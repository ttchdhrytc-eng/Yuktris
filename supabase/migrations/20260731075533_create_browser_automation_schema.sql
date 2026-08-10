/*
# Browser Automation Foundation Schema (Phase 21.1)

1. Overview
   Creates the complete database backing for the Playwright-based browser automation
   layer. Nine tables track browser sessions, workers, pages, queued actions, errors,
   logs, health metrics, and screenshots. All tables are workspace-scoped with RLS
   policies so authenticated users can only access their own workspace's browser data.

2. New Tables
   - browser_sessions   — persisted browser sessions (cookies, storage state) for login automation
   - browser_workers    — worker pool members (browser instances with status, health, assignment)
   - browser_pages      — individual browser pages/tabs tracked per worker
   - browser_actions    — atomic browser actions (visit, click, type, scroll, screenshot, etc.)
   - browser_queue      — universal browser action queue with retry, priority, scheduling
   - browser_errors     — error log with stack traces, screenshots, retry info
   - browser_logs       — general browser execution logs (info/warn/debug)
   - browser_health     — per-worker health metrics (CPU, RAM, URL, crashes, network errors)
   - browser_screenshots — screenshot metadata + storage paths (before/after/error/debug)

3. Security
   - RLS enabled on all nine tables.
   - All policies are workspace-scoped (workspace_id ownership via workspace_members).
   - Uses is_workspace_member() SECURITY DEFINER function for access checks.

4. Indexes
   - workspace_id on all tables for fast workspace isolation
   - status + priority on browser_queue for efficient queue processing
   - session_id on browser_pages, browser_actions, browser_screenshots
   - worker_id on browser_health, browser_logs, browser_errors
*/

-- ============================================================
-- browser_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  session_type text NOT NULL DEFAULT 'standard',
  cookies jsonb NOT NULL DEFAULT '[]'::jsonb,
  storage_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  local_storage jsonb NOT NULL DEFAULT '{}'::jsonb,
  session_storage jsonb NOT NULL DEFAULT '{}'::jsonb,
  encrypted boolean NOT NULL DEFAULT true,
  encryption_key_id text,
  user_agent text,
  viewport jsonb,
  timezone text,
  locale text,
  status text NOT NULL DEFAULT 'active',
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_sessions_workspace ON browser_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_status ON browser_sessions(status);

-- ============================================================
-- browser_workers
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_name text NOT NULL,
  browser_type text NOT NULL DEFAULT 'chromium',
  status text NOT NULL DEFAULT 'idle',
  current_url text,
  last_action text,
  last_action_at timestamptz,
  session_id uuid REFERENCES browser_sessions(id) ON DELETE SET NULL,
  page_count integer NOT NULL DEFAULT 0,
  actions_completed bigint NOT NULL DEFAULT 0,
  actions_failed bigint NOT NULL DEFAULT 0,
  uptime_seconds bigint NOT NULL DEFAULT 0,
  cpu_usage numeric(5,2) DEFAULT 0,
  memory_usage_mb numeric(8,2) DEFAULT 0,
  crash_count integer NOT NULL DEFAULT 0,
  last_crash_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_workers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_workers_workspace ON browser_workers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_workers_status ON browser_workers(status);

-- ============================================================
-- browser_pages
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES browser_workers(id) ON DELETE CASCADE,
  page_index integer NOT NULL DEFAULT 0,
  url text,
  title text,
  status text NOT NULL DEFAULT 'open',
  load_time_ms integer,
  network_error_count integer NOT NULL DEFAULT 0,
  last_network_error text,
  screenshot_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_pages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_pages_workspace ON browser_pages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_pages_worker ON browser_pages(worker_id);

-- ============================================================
-- browser_actions
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES browser_workers(id) ON DELETE SET NULL,
  page_id uuid REFERENCES browser_pages(id) ON DELETE SET NULL,
  session_id uuid REFERENCES browser_sessions(id) ON DELETE SET NULL,
  queue_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  result jsonb,
  error text,
  duration_ms integer,
  screenshot_before_path text,
  screenshot_after_path text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_actions_workspace ON browser_actions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_actions_status ON browser_actions(status);
CREATE INDEX IF NOT EXISTS idx_browser_actions_worker ON browser_actions(worker_id);

-- ============================================================
-- browser_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES browser_workers(id) ON DELETE SET NULL,
  session_id uuid REFERENCES browser_sessions(id) ON DELETE SET NULL,
  agent_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 5,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  error text,
  result jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_queue ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_queue_workspace ON browser_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_queue_status ON browser_queue(status);
CREATE INDEX IF NOT EXISTS idx_browser_queue_priority ON browser_queue(priority, created_at);

-- ============================================================
-- browser_errors
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES browser_workers(id) ON DELETE SET NULL,
  page_id uuid REFERENCES browser_pages(id) ON DELETE SET NULL,
  action_id uuid REFERENCES browser_actions(id) ON DELETE SET NULL,
  queue_id uuid,
  error_type text NOT NULL,
  error_message text NOT NULL,
  stack_trace text,
  screenshot_path text,
  url text,
  retry_count integer NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_errors ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_errors_workspace ON browser_errors(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_errors_worker ON browser_errors(worker_id);
CREATE INDEX IF NOT EXISTS idx_browser_errors_resolved ON browser_errors(resolved);

-- ============================================================
-- browser_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES browser_workers(id) ON DELETE SET NULL,
  page_id uuid REFERENCES browser_pages(id) ON DELETE SET NULL,
  level text NOT NULL DEFAULT 'info',
  category text NOT NULL DEFAULT 'general',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_logs_workspace ON browser_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_logs_worker ON browser_logs(worker_id);
CREATE INDEX IF NOT EXISTS idx_browser_logs_level ON browser_logs(level);
CREATE INDEX IF NOT EXISTS idx_browser_logs_created ON browser_logs(created_at DESC);

-- ============================================================
-- browser_health
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid NOT NULL REFERENCES browser_workers(id) ON DELETE CASCADE,
  cpu_usage numeric(5,2) NOT NULL DEFAULT 0,
  memory_usage_mb numeric(8,2) NOT NULL DEFAULT 0,
  current_url text,
  last_action text,
  page_load_time_ms integer,
  network_error_count integer NOT NULL DEFAULT 0,
  crash_count integer NOT NULL DEFAULT 0,
  is_responsive boolean NOT NULL DEFAULT true,
  uptime_seconds bigint NOT NULL DEFAULT 0,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_health ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_health_workspace ON browser_health(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_health_worker ON browser_health(worker_id);
CREATE INDEX IF NOT EXISTS idx_browser_health_recorded ON browser_health(recorded_at DESC);

-- ============================================================
-- browser_screenshots
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_screenshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id uuid REFERENCES browser_workers(id) ON DELETE SET NULL,
  page_id uuid REFERENCES browser_pages(id) ON DELETE SET NULL,
  action_id uuid REFERENCES browser_actions(id) ON DELETE SET NULL,
  screenshot_type text NOT NULL DEFAULT 'debug',
  storage_path text NOT NULL,
  url text,
  page_title text,
  viewport jsonb,
  file_size_bytes bigint,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_screenshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_browser_screenshots_workspace ON browser_screenshots(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_screenshots_worker ON browser_screenshots(worker_id);
CREATE INDEX IF NOT EXISTS idx_browser_screenshots_type ON browser_screenshots(screenshot_type);
CREATE INDEX IF NOT EXISTS idx_browser_screenshots_created ON browser_screenshots(created_at DESC);

-- ============================================================
-- RLS Policies — all tables, workspace-scoped CRUD
-- ============================================================

DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY[
    'browser_sessions', 'browser_workers', 'browser_pages', 'browser_actions',
    'browser_queue', 'browser_errors', 'browser_logs', 'browser_health', 'browser_screenshots'
  ])
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "select_own_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "select_own_%s" ON %I FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "insert_own_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "insert_own_%s" ON %I FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "update_own_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "update_own_%s" ON %I FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));', tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "delete_own_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "delete_own_%s" ON %I FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));', tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_browser_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_browser_sessions_updated ON browser_sessions;
CREATE TRIGGER trg_browser_sessions_updated BEFORE UPDATE ON browser_sessions
  FOR EACH ROW EXECUTE FUNCTION update_browser_timestamp();

DROP TRIGGER IF EXISTS trg_browser_workers_updated ON browser_workers;
CREATE TRIGGER trg_browser_workers_updated BEFORE UPDATE ON browser_workers
  FOR EACH ROW EXECUTE FUNCTION update_browser_timestamp();

DROP TRIGGER IF EXISTS trg_browser_pages_updated ON browser_pages;
CREATE TRIGGER trg_browser_pages_updated BEFORE UPDATE ON browser_pages
  FOR EACH ROW EXECUTE FUNCTION update_browser_timestamp();

DROP TRIGGER IF EXISTS trg_browser_queue_updated ON browser_queue;
CREATE TRIGGER trg_browser_queue_updated BEFORE UPDATE ON browser_queue
  FOR EACH ROW EXECUTE FUNCTION update_browser_timestamp();
