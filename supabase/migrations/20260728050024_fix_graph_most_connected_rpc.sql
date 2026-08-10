/*
# Fix graph_most_connected RPC ambiguous column reference

## Overview
The initial graph_most_connected RPC had an ambiguous column reference:
the inner subquery aliased columns as `node_id`, which collided with the
PL/pgSQL function's output column name `node_id`. This migration re-creates
the function with disambiguated column aliases (`n_id`, `deg`) in the
inner queries to eliminate the ambiguity.

## Changes
- DROP and re-CREATE `public.graph_most_connected` with fixed column aliases
- No table changes, no data changes
*/

DROP FUNCTION IF EXISTS public.graph_most_connected(uuid, integer);

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
    degree_calc.deg AS degree
  FROM (
    SELECT n_id, SUM(edge_count) AS deg
    FROM (
      SELECT source_node_id AS n_id, COUNT(*) AS edge_count
      FROM graph_edges
      WHERE is_deleted = false
        AND (p_workspace_id IS NULL OR workspace_id = p_workspace_id)
      GROUP BY source_node_id

      UNION ALL

      SELECT target_node_id AS n_id, COUNT(*) AS edge_count
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
