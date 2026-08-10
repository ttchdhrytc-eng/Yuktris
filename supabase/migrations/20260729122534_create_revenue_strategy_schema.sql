/*
# Create Revenue Strategy & Campaign Intelligence Schema
9 new tables, all RLS-enabled, workspace-scoped.
*/

-- ============================================================
-- REVENUE STRATEGIES
-- ============================================================
CREATE TABLE revenue_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_dna_id uuid REFERENCES revenue_dna_profiles(id) ON DELETE SET NULL,
  market_profile_id uuid REFERENCES market_profiles(id) ON DELETE SET NULL,
  best_icp jsonb NOT NULL DEFAULT '{}'::jsonb,
  best_market text,
  best_industry text,
  best_geography text,
  best_company_size text,
  best_decision_makers jsonb NOT NULL DEFAULT '[]'::jsonb,
  best_messaging_angle text,
  best_outreach_channel text,
  best_campaign_sequence text,
  best_follow_up_timing text,
  expected_reply_rate numeric NOT NULL DEFAULT 0,
  expected_meeting_rate numeric NOT NULL DEFAULT 0,
  expected_revenue text,
  estimated_campaign_duration text,
  confidence_score numeric NOT NULL DEFAULT 0,
  completion_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_revenue_strategies_workspace ON revenue_strategies(workspace_id);
CREATE INDEX idx_revenue_strategies_status ON revenue_strategies(status);

ALTER TABLE revenue_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_revenue_strategies" ON revenue_strategies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_revenue_strategies" ON revenue_strategies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_revenue_strategies" ON revenue_strategies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_strategies.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_revenue_strategies" ON revenue_strategies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_strategies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CAMPAIGN STRATEGIES
-- ============================================================
CREATE TABLE campaign_strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_strategy_id uuid NOT NULL REFERENCES revenue_strategies(id) ON DELETE CASCADE,
  strategy_name text NOT NULL,
  objective text,
  recommended_icp jsonb NOT NULL DEFAULT '{}'::jsonb,
  target_industry text,
  target_geography text,
  target_company_size text,
  target_revenue_range text,
  decision_maker_personas jsonb NOT NULL DEFAULT '[]'::jsonb,
  pain_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  buying_triggers jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,
  unique_messaging_angle text,
  competitive_positioning text,
  primary_cta text,
  secondary_cta text,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  expected_roi text,
  expected_meetings integer NOT NULL DEFAULT 0,
  estimated_pipeline text,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  ai_recommendation text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'active', 'paused', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_strategies_workspace ON campaign_strategies(workspace_id);
CREATE INDEX idx_campaign_strategies_strategy ON campaign_strategies(revenue_strategy_id);
CREATE INDEX idx_campaign_strategies_status ON campaign_strategies(status);

ALTER TABLE campaign_strategies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_campaign_strategies" ON campaign_strategies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_campaign_strategies" ON campaign_strategies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_campaign_strategies" ON campaign_strategies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategies.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_campaign_strategies" ON campaign_strategies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CAMPAIGN SEQUENCES
-- ============================================================
CREATE TABLE campaign_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_strategy_id uuid NOT NULL REFERENCES campaign_strategies(id) ON DELETE CASCADE,
  sequence_name text NOT NULL,
  sequence_type text NOT NULL CHECK (sequence_type IN (
    'linkedin_only', 'email_only', 'linkedin_email', 'warm_followup',
    'cold_outbound', 'enterprise_abm', 'founder_outreach',
    'channel_partner', 'referral_campaign'
  )),
  touch_order integer NOT NULL DEFAULT 1,
  delay_between_touches text,
  purpose text,
  success_criteria text,
  escalation_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  exit_rules jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_sequences_workspace ON campaign_sequences(workspace_id);
CREATE INDEX idx_campaign_sequences_strategy ON campaign_sequences(campaign_strategy_id);
CREATE INDEX idx_campaign_sequences_order ON campaign_sequences(touch_order);

ALTER TABLE campaign_sequences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_campaign_sequences" ON campaign_sequences FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_sequences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_campaign_sequences" ON campaign_sequences FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_sequences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_campaign_sequences" ON campaign_sequences FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_sequences.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_sequences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_campaign_sequences" ON campaign_sequences FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_sequences.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MESSAGE LIBRARIES
-- ============================================================
CREATE TABLE message_libraries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_strategy_id uuid REFERENCES revenue_strategies(id) ON DELETE SET NULL,
  campaign_strategy_id uuid REFERENCES campaign_strategies(id) ON DELETE SET NULL,
  asset_type text NOT NULL CHECK (asset_type IN (
    'linkedin_connection_hook', 'linkedin_opening_message', 'follow_up_theme',
    'email_subject_line', 'email_opener', 'value_hook', 'trust_builder',
    'social_proof', 'industry_angle', 'persona_angle', 'objection_response',
    'cta_library'
  )),
  content text NOT NULL,
  target_persona text,
  target_industry text,
  context text,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_message_libraries_workspace ON message_libraries(workspace_id);
CREATE INDEX idx_message_libraries_strategy ON message_libraries(revenue_strategy_id);
CREATE INDEX idx_message_libraries_campaign ON message_libraries(campaign_strategy_id);
CREATE INDEX idx_message_libraries_type ON message_libraries(asset_type);

ALTER TABLE message_libraries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_message_libraries" ON message_libraries FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_libraries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_message_libraries" ON message_libraries FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_libraries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_message_libraries" ON message_libraries FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_libraries.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_libraries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_message_libraries" ON message_libraries FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = message_libraries.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MESSAGING TEMPLATES
-- ============================================================
CREATE TABLE messaging_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_strategy_id uuid REFERENCES campaign_strategies(id) ON DELETE SET NULL,
  template_name text NOT NULL,
  channel text NOT NULL CHECK (channel IN ('linkedin', 'email', 'voice_note', 'video_message')),
  persona text,
  industry text,
  subject text,
  body text NOT NULL,
  variables jsonb NOT NULL DEFAULT '[]'::jsonb,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_messaging_templates_workspace ON messaging_templates(workspace_id);
CREATE INDEX idx_messaging_templates_campaign ON messaging_templates(campaign_strategy_id);
CREATE INDEX idx_messaging_templates_channel ON messaging_templates(channel);

ALTER TABLE messaging_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_messaging_templates" ON messaging_templates FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messaging_templates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_messaging_templates" ON messaging_templates FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messaging_templates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_messaging_templates" ON messaging_templates FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messaging_templates.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messaging_templates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_messaging_templates" ON messaging_templates FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = messaging_templates.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHANNEL RECOMMENDATIONS
-- ============================================================
CREATE TABLE channel_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_strategy_id uuid NOT NULL REFERENCES revenue_strategies(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('linkedin', 'email', 'both', 'voice_note', 'video_message', 'referral')),
  recommendation text NOT NULL,
  reasoning text,
  estimated_performance jsonb NOT NULL DEFAULT '{}'::jsonb,
  estimated_reply_rate numeric,
  estimated_meeting_rate numeric,
  is_primary boolean NOT NULL DEFAULT false,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_channel_recs_workspace ON channel_recommendations(workspace_id);
CREATE INDEX idx_channel_recs_strategy ON channel_recommendations(revenue_strategy_id);

ALTER TABLE channel_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_channel_recommendations" ON channel_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_channel_recommendations" ON channel_recommendations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_channel_recommendations" ON channel_recommendations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_recommendations.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_recommendations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_channel_recommendations" ON channel_recommendations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = channel_recommendations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CAMPAIGN GOALS
-- ============================================================
CREATE TABLE campaign_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_strategy_id uuid REFERENCES campaign_strategies(id) ON DELETE SET NULL,
  goal_type text NOT NULL CHECK (goal_type IN (
    'book_meetings', 'generate_demos', 'generate_qualified_opportunities',
    'enterprise_expansion', 'partnership_outreach', 'affiliate_recruitment',
    'account_expansion', 'product_launch', 'hiring_outreach'
  )),
  goal_description text,
  messaging_adaptation text,
  target_metric text,
  target_value text,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_goals_workspace ON campaign_goals(workspace_id);
CREATE INDEX idx_campaign_goals_strategy ON campaign_goals(campaign_strategy_id);

ALTER TABLE campaign_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_campaign_goals" ON campaign_goals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_campaign_goals" ON campaign_goals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_campaign_goals" ON campaign_goals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_goals.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_campaign_goals" ON campaign_goals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_goals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CAMPAIGN STRATEGY VERSIONS
-- ============================================================
CREATE TABLE campaign_strategy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_strategy_id uuid NOT NULL REFERENCES campaign_strategies(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  change_description text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategy_versions_workspace ON campaign_strategy_versions(workspace_id);
CREATE INDEX idx_strategy_versions_strategy ON campaign_strategy_versions(campaign_strategy_id);

ALTER TABLE campaign_strategy_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_strategy_versions" ON campaign_strategy_versions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategy_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_strategy_versions" ON campaign_strategy_versions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategy_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_strategy_versions" ON campaign_strategy_versions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategy_versions.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategy_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_strategy_versions" ON campaign_strategy_versions FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = campaign_strategy_versions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- STRATEGY APPROVALS
-- ============================================================
CREATE TABLE strategy_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  campaign_strategy_id uuid NOT NULL REFERENCES campaign_strategies(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('approve', 'edit', 'duplicate', 'save_template')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  feedback text,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_strategy_approvals_workspace ON strategy_approvals(workspace_id);
CREATE INDEX idx_strategy_approvals_strategy ON strategy_approvals(campaign_strategy_id);
CREATE INDEX idx_strategy_approvals_status ON strategy_approvals(status);

ALTER TABLE strategy_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_strategy_approvals" ON strategy_approvals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategy_approvals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_strategy_approvals" ON strategy_approvals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategy_approvals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_strategy_approvals" ON strategy_approvals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategy_approvals.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategy_approvals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_strategy_approvals" ON strategy_approvals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = strategy_approvals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_revenue_strategy_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_revenue_strategies_updated_at ON revenue_strategies;
CREATE TRIGGER trigger_revenue_strategies_updated_at BEFORE UPDATE ON revenue_strategies FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();

DROP TRIGGER IF EXISTS trigger_campaign_strategies_updated_at ON campaign_strategies;
CREATE TRIGGER trigger_campaign_strategies_updated_at BEFORE UPDATE ON campaign_strategies FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();

DROP TRIGGER IF EXISTS trigger_campaign_sequences_updated_at ON campaign_sequences;
CREATE TRIGGER trigger_campaign_sequences_updated_at BEFORE UPDATE ON campaign_sequences FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();

DROP TRIGGER IF EXISTS trigger_message_libraries_updated_at ON message_libraries;
CREATE TRIGGER trigger_message_libraries_updated_at BEFORE UPDATE ON message_libraries FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();

DROP TRIGGER IF EXISTS trigger_messaging_templates_updated_at ON messaging_templates;
CREATE TRIGGER trigger_messaging_templates_updated_at BEFORE UPDATE ON messaging_templates FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();

DROP TRIGGER IF EXISTS trigger_channel_recs_updated_at ON channel_recommendations;
CREATE TRIGGER trigger_channel_recs_updated_at BEFORE UPDATE ON channel_recommendations FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();

DROP TRIGGER IF EXISTS trigger_campaign_goals_updated_at ON campaign_goals;
CREATE TRIGGER trigger_campaign_goals_updated_at BEFORE UPDATE ON campaign_goals FOR EACH ROW EXECUTE FUNCTION update_revenue_strategy_updated_at();
