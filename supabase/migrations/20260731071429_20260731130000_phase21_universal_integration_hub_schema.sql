/*
# Universal Integration Hub — Phase 21 Schema Extension

## Purpose
Extends the existing integration architecture (Phases 1-20) with missing tables
required for the Universal Integration Hub & Real-World Execution Layer.

## New Tables

### Integration Failures & Usage
- `integration_failures` — tracks failed integration calls with retry context
- `integration_usage_daily` — daily usage aggregates per workspace/provider

### Stripe Integration
- `stripe_customers` — workspace→Stripe customer mapping
- `stripe_subscriptions` — subscription sync state
- `stripe_invoices` — invoice sync state
- `stripe_payment_intents` — payment intent tracking
- `stripe_webhook_events` — inbound Stripe webhook event log

### Universal Execution Queue
- `universal_execution_queue` — the single queue every AI agent action flows through
  (agent → queue → integration → execution → result → memory → knowledge graph)

### Browser Worker Layer
- `browser_workers` — worker registry for browser automation (Playwright/Chromium)
- `browser_worker_tasks` — tasks assigned to browser workers

## Security
All tables are workspace-scoped with RLS. Authenticated users can only access
rows belonging to workspaces they are a member of.

## Important Notes
1. All tables use `workspace_id` for isolation, checked via `workspace_members`.
2. `integration_failures` and `integration_usage_daily` are scoped to workspace.
3. Stripe tables store sync state, not the source-of-truth (Stripe is source-of-truth).
4. `universal_execution_queue` is the single entry point for all agent actions.
5. Browser worker tables track automation workers and their tasks.
*/

-- ============================================================
-- 1. integration_failures
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration text NOT NULL,
  provider text,
  error_code text,
  error_message text NOT NULL,
  endpoint text,
  request_payload jsonb,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retrying', 'resolved', 'dead_letter')),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE integration_failures ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_integration_failures_workspace ON integration_failures(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_failures_status ON integration_failures(status);
CREATE INDEX IF NOT EXISTS idx_integration_failures_integration ON integration_failures(integration);

-- ============================================================
-- 2. integration_usage_daily
-- ============================================================
CREATE TABLE IF NOT EXISTS integration_usage_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration text NOT NULL,
  provider text,
  date date NOT NULL DEFAULT CURRENT_DATE,
  api_calls integer NOT NULL DEFAULT 0,
  tokens_used bigint NOT NULL DEFAULT 0,
  cost_cents integer NOT NULL DEFAULT 0,
  records_synced integer NOT NULL DEFAULT 0,
  errors integer NOT NULL DEFAULT 0,
  avg_latency_ms integer,
  UNIQUE(workspace_id, integration, provider, date)
);
ALTER TABLE integration_usage_daily ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_integration_usage_daily_workspace ON integration_usage_daily(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integration_usage_daily_date ON integration_usage_daily(date);

-- ============================================================
-- 3. stripe_customers
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  email text,
  name text,
  phone text,
  default_payment_method text,
  currency text DEFAULT 'usd',
  address jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stripe_customers_workspace ON stripe_customers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe_id ON stripe_customers(stripe_customer_id);

-- ============================================================
-- 4. stripe_subscriptions
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text NOT NULL UNIQUE,
  status text NOT NULL,
  plan_id text,
  price_id text,
  quantity integer DEFAULT 1,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  trial_end timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stripe_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_workspace ON stripe_subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_stripe_id ON stripe_subscriptions(stripe_subscription_id);

-- ============================================================
-- 5. stripe_invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_invoice_id text NOT NULL UNIQUE,
  stripe_subscription_id text,
  number text,
  status text NOT NULL,
  total_cents integer NOT NULL DEFAULT 0,
  currency text DEFAULT 'usd',
  due_date timestamptz,
  paid_at timestamptz,
  invoice_pdf text,
  hosted_invoice_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stripe_invoices ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_workspace ON stripe_invoices(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stripe_invoices_stripe_id ON stripe_invoices(stripe_invoice_id);

-- ============================================================
-- 6. stripe_payment_intents
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_payment_intent_id text NOT NULL UNIQUE,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'usd',
  status text NOT NULL,
  description text,
  payment_method text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stripe_payment_intents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_workspace ON stripe_payment_intents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stripe_payment_intents_stripe_id ON stripe_payment_intents(stripe_payment_intent_id);

-- ============================================================
-- 7. stripe_webhook_events
-- ============================================================
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL,
  stripe_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  event_data jsonb NOT NULL,
  processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE stripe_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_workspace ON stripe_webhook_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_webhook_events_processed ON stripe_webhook_events(processed);

-- ============================================================
-- 8. universal_execution_queue
-- ============================================================
CREATE TABLE IF NOT EXISTS universal_execution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id text,
  agent_name text,
  action_type text NOT NULL,
  integration text NOT NULL,
  provider text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority integer NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled', 'retrying')),
  result jsonb,
  error text,
  retry_count integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  memory_stored boolean NOT NULL DEFAULT false,
  graph_updated boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE universal_execution_queue ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_ueq_workspace ON universal_execution_queue(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ueq_status ON universal_execution_queue(status);
CREATE INDEX IF NOT EXISTS idx_ueq_integration ON universal_execution_queue(integration);
CREATE INDEX IF NOT EXISTS idx_ueq_priority ON universal_execution_queue(priority, scheduled_at);

-- ============================================================
-- 9. browser_workers
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id text NOT NULL UNIQUE,
  provider text NOT NULL DEFAULT 'linkedin',
  status text NOT NULL DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'offline', 'error', 'maintenance')),
  browser_version text,
  fingerprint jsonb,
  proxy_config jsonb,
  session_id text,
  queue_depth integer NOT NULL DEFAULT 0,
  last_heartbeat timestamptz,
  last_activity timestamptz,
  total_tasks integer NOT NULL DEFAULT 0,
  total_errors integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE browser_workers ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_browser_workers_workspace ON browser_workers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_workers_status ON browser_workers(status);

-- ============================================================
-- 10. browser_worker_tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS browser_worker_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  worker_id text NOT NULL,
  task_type text NOT NULL,
  target_url text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'assigned', 'running', 'completed', 'failed', 'timeout')),
  result jsonb,
  screenshot_url text,
  logs jsonb,
  error text,
  duration_ms integer,
  assigned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE browser_worker_tasks ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_browser_worker_tasks_workspace ON browser_worker_tasks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_browser_worker_tasks_worker ON browser_worker_tasks(worker_id);
CREATE INDEX IF NOT EXISTS idx_browser_worker_tasks_status ON browser_worker_tasks(status);

-- ============================================================
-- RLS Policies — workspace-scoped via workspace_members
-- ============================================================

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'integration_failures', 'integration_usage_daily',
    'stripe_customers', 'stripe_subscriptions', 'stripe_invoices',
    'stripe_payment_intents', 'stripe_webhook_events',
    'universal_execution_queue', 'browser_workers', 'browser_worker_tasks'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "select_workspace_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "select_workspace_%s" ON %I FOR SELECT TO authenticated USING (
      EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = %I.workspace_id AND wm.user_id = auth.uid() AND wm.status = ''active'')
    );', tbl, tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "insert_workspace_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "insert_workspace_%s" ON %I FOR INSERT TO authenticated WITH CHECK (
      EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = %I.workspace_id AND wm.user_id = auth.uid() AND wm.status = ''active'')
    );', tbl, tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "update_workspace_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "update_workspace_%s" ON %I FOR UPDATE TO authenticated USING (
      EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = %I.workspace_id AND wm.user_id = auth.uid() AND wm.status = ''active'')
    ) WITH CHECK (
      EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = %I.workspace_id AND wm.user_id = auth.uid() AND wm.status = ''active'')
    );', tbl, tbl, tbl, tbl);

    EXECUTE format('DROP POLICY IF EXISTS "delete_workspace_%s" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "delete_workspace_%s" ON %I FOR DELETE TO authenticated USING (
      EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = %I.workspace_id AND wm.user_id = auth.uid() AND wm.status = ''active'')
    );', tbl, tbl, tbl);
  END LOOP;
END $$;

-- ============================================================
-- updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'integration_failures', 'integration_usage_daily',
    'stripe_customers', 'stripe_subscriptions', 'stripe_invoices',
    'stripe_payment_intents',
    'universal_execution_queue', 'browser_workers'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%s_updated ON %I;', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_%s_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();', tbl, tbl);
  END LOOP;
END $$;
