/*
# Phase 7 — AI Outreach Intelligence Engine Schema

## Strategy
- Extend existing `personalization_profiles` table with outreach-specific columns
- Create 9 new tables for outreach decisions, scores, timing, channels, messages, CTA, icebreakers, trust signals, reasoning
*/

-- ============================================================
-- EXTEND personalization_profiles TABLE
-- ============================================================
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE CASCADE;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS personalization_summary text;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS website_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS news_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS linkedin_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS technology_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS industry_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS pain_point_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS competitor_references jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS case_study_recommendations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS trust_signals jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS conversation_angle text;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS icebreakers jsonb DEFAULT '[]'::jsonb;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS version integer DEFAULT 1;
ALTER TABLE personalization_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_personalization_workspace ON personalization_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_personalization_company ON personalization_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_personalization_contact ON personalization_profiles(contact_id);

-- ============================================================
-- OUTREACH DECISIONS
-- ============================================================
CREATE TABLE outreach_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN (
    'contact_immediately', 'wait_3_days', 'wait_7_days',
    'engage_content_first', 'connect_first', 'email_first',
    'linkedin_first', 'multi_channel', 'skip_prospect', 'revisit_later'
  )),
  decision_reason text NOT NULL,
  confidence_score numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  status text DEFAULT 'active' CHECK (status IN ('active', 'superseded', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_outreach_decisions_workspace ON outreach_decisions(workspace_id);
CREATE INDEX idx_outreach_decisions_company ON outreach_decisions(company_id);
CREATE INDEX idx_outreach_decisions_contact ON outreach_decisions(contact_id);
CREATE INDEX idx_outreach_decisions_status ON outreach_decisions(status);

ALTER TABLE outreach_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_outreach_decisions" ON outreach_decisions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_outreach_decisions" ON outreach_decisions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_outreach_decisions" ON outreach_decisions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_decisions.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_decisions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_outreach_decisions" ON outreach_decisions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_decisions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- OUTREACH SCORES
-- ============================================================
CREATE TABLE outreach_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  connection_probability numeric DEFAULT 0,
  reply_probability numeric DEFAULT 0,
  meeting_probability numeric DEFAULT 0,
  revenue_probability numeric DEFAULT 0,
  relationship_difficulty numeric DEFAULT 0,
  channel_effectiveness jsonb DEFAULT '{}'::jsonb,
  timing_score integer DEFAULT 0,
  personalization_score integer DEFAULT 0,
  overall_outreach_score integer DEFAULT 0,
  scoring_explanation jsonb DEFAULT '{}'::jsonb,
  confidence_score numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  scored_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_outreach_scores_workspace ON outreach_scores(workspace_id);
CREATE INDEX idx_outreach_scores_company ON outreach_scores(company_id);
CREATE INDEX idx_outreach_scores_contact ON outreach_scores(contact_id);
CREATE INDEX idx_outreach_scores_overall ON outreach_scores(overall_outreach_score DESC);

ALTER TABLE outreach_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_outreach_scores" ON outreach_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_outreach_scores" ON outreach_scores FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_outreach_scores" ON outreach_scores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_scores.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_outreach_scores" ON outreach_scores FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_scores.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TIMING RECOMMENDATIONS
-- ============================================================
CREATE TABLE timing_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  best_day text CHECK (best_day IN ('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')),
  best_hour integer,
  best_sequence_timing jsonb DEFAULT '{}'::jsonb,
  follow_up_delay_days integer DEFAULT 3,
  maximum_attempts integer DEFAULT 5,
  cooling_period_days integer DEFAULT 30,
  retry_window_days integer DEFAULT 90,
  timezone text,
  timezone_aware boolean DEFAULT true,
  timing_reason text,
  confidence_score numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_timing_rec_workspace ON timing_recommendations(workspace_id);
CREATE INDEX idx_timing_rec_company ON timing_recommendations(company_id);
CREATE INDEX idx_timing_rec_contact ON timing_recommendations(contact_id);

ALTER TABLE timing_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_timing_rec" ON timing_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = timing_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_timing_rec" ON timing_recommendations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = timing_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_timing_rec" ON timing_recommendations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = timing_recommendations.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = timing_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_timing_rec" ON timing_recommendations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = timing_recommendations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHANNEL STRATEGIES
-- ============================================================
CREATE TABLE channel_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  recommended_channel text NOT NULL CHECK (recommended_channel IN ('linkedin', 'email', 'linkedin_email', 'voice_note', 'video', 'multi_channel')),
  channel_reason text NOT NULL,
  channel_priority jsonb DEFAULT '[]'::jsonb,
  expected_performance jsonb DEFAULT '{}'::jsonb,
  linkedin_feasibility text,
  email_feasibility text,
  confidence_score numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_channel_strategies_workspace ON channel_strategies(workspace_id);
CREATE INDEX idx_channel_strategies_company ON channel_strategies(company_id);
CREATE INDEX idx_channel_strategies_contact ON channel_strategies(contact_id);

ALTER TABLE channel_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_channel_strategies" ON channel_strategies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_channel_strategies" ON channel_strategies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_channel_strategies" ON channel_strategies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_strategies.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_channel_strategies" ON channel_strategies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_strategies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MESSAGE STRATEGIES
-- ============================================================
CREATE TABLE message_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  connection_request_strategy text,
  first_message_strategy text,
  second_message_strategy text,
  follow_up_strategy text,
  re_engagement_strategy text,
  email_strategy text,
  voice_note_strategy text,
  video_strategy text,
  cta_strategy text,
  objection_prevention_strategy text,
  strategy_reasoning text,
  confidence_score numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_message_strategies_workspace ON message_strategies(workspace_id);
CREATE INDEX idx_message_strategies_company ON message_strategies(company_id);
CREATE INDEX idx_message_strategies_contact ON message_strategies(contact_id);

ALTER TABLE message_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_message_strategies" ON message_strategies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_message_strategies" ON message_strategies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_message_strategies" ON message_strategies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_strategies.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_message_strategies" ON message_strategies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_strategies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CTA LIBRARY
-- ============================================================
CREATE TABLE cta_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  cta_text text NOT NULL,
  cta_type text NOT NULL CHECK (cta_type IN ('meeting', 'demo', 'call', 'resource', 'question', 'soft', 'referral', 'breakup')),
  cta_angle text,
  target_persona text,
  target_industry text,
  effectiveness_score numeric DEFAULT 0.5,
  usage_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  confidence_score numeric DEFAULT 0.5,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cta_library_workspace ON cta_library(workspace_id);
CREATE INDEX idx_cta_library_type ON cta_library(cta_type);

ALTER TABLE cta_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_cta_library" ON cta_library FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cta_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_cta_library" ON cta_library FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cta_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_cta_library" ON cta_library FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cta_library.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cta_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_cta_library" ON cta_library FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cta_library.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ICEBREAKER LIBRARY
-- ============================================================
CREATE TABLE icebreaker_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  icebreaker_text text NOT NULL,
  icebreaker_type text NOT NULL CHECK (icebreaker_type IN ('news', 'funding', 'hiring', 'content', 'milestone', 'personal', 'industry', 'competitor', 'technology', 'mutual_connection')),
  target_persona text,
  target_industry text,
  reference_url text,
  effectiveness_score numeric DEFAULT 0.5,
  usage_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  confidence_score numeric DEFAULT 0.5,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_icebreaker_library_workspace ON icebreaker_library(workspace_id);
CREATE INDEX idx_icebreaker_library_type ON icebreaker_library(icebreaker_type);

ALTER TABLE icebreaker_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_icebreaker_library" ON icebreaker_library FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = icebreaker_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_icebreaker_library" ON icebreaker_library FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = icebreaker_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_icebreaker_library" ON icebreaker_library FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = icebreaker_library.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = icebreaker_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_icebreaker_library" ON icebreaker_library FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = icebreaker_library.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TRUST SIGNAL LIBRARY
-- ============================================================
CREATE TABLE trust_signal_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_text text NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN ('case_study', 'testimonial', 'metric', 'award', 'certification', 'partnership', 'social_proof', 'authority', 'data_point', 'guarantee')),
  target_persona text,
  target_industry text,
  effectiveness_score numeric DEFAULT 0.5,
  usage_count integer DEFAULT 0,
  success_count integer DEFAULT 0,
  confidence_score numeric DEFAULT 0.5,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_trust_signal_workspace ON trust_signal_library(workspace_id);
CREATE INDEX idx_trust_signal_type ON trust_signal_library(signal_type);

ALTER TABLE trust_signal_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_trust_signal_library" ON trust_signal_library FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trust_signal_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_trust_signal_library" ON trust_signal_library FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trust_signal_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_trust_signal_library" ON trust_signal_library FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trust_signal_library.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trust_signal_library.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_trust_signal_library" ON trust_signal_library FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = trust_signal_library.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- OUTREACH REASONING
-- ============================================================
CREATE TABLE outreach_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  reasoning_type text NOT NULL CHECK (reasoning_type IN ('decision', 'personalization', 'timing', 'channel', 'message', 'scoring')),
  reasoning_text text NOT NULL,
  reasoning_factors jsonb DEFAULT '{}'::jsonb,
  confidence_score numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_outreach_reasoning_workspace ON outreach_reasoning(workspace_id);
CREATE INDEX idx_outreach_reasoning_company ON outreach_reasoning(company_id);
CREATE INDEX idx_outreach_reasoning_contact ON outreach_reasoning(contact_id);
CREATE INDEX idx_outreach_reasoning_type ON outreach_reasoning(reasoning_type);

ALTER TABLE outreach_reasoning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_outreach_reasoning" ON outreach_reasoning FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_outreach_reasoning" ON outreach_reasoning FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_outreach_reasoning" ON outreach_reasoning FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_reasoning.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_outreach_reasoning" ON outreach_reasoning FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = outreach_reasoning.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_oi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_outreach_decisions_updated_at ON outreach_decisions;
CREATE TRIGGER trigger_outreach_decisions_updated_at BEFORE UPDATE ON outreach_decisions FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_outreach_scores_updated_at ON outreach_scores;
CREATE TRIGGER trigger_outreach_scores_updated_at BEFORE UPDATE ON outreach_scores FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_timing_rec_updated_at ON timing_recommendations;
CREATE TRIGGER trigger_timing_rec_updated_at BEFORE UPDATE ON timing_recommendations FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_channel_strategies_updated_at ON channel_strategies;
CREATE TRIGGER trigger_channel_strategies_updated_at BEFORE UPDATE ON channel_strategies FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_message_strategies_updated_at ON message_strategies;
CREATE TRIGGER trigger_message_strategies_updated_at BEFORE UPDATE ON message_strategies FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_cta_library_updated_at ON cta_library;
CREATE TRIGGER trigger_cta_library_updated_at BEFORE UPDATE ON cta_library FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_icebreaker_library_updated_at ON icebreaker_library;
CREATE TRIGGER trigger_icebreaker_library_updated_at BEFORE UPDATE ON icebreaker_library FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_trust_signal_library_updated_at ON trust_signal_library;
CREATE TRIGGER trigger_trust_signal_library_updated_at BEFORE UPDATE ON trust_signal_library FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();

DROP TRIGGER IF EXISTS trigger_personalization_profiles_oi_updated_at ON personalization_profiles;
CREATE TRIGGER trigger_personalization_profiles_oi_updated_at BEFORE UPDATE ON personalization_profiles FOR EACH ROW EXECUTE FUNCTION update_oi_updated_at();
