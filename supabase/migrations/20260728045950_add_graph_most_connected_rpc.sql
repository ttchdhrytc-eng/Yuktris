/*
# Add graph_most_connected RPC to Knowledge Graph

## Overview
Adds the missing `graph_most_connected` RPC function that GraphAnalyticsService
calls to find the most connected nodes in the knowledge graph. The service code
already calls this RPC with a .catch() fallback to JS computation — this migration
makes the RPC available so the database-side query runs instead of the fallback.

## RPC: graph_most_connected
- Parameters: p_workspace_id (uuid, nullable), p_limit (integer, default 10)
- Returns: TABLE(node_id uuid, display_name text, degree bigint)
- Computes node degree by counting all non-deleted edges (both source and target)
  per node, then returns the top N ordered by degree descending.
- SECURITY DEFINER with SET search_path = public, matching the convention of
  the existing graph_neighborhood and graph_shortest_path functions.

## Security
- The function is SECURITY DEFINER so it can read graph_edges and graph_nodes
  regardless of the caller's RLS context. The p_workspace_id parameter scopes
  results to the caller's workspace (or all if NULL, matching the global-data
  convention used throughout the graph schema).
*/

CREATE OR REPLACE FUNCTION public.graph_most_connected(
  p_workspace_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  node_id uuid,
  display_name text,
  degree bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    gn.id AS node_id,
    gn.display_name AS display_name,
    degree.degree
  FROM (
    SELECT node_id, SUM(edge_count) AS degree
    FROM (
      SELECT source_node_id AS node_id, COUNT(*) AS edge_count
      FROM graph_edges
      WHERE is_deleted = false
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      GROUP BY source_node_id

      UNION ALL

      SELECT target_node_id AS node_id, COUNT(*) AS edge_count
      FROM graph_edges
      WHERE is_deleted = false
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      GROUP BY target_node_id
    ) AS combined
    GROUP BY node_id
  ) AS degree
  JOIN graph_nodes gn ON gn.id = degree.node_id
  WHERE gn.is_deleted = false
  ORDER BY degree.degree DESC
  LIMIT p_limit;
END;
$function$;
