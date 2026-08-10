/*
# Create Buying Intent Agent Schema

## Overview
Creates the complete database schema for the Buying Intent Agent.
This agent analyzes every available signal from companies, stakeholders,
industries, technologies, digital activities, and market trends to determine
which prospects are most likely to purchase. It runs after all upstream agents
(BI, Market, ICP, Prospect Discovery, Sales Navigator, Company Research,
Decision Maker Research) complete.

## New Tables (5 total)

1. **buying_intent_analysis** — Main analysis record. Links to workspace, company,
   and company_research. Stores intent score, opportunity score, urgency score,
   confidence score, intent level, buying window, recommended priority, and status.

2. **intent_signals** — Individual signals collected per analysis (hiring, funding,
   expansion, technology changes, website updates, leadership changes, product launches,
   partnerships, acquisitions). Each has a signal type, value, weight, confidence, and priority.

3. **stakeholder_signals** — Per-contact stakeholder signals linked to an analysis and
   a contact: activity score, engagement score, influence score, and buying readiness.

4. **intent_predictions** — AI-driven predictions per analysis: purchase probability,
   estimated deal size, estimated sales cycle, expected close rate, and risk score.

5. **intent_recommendations** — AI-generated outreach recommendations per analysis:
   recommendation text, priority, and reason.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member() function.
- Child tables (2-5) scope through buying_intent_analysis using EXISTS subquery.
- stakeholder_signals additionally joins contacts → decision_maker_research for workspace scoping.
- 4 CRUD policies per table (select, insert, update, delete) — no FOR ALL.
- All policies use TO authenticated.

## Important Notes
1. buying_intent_analysis links to company_research via research_id (loose reference, no FK).
2. All child tables cascade delete when a buying_intent_analysis record is deleted.
3. Indexes created on workspace_id, company_id, research_id, analysis_id, contact_id, and status.
4. The updated_at trigger on buying_intent_analysis auto-updates the timestamp.
*/

-- ============================================================
-- 1. buying_intent_analysis (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS buying_intent_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid,
  research_id uuid,
  intent_score integer DEFAULT 0,
  opportunity_score integer DEFAULT 0,
  urgency_score integer DEFAULT 0,
  confidence_score integer DEFAULT 0,
  intent_level text DEFAULT 'medium' CHECK (intent_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
  buying_window text,
  recommended_priority text DEFAULT 'medium' CHECK (recommended_priority IN ('low', 'medium', 'high', 'critical')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buying_intent_workspace_id ON buying_intent_analysis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_buying_intent_company_id ON buying_intent_analysis(company_id);
CREATE INDEX IF NOT EXISTS idx_buying_intent_research_id ON buying_intent_analysis(research_id);
CREATE INDEX IF NOT EXISTS idx_buying_intent_status ON buying_intent_analysis(status);

ALTER TABLE buying_intent_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_buying_intent" ON buying_intent_analysis;
CREATE POLICY "select_own_buying_intent" ON buying_intent_analysis FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_buying_intent" ON buying_intent_analysis;
CREATE POLICY "insert_own_buying_intent" ON buying_intent_analysis FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_buying_intent" ON buying_intent_analysis;
CREATE POLICY "update_own_buying_intent" ON buying_intent_analysis FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_buying_intent" ON buying_intent_analysis;
CREATE POLICY "delete_own_buying_intent" ON buying_intent_analysis FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. intent_signals
-- ============================================================

CREATE TABLE IF NOT EXISTS intent_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES buying_intent_analysis(id) ON DELETE CASCADE,
  signal_name text NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('hiring', 'funding', 'expansion', 'technology', 'website', 'leadership', 'product', 'partnership', 'acquisition', 'revenue', 'employee_growth', 'market', 'digital', 'competitive', 'security', 'infrastructure')),
  signal_value text,
  signal_weight integer DEFAULT 0,
  confidence integer DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_signals_analysis_id ON intent_signals(analysis_id);
CREATE INDEX IF NOT EXISTS idx_intent_signals_signal_type ON intent_signals(signal_type);

ALTER TABLE intent_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_intent_signals" ON intent_signals;
CREATE POLICY "select_own_intent_signals" ON intent_signals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_intent_signals" ON intent_signals;
CREATE POLICY "insert_own_intent_signals" ON intent_signals FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_intent_signals" ON intent_signals;
CREATE POLICY "update_own_intent_signals" ON intent_signals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_intent_signals" ON intent_signals;
CREATE POLICY "delete_own_intent_signals" ON intent_signals FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

-- ============================================================
-- 3. stakeholder_signals
-- ============================================================

CREATE TABLE IF NOT EXISTS stakeholder_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES buying_intent_analysis(id) ON DELETE CASCADE,
  contact_id uuid,
  activity_score integer DEFAULT 0,
  engagement_score integer DEFAULT 0,
  influence_score integer DEFAULT 0,
  buying_readiness integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stakeholder_signals_analysis_id ON stakeholder_signals(analysis_id);
CREATE INDEX IF NOT EXISTS idx_stakeholder_signals_contact_id ON stakeholder_signals(contact_id);

ALTER TABLE stakeholder_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_stakeholder_signals" ON stakeholder_signals;
CREATE POLICY "select_own_stakeholder_signals" ON stakeholder_signals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = stakeholder_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_stakeholder_signals" ON stakeholder_signals;
CREATE POLICY "insert_own_stakeholder_signals" ON stakeholder_signals FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = stakeholder_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_stakeholder_signals" ON stakeholder_signals;
CREATE POLICY "update_own_stakeholder_signals" ON stakeholder_signals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = stakeholder_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = stakeholder_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_stakeholder_signals" ON stakeholder_signals;
CREATE POLICY "delete_own_stakeholder_signals" ON stakeholder_signals FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = stakeholder_signals.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

-- ============================================================
-- 4. intent_predictions
-- ============================================================

CREATE TABLE IF NOT EXISTS intent_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES buying_intent_analysis(id) ON DELETE CASCADE,
  purchase_probability integer DEFAULT 0,
  estimated_deal_size text,
  estimated_sales_cycle text,
  expected_close_rate integer DEFAULT 0,
  risk_score integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_predictions_analysis_id ON intent_predictions(analysis_id);

ALTER TABLE intent_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_intent_predictions" ON intent_predictions;
CREATE POLICY "select_own_intent_predictions" ON intent_predictions FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_predictions.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_intent_predictions" ON intent_predictions;
CREATE POLICY "insert_own_intent_predictions" ON intent_predictions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_predictions.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_intent_predictions" ON intent_predictions;
CREATE POLICY "update_own_intent_predictions" ON intent_predictions FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_predictions.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_predictions.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_intent_predictions" ON intent_predictions;
CREATE POLICY "delete_own_intent_predictions" ON intent_predictions FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_predictions.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

-- ============================================================
-- 5. intent_recommendations
-- ============================================================

CREATE TABLE IF NOT EXISTS intent_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES buying_intent_analysis(id) ON DELETE CASCADE,
  recommendation text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_intent_recommendations_analysis_id ON intent_recommendations(analysis_id);

ALTER TABLE intent_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_intent_recommendations" ON intent_recommendations;
CREATE POLICY "select_own_intent_recommendations" ON intent_recommendations FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_recommendations.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_intent_recommendations" ON intent_recommendations;
CREATE POLICY "insert_own_intent_recommendations" ON intent_recommendations FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_recommendations.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_intent_recommendations" ON intent_recommendations;
CREATE POLICY "update_own_intent_recommendations" ON intent_recommendations FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_recommendations.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_recommendations.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_intent_recommendations" ON intent_recommendations;
CREATE POLICY "delete_own_intent_recommendations" ON intent_recommendations FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM buying_intent_analysis WHERE buying_intent_analysis.id = intent_recommendations.analysis_id AND is_workspace_member(buying_intent_analysis.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on buying_intent_analysis
-- ============================================================

CREATE OR REPLACE FUNCTION update_buying_intent_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_buying_intent_updated_at ON buying_intent_analysis;
CREATE TRIGGER trigger_buying_intent_updated_at
  BEFORE UPDATE ON buying_intent_analysis
  FOR EACH ROW
  EXECUTE FUNCTION update_buying_intent_updated_at();