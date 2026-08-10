/*
# Create Enterprise Execution Engine Schema

## Overview
Creates the database infrastructure for the centralized Execution
Engine. The Agent Orchestrator decides WHAT should happen; the
Execution Engine executes those plans reliably.

## New Tables (4)

1. **execution_workflows** — Each workflow run from an execution
   plan. Stores the plan, context, status, timing, and errors.

2. **execution_jobs** — Individual jobs within a workflow. Each job
   has a type, worker type, priority, payload, result, attempts,
   and status. This is the job queue.

3. **execution_events** — Append-only event log for observability.
   Every workflow and job lifecycle event is recorded here.

4. **worker_registry** — Registry of all workers. Tracks status,
   current job assignment, and heartbeats for health monitoring.

## Security
- RLS enabled on all four tables.
- execution_workflows: workspace members can SELECT/INSERT their
  workspace's workflows; only owner/admin can UPDATE/DELETE.
- execution_jobs: workspace members can SELECT; any authenticated
  user can INSERT (the engine logs on behalf of jobs); only
  owner/admin can UPDATE/DELETE.
- execution_events: workspace members can SELECT; any authenticated
  user can INSERT; only owner/admin can DELETE.
- worker_registry: any authenticated user can SELECT; only
  owner/admin can INSERT/UPDATE/DELETE.
- 4 CRUD policies per table — no FOR ALL.
*/

-- ============================================================
-- 1. execution_workflows
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  workflow_name text NOT NULL,
  workflow_version text NOT NULL DEFAULT '1.0.0',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'planning', 'queued', 'running', 'paused', 'completed', 'cancelled', 'failed')),
  execution_plan jsonb,
  context jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_workflows_workspace_id ON execution_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_exec_workflows_status ON execution_workflows(status);
CREATE INDEX IF NOT EXISTS idx_exec_workflows_created_at ON execution_workflows(created_at DESC);

ALTER TABLE execution_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_execution_workflows" ON execution_workflows;
CREATE POLICY "select_execution_workflows" ON execution_workflows
  FOR SELECT TO authenticated
  USING (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "insert_execution_workflows" ON execution_workflows;
CREATE POLICY "insert_execution_workflows" ON execution_workflows
  FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "update_execution_workflows" ON execution_workflows;
CREATE POLICY "update_execution_workflows" ON execution_workflows
  FOR UPDATE TO authenticated
  USING (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  )
  WITH CHECK (
    workspace_id IS NULL
    OR is_workspace_member(workspace_id)
  );

DROP POLICY IF EXISTS "delete_execution_workflows" ON execution_workflows;
CREATE POLICY "delete_execution_workflows" ON execution_workflows
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 2. execution_jobs
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid NOT NULL REFERENCES execution_workflows(id) ON DELETE CASCADE,
  job_name text NOT NULL,
  job_type text NOT NULL DEFAULT 'immediate' CHECK (job_type IN ('immediate', 'delayed', 'scheduled', 'recurring', 'batch', 'event_triggered', 'long_running', 'dependent', 'manual')),
  worker_type text NOT NULL DEFAULT 'custom' CHECK (worker_type IN ('ai', 'research', 'integration', 'crm', 'calendar', 'email', 'document', 'notification', 'file', 'custom')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'waiting', 'running', 'paused', 'retrying', 'completed', 'cancelled', 'failed', 'dead_letter')),
  payload jsonb,
  result jsonb,
  error text,
  attempts integer NOT NULL DEFAULT 0,
  max_attempts integer NOT NULL DEFAULT 3,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_jobs_workflow_id ON execution_jobs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_exec_jobs_status ON execution_jobs(status);
CREATE INDEX IF NOT EXISTS idx_exec_jobs_priority ON execution_jobs(priority);
CREATE INDEX IF NOT EXISTS idx_exec_jobs_worker_type ON execution_jobs(worker_type);
CREATE INDEX IF NOT EXISTS idx_exec_jobs_created_at ON execution_jobs(created_at DESC);

ALTER TABLE execution_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_execution_jobs" ON execution_jobs;
CREATE POLICY "select_execution_jobs" ON execution_jobs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_jobs.workflow_id
      AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  );

DROP POLICY IF EXISTS "insert_execution_jobs" ON execution_jobs;
CREATE POLICY "insert_execution_jobs" ON execution_jobs
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_execution_jobs" ON execution_jobs;
CREATE POLICY "update_execution_jobs" ON execution_jobs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_jobs.workflow_id
      AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  )
  WITH CHECK (true);

DROP POLICY IF EXISTS "delete_execution_jobs" ON execution_jobs;
CREATE POLICY "delete_execution_jobs" ON execution_jobs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 3. execution_events
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id uuid REFERENCES execution_workflows(id) ON DELETE SET NULL,
  job_id uuid REFERENCES execution_jobs(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  event_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exec_events_workflow_id ON execution_events(workflow_id);
CREATE INDEX IF NOT EXISTS idx_exec_events_job_id ON execution_events(job_id);
CREATE INDEX IF NOT EXISTS idx_exec_events_event_type ON execution_events(event_type);
CREATE INDEX IF NOT EXISTS idx_exec_events_created_at ON execution_events(created_at DESC);

ALTER TABLE execution_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_execution_events" ON execution_events;
CREATE POLICY "select_execution_events" ON execution_events
  FOR SELECT TO authenticated
  USING (
    workflow_id IS NULL
    OR EXISTS (
      SELECT 1 FROM execution_workflows
      WHERE execution_workflows.id = execution_events.workflow_id
      AND (execution_workflows.workspace_id IS NULL OR is_workspace_member(execution_workflows.workspace_id))
    )
  );

DROP POLICY IF EXISTS "insert_execution_events" ON execution_events;
CREATE POLICY "insert_execution_events" ON execution_events
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_execution_events" ON execution_events;
CREATE POLICY "update_execution_events" ON execution_events
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_execution_events" ON execution_events;
CREATE POLICY "delete_execution_events" ON execution_events
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 4. worker_registry
-- ============================================================

CREATE TABLE IF NOT EXISTS worker_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_name text NOT NULL UNIQUE,
  worker_type text NOT NULL DEFAULT 'custom' CHECK (worker_type IN ('ai', 'research', 'integration', 'crm', 'calendar', 'email', 'document', 'notification', 'file', 'custom')),
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'paused', 'offline', 'error')),
  current_job uuid REFERENCES execution_jobs(id) ON DELETE SET NULL,
  last_heartbeat timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_registry_status ON worker_registry(status);
CREATE INDEX IF NOT EXISTS idx_worker_registry_type ON worker_registry(worker_type);

ALTER TABLE worker_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_worker_registry" ON worker_registry;
CREATE POLICY "select_worker_registry" ON worker_registry
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_worker_registry" ON worker_registry;
CREATE POLICY "insert_worker_registry" ON worker_registry
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_worker_registry" ON worker_registry;
CREATE POLICY "update_worker_registry" ON worker_registry
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_worker_registry" ON worker_registry;
CREATE POLICY "delete_worker_registry" ON worker_registry
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_execution_workflows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_execution_workflows_updated_at ON execution_workflows;
CREATE TRIGGER trigger_execution_workflows_updated_at
  BEFORE UPDATE ON execution_workflows
  FOR EACH ROW
  EXECUTE FUNCTION update_execution_workflows_updated_at();

CREATE OR REPLACE FUNCTION update_worker_registry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_worker_registry_updated_at ON worker_registry;
CREATE TRIGGER trigger_worker_registry_updated_at
  BEFORE UPDATE ON worker_registry
  FOR EACH ROW
  EXECUTE FUNCTION update_worker_registry_updated_at();
