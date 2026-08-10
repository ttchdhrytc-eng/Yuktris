/*
# Phase 21.4 — Universal Browser Execution Queue Schema

## Purpose
All browser actions become queue jobs. This migration creates the full execution queue
infrastructure: queue, history, logs, failures, retry queue, and dead letter queue.

## New Tables

1. **browser_execution_queue** — Pending/in-progress browser actions with priority, retry,
   scheduling, and escalation support. Replaces the simpler browser_queue for LinkedIn actions.
2. **browser_execution_history** — Completed (success or failure) execution records for audit.
3. **browser_execution_logs** — Per-execution log lines with level, category, message, timestamp.
4. **browser_execution_failures** — Structured failure records with error type, stack trace,
   screenshot path, and resolution status.
5. **browser_retry_queue** — Items waiting for retry with exponential backoff scheduling.
6. **browser_dead_letter_queue** — Items that exceeded max retries and cannot be retried.

## Queue States
pending, running, waiting, retry, failed, completed, cancelled, escalated

## Priority Levels
critical (1), high (2), medium (3), low (4) — lower number = higher priority

## Security
- RLS enabled on all tables, scoped to authenticated users via workspace membership.
*/

-- ── 1. browser_execution_queue ──────────────────────────────

CREATE TABLE IF NOT EXISTS browser_execution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  worker_id uuid,
  session_id uuid,
  agent_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority int NOT NULL DEFAULT 3 CHECK (priority IN (1,2,3,4)),
  priority_label text NOT NULL DEFAULT 'medium' CHECK (priority_label IN ('critical','high','medium','low')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','waiting','retry','failed','completed','cancelled','escalated')),
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  next_retry_at timestamptz,
  error text,
  result jsonb,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms int,
  escalated_at timestamptz,
  escalation_reason text,
  parent_job_id uuid REFERENCES browser_execution_queue(id) ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_execution_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_browser_exec_queue" ON browser_execution_queue;
CREATE POLICY "select_own_browser_exec_queue" ON browser_execution_queue FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_browser_exec_queue" ON browser_execution_queue;
CREATE POLICY "insert_own_browser_exec_queue" ON browser_execution_queue FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_browser_exec_queue" ON browser_execution_queue;
CREATE POLICY "update_own_browser_exec_queue" ON browser_execution_queue FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_browser_exec_queue" ON browser_execution_queue;
CREATE POLICY "delete_own_browser_exec_queue" ON browser_execution_queue FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 2. browser_execution_history ──────────────────────────────

CREATE TABLE IF NOT EXISTS browser_execution_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  queue_id uuid,
  account_id uuid,
  worker_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL CHECK (status IN ('completed','failed','cancelled','escalated')),
  result jsonb,
  error text,
  duration_ms int,
  retry_count int NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_execution_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_browser_exec_history" ON browser_execution_history;
CREATE POLICY "select_own_browser_exec_history" ON browser_execution_history FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_browser_exec_history" ON browser_execution_history;
CREATE POLICY "insert_own_browser_exec_history" ON browser_execution_history FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_browser_exec_history" ON browser_execution_history;
CREATE POLICY "delete_own_browser_exec_history" ON browser_execution_history FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 3. browser_execution_logs ────────────────────────────────

CREATE TABLE IF NOT EXISTS browser_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL,
  level text NOT NULL DEFAULT 'info' CHECK (level IN ('debug','info','warn','error')),
  category text NOT NULL DEFAULT 'execution',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_execution_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_browser_exec_logs" ON browser_execution_logs;
CREATE POLICY "select_own_browser_exec_logs" ON browser_execution_logs FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_browser_exec_logs" ON browser_execution_logs;
CREATE POLICY "insert_own_browser_exec_logs" ON browser_execution_logs FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

-- ── 4. browser_execution_failures ────────────────────────────

CREATE TABLE IF NOT EXISTS browser_execution_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL,
  account_id uuid,
  worker_id uuid,
  error_type text NOT NULL,
  error_message text NOT NULL,
  stack_trace text,
  screenshot_path text,
  url text,
  retry_count int NOT NULL DEFAULT 0,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolution_note text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_execution_failures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_browser_exec_failures" ON browser_execution_failures;
CREATE POLICY "select_own_browser_exec_failures" ON browser_execution_failures FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_browser_exec_failures" ON browser_execution_failures;
CREATE POLICY "insert_own_browser_exec_failures" ON browser_execution_failures FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_browser_exec_failures" ON browser_execution_failures;
CREATE POLICY "update_own_browser_exec_failures" ON browser_execution_failures FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

-- ── 5. browser_retry_queue ───────────────────────────────────

CREATE TABLE IF NOT EXISTS browser_retry_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL,
  original_queue_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_count int NOT NULL DEFAULT 0,
  max_retries int NOT NULL DEFAULT 3,
  next_retry_at timestamptz NOT NULL,
  last_error text,
  backoff_seconds int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','scheduled','executing','completed','exhausted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_retry_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_browser_retry_queue" ON browser_retry_queue;
CREATE POLICY "select_own_browser_retry_queue" ON browser_retry_queue FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_browser_retry_queue" ON browser_retry_queue;
CREATE POLICY "insert_own_browser_retry_queue" ON browser_retry_queue FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_browser_retry_queue" ON browser_retry_queue;
CREATE POLICY "update_own_browser_retry_queue" ON browser_retry_queue FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_browser_retry_queue" ON browser_retry_queue;
CREATE POLICY "delete_own_browser_retry_queue" ON browser_retry_queue FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 6. browser_dead_letter_queue ──────────────────────────────

CREATE TABLE IF NOT EXISTS browser_dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  execution_id uuid NOT NULL,
  original_queue_id uuid,
  account_id uuid,
  action_type text NOT NULL,
  action_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_reason text NOT NULL,
  retry_count int NOT NULL DEFAULT 0,
  last_error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE browser_dead_letter_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_browser_dlq" ON browser_dead_letter_queue;
CREATE POLICY "select_own_browser_dlq" ON browser_dead_letter_queue FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_browser_dlq" ON browser_dead_letter_queue;
CREATE POLICY "insert_own_browser_dlq" ON browser_dead_letter_queue FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_browser_dlq" ON browser_dead_letter_queue;
CREATE POLICY "delete_own_browser_dlq" ON browser_dead_letter_queue FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_browser_exec_queue_workspace ON browser_execution_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_exec_queue_status ON browser_execution_queue(status);
CREATE INDEX IF NOT EXISTS idx_browser_exec_queue_priority ON browser_execution_queue(priority, created_at);
CREATE INDEX IF NOT EXISTS idx_browser_exec_history_workspace ON browser_execution_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_exec_logs_execution ON browser_execution_logs(execution_id);
CREATE INDEX IF NOT EXISTS idx_browser_exec_failures_execution ON browser_execution_failures(execution_id);
CREATE INDEX IF NOT EXISTS idx_browser_retry_queue_next_retry ON browser_retry_queue(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_browser_dlq_workspace ON browser_dead_letter_queue(workspace_id);

-- ── updated_at triggers ─────────────────────────────────────

DROP TRIGGER IF EXISTS trg_browser_exec_queue_updated_at ON browser_execution_queue;
CREATE TRIGGER trg_browser_exec_queue_updated_at BEFORE UPDATE ON browser_execution_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_browser_retry_queue_updated_at ON browser_retry_queue;
CREATE TRIGGER trg_browser_retry_queue_updated_at BEFORE UPDATE ON browser_retry_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
