/*
# Fix workspaces RLS — chicken-and-egg on workspace creation

## Root Cause
OnboardingPage does:

  const { data: ws } = supabase
    .from('workspaces')
    .insert({ name, website, ... })
    .select()     // ← RETURNING * is subject to SELECT RLS policy
    .single();

The INSERT policy (`WITH CHECK (true)`) passes, but the RETURNING
clause is filtered by the SELECT policy `is_workspace_member(id)`.
At that instant, the workspace_members row does NOT exist yet
(it's inserted in the next statement), so `is_workspace_member`
returns false, RETURNING yields zero rows, and PostgREST surfaces
"new row violates row-level security policy for table workspaces".

## Fix
1. Add `owner_id uuid` column to workspaces (references auth.users.id).
   This directly links a workspace to its creator.
2. Update the SELECT policy to allow access when the caller is the
   owner OR is a workspace member — so the just-inserted row is
   immediately visible to its creator.
3. Update UPDATE and DELETE policies the same way.
4. Backfill any existing rows with a NULL owner_id (no data loss).

After this, the `.insert({ ..., owner_id: user.id }).select().single()`
call in OnboardingPage will succeed because `owner_id = auth.uid()`
satisfies the SELECT policy immediately, before workspace_members
is populated.
*/

-- ============================================================
-- 1. Add owner_id column
-- ============================================================

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ============================================================
-- 2. Update SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "select_own_workspaces" ON workspaces;
CREATE POLICY "select_own_workspaces" ON workspaces FOR SELECT
  TO authenticated USING (
    is_workspace_member(id) OR owner_id = auth.uid()
  );

-- ============================================================
-- 3. Update UPDATE policy
-- ============================================================

DROP POLICY IF EXISTS "update_own_workspaces" ON workspaces;
CREATE POLICY "update_own_workspaces" ON workspaces FOR UPDATE
  TO authenticated
  USING (is_workspace_member(id) OR owner_id = auth.uid())
  WITH CHECK (is_workspace_member(id) OR owner_id = auth.uid());

-- ============================================================
-- 4. Update DELETE policy (owner or workspace owner can delete)
-- ============================================================

DROP POLICY IF EXISTS "delete_own_workspaces" ON workspaces;
CREATE POLICY "delete_own_workspaces" ON workspaces FOR DELETE
  TO authenticated USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role = 'owner'
    )
  );

-- ============================================================
-- 5. Index on owner_id for performance
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);