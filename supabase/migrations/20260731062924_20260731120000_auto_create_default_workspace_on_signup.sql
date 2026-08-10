/*
# Auto-Create Default Workspace on Signup

## Root Cause Fixed
The `handle_new_user()` trigger (in 20260724053604) only created a `profiles` row
when a new user signed up. It did NOT create a workspace or workspace_members row.
This meant every new user had:
  - a profile (yes)
  - a workspace (NO)
  - a workspace membership (NO)

When the user reached the Gmail/Calendar connect steps in onboarding (which come
BEFORE the "Business Details" step that calls `activationService.createWorkspaceFromWebsite`),
the `useConnectGoogle` hook threw `Error('No workspace or user')` because
`useWorkspace().workspace` was null. The user saw "Google authentication failed."
and the console showed "No workspace or user".

## Changes

### 1. Replace `handle_new_user()` trigger function
The updated function now:
  a) Inserts the profile row (as before).
  b) Creates a default workspace named "My Workspace" with slug auto-generated
     by the existing `generate_workspace_slug()` function.
  c) Creates a `workspace_members` row linking the new user as `owner`.
  d) Sets `profiles.workspace_id` and `profiles.role = 'owner'`.

### 2. Idempotency
The function checks whether a workspace already exists for the user before
creating one, so it is safe to re-run.

### 3. Security
The function is `SECURITY DEFINER` (runs as the postgres role) so it can insert
into `workspaces` and `workspace_members` during the auth trigger, before the
user has an authenticated session. `search_path = public` for safety.
*/

-- ============================================================
-- 1. Replace handle_new_user to also create a default workspace
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  ws_id uuid;
  full_name text;
  first_name text;
  last_name text;
BEGIN
  full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email);

  first_name := split_part(full_name, ' ', 1);
  last_name := CASE
    WHEN position(' ' in full_name) > 0
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE NULL
  END;

  -- 1. Insert profile (idempotent)
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email, first_name, last_name)
  ON CONFLICT (id) DO NOTHING;

  -- 2. Check if user already has a workspace
  SELECT w.id INTO ws_id
  FROM public.workspaces w
  JOIN public.workspace_members wm ON wm.workspace_id = w.id
  WHERE wm.user_id = NEW.id AND wm.status = 'active'
  LIMIT 1;

  -- 3. If no workspace, create one + membership
  IF ws_id IS NULL THEN
    INSERT INTO public.workspaces (name, owner_id, onboarding_completed)
    VALUES ('My Workspace', NEW.id, false)
    RETURNING id INTO ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (ws_id, NEW.id, 'owner', 'active')
    ON CONFLICT DO NOTHING;

    -- Link profile to workspace
    UPDATE public.profiles
    SET workspace_id = ws_id, role = 'owner'
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-link the trigger (drop + recreate to pick up new function body)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 2. Backfill: create workspaces for existing users who lack one
-- ============================================================

DO $$
DECLARE
  u RECORD;
  ws_id uuid;
BEGIN
  FOR u IN
    SELECT p.id, p.email
    FROM public.profiles p
    WHERE p.workspace_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.workspace_members wm
        WHERE wm.user_id = p.id AND wm.status = 'active'
      )
  LOOP
    INSERT INTO public.workspaces (name, owner_id, onboarding_completed)
    VALUES ('My Workspace', u.id, false)
    RETURNING id INTO ws_id;

    INSERT INTO public.workspace_members (workspace_id, user_id, role, status)
    VALUES (ws_id, u.id, 'owner', 'active')
    ON CONFLICT DO NOTHING;

    UPDATE public.profiles
    SET workspace_id = ws_id, role = 'owner'
    WHERE id = u.id;
  END LOOP;
END $$;
