/*
# Restore EXECUTE on is_workspace_member for authenticated role

## Summary
Re-grants EXECUTE on `is_workspace_member()` to the `authenticated` role.
This was revoked in the previous migration, which broke all RLS policies
that reference the function — any insert/update/select by a signed-in user
fails with "permission denied for function is_workspace_member".

## Why this is necessary
`is_workspace_member()` is called inside RLS policies on `workspace_members`,
`graph_nodes`, `graph_edges`, and other tables. When an authenticated user
queries those tables, Postgres evaluates the RLS policy, which calls
`is_workspace_member()`. Without EXECUTE permission, the policy itself fails.

## Why this is safe
- The function only checks whether `auth.uid()` (the current caller) is a
  member of the given workspace. It returns a boolean — no sensitive data.
- `anon` still has NO execute permission, so unauthenticated users cannot
  call it via RPC.
- The function remains SECURITY DEFINER to avoid infinite RLS recursion.

## Changes
- GRANT EXECUTE ON FUNCTION is_workspace_member TO authenticated
*/

GRANT EXECUTE ON FUNCTION public.is_workspace_member(check_workspace_id uuid) TO authenticated;