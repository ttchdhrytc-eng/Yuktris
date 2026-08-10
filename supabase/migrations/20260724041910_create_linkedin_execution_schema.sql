/*
# Create LinkedIn Execution Agent Schema

## Overview
Creates the complete database schema for the LinkedIn Execution Agent.
This agent ONLY executes approved LinkedIn outreach campaigns — it never
generates strategy, creates personalization, or predicts buying intent.

It runs after the Outreach Strategy Agent produces an approved campaign.

## New Tables (5 total)

1. **linkedin_campaigns** — Execution-level campaign record. Links to
   workspace and the originating outreach campaign. Tracks status,
   progress, start/completion timestamps, and execution score.

2. **execution_queue** — Queued actions for each campaign execution:
   sequence, action_type, scheduled_at, executed_at, status, retry_count.

3. **linkedin_actions** — Individual LinkedIn actions performed:
   action_type, result, duration, error_message. This is the audit log
   of every connection request, message, and follow-up sent.

4. **safety_logs** — Safety metrics per campaign execution:
   risk_score, daily_usage, hourly_usage, cooldown_until. Enforces
   account safety limits.

5. **performance_metrics** — Aggregated performance per campaign
   execution: connections_sent, messages_sent, followups_sent,
   replies_received, acceptance_rate, reply_rate.

## Naming
All tables use the `linkedin_exec_` prefix to avoid conflicts with
existing `campaigns`, `linkedin_accounts`, and `messages` tables.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member().
- Child tables scope through linkedin_campaigns using EXISTS subquery.
- 4 CRUD policies per table — no FOR ALL.
- All policies use TO authenticated.
*/

-- ============================================================
-- 1. linkedin_campaigns (execution-level campaign)
-- ============================================================

CREATE TABLE IF NOT EXISTS linkedin_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid,
  prospect_name text,
  prospect_title text,
  company_name text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'paused', 'completed', 'failed', 'stopped')),
  progress integer NOT NULL DEFAULT 0,
  current_step text,
  started_at timestamptz,
  completed_at timestamptz,
  execution_score integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_workspace_id ON linkedin_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_campaign_id ON linkedin_campaigns(campaign_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_campaigns_status ON linkedin_campaigns(status);

ALTER TABLE linkedin_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_campaigns" ON linkedin_campaigns;
CREATE POLICY "select_own_linkedin_campaigns" ON linkedin_campaigns FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_campaigns" ON linkedin_campaigns;
CREATE POLICY "insert_own_linkedin_campaigns" ON linkedin_campaigns FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_linkedin_campaigns" ON linkedin_campaigns;
CREATE POLICY "update_own_linkedin_campaigns" ON linkedin_campaigns FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_linkedin_campaigns" ON linkedin_campaigns;
CREATE POLICY "delete_own_linkedin_campaigns" ON linkedin_campaigns FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. execution_queue
-- ============================================================

CREATE TABLE IF NOT EXISTS execution_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_execution_id uuid NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  action_type text NOT NULL,
  scheduled_at timestamptz,
  executed_at timestamptz,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'paused', 'completed', 'failed', 'skipped', 'retry')),
  retry_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_execution_queue_campaign_id ON execution_queue(campaign_execution_id);
CREATE INDEX IF NOT EXISTS idx_execution_queue_status ON execution_queue(status);
CREATE INDEX IF NOT EXISTS idx_execution_queue_sequence ON execution_queue(sequence);

ALTER TABLE execution_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_execution_queue" ON execution_queue;
CREATE POLICY "select_own_execution_queue" ON execution_queue FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = execution_queue.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_execution_queue" ON execution_queue;
CREATE POLICY "insert_own_execution_queue" ON execution_queue FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = execution_queue.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_execution_queue" ON execution_queue;
CREATE POLICY "update_own_execution_queue" ON execution_queue FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = execution_queue.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = execution_queue.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_execution_queue" ON execution_queue;
CREATE POLICY "delete_own_execution_queue" ON execution_queue FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = execution_queue.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

-- ============================================================
-- 3. linkedin_actions
-- ============================================================

CREATE TABLE IF NOT EXISTS linkedin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_execution_id uuid NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  contact_id uuid,
  action_type text NOT NULL,
  result text,
  duration integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_linkedin_actions_campaign_id ON linkedin_actions(campaign_execution_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_actions_action_type ON linkedin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_linkedin_actions_created_at ON linkedin_actions(created_at);

ALTER TABLE linkedin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_actions" ON linkedin_actions;
CREATE POLICY "select_own_linkedin_actions" ON linkedin_actions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = linkedin_actions.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_linkedin_actions" ON linkedin_actions;
CREATE POLICY "insert_own_linkedin_actions" ON linkedin_actions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = linkedin_actions.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_linkedin_actions" ON linkedin_actions;
CREATE POLICY "update_own_linkedin_actions" ON linkedin_actions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = linkedin_actions.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = linkedin_actions.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_linkedin_actions" ON linkedin_actions;
CREATE POLICY "delete_own_linkedin_actions" ON linkedin_actions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = linkedin_actions.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

-- ============================================================
-- 4. safety_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS safety_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_execution_id uuid NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  risk_score integer DEFAULT 0,
  daily_usage integer DEFAULT 0,
  hourly_usage integer DEFAULT 0,
  cooldown_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_safety_logs_campaign_id ON safety_logs(campaign_execution_id);

ALTER TABLE safety_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_safety_logs" ON safety_logs;
CREATE POLICY "select_own_safety_logs" ON safety_logs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = safety_logs.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_safety_logs" ON safety_logs;
CREATE POLICY "insert_own_safety_logs" ON safety_logs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = safety_logs.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_safety_logs" ON safety_logs;
CREATE POLICY "update_own_safety_logs" ON safety_logs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = safety_logs.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = safety_logs.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_safety_logs" ON safety_logs;
CREATE POLICY "delete_own_safety_logs" ON safety_logs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = safety_logs.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

-- ============================================================
-- 5. performance_metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_execution_id uuid NOT NULL REFERENCES linkedin_campaigns(id) ON DELETE CASCADE,
  connections_sent integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  followups_sent integer DEFAULT 0,
  replies_received integer DEFAULT 0,
  acceptance_rate integer DEFAULT 0,
  reply_rate integer DEFAULT 0,
  positive_replies integer DEFAULT 0,
  negative_replies integer DEFAULT 0,
  ignored_count integer DEFAULT 0,
  blocked_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_campaign_id ON performance_metrics(campaign_execution_id);

ALTER TABLE performance_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_performance_metrics" ON performance_metrics;
CREATE POLICY "select_own_performance_metrics" ON performance_metrics FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = performance_metrics.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_performance_metrics" ON performance_metrics;
CREATE POLICY "insert_own_performance_metrics" ON performance_metrics FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = performance_metrics.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_performance_metrics" ON performance_metrics;
CREATE POLICY "update_own_performance_metrics" ON performance_metrics FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = performance_metrics.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = performance_metrics.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_performance_metrics" ON performance_metrics;
CREATE POLICY "delete_own_performance_metrics" ON performance_metrics FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM linkedin_campaigns WHERE linkedin_campaigns.id = performance_metrics.campaign_execution_id AND is_workspace_member(linkedin_campaigns.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on linkedin_campaigns
-- ============================================================

CREATE OR REPLACE FUNCTION update_linkedin_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_linkedin_campaign_updated_at ON linkedin_campaigns;
CREATE TRIGGER trigger_linkedin_campaign_updated_at
  BEFORE UPDATE ON linkedin_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_linkedin_campaign_updated_at();