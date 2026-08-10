/*
# Fix workspace creation: trigger permission + members query relationship

## Issue 1: "permission denied for function generate_workspace_slug"
set_workspace_slug is SECURITY INVOKER, so when an authenticated user
INSERTs a workspace, the trigger runs as that user and calls
generate_workspace_slug (SECURITY DEFINER), but the user lacks EXECUTE.
Fix: make set_workspace_slug SECURITY DEFINER.

## Issue 2: "Could not find a relationship between workspace_members and profiles"
The query profiles!workspace_members_user_id_fkey(*) assumes a FK from
workspace_members.user_id to profiles.id, but the actual FK points to
auth.users.id. PostgREST cannot infer the join through auth.users.
Fix: add a FK from workspace_members.user_id to profiles(id) as NOT VALID
so existing rows without matching profiles are not rejected, but new
inserts/updates are checked.
*/

-- ============================================================
-- Fix 1: Make trigger function SECURITY DEFINER
-- ============================================================

CREATE OR REPLACE FUNCTION public.set_workspace_slug()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    NEW.slug := public.generate_workspace_slug(NEW.name);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============================================================
-- Fix 2: Add FK from workspace_members.user_id to profiles.id (NOT VALID)
-- ============================================================

DO $$ BEGIN
  ALTER TABLE public.workspace_members
    ADD CONSTRAINT workspace_members_user_id_profiles_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
    NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
