/*
# Phase 8 — LinkedIn Execution Engine Schema

## Strategy
- Extend existing `linkedin_accounts` table with safety/health/limits columns
- Create 12 new tables for the full LinkedIn execution pipeline
*/

-- ============================================================
-- EXTEND linkedin_accounts TABLE
-- ============================================================
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS cookies jsonb;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS session_token text;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'active' CHECK (connection_status IN ('active', 'warming_up', 'restricted', 'cooldown', 'disconnected'));
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS daily_connection_limit integer DEFAULT 25;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS daily_message_limit integer DEFAULT 20;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS weekly_connection_limit integer DEFAULT 100;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS weekly_message_limit integer DEFAULT 80;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS warmup_status text DEFAULT 'completed' CHECK (warmup_status IN ('not_started', 'in_progress', 'completed'));
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS warmup_day integer DEFAULT 0;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS risk_score numeric DEFAULT 0;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS working_hours_start text DEFAULT '09:00';
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS working_hours_end text DEFAULT '17:00';
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS working_days text[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'];
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS timezone text DEFAULT 'America/New_York';
ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_workspace ON linkedin_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_status ON linkedin_accounts(status);

-- ============================================================
-- LINKEDIN ACCOUNT HEALTH
-- ============================================================
CREATE TABLE linkedin_account_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  health_status text NOT NULL CHECK (health_status IN ('healthy', 'warning', 'critical', 'down')),
  risk_score numeric DEFAULT 0,
  invitation_acceptance_rate numeric DEFAULT 0,
  reply_ratio numeric DEFAULT 0,
  profile_views_today integer DEFAULT 0,
  connections_today integer DEFAULT 0,
  messages_today integer DEFAULT 0,
  cooldown_until timestamptz,
  last_health_check timestamptz DEFAULT now(),
  health_factors jsonb DEFAULT '{}'::jsonb,
  recommendations jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_health_workspace ON linkedin_account_health(workspace_id);
CREATE INDEX idx_linkedin_health_account ON linkedin_account_health(linkedin_account_id);

ALTER TABLE linkedin_account_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_health" ON linkedin_account_health FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_account_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_health" ON linkedin_account_health FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_account_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_health" ON linkedin_account_health FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_account_health.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_account_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_health" ON linkedin_account_health FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_account_health.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN DAILY USAGE
-- ============================================================
CREATE TABLE linkedin_daily_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  connections_sent integer DEFAULT 0,
  connections_accepted integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  messages_replied integer DEFAULT 0,
  profile_visits integer DEFAULT 0,
  posts_liked integer DEFAULT 0,
  posts_commented integer DEFAULT 0,
  follows integer DEFAULT 0,
  endorsements integer DEFAULT 0,
  invitations_withdrawn integer DEFAULT 0,
  total_actions integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (linkedin_account_id, usage_date)
);

CREATE INDEX idx_linkedin_usage_workspace ON linkedin_daily_usage(workspace_id);
CREATE INDEX idx_linkedin_usage_account ON linkedin_daily_usage(linkedin_account_id);
CREATE INDEX idx_linkedin_usage_date ON linkedin_daily_usage(usage_date DESC);

ALTER TABLE linkedin_daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_usage" ON linkedin_daily_usage FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_daily_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_usage" ON linkedin_daily_usage FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_daily_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_usage" ON linkedin_daily_usage FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_daily_usage.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_daily_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_usage" ON linkedin_daily_usage FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_daily_usage.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN EXECUTION JOBS
-- ============================================================
CREATE TABLE linkedin_execution_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  outreach_decision_id uuid REFERENCES outreach_decisions(id) ON DELETE SET NULL,
  campaign_id uuid REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
  sequence_id uuid,
  sequence_step integer DEFAULT 0,
  action_type text NOT NULL CHECK (action_type IN (
    'connection_request', 'withdraw_invitation', 'first_message', 'follow_up_message',
    'profile_visit', 'follow_company', 'like_post', 'comment', 'endorse_skills',
    'voice_note', 'video_message'
  )),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'scheduled', 'running', 'completed', 'failed', 'retrying', 'cancelled', 'paused'
  )),
  priority integer DEFAULT 2 CHECK (priority IN (0, 1, 2, 3)),
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  action_payload jsonb DEFAULT '{}'::jsonb,
  result_payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_jobs_workspace ON linkedin_execution_jobs(workspace_id);
CREATE INDEX idx_linkedin_jobs_account ON linkedin_execution_jobs(linkedin_account_id);
CREATE INDEX idx_linkedin_jobs_status ON linkedin_execution_jobs(status);
CREATE INDEX idx_linkedin_jobs_scheduled ON linkedin_execution_jobs(scheduled_at);
CREATE INDEX idx_linkedin_jobs_priority ON linkedin_execution_jobs(priority, scheduled_at);

ALTER TABLE linkedin_execution_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_jobs" ON linkedin_execution_jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_jobs" ON linkedin_execution_jobs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_jobs" ON linkedin_execution_jobs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_jobs.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_jobs" ON linkedin_execution_jobs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_jobs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN ACTION HISTORY
-- ============================================================
CREATE TABLE linkedin_action_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  execution_job_id uuid REFERENCES linkedin_execution_jobs(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id uuid,
  sequence_id uuid,
  action_type text NOT NULL,
  action_result text NOT NULL CHECK (action_result IN ('success', 'failed', 'pending', 'rate_limited', 'policy_violation', 'already_connected', 'not_found', 'blocked')),
  action_payload jsonb DEFAULT '{}'::jsonb,
  response_payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  duration_ms integer,
  screenshot_path text,
  retry_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_history_workspace ON linkedin_action_history(workspace_id);
CREATE INDEX idx_linkedin_history_account ON linkedin_action_history(linkedin_account_id);
CREATE INDEX idx_linkedin_history_contact ON linkedin_action_history(contact_id);
CREATE INDEX idx_linkedin_history_created ON linkedin_action_history(created_at DESC);

ALTER TABLE linkedin_action_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_history" ON linkedin_action_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_action_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_history" ON linkedin_action_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_action_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_history" ON linkedin_action_history FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_action_history.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_action_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_history" ON linkedin_action_history FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_action_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN SEQUENCES
-- ============================================================
CREATE TABLE linkedin_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  sequence_name text NOT NULL,
  sequence_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_steps integer DEFAULT 0,
  status text DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'draft')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_sequences_workspace ON linkedin_sequences(workspace_id);
CREATE INDEX idx_linkedin_sequences_campaign ON linkedin_sequences(campaign_id);

ALTER TABLE linkedin_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_sequences" ON linkedin_sequences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_sequences" ON linkedin_sequences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_sequences" ON linkedin_sequences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequences.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_sequences" ON linkedin_sequences FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequences.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN SEQUENCE STATE (per prospect)
-- ============================================================
CREATE TABLE linkedin_sequence_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sequence_id uuid NOT NULL REFERENCES linkedin_sequences(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  current_step integer DEFAULT 0,
  step_status text DEFAULT 'pending' CHECK (step_status IN ('pending', 'in_progress', 'completed', 'failed', 'skipped', 'stopped')),
  started_at timestamptz,
  completed_at timestamptz,
  stopped_reason text,
  next_action_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sequence_id, contact_id)
);

CREATE INDEX idx_linkedin_seq_state_workspace ON linkedin_sequence_state(workspace_id);
CREATE INDEX idx_linkedin_seq_state_sequence ON linkedin_sequence_state(sequence_id);
CREATE INDEX idx_linkedin_seq_state_contact ON linkedin_sequence_state(contact_id);
CREATE INDEX idx_linkedin_seq_state_next ON linkedin_sequence_state(next_action_at) WHERE step_status = 'pending';

ALTER TABLE linkedin_sequence_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_seq_state" ON linkedin_sequence_state FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequence_state.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_seq_state" ON linkedin_sequence_state FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequence_state.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_seq_state" ON linkedin_sequence_state FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequence_state.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequence_state.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_seq_state" ON linkedin_sequence_state FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_sequence_state.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN QUEUE (processing queue)
-- ============================================================
CREATE TABLE linkedin_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  execution_job_id uuid REFERENCES linkedin_execution_jobs(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  priority integer DEFAULT 2,
  scheduled_at timestamptz,
  status text DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  attempts integer DEFAULT 0,
  locked_at timestamptz,
  locked_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_queue_workspace ON linkedin_queue(workspace_id);
CREATE INDEX idx_linkedin_queue_status ON linkedin_queue(status, scheduled_at);
CREATE INDEX idx_linkedin_queue_priority ON linkedin_queue(priority, scheduled_at) WHERE status = 'queued';

ALTER TABLE linkedin_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_queue" ON linkedin_queue FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_queue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_queue" ON linkedin_queue FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_queue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_queue" ON linkedin_queue FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_queue.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_queue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_queue" ON linkedin_queue FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_queue.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN EXECUTION LOGS
-- ============================================================
CREATE TABLE linkedin_execution_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  execution_job_id uuid REFERENCES linkedin_execution_jobs(id) ON DELETE CASCADE,
  log_level text NOT NULL CHECK (log_level IN ('info', 'warning', 'error', 'debug')),
  log_message text NOT NULL,
  log_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_logs_workspace ON linkedin_execution_logs(workspace_id);
CREATE INDEX idx_linkedin_logs_job ON linkedin_execution_logs(execution_job_id);
CREATE INDEX idx_linkedin_logs_created ON linkedin_execution_logs(created_at DESC);

ALTER TABLE linkedin_execution_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_logs" ON linkedin_execution_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_logs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_logs" ON linkedin_execution_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_logs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_logs" ON linkedin_execution_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_logs.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_logs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_logs" ON linkedin_execution_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_execution_logs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN FAILURES
-- ============================================================
CREATE TABLE linkedin_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  execution_job_id uuid REFERENCES linkedin_execution_jobs(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  failure_type text NOT NULL CHECK (failure_type IN ('network', 'rate_limit', 'policy_violation', 'authentication', 'session_expired', 'captcha', 'unknown')),
  failure_message text NOT NULL,
  failure_payload jsonb DEFAULT '{}'::jsonb,
  is_retryable boolean DEFAULT true,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_failures_workspace ON linkedin_failures(workspace_id);
CREATE INDEX idx_linkedin_failures_type ON linkedin_failures(failure_type);
CREATE INDEX idx_linkedin_failures_unresolved ON linkedin_failures(resolved) WHERE resolved = false;

ALTER TABLE linkedin_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_failures" ON linkedin_failures FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_failures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_failures" ON linkedin_failures FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_failures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_failures" ON linkedin_failures FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_failures.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_failures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_failures" ON linkedin_failures FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_failures.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN RETRY HISTORY
-- ============================================================
CREATE TABLE linkedin_retry_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  execution_job_id uuid REFERENCES linkedin_execution_jobs(id) ON DELETE CASCADE,
  failure_id uuid REFERENCES linkedin_failures(id) ON DELETE SET NULL,
  retry_attempt integer NOT NULL,
  retry_reason text,
  retry_delay_ms integer,
  retry_result text CHECK (retry_result IN ('success', 'failed', 'pending')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_retry_workspace ON linkedin_retry_history(workspace_id);
CREATE INDEX idx_linkedin_retry_job ON linkedin_retry_history(execution_job_id);

ALTER TABLE linkedin_retry_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_retry" ON linkedin_retry_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_retry_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_retry" ON linkedin_retry_history FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_retry_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_retry" ON linkedin_retry_history FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_retry_history.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_retry_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_retry" ON linkedin_retry_history FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_retry_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN RATE LIMITS
-- ============================================================
CREATE TABLE linkedin_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  action_type text NOT NULL,
  daily_limit integer NOT NULL,
  daily_used integer DEFAULT 0,
  weekly_limit integer NOT NULL,
  weekly_used integer DEFAULT 0,
  reset_at timestamptz,
  cooldown_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (linkedin_account_id, action_type)
);

CREATE INDEX idx_linkedin_rate_limits_account ON linkedin_rate_limits(linkedin_account_id);
CREATE INDEX idx_linkedin_rate_limits_workspace ON linkedin_rate_limits(workspace_id);

ALTER TABLE linkedin_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_rate_limits" ON linkedin_rate_limits FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_rate_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_rate_limits" ON linkedin_rate_limits FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_rate_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_rate_limits" ON linkedin_rate_limits FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_rate_limits.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_rate_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_rate_limits" ON linkedin_rate_limits FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_rate_limits.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- LINKEDIN NOTIFICATIONS
-- ============================================================
CREATE TABLE linkedin_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('account_disconnected', 'daily_limit_reached', 'risk_score_increased', 'queue_completed', 'execution_failure', 'reply_received', 'invitation_accepted', 'cooldown_started', 'warmup_progress')),
  notification_title text NOT NULL,
  notification_message text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_linkedin_notifications_workspace ON linkedin_notifications(workspace_id);
CREATE INDEX idx_linkedin_notifications_unread ON linkedin_notifications(is_read) WHERE is_read = false;

ALTER TABLE linkedin_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_linkedin_notifications" ON linkedin_notifications FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_linkedin_notifications" ON linkedin_notifications FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_linkedin_notifications" ON linkedin_notifications FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_notifications.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_linkedin_notifications" ON linkedin_notifications FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = linkedin_notifications.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_li_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_linkedin_accounts_li_updated_at ON linkedin_accounts;
CREATE TRIGGER trigger_linkedin_accounts_li_updated_at BEFORE UPDATE ON linkedin_accounts FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();

DROP TRIGGER IF EXISTS trigger_linkedin_health_updated_at ON linkedin_account_health;
CREATE TRIGGER trigger_linkedin_health_updated_at BEFORE UPDATE ON linkedin_account_health FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();

DROP TRIGGER IF EXISTS trigger_linkedin_usage_updated_at ON linkedin_daily_usage;
CREATE TRIGGER trigger_linkedin_usage_updated_at BEFORE UPDATE ON linkedin_daily_usage FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();

DROP TRIGGER IF EXISTS trigger_linkedin_jobs_updated_at ON linkedin_execution_jobs;
CREATE TRIGGER trigger_linkedin_jobs_updated_at BEFORE UPDATE ON linkedin_execution_jobs FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();

DROP TRIGGER IF EXISTS trigger_linkedin_sequences_updated_at ON linkedin_sequences;
CREATE TRIGGER trigger_linkedin_sequences_updated_at BEFORE UPDATE ON linkedin_sequences FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();

DROP TRIGGER IF EXISTS trigger_linkedin_seq_state_updated_at ON linkedin_sequence_state;
CREATE TRIGGER trigger_linkedin_seq_state_updated_at BEFORE UPDATE ON linkedin_sequence_state FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();

DROP TRIGGER IF EXISTS trigger_linkedin_rate_limits_updated_at ON linkedin_rate_limits;
CREATE TRIGGER trigger_linkedin_rate_limits_updated_at BEFORE UPDATE ON linkedin_rate_limits FOR EACH ROW EXECUTE FUNCTION update_li_updated_at();
