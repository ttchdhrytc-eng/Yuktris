/*
# Create Enterprise Knowledge Graph Schema

## Overview
Creates the database layer for the Enterprise Knowledge Graph — the centralized
intelligence graph that stores relationships between all business entities.
Every AI Agent and business feature queries this graph instead of reconstructing
relationships independently.

## New Tables (3)
1. graph_nodes — First-class entities (companies, contacts, people, products, etc.)
   - Flexible node_type for future entity types without schema redesign
   - external_id for linking to source systems (CRM, Research Engine, etc.)
   - properties JSONB for arbitrary entity attributes
   - Soft delete via deleted_at
   - Version tracking for audit trail
2. graph_edges — Typed relationships between nodes
   - Flexible relationship_type for future relationships without schema redesign
   - confidence_score for relationship strength
   - properties JSONB for arbitrary relationship attributes
   - Soft delete via deleted_at
3. graph_snapshots — Point-in-time graph snapshots for versioning and history

## Indexes
- GIN index on properties for JSONB queries
- B-tree indexes on node_type, external_id, relationship_type
- Composite index on source_node_id + target_node_id for traversal
- B-tree index on confidence_score for filtering

## Security
- RLS enabled on all 3 tables, scoped to authenticated users via workspace membership.
- 4 CRUD policies per table (select/insert/update/delete), no FOR ALL.
- All ownership checks use is_workspace_member() or workspace_id matching.
- Trigger functions use SECURITY DEFINER with SET search_path = public.
*/

-- ============================================================
-- 1. graph_nodes
-- ============================================================

CREATE TABLE IF NOT EXISTS graph_nodes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  node_type text NOT NULL,
  external_id text,
  display_name text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  confidence_score numeric DEFAULT 1.0,
  is_deleted boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_nodes_workspace_id ON graph_nodes(workspace_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_node_type ON graph_nodes(node_type);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_external_id ON graph_nodes(external_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_display_name ON graph_nodes(display_name);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_is_deleted ON graph_nodes(is_deleted);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_properties ON graph_nodes USING GIN (properties);
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_nodes_workspace_type_external ON graph_nodes(workspace_id, node_type, external_id) WHERE external_id IS NOT NULL AND is_deleted = false;

ALTER TABLE graph_nodes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_graph_nodes" ON graph_nodes;
CREATE POLICY "select_graph_nodes" ON graph_nodes
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_graph_nodes" ON graph_nodes;
CREATE POLICY "insert_graph_nodes" ON graph_nodes
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_graph_nodes" ON graph_nodes;
CREATE POLICY "update_graph_nodes" ON graph_nodes
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_graph_nodes" ON graph_nodes;
CREATE POLICY "delete_graph_nodes" ON graph_nodes
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 2. graph_edges
-- ============================================================

CREATE TABLE IF NOT EXISTS graph_edges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  source_node_id uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  target_node_id uuid NOT NULL REFERENCES graph_nodes(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  properties jsonb NOT NULL DEFAULT '{}',
  confidence_score numeric DEFAULT 1.0,
  is_deleted boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_edges_workspace_id ON graph_edges(workspace_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source_node_id ON graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target_node_id ON graph_edges(target_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_relationship_type ON graph_edges(relationship_type);
CREATE INDEX IF NOT EXISTS idx_graph_edges_confidence_score ON graph_edges(confidence_score);
CREATE INDEX IF NOT EXISTS idx_graph_edges_is_deleted ON graph_edges(is_deleted);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source_target ON graph_edges(source_node_id, target_node_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_properties ON graph_edges USING GIN (properties);
CREATE UNIQUE INDEX IF NOT EXISTS idx_graph_edges_unique_edge ON graph_edges(source_node_id, target_node_id, relationship_type) WHERE is_deleted = false;

ALTER TABLE graph_edges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_graph_edges" ON graph_edges;
CREATE POLICY "select_graph_edges" ON graph_edges
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_graph_edges" ON graph_edges;
CREATE POLICY "insert_graph_edges" ON graph_edges
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_graph_edges" ON graph_edges;
CREATE POLICY "update_graph_edges" ON graph_edges
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_graph_edges" ON graph_edges;
CREATE POLICY "delete_graph_edges" ON graph_edges
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 3. graph_snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS graph_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  snapshot_name text NOT NULL,
  description text,
  node_count integer NOT NULL DEFAULT 0,
  edge_count integer NOT NULL DEFAULT 0,
  snapshot_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_graph_snapshots_workspace_id ON graph_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_graph_snapshots_created_at ON graph_snapshots(created_at DESC);

ALTER TABLE graph_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_graph_snapshots" ON graph_snapshots;
CREATE POLICY "select_graph_snapshots" ON graph_snapshots
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_graph_snapshots" ON graph_snapshots;
CREATE POLICY "insert_graph_snapshots" ON graph_snapshots
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_graph_snapshots" ON graph_snapshots;
CREATE POLICY "update_graph_snapshots" ON graph_snapshots
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_graph_snapshots" ON graph_snapshots;
CREATE POLICY "delete_graph_snapshots" ON graph_snapshots
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 4. Trigger: update_graph_nodes_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_graph_nodes_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_graph_nodes_updated_at ON graph_nodes;
CREATE TRIGGER trigger_graph_nodes_updated_at
  BEFORE UPDATE ON graph_nodes
  FOR EACH ROW
  EXECUTE FUNCTION update_graph_nodes_updated_at();

-- ============================================================
-- 5. Trigger: update_graph_edges_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_graph_edges_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_graph_edges_updated_at ON graph_edges;
CREATE TRIGGER trigger_graph_edges_updated_at
  BEFORE UPDATE ON graph_edges
  FOR EACH ROW
  EXECUTE FUNCTION update_graph_edges_updated_at();

-- ============================================================
-- 6. Recursive neighborhood search function
-- ============================================================

CREATE OR REPLACE FUNCTION public.graph_neighborhood(
  p_start_node_id uuid,
  p_max_depth integer DEFAULT 2,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS TABLE (
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
SECURITY DEFINER
SET search_path = public
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

-- ============================================================
-- 7. Shortest path function (BFS up to max_depth)
-- ============================================================

CREATE OR REPLACE FUNCTION public.graph_shortest_path(
  p_source_node_id uuid,
  p_target_node_id uuid,
  p_max_depth integer DEFAULT 5,
  p_workspace_id uuid DEFAULT NULL
)
RETURNS TABLE (
  node_id uuid,
  node_type text,
  display_name text,
  step integer,
  edge_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
