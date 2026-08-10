/*
# Fix is_workspace_member SECURITY DEFINER advisory

## Summary
Switches `is_workspace_member()` from SECURITY DEFINER to SECURITY INVOKER
to resolve the Supabase security advisor warning. The function was
SECURITY DEFINER to avoid infinite RLS recursion on `workspace_members`.
This migration breaks the recursion by changing the `workspace_members`
SELECT policy to a direct `user_id = auth.uid()` check instead of calling
`is_workspace_member()`.

## Why this is safe
1. `is_workspace_member()` only checks whether `auth.uid()` (the current
   caller) is a member of the given workspace. It returns a boolean — no
   sensitive data is exposed. With INVOKER, even if a user calls it
   directly via RPC, it runs as themselves with no privilege escalation.
2. The recursion that originally required SECURITY DEFINER is broken:
   - `workspace_members` SELECT policy now uses `user_id = auth.uid()`
     (no function call, no recursion).
   - All other tables' policies call `is_workspace_member()`, which
     queries `workspace_members` as the invoker. RLS on `workspace_members`
     filters to the user's own rows. The EXISTS check works correctly.
     No recursion because `workspace_members` SELECT policy no longer
     calls the function.
3. EXECUTE remains granted to `authenticated` because RLS policy
   expressions require the caller to have EXECUTE permission on any
   function they reference. This is safe with INVOKER — the function
     runs as the caller, not as the owner.

## Changes
1. Replace `workspace_members` SELECT policy with direct ownership check.
2. Recreate `is_workspace_member()` as SECURITY INVOKER with locked
   search_path to prevent search_path injection.
*/

-- 1. Break recursion: workspace_members SELECT policy uses direct check
DROP POLICY IF EXISTS "select_own_members" ON workspace_members;
CREATE POLICY "select_own_members" ON workspace_members FOR SELECT
  TO authenticated USING (user_id = auth.uid());

-- 2. Switch is_workspace_member to SECURITY INVOKER with locked search_path
CREATE OR REPLACE FUNCTION public.is_workspace_member(check_workspace_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = check_workspace_id
    AND workspace_members.user_id = auth.uid()
  );
$$;

-- 3. Ensure EXECUTE is granted to authenticated (needed for RLS policies)
--    and revoked from anon/PUBLIC (unauthenticated users should not call it)
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(check_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(check_workspace_id uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(check_workspace_id uuid) TO authenticated;
