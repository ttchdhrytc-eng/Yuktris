/*
# Create Authentication Infrastructure (Phase 2)

## Overview
Creates the complete authentication infrastructure for Revenue AI:
profiles table, invitations table, handle_new_user trigger, and
updates workspaces/workspace_members with new columns.

## New Tables (2)
1. profiles — User profile data linked to auth.users.
2. invitations — Workspace invitation system.

## Modified Tables (2)
1. workspaces — Added slug, logo, plan, status columns.
2. workspace_members — Added status, joined_at, expanded role constraint.

## Security
- RLS enabled on profiles and invitations.
- profiles: users can read/update their own profile only.
- invitations: workspace members can read; only owner/admin can insert/update/delete.
- handle_new_user trigger auto-creates a profile row on signup.
*/

-- ============================================================
-- 1. Update workspaces table
-- ============================================================

DO $$ BEGIN
  ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS slug text;
  ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS logo text;
  ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'starter', 'growth', 'enterprise'));
  ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'deleted'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION generate_workspace_slug(ws_name text)
RETURNS text AS $$
DECLARE
  base_slug text;
  candidate_slug text;
  counter integer := 0;
BEGIN
  base_slug := lower(regexp_replace(ws_name, '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  base_slug := CASE WHEN base_slug = '' THEN 'workspace' ELSE base_slug END;
  LOOP
    candidate_slug := CASE WHEN counter = 0 THEN base_slug ELSE base_slug || '-' || counter END;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM workspaces w WHERE w.slug = candidate_slug);
    counter := counter + 1;
  END LOOP;
  RETURN candidate_slug;
END;
$$ LANGUAGE plpgsql;

UPDATE workspaces SET slug = generate_workspace_slug(name) WHERE slug IS NULL;

DO $$ BEGIN
  ALTER TABLE workspaces ALTER COLUMN slug SET NOT NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspaces_slug ON workspaces(slug);

-- ============================================================
-- 2. Update workspace_members
-- ============================================================

DO $$ BEGIN
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'removed'));
  ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS joined_at timestamptz NOT NULL DEFAULT now();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
  ALTER TABLE workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('owner', 'admin', 'manager', 'sales_rep', 'viewer'));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- 3. profiles table
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  first_name text,
  last_name text,
  avatar text,
  email text NOT NULL,
  phone text,
  timezone text NOT NULL DEFAULT 'America/New_York',
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'manager', 'sales_rep', 'viewer')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'invited', 'suspended', 'deleted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_workspace_id ON profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ============================================================
-- 4. invitations table
-- ============================================================

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'admin', 'manager', 'sales_rep', 'viewer')),
  token text NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace_id ON invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON invitations(email);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON invitations(token);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_invitations" ON invitations;
CREATE POLICY "select_own_invitations" ON invitations
  FOR SELECT TO authenticated
  USING (
    is_workspace_member(workspace_id)
    OR email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "insert_own_invitations" ON invitations;
CREATE POLICY "insert_own_invitations" ON invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invitations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_own_invitations" ON invitations;
CREATE POLICY "update_own_invitations" ON invitations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invitations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invitations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_own_invitations" ON invitations;
CREATE POLICY "delete_own_invitations" ON invitations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = invitations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 5. handle_new_user trigger
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    split_part(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), ' ', 1),
    CASE
      WHEN position(' ' in COALESCE(NEW.raw_user_meta_data->>'full_name', '')) > 0
      THEN substring(COALESCE(NEW.raw_user_meta_data->>'full_name', '') from position(' ' in COALESCE(NEW.raw_user_meta_data->>'full_name', '')) + 1)
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 6. update_profile_updated_at trigger
-- ============================================================

CREATE OR REPLACE FUNCTION update_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_profile_updated_at ON profiles;
CREATE TRIGGER trigger_profile_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_profile_updated_at();