/*
# Revoke PUBLIC EXECUTE on Security Functions

## Summary
Removes the default PUBLIC grant on functions that were still exposed via
PostgREST despite role-specific revokes. The default `GRANT EXECUTE TO PUBLIC`
overrides individual role revokes.

## Changes

### 1. Graph query functions — REVOKE FROM PUBLIC, GRANT TO authenticated
- `graph_most_connected`
- `graph_neighborhood`
- `graph_shortest_path`

These are called from the frontend via `supabase.rpc()` by authenticated users.
We revoke the blanket PUBLIC grant and grant EXECUTE only to `authenticated`.
Anon (unauthenticated) users cannot call these RPC endpoints.

### 2. `update_updated_at_column` — REVOKE FROM PUBLIC
Trigger function, never called via RPC. Removing the PUBLIC grant ensures it
is not exposed as an endpoint. Triggers use the owner's privileges internally.

## Security
- Anon role can no longer execute any of these functions via PostgREST
- Authenticated users can still call graph query functions (needed by frontend)
- `update_updated_at_column` is not callable by any non-internal role
*/

-- ============================================================
-- 1. Graph query functions: revoke PUBLIC, grant to authenticated only
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.graph_most_connected(p_workspace_id uuid, p_limit integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.graph_neighborhood(p_start_node_id uuid, p_max_depth integer, p_workspace_id uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.graph_shortest_path(p_source_node_id uuid, p_target_node_id uuid, p_max_depth integer, p_workspace_id uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.graph_most_connected(p_workspace_id uuid, p_limit integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.graph_neighborhood(p_start_node_id uuid, p_max_depth integer, p_workspace_id uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.graph_shortest_path(p_source_node_id uuid, p_target_node_id uuid, p_max_depth integer, p_workspace_id uuid) TO authenticated;

-- ============================================================
-- 2. update_updated_at_column: revoke PUBLIC (no re-grant needed)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC;