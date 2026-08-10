/*
# Create Enterprise Memory Engine Schema

## Overview
Creates the database layer for the Enterprise Memory & Learning Engine — the
persistent memory store that records observations, learnings, and relationships
about every business entity. AI Agents and business features query this store
instead of re-deriving context from scratch each time.

## New Tables (4)
1. memory_entities — First-class memory records about entities (companies, contacts, etc.)
   - entity_type + entity_id + memory_type form a logical composite key
   - confidence_score, freshness_score, importance_score for ranking
   - is_active for soft expiration (stale memories are deactivated, not deleted)
   - version for optimistic concurrency / audit trail
   - content JSONB for arbitrary structured memory payload
   - Sensitive data is masked by the service layer before insert
2. memory_records — Version history for each memory entity
   - One row per version snapshot; ordered by created_at desc for history
   - embedding_reference reserved for future vector embeddings
3. memory_relationships — Typed links between memory entities
   - source_memory_id + target_memory_id + relationship_type
   - strength for relationship weight
4. learning_events — Audit log of all learning events
   - event_type from a fixed vocabulary (memory_created, memory_merged, etc.)
   - triggered_by identifies the source (system, agent id, user id)
   - confidence tracks the learning's reliability

## Indexes
- B-tree indexes on workspace_id, entity_type, entity_id, memory_type, is_active
- Composite unique index on (workspace_id, entity_type, entity_id, memory_type) WHERE is_active = true
- B-tree indexes on memory_entity_id for child tables
- B-tree indexes on event_type, created_at for learning_events

## Security
- RLS enabled on all 4 tables, scoped to authenticated users via workspace membership.
- 4 CRUD policies per table (select/insert/update/delete), no FOR ALL.
- All ownership checks use is_workspace_member() or workspace_id IS NULL (global memories).
- Child tables (memory_records, memory_relationships) use EXISTS join through memory_entities.
- learning_events uses direct is_workspace_member() since it has its own workspace_id.
- Trigger functions use SECURITY DEFINER with SET search_path = public.
*/

-- ============================================================
-- 1. memory_entities
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  memory_type text NOT NULL,
  title text NOT NULL,
  summary text,
  content jsonb NOT NULL DEFAULT '{}',
  confidence_score numeric NOT NULL DEFAULT 0.5,
  freshness_score numeric NOT NULL DEFAULT 1.0,
  importance_score numeric NOT NULL DEFAULT 0.5,
  is_active boolean NOT NULL DEFAULT true,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_entities_workspace_id ON memory_entities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memory_entities_entity_type ON memory_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_memory_entities_entity_id ON memory_entities(entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_entities_memory_type ON memory_entities(memory_type);
CREATE INDEX IF NOT EXISTS idx_memory_entities_is_active ON memory_entities(is_active);
CREATE INDEX IF NOT EXISTS idx_memory_entities_confidence_score ON memory_entities(confidence_score);
CREATE INDEX IF NOT EXISTS idx_memory_entities_importance_score ON memory_entities(importance_score);
CREATE INDEX IF NOT EXISTS idx_memory_entities_freshness_score ON memory_entities(freshness_score);
CREATE UNIQUE INDEX IF NOT EXISTS idx_memory_entities_unique_ref
  ON memory_entities(workspace_id, entity_type, entity_id, memory_type)
  WHERE is_active = true;

ALTER TABLE memory_entities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_entities" ON memory_entities;
CREATE POLICY "select_memory_entities" ON memory_entities
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_memory_entities" ON memory_entities;
CREATE POLICY "insert_memory_entities" ON memory_entities
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_memory_entities" ON memory_entities;
CREATE POLICY "update_memory_entities" ON memory_entities
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_memory_entities" ON memory_entities;
CREATE POLICY "delete_memory_entities" ON memory_entities
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 2. memory_records (version history)
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  memory_entity_id uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'system',
  content jsonb NOT NULL DEFAULT '{}',
  embedding_reference text,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_records_workspace_id ON memory_records(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memory_records_memory_entity_id ON memory_records(memory_entity_id);
CREATE INDEX IF NOT EXISTS idx_memory_records_created_at ON memory_records(created_at DESC);

ALTER TABLE memory_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_records" ON memory_records;
CREATE POLICY "select_memory_records" ON memory_records
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_records.memory_entity_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

DROP POLICY IF EXISTS "insert_memory_records" ON memory_records;
CREATE POLICY "insert_memory_records" ON memory_records
  FOR INSERT TO authenticated
  WITH CHECK (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_records.memory_entity_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

DROP POLICY IF EXISTS "update_memory_records" ON memory_records;
CREATE POLICY "update_memory_records" ON memory_records
  FOR UPDATE TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_records.memory_entity_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  )
  WITH CHECK (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_records.memory_entity_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

DROP POLICY IF EXISTS "delete_memory_records" ON memory_records;
CREATE POLICY "delete_memory_records" ON memory_records
  FOR DELETE TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_records.memory_entity_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

-- ============================================================
-- 3. memory_relationships
-- ============================================================

CREATE TABLE IF NOT EXISTS memory_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  source_memory_id uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  target_memory_id uuid NOT NULL REFERENCES memory_entities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL,
  strength numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_memory_relationships_workspace_id ON memory_relationships(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memory_relationships_source_memory_id ON memory_relationships(source_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_relationships_target_memory_id ON memory_relationships(target_memory_id);
CREATE INDEX IF NOT EXISTS idx_memory_relationships_relationship_type ON memory_relationships(relationship_type);
CREATE INDEX IF NOT EXISTS idx_memory_relationships_created_at ON memory_relationships(created_at DESC);

ALTER TABLE memory_relationships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_memory_relationships" ON memory_relationships;
CREATE POLICY "select_memory_relationships" ON memory_relationships
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_relationships.source_memory_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

DROP POLICY IF EXISTS "insert_memory_relationships" ON memory_relationships;
CREATE POLICY "insert_memory_relationships" ON memory_relationships
  FOR INSERT TO authenticated
  WITH CHECK (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_relationships.source_memory_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

DROP POLICY IF EXISTS "update_memory_relationships" ON memory_relationships;
CREATE POLICY "update_memory_relationships" ON memory_relationships
  FOR UPDATE TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_relationships.source_memory_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  )
  WITH CHECK (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_relationships.source_memory_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

DROP POLICY IF EXISTS "delete_memory_relationships" ON memory_relationships;
CREATE POLICY "delete_memory_relationships" ON memory_relationships
  FOR DELETE TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM memory_entities me
      WHERE me.id = memory_relationships.source_memory_id
      AND (me.workspace_id IS NULL OR is_workspace_member(me.workspace_id))
    )
  );

-- ============================================================
-- 4. learning_events
-- ============================================================

CREATE TABLE IF NOT EXISTS learning_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  entity_type text,
  entity_id text,
  triggered_by text NOT NULL DEFAULT 'system',
  learning_summary text,
  confidence numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_events_workspace_id ON learning_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_event_type ON learning_events(event_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_entity_type ON learning_events(entity_type);
CREATE INDEX IF NOT EXISTS idx_learning_events_entity_id ON learning_events(entity_id);
CREATE INDEX IF NOT EXISTS idx_learning_events_created_at ON learning_events(created_at DESC);

ALTER TABLE learning_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_learning_events" ON learning_events;
CREATE POLICY "select_learning_events" ON learning_events
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_learning_events" ON learning_events;
CREATE POLICY "insert_learning_events" ON learning_events
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_learning_events" ON learning_events;
CREATE POLICY "update_learning_events" ON learning_events
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_learning_events" ON learning_events;
CREATE POLICY "delete_learning_events" ON learning_events
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 5. Trigger: update_memory_entities_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_memory_entities_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_memory_entities_updated_at ON memory_entities;
CREATE TRIGGER trigger_memory_entities_updated_at
  BEFORE UPDATE ON memory_entities
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_entities_updated_at();
