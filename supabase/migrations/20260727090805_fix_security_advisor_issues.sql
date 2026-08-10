/*
# Fix Security Advisor Issues

## Overview
Resolves 10 security warnings flagged by the Supabase Security Advisor:
1 mutable search_path function, 2 permissive RLS policies on
asset_tag_map, and 7 SECURITY DEFINER function execution issues.

## Changes

### 1. Mutable search_path on update_updated_at_column
The trigger function `update_updated_at_column()` was created without
an immutable `search_path` setting. Added `SET search_path = public`
to the function body so the search_path cannot be hijacked.

### 2. Permissive RLS on asset_tag_map
The `delete_asset_tag_map` and `insert_asset_tag_map` policies used
`USING(true)` / `WITH CHECK(true)`, allowing any authenticated user
to modify any tag mapping. Replaced with workspace-ownership checks
that join through `proposal_assets` to verify the authenticated user
owns the workspace the asset belongs to.

### 3. SECURITY DEFINER function execution
- `get_google_secret`: Revoked EXECUTE from `authenticated` and `anon`.
  This function reads from vault and must only run server-side (edge
  functions use the service role, which bypasses RLS).
- `handle_new_user`: Revoked EXECUTE from `authenticated` and `anon`.
  This is a trigger function called on new user signup — it runs via
  the trigger, not via REST RPC.
- `is_workspace_member`: Revoked EXECUTE from `authenticated` and
  `anon`. This is a helper used by other RLS policies, not callable
  directly.
- `graph_neighborhood`: Revoked EXECUTE from `anon` only. Kept
  EXECUTE on `authenticated` because the frontend calls this via
  `.rpc()` from the Knowledge Graph page. The function already has
  `SET search_path = public` and accepts a workspace_id parameter
  for scoping.
- `graph_shortest_path`: Same as graph_neighborhood — revoke anon,
  keep authenticated.

## Security
- Trigger function search_path is now immutable.
- asset_tag_map CRUD is now scoped to workspace ownership.
- Sensitive vault-access and trigger functions are no longer
  callable via REST API.
- Graph traversal functions remain available to signed-in users
  (who already pass workspace_id) but are blocked for anonymous
  access.
*/

-- ============================================================
-- 1. Fix mutable search_path on update_updated_at_column
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Fix permissive RLS on asset_tag_map
-- ============================================================

DROP POLICY IF EXISTS "delete_asset_tag_map" ON asset_tag_map;
CREATE POLICY "delete_asset_tag_map" ON asset_tag_map
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM proposal_assets
    WHERE proposal_assets.id = asset_tag_map.asset_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = proposal_assets.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "insert_asset_tag_map" ON asset_tag_map;
CREATE POLICY "insert_asset_tag_map" ON asset_tag_map
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM proposal_assets
    WHERE proposal_assets.id = asset_tag_map.asset_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = proposal_assets.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

-- ============================================================
-- 3. Revoke EXECUTE on sensitive SECURITY DEFINER functions
-- ============================================================

-- get_google_secret: server-side only (reads vault)
REVOKE EXECUTE ON FUNCTION public.get_google_secret(text) FROM authenticated, anon;

-- handle_new_user: trigger-only (not callable via RPC)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated, anon;

-- is_workspace_member: helper for RLS policies, not direct call
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid) FROM authenticated, anon;

-- graph_neighborhood: keep for authenticated (frontend uses it), block anon
REVOKE EXECUTE ON FUNCTION public.graph_neighborhood(uuid, integer, uuid) FROM anon;

-- graph_shortest_path: keep for authenticated (frontend uses it), block anon
REVOKE EXECUTE ON FUNCTION public.graph_shortest_path(uuid, uuid, integer, uuid) FROM anon;
