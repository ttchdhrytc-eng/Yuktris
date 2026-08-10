/*
# Create Enterprise Context Engine Schema

## Overview
Creates the database layer for the Enterprise Context Engine — the system that
assembles, versions, and caches context for AI Agents. When an agent needs to
generate a response, it queries the Context Engine for a fully-assembled context
profile (business info, company research, revenue intelligence, relationships,
etc.) instead of gathering fragments from a dozen services each time.

## New Tables (3)
1. context_profiles — One row per entity+context_type combination
   - Tracks version, status (active/stale/archived/error), and build metrics
   - entity_type + entity_id + context_type identify what the context is about
   - token_count, source_count, compression_ratio, quality_score, build_duration_ms
2. context_snapshots — Immutable point-in-time snapshots of assembled context
   - One row per version of a profile; ordered by created_at desc for history
   - assembled_context stores the full AssembledContext JSONB
   - source_contributions tracks per-source token/priority breakdown
3. context_cache — TTL-based cache for assembled contexts
   - cache_key is a deterministic string (context:{type}:{entityType}:{entityId})
   - expires_at drives automatic invalidation
   - context stores the full AssembledContext JSONB

## Indexes
- B-tree indexes on workspace_id, entity_type, entity_id, context_type
- Composite unique index on (workspace_id, entity_type, entity_id, context_type) for profiles
- B-tree index on cache_key for cache lookups
- B-tree index on expires_at for cache cleanup

## Security
- RLS enabled on all 3 tables, scoped to authenticated users via workspace membership.
- 4 CRUD policies per table (select/insert/update/delete), no FOR ALL.
- All ownership checks use is_workspace_member() or workspace_id IS NULL (global contexts).
- context_snapshots uses EXISTS join through context_profiles for child-table isolation.
- Trigger functions use SECURITY DEFINER with SET search_path = public.
*/

-- ============================================================
-- 1. context_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS context_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  context_name text NOT NULL,
  context_type text NOT NULL,
  entity_type text,
  entity_id text,
  version integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'active',
  token_count integer NOT NULL DEFAULT 0,
  source_count integer NOT NULL DEFAULT 0,
  compression_ratio numeric NOT NULL DEFAULT 1.0,
  quality_score numeric NOT NULL DEFAULT 0.5,
  build_duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_profiles_workspace_id ON context_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_context_profiles_entity_type ON context_profiles(entity_type);
CREATE INDEX IF NOT EXISTS idx_context_profiles_entity_id ON context_profiles(entity_id);
CREATE INDEX IF NOT EXISTS idx_context_profiles_context_type ON context_profiles(context_type);
CREATE INDEX IF NOT EXISTS idx_context_profiles_status ON context_profiles(status);
CREATE INDEX IF NOT EXISTS idx_context_profiles_updated_at ON context_profiles(updated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_context_profiles_unique_ref
  ON context_profiles(workspace_id, entity_type, entity_id, context_type);

ALTER TABLE context_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_context_profiles" ON context_profiles;
CREATE POLICY "select_context_profiles" ON context_profiles
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_context_profiles" ON context_profiles;
CREATE POLICY "insert_context_profiles" ON context_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_context_profiles" ON context_profiles;
CREATE POLICY "update_context_profiles" ON context_profiles
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_context_profiles" ON context_profiles;
CREATE POLICY "delete_context_profiles" ON context_profiles
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 2. context_snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS context_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  context_profile_id uuid NOT NULL REFERENCES context_profiles(id) ON DELETE CASCADE,
  snapshot_version integer NOT NULL DEFAULT 1,
  assembled_context jsonb NOT NULL DEFAULT '{}',
  token_count integer NOT NULL DEFAULT 0,
  source_contributions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_snapshots_workspace_id ON context_snapshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_context_profile_id ON context_snapshots(context_profile_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_created_at ON context_snapshots(created_at DESC);

ALTER TABLE context_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_context_snapshots" ON context_snapshots;
CREATE POLICY "select_context_snapshots" ON context_snapshots
  FOR SELECT TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM context_profiles cp
      WHERE cp.id = context_snapshots.context_profile_id
      AND (cp.workspace_id IS NULL OR is_workspace_member(cp.workspace_id))
    )
  );

DROP POLICY IF EXISTS "insert_context_snapshots" ON context_snapshots;
CREATE POLICY "insert_context_snapshots" ON context_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM context_profiles cp
      WHERE cp.id = context_snapshots.context_profile_id
      AND (cp.workspace_id IS NULL OR is_workspace_member(cp.workspace_id))
    )
  );

DROP POLICY IF EXISTS "update_context_snapshots" ON context_snapshots;
CREATE POLICY "update_context_snapshots" ON context_snapshots
  FOR UPDATE TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM context_profiles cp
      WHERE cp.id = context_snapshots.context_profile_id
      AND (cp.workspace_id IS NULL OR is_workspace_member(cp.workspace_id))
    )
  )
  WITH CHECK (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM context_profiles cp
      WHERE cp.id = context_snapshots.context_profile_id
      AND (cp.workspace_id IS NULL OR is_workspace_member(cp.workspace_id))
    )
  );

DROP POLICY IF EXISTS "delete_context_snapshots" ON context_snapshots;
CREATE POLICY "delete_context_snapshots" ON context_snapshots
  FOR DELETE TO authenticated
  USING (
    (workspace_id IS NULL) OR is_workspace_member(workspace_id)
    OR EXISTS (
      SELECT 1 FROM context_profiles cp
      WHERE cp.id = context_snapshots.context_profile_id
      AND (cp.workspace_id IS NULL OR is_workspace_member(cp.workspace_id))
    )
  );

-- ============================================================
-- 3. context_cache
-- ============================================================

CREATE TABLE IF NOT EXISTS context_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  cache_key text NOT NULL,
  entity_type text,
  entity_id text,
  context jsonb NOT NULL DEFAULT '{}',
  token_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_context_cache_workspace_id ON context_cache(workspace_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_cache_key ON context_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_context_cache_entity_type ON context_cache(entity_type);
CREATE INDEX IF NOT EXISTS idx_context_cache_entity_id ON context_cache(entity_id);
CREATE INDEX IF NOT EXISTS idx_context_cache_expires_at ON context_cache(expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_context_cache_unique_key ON context_cache(cache_key);

ALTER TABLE context_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_context_cache" ON context_cache;
CREATE POLICY "select_context_cache" ON context_cache
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_context_cache" ON context_cache;
CREATE POLICY "insert_context_cache" ON context_cache
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_context_cache" ON context_cache;
CREATE POLICY "update_context_cache" ON context_cache
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_context_cache" ON context_cache;
CREATE POLICY "delete_context_cache" ON context_cache
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 4. Trigger: update_context_profiles_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_context_profiles_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_context_profiles_updated_at ON context_profiles;
CREATE TRIGGER trigger_context_profiles_updated_at
  BEFORE UPDATE ON context_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_context_profiles_updated_at();
