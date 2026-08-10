/*
# Fix SECURITY DEFINER Function Permissions

## Summary
Fixes security advisor warnings where SECURITY DEFINER functions were
executable by `anon` and/or `authenticated` roles via the PostgREST API.

## Changes

### 1. Graph query functions → SECURITY INVOKER
- `graph_most_connected` — switched from SECURITY DEFINER to SECURITY INVOKER
- `graph_neighborhood` — switched from SECURITY DEFINER to SECURITY INVOKER
- `graph_shortest_path` — switched from SECURITY DEFINER to SECURITY INVOKER

These functions only read from `graph_nodes` and `graph_edges`, which already
have RLS policies scoped to `is_workspace_member()`. With INVOKER, the caller's
RLS policies apply naturally — SECURITY DEFINER was bypassing RLS unnecessarily.

### 2. `is_workspace_member` — kept SECURITY DEFINER, revoked public access
This function is used inside RLS policies on `workspace_members` itself, creating
a circular dependency. It MUST remain SECURITY DEFINER to avoid infinite recursion.
However, it should not be callable via the REST API by anyone. We revoke EXECUTE
from `anon` and `authenticated` so it can only be used internally by the database
(in RLS policies), not exposed as an RPC endpoint.

### 3. `update_updated_at_column` — revoked all direct EXECUTE
This is a trigger function called by triggers, not by users. It should never be
invoked via RPC. We revoke EXECUTE from `anon` and `authenticated` so it is not
exposed as an RPC endpoint. The trigger mechanism uses the function owner's
privileges, so triggers continue to work.

## Security
- Graph query functions now respect caller RLS policies (SECURITY INVOKER)
- `is_workspace_member` no longer exposed as a callable RPC endpoint
- `update_updated_at_column` no longer exposed as a callable RPC endpoint
- Internal trigger and RLS policy usage of these functions is unaffected

## Notes
1. `is_workspace_member` must remain SECURITY DEFINER because it is called from
   RLS policies on `workspace_members` — switching to INVOKER would cause
   infinite recursion (the policy on workspace_members calls is_workspace_member,
   which queries workspace_members, which triggers the policy again).
2. `update_updated_at_column` is a trigger function; triggers execute with the
   function owner's privileges regardless of EXECUTE grants, so revoking
   EXECUTE from anon/authenticated does not affect trigger behavior.
3. All changes are idempotent — REVOKE is safe to run multiple times.
*/

-- ============================================================
-- 1. Switch graph query functions to SECURITY INVOKER
-- ============================================================

CREATE OR REPLACE FUNCTION public.graph_most_connected(
  p_workspace_id uuid DEFAULT NULL::uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(node_id uuid, display_name text, degree bigint)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    gn.id AS node_id,
    gn.display_name AS display_name,
    degree_calc.deg::bigint AS degree
  FROM (
    SELECT n_id, SUM(edge_count)::bigint AS deg
    FROM (
      SELECT source_node_id AS n_id, COUNT(*)::bigint AS edge_count
      FROM graph_edges
      WHERE is_deleted = false
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      GROUP BY source_node_id

      UNION ALL

      SELECT target_node_id AS n_id, COUNT(*)::bigint AS edge_count
      FROM graph_edges
      WHERE is_deleted = false
      AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      GROUP BY target_node_id
    ) AS combined
    GROUP BY n_id
  ) AS degree_calc
  JOIN graph_nodes gn ON gn.id = degree_calc.n_id
  WHERE gn.is_deleted = false
  ORDER BY degree_calc.deg DESC
  LIMIT p_limit;
END;
$function$;

CREATE OR REPLACE FUNCTION public.graph_neighborhood(
  p_start_node_id uuid,
  p_max_depth integer DEFAULT 2,
  p_workspace_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  node_id uuid,
  node_type text,
  display_name text,
  depth integer,
  edge_id uuid,
  edge_type text,
  source_node_id uuid,
  confidence_score numeric
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE traversal AS (
    -- Base case: direct neighbors
    SELECT
      ge.target_node_id AS node_id,
      gn.node_type,
      gn.display_name,
      1 AS depth,
      ge.id AS edge_id,
      ge.relationship_type AS edge_type,
      ge.source_node_id,
      ge.confidence_score
    FROM graph_edges ge
    JOIN graph_nodes gn ON gn.id = ge.target_node_id
    WHERE ge.source_node_id = p_start_node_id
    AND ge.is_deleted = false
    AND gn.is_deleted = false
    AND (p_workspace_id IS NULL OR ge.workspace_id = p_workspace_id)

    UNION ALL

    -- Recursive case: neighbors of neighbors
    SELECT
      ge.target_node_id AS node_id,
      gn.node_type,
      gn.display_name,
      t.depth + 1,
      ge.id AS edge_id,
      ge.relationship_type AS edge_type,
      ge.source_node_id,
      ge.confidence_score
    FROM graph_edges ge
    JOIN graph_nodes gn ON gn.id = ge.target_node_id
    JOIN traversal t ON t.node_id = ge.source_node_id
    WHERE t.depth < p_max_depth
    AND ge.is_deleted = false
    AND gn.is_deleted = false
    AND ge.target_node_id != p_start_node_id
    AND (p_workspace_id IS NULL OR ge.workspace_id = p_workspace_id)
  )
  SELECT DISTINCT ON (node_id)
    node_id, node_type, display_name, depth, edge_id, edge_type, source_node_id, confidence_score
  FROM traversal
  ORDER BY node_id, depth;
END;
$function$;

CREATE OR REPLACE FUNCTION public.graph_shortest_path(
  p_source_node_id uuid,
  p_target_node_id uuid,
  p_max_depth integer DEFAULT 5,
  p_workspace_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(node_id uuid, node_type text, display_name text, step integer, edge_type text)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH RECURSIVE bfs AS (
    -- Base: start node
    SELECT
      p_source_node_id AS node_id,
      gn.node_type,
      gn.display_name,
      0 AS step,
      ''::text AS edge_type,
      ARRAY[p_source_node_id] AS path
    FROM graph_nodes gn
    WHERE gn.id = p_source_node_id

    UNION ALL

    -- Recursive: expand neighbors
    SELECT
      ge.target_node_id AS node_id,
      gn.node_type,
      gn.display_name,
      b.step + 1,
      ge.relationship_type AS edge_type,
      b.path || ge.target_node_id
    FROM bfs b
    JOIN graph_edges ge ON ge.source_node_id = b.node_id
    JOIN graph_nodes gn ON gn.id = ge.target_node_id
    WHERE b.step < p_max_depth
    AND ge.is_deleted = false
    AND gn.is_deleted = false
    AND NOT (ge.target_node_id = ANY(b.path))
    AND (p_workspace_id IS NULL OR ge.workspace_id = p_workspace_id)
  )
  SELECT node_id, node_type, display_name, step, edge_type
  FROM bfs
  WHERE node_id = p_target_node_id
  ORDER BY step
  LIMIT 1;
END;
$function$;

-- ============================================================
-- 2. Revoke EXECUTE on is_workspace_member from anon and authenticated
--    (must stay SECURITY DEFINER for RLS circular dependency)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.is_workspace_member(check_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(check_workspace_id uuid) FROM authenticated;

-- ============================================================
-- 3. Revoke EXECUTE on update_updated_at_column from anon and authenticated
--    (trigger function, never called via RPC)
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM authenticated;

-- Also revoke from graph functions since they are now INVOKER and called via RPC
-- by authenticated users only (RLS will enforce workspace scoping)
REVOKE EXECUTE ON FUNCTION public.graph_most_connected(p_workspace_id uuid, p_limit integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.graph_neighborhood(p_start_node_id uuid, p_max_depth integer, p_workspace_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.graph_shortest_path(p_source_node_id uuid, p_target_node_id uuid, p_max_depth integer, p_workspace_id uuid) FROM anon;