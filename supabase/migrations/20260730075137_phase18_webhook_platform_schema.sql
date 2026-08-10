/*
# Phase 18: Enterprise Platform Schema — Part 2: Webhook Platform

1. New Tables
- `webhook_subscriptions` — Outgoing webhook endpoint subscriptions per workspace
- `webhook_events` — Event catalog (lead.created, meeting.booked, etc.)
- `webhook_deliveries` — Delivery attempts with status, response, retry info
- `webhook_dead_letter_queue` — Failed deliveries after max retries
- `webhook_templates` — Reusable webhook payload templates
- `webhook_secrets` — Signing secrets for webhook verification
- `webhook_replay_logs` — Replay attempt logs

2. Security
- All tables RLS enabled, workspace-scoped
*/

CREATE TABLE IF NOT EXISTS webhook_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_name text NOT NULL,
  endpoint_url text NOT NULL,
  events text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  secret_id uuid,
  content_type text NOT NULL DEFAULT 'application/json',
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  retry_count integer NOT NULL DEFAULT 3,
  retry_delay_seconds integer NOT NULL DEFAULT 60,
  timeout_seconds integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_subscriptions_workspace_id ON webhook_subscriptions(workspace_id);
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_subs" ON webhook_subscriptions;
CREATE POLICY "select_own_webhook_subs" ON webhook_subscriptions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_subscriptions.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_subs" ON webhook_subscriptions;
CREATE POLICY "insert_own_webhook_subs" ON webhook_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_subscriptions.workspace_id));
DROP POLICY IF EXISTS "update_own_webhook_subs" ON webhook_subscriptions;
CREATE POLICY "update_own_webhook_subs" ON webhook_subscriptions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_subscriptions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_subscriptions.workspace_id));
DROP POLICY IF EXISTS "delete_own_webhook_subs" ON webhook_subscriptions;
CREATE POLICY "delete_own_webhook_subs" ON webhook_subscriptions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_subscriptions.workspace_id));

CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_category text NOT NULL,
  event_description text,
  event_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_events_workspace_id ON webhook_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_event_name ON webhook_events(event_name);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_events" ON webhook_events;
CREATE POLICY "select_own_webhook_events" ON webhook_events FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_events.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_events" ON webhook_events;
CREATE POLICY "insert_own_webhook_events" ON webhook_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_events.workspace_id));
DROP POLICY IF EXISTS "update_own_webhook_events" ON webhook_events;
CREATE POLICY "update_own_webhook_events" ON webhook_events FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_events.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_events.workspace_id));

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid NOT NULL REFERENCES webhook_subscriptions(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_id text,
  payload jsonb NOT NULL,
  attempt_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',
  http_status integer,
  response_body text,
  response_headers jsonb,
  latency_ms integer,
  error_message text,
  next_retry_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_workspace_id ON webhook_deliveries(workspace_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at DESC);
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "select_own_webhook_deliveries" ON webhook_deliveries FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_deliveries.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "insert_own_webhook_deliveries" ON webhook_deliveries FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_deliveries.workspace_id));
DROP POLICY IF EXISTS "update_own_webhook_deliveries" ON webhook_deliveries;
CREATE POLICY "update_own_webhook_deliveries" ON webhook_deliveries FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_deliveries.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_deliveries.workspace_id));

CREATE TABLE IF NOT EXISTS webhook_dead_letter_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subscription_id uuid,
  event_name text NOT NULL,
  event_id text,
  payload jsonb NOT NULL,
  failure_reason text,
  total_attempts integer NOT NULL DEFAULT 0,
  last_error text,
  last_attempt_at timestamptz,
  is_replayed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_dlq_workspace_id ON webhook_dead_letter_queue(workspace_id);
ALTER TABLE webhook_dead_letter_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_dlq" ON webhook_dead_letter_queue;
CREATE POLICY "select_own_webhook_dlq" ON webhook_dead_letter_queue FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_dead_letter_queue.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_dlq" ON webhook_dead_letter_queue;
CREATE POLICY "insert_own_webhook_dlq" ON webhook_dead_letter_queue FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_dead_letter_queue.workspace_id));
DROP POLICY IF EXISTS "delete_own_webhook_dlq" ON webhook_dead_letter_queue;
CREATE POLICY "delete_own_webhook_dlq" ON webhook_dead_letter_queue FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_dead_letter_queue.workspace_id));

CREATE TABLE IF NOT EXISTS webhook_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  event_name text NOT NULL,
  template_body jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_templates_workspace_id ON webhook_templates(workspace_id);
ALTER TABLE webhook_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_templates" ON webhook_templates;
CREATE POLICY "select_own_webhook_templates" ON webhook_templates FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_templates.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_templates" ON webhook_templates;
CREATE POLICY "insert_own_webhook_templates" ON webhook_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_templates.workspace_id));
DROP POLICY IF EXISTS "update_own_webhook_templates" ON webhook_templates;
CREATE POLICY "update_own_webhook_templates" ON webhook_templates FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_templates.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_templates.workspace_id));
DROP POLICY IF EXISTS "delete_own_webhook_templates" ON webhook_templates;
CREATE POLICY "delete_own_webhook_templates" ON webhook_templates FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_templates.workspace_id));

CREATE TABLE IF NOT EXISTS webhook_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  secret_name text NOT NULL,
  secret_value_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_secrets_workspace_id ON webhook_secrets(workspace_id);
ALTER TABLE webhook_secrets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_secrets" ON webhook_secrets;
CREATE POLICY "select_own_webhook_secrets" ON webhook_secrets FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_secrets.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_secrets" ON webhook_secrets;
CREATE POLICY "insert_own_webhook_secrets" ON webhook_secrets FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_secrets.workspace_id));
DROP POLICY IF EXISTS "update_own_webhook_secrets" ON webhook_secrets;
CREATE POLICY "update_own_webhook_secrets" ON webhook_secrets FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_secrets.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_secrets.workspace_id));
DROP POLICY IF EXISTS "delete_own_webhook_secrets" ON webhook_secrets;
CREATE POLICY "delete_own_webhook_secrets" ON webhook_secrets FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_secrets.workspace_id));

CREATE TABLE IF NOT EXISTS webhook_replay_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  delivery_id uuid NOT NULL REFERENCES webhook_deliveries(id) ON DELETE CASCADE,
  replay_status text NOT NULL DEFAULT 'pending',
  replay_response text,
  replay_http_status integer,
  replayed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webhook_replay_logs_workspace_id ON webhook_replay_logs(workspace_id);
ALTER TABLE webhook_replay_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_webhook_replays" ON webhook_replay_logs;
CREATE POLICY "select_own_webhook_replays" ON webhook_replay_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_replay_logs.workspace_id));
DROP POLICY IF EXISTS "insert_own_webhook_replays" ON webhook_replay_logs;
CREATE POLICY "insert_own_webhook_replays" ON webhook_replay_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = webhook_replay_logs.workspace_id));