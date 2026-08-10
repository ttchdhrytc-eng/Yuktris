-- Fix 1: Tighten the always-true RLS INSERT policy on workspaces
-- The WITH CHECK (true) allowed any authenticated user to insert any workspace.
-- Restrict to: the inserting user must be the owner.
DROP POLICY IF EXISTS "insert_own_workspaces" ON public.workspaces;
CREATE POLICY "insert_own_workspaces" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Fix 2: Revoke EXECUTE on SECURITY DEFINER functions from anon and PUBLIC
-- get_google_secret — reads vault secrets; must never be callable by anon
REVOKE EXECUTE ON FUNCTION public.get_google_secret(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_google_secret(text) FROM PUBLIC;

-- handle_new_user — SECURITY DEFINER trigger called only by pg auth trigger; anon must not call it
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;

-- is_workspace_member — used internally by RLS policies; restrict to authenticated only
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid) TO authenticated;
