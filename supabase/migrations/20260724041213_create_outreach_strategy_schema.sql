/*
# Create Outreach Strategy Agent Schema

## Overview
Creates the complete database schema for the Outreach Strategy Agent.
This agent transforms personalization intelligence into complete
outreach strategies. It DOES NOT send messages or automate LinkedIn —
it only creates structured outreach strategies that can later be
executed by the LinkedIn Execution Agent or other channel execution
agents.

It runs after all upstream agents complete: Business Intelligence,
Market Intelligence, ICP Intelligence, Prospect Discovery, Sales
Navigator, Company Research, Decision Maker Research, Buying Intent,
and Personalization Blueprint.

## Naming
All tables use the `outreach_` prefix to avoid conflicts with existing
`campaigns` and `recommendations` tables.

## New Tables (6 total)

1. **outreach_campaigns** — Main campaign record.
2. **outreach_touchpoints** — Individual touchpoints in the sequence.
3. **outreach_channel_strategy** — Channel-specific strategy.
4. **outreach_timing_strategy** — Timing recommendations.
5. **outreach_campaign_metrics** — Expected success metrics.
6. **outreach_recommendations** — AI recommendations.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member().
- Child tables scope through outreach_campaigns using EXISTS subquery.
- 4 CRUD policies per table — no FOR ALL.
- All policies use TO authenticated.
*/

-- ============================================================
-- 1. outreach_campaigns (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid,
  contact_id uuid,
  campaign_name text NOT NULL,
  campaign_type text NOT NULL DEFAULT 'multi_touch' CHECK (campaign_type IN ('multi_touch', 'single_touch', 'sequence', 'drip', 'ab_test')),
  campaign_status text NOT NULL DEFAULT 'queued' CHECK (campaign_status IN ('queued', 'processing', 'completed', 'failed', 'archived')),
  campaign_score integer DEFAULT 0,
  success_probability integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_workspace_id ON outreach_campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_company_id ON outreach_campaigns(company_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_contact_id ON outreach_campaigns(contact_id);
CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(campaign_status);

ALTER TABLE outreach_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outreach_campaigns" ON outreach_campaigns;
CREATE POLICY "select_own_outreach_campaigns" ON outreach_campaigns FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_outreach_campaigns" ON outreach_campaigns;
CREATE POLICY "insert_own_outreach_campaigns" ON outreach_campaigns FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_outreach_campaigns" ON outreach_campaigns;
CREATE POLICY "update_own_outreach_campaigns" ON outreach_campaigns FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_outreach_campaigns" ON outreach_campaigns;
CREATE POLICY "delete_own_outreach_campaigns" ON outreach_campaigns FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. outreach_touchpoints
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_touchpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  sequence integer NOT NULL,
  channel text NOT NULL,
  purpose text,
  timing text,
  cta text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'skipped', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_touchpoints_campaign_id ON outreach_touchpoints(campaign_id);
CREATE INDEX IF NOT EXISTS idx_outreach_touchpoints_sequence ON outreach_touchpoints(sequence);

ALTER TABLE outreach_touchpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outreach_touchpoints" ON outreach_touchpoints;
CREATE POLICY "select_own_outreach_touchpoints" ON outreach_touchpoints FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_touchpoints.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_outreach_touchpoints" ON outreach_touchpoints;
CREATE POLICY "insert_own_outreach_touchpoints" ON outreach_touchpoints FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_touchpoints.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_outreach_touchpoints" ON outreach_touchpoints;
CREATE POLICY "update_own_outreach_touchpoints" ON outreach_touchpoints FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_touchpoints.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_touchpoints.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_outreach_touchpoints" ON outreach_touchpoints;
CREATE POLICY "delete_own_outreach_touchpoints" ON outreach_touchpoints FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_touchpoints.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

-- ============================================================
-- 3. outreach_channel_strategy
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_channel_strategy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  channel text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_channel_strategy_campaign_id ON outreach_channel_strategy(campaign_id);

ALTER TABLE outreach_channel_strategy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outreach_channel_strategy" ON outreach_channel_strategy;
CREATE POLICY "select_own_outreach_channel_strategy" ON outreach_channel_strategy FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_channel_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_outreach_channel_strategy" ON outreach_channel_strategy;
CREATE POLICY "insert_own_outreach_channel_strategy" ON outreach_channel_strategy FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_channel_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_outreach_channel_strategy" ON outreach_channel_strategy;
CREATE POLICY "update_own_outreach_channel_strategy" ON outreach_channel_strategy FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_channel_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_channel_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_outreach_channel_strategy" ON outreach_channel_strategy;
CREATE POLICY "delete_own_outreach_channel_strategy" ON outreach_channel_strategy FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_channel_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

-- ============================================================
-- 4. outreach_timing_strategy
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_timing_strategy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  best_day text,
  best_time text,
  follow_up_interval text,
  cooling_period text,
  maximum_attempts integer DEFAULT 6,
  campaign_expiry text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_timing_strategy_campaign_id ON outreach_timing_strategy(campaign_id);

ALTER TABLE outreach_timing_strategy ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outreach_timing_strategy" ON outreach_timing_strategy;
CREATE POLICY "select_own_outreach_timing_strategy" ON outreach_timing_strategy FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_timing_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_outreach_timing_strategy" ON outreach_timing_strategy;
CREATE POLICY "insert_own_outreach_timing_strategy" ON outreach_timing_strategy FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_timing_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_outreach_timing_strategy" ON outreach_timing_strategy;
CREATE POLICY "update_own_outreach_timing_strategy" ON outreach_timing_strategy FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_timing_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_timing_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_outreach_timing_strategy" ON outreach_timing_strategy;
CREATE POLICY "delete_own_outreach_timing_strategy" ON outreach_timing_strategy FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_timing_strategy.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

-- ============================================================
-- 5. outreach_campaign_metrics
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_campaign_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  expected_acceptance_rate integer DEFAULT 0,
  expected_reply_rate integer DEFAULT 0,
  expected_meeting_rate integer DEFAULT 0,
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_campaign_metrics_campaign_id ON outreach_campaign_metrics(campaign_id);

ALTER TABLE outreach_campaign_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outreach_campaign_metrics" ON outreach_campaign_metrics;
CREATE POLICY "select_own_outreach_campaign_metrics" ON outreach_campaign_metrics FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_campaign_metrics.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_outreach_campaign_metrics" ON outreach_campaign_metrics;
CREATE POLICY "insert_own_outreach_campaign_metrics" ON outreach_campaign_metrics FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_campaign_metrics.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_outreach_campaign_metrics" ON outreach_campaign_metrics;
CREATE POLICY "update_own_outreach_campaign_metrics" ON outreach_campaign_metrics FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_campaign_metrics.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_campaign_metrics.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_outreach_campaign_metrics" ON outreach_campaign_metrics;
CREATE POLICY "delete_own_outreach_campaign_metrics" ON outreach_campaign_metrics FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_campaign_metrics.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

-- ============================================================
-- 6. outreach_recommendations
-- ============================================================

CREATE TABLE IF NOT EXISTS outreach_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES outreach_campaigns(id) ON DELETE CASCADE,
  recommendation text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outreach_recommendations_campaign_id ON outreach_recommendations(campaign_id);

ALTER TABLE outreach_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_outreach_recommendations" ON outreach_recommendations;
CREATE POLICY "select_own_outreach_recommendations" ON outreach_recommendations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_recommendations.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_outreach_recommendations" ON outreach_recommendations;
CREATE POLICY "insert_own_outreach_recommendations" ON outreach_recommendations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_recommendations.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_outreach_recommendations" ON outreach_recommendations;
CREATE POLICY "update_own_outreach_recommendations" ON outreach_recommendations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_recommendations.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_recommendations.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_outreach_recommendations" ON outreach_recommendations;
CREATE POLICY "delete_own_outreach_recommendations" ON outreach_recommendations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM outreach_campaigns WHERE outreach_campaigns.id = outreach_recommendations.campaign_id AND is_workspace_member(outreach_campaigns.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on outreach_campaigns
-- ============================================================

CREATE OR REPLACE FUNCTION update_outreach_campaign_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_outreach_campaign_updated_at ON outreach_campaigns;
CREATE TRIGGER trigger_outreach_campaign_updated_at
  BEFORE UPDATE ON outreach_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_outreach_campaign_updated_at();