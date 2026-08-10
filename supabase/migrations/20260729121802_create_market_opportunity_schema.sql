/*
# Create Market Opportunity & Discovery Schema

## New Tables
1. `market_profiles` — persistent market profile per workspace
2. `market_segments` — sub-markets/verticals within the market profile
3. `market_opportunities` — discovered companies showing buying signals
4. `market_scores` — per-company market opportunity scores across 16 factors
5. `target_account_lists` — recommended target account lists with ROI estimates
6. `target_account_members` — companies within each target account list
7. `market_trends` — continuous market trend tracking

## Security
- RLS enabled on all tables, owner-scoped via workspace membership
*/

-- ============================================================
-- MARKET PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS market_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_analysis_id uuid REFERENCES market_analysis(id) ON DELETE SET NULL,

  total_addressable_market text,
  serviceable_addressable_market text,
  ideal_market text,
  emerging_markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  growing_industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  declining_industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  market_saturation text CHECK (market_saturation IN ('low', 'medium', 'high', 'very_high')),
  competitive_density text CHECK (competitive_density IN ('low', 'medium', 'high', 'very_high')),
  average_sales_cycle text,
  average_deal_size text,
  buying_committee_complexity text CHECK (buying_committee_complexity IN ('low', 'medium', 'high', 'very_high')),
  technology_adoption text,
  digital_maturity text CHECK (digital_maturity IN ('low', 'medium', 'high', 'very_high')),
  growth_potential integer NOT NULL DEFAULT 0,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  confidence_score numeric NOT NULL DEFAULT 0,
  completion_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  last_refreshed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_profiles_workspace ON market_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_market_profiles_status ON market_profiles(status);

ALTER TABLE market_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_market_profiles" ON market_profiles;
CREATE POLICY "select_market_profiles" ON market_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_profiles.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_market_profiles" ON market_profiles;
CREATE POLICY "insert_market_profiles" ON market_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_profiles.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_market_profiles" ON market_profiles;
CREATE POLICY "update_market_profiles" ON market_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_profiles.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_profiles.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_market_profiles" ON market_profiles;
CREATE POLICY "delete_market_profiles" ON market_profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_profiles.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MARKET SEGMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS market_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_profile_id uuid NOT NULL REFERENCES market_profiles(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  segment_type text NOT NULL CHECK (segment_type IN ('industry', 'sub_industry', 'vertical', 'geography', 'technology_ecosystem', 'business_model', 'growth_stage', 'company_size')),
  description text,
  market_size text,
  growth_rate text,
  opportunity_score integer NOT NULL DEFAULT 0,
  competition_level text CHECK (competition_level IN ('low', 'medium', 'high', 'very_high')),
  recommended boolean NOT NULL DEFAULT false,
  reason text,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_segments_workspace ON market_segments(workspace_id);
CREATE INDEX IF NOT EXISTS idx_market_segments_profile ON market_segments(market_profile_id);

ALTER TABLE market_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_market_segments" ON market_segments;
CREATE POLICY "select_market_segments" ON market_segments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_segments.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_market_segments" ON market_segments;
CREATE POLICY "insert_market_segments" ON market_segments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_segments.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_market_segments" ON market_segments;
CREATE POLICY "update_market_segments" ON market_segments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_segments.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_segments.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_market_segments" ON market_segments;
CREATE POLICY "delete_market_segments" ON market_segments FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_segments.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MARKET OPPORTUNITIES
-- ============================================================
CREATE TABLE IF NOT EXISTS market_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_profile_id uuid REFERENCES market_profiles(id) ON DELETE SET NULL,
  company_name text NOT NULL,
  website text,
  industry text,
  reason text NOT NULL,
  signal_type text NOT NULL CHECK (signal_type IN (
    'hiring', 'funding', 'expansion', 'new_office', 'technology_adoption',
    'vendor_change', 'linkedin_content', 'executive_change', 'product_launch',
    'new_market_entry', 'buying_intent', 'compliance_change', 'merger_acquisition',
    'leadership_change', 'technology_migration', 'digital_transformation'
  )),
  priority text NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  confidence numeric NOT NULL DEFAULT 0.5,
  recommended_action text,
  urgency text CHECK (urgency IN ('low', 'medium', 'high', 'immediate')),
  expected_conversion_probability numeric,
  opportunity_score integer NOT NULL DEFAULT 0,
  signal_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_opps_workspace ON market_opportunities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_market_opps_profile ON market_opportunities(market_profile_id);
CREATE INDEX IF NOT EXISTS idx_market_opps_priority ON market_opportunities(priority);
CREATE INDEX IF NOT EXISTS idx_market_opps_signal_type ON market_opportunities(signal_type);
CREATE INDEX IF NOT EXISTS idx_market_opps_score ON market_opportunities(opportunity_score DESC);

ALTER TABLE market_opportunities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_market_opportunities" ON market_opportunities;
CREATE POLICY "select_market_opportunities" ON market_opportunities FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_opportunities.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_market_opportunities" ON market_opportunities;
CREATE POLICY "insert_market_opportunities" ON market_opportunities FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_opportunities.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_market_opportunities" ON market_opportunities;
CREATE POLICY "update_market_opportunities" ON market_opportunities FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_opportunities.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_opportunities.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_market_opportunities" ON market_opportunities;
CREATE POLICY "delete_market_opportunities" ON market_opportunities FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_opportunities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MARKET SCORES
-- ============================================================
CREATE TABLE IF NOT EXISTS market_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_opportunity_id uuid NOT NULL REFERENCES market_opportunities(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  revenue_dna_fit integer NOT NULL DEFAULT 0,
  icp_fit integer NOT NULL DEFAULT 0,
  buying_signals_score integer NOT NULL DEFAULT 0,
  technology_fit integer NOT NULL DEFAULT 0,
  industry_fit integer NOT NULL DEFAULT 0,
  growth_stage_fit integer NOT NULL DEFAULT 0,
  competition_score integer NOT NULL DEFAULT 0,
  risk_score integer NOT NULL DEFAULT 0,
  geography_fit integer NOT NULL DEFAULT 0,
  market_momentum integer NOT NULL DEFAULT 0,
  decision_maker_accessibility integer NOT NULL DEFAULT 0,
  expected_reply_rate numeric NOT NULL DEFAULT 0,
  expected_meeting_rate numeric NOT NULL DEFAULT 0,
  expected_deal_quality integer NOT NULL DEFAULT 0,
  expected_sales_cycle text,
  overall_score integer NOT NULL DEFAULT 0,
  overall_confidence numeric NOT NULL DEFAULT 0.5,
  scoring_factors jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_scores_workspace ON market_scores(workspace_id);
CREATE INDEX IF NOT EXISTS idx_market_scores_opportunity ON market_scores(market_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_market_scores_overall ON market_scores(overall_score DESC);

ALTER TABLE market_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_market_scores" ON market_scores;
CREATE POLICY "select_market_scores" ON market_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_scores.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_market_scores" ON market_scores;
CREATE POLICY "insert_market_scores" ON market_scores FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_scores.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_market_scores" ON market_scores;
CREATE POLICY "update_market_scores" ON market_scores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_scores.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_scores.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_market_scores" ON market_scores;
CREATE POLICY "delete_market_scores" ON market_scores FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_scores.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TARGET ACCOUNT LISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS target_account_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_profile_id uuid REFERENCES market_profiles(id) ON DELETE SET NULL,
  list_name text NOT NULL,
  description text,
  selection_reason text NOT NULL,
  estimated_opportunities integer NOT NULL DEFAULT 0,
  average_score integer NOT NULL DEFAULT 0,
  risk_level text CHECK (risk_level IN ('low', 'medium', 'high', 'very_high')),
  expected_roi text,
  recommended boolean NOT NULL DEFAULT false,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_target_lists_workspace ON target_account_lists(workspace_id);
CREATE INDEX IF NOT EXISTS idx_target_lists_profile ON target_account_lists(market_profile_id);

ALTER TABLE target_account_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_target_account_lists" ON target_account_lists;
CREATE POLICY "select_target_account_lists" ON target_account_lists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_lists.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_target_account_lists" ON target_account_lists;
CREATE POLICY "insert_target_account_lists" ON target_account_lists FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_lists.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_target_account_lists" ON target_account_lists;
CREATE POLICY "update_target_account_lists" ON target_account_lists FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_lists.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_lists.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_target_account_lists" ON target_account_lists;
CREATE POLICY "delete_target_account_lists" ON target_account_lists FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_lists.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- TARGET ACCOUNT MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS target_account_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  target_account_list_id uuid NOT NULL REFERENCES target_account_lists(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  company_size text,
  opportunity_score integer NOT NULL DEFAULT 0,
  signal_summary text,
  recommended_action text,
  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_target_members_workspace ON target_account_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_target_members_list ON target_account_members(target_account_list_id);
CREATE INDEX IF NOT EXISTS idx_target_members_score ON target_account_members(opportunity_score DESC);

ALTER TABLE target_account_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_target_account_members" ON target_account_members;
CREATE POLICY "select_target_account_members" ON target_account_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_members.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_target_account_members" ON target_account_members;
CREATE POLICY "insert_target_account_members" ON target_account_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_members.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_target_account_members" ON target_account_members;
CREATE POLICY "update_target_account_members" ON target_account_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_members.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_members.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_target_account_members" ON target_account_members;
CREATE POLICY "delete_target_account_members" ON target_account_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = target_account_members.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MARKET TRENDS
-- ============================================================
CREATE TABLE IF NOT EXISTS market_trends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  market_profile_id uuid REFERENCES market_profiles(id) ON DELETE SET NULL,
  trend_name text NOT NULL,
  trend_type text NOT NULL CHECK (trend_type IN ('growth', 'decline', 'emerging', 'disruption', 'regulatory', 'technology', 'consumer_behavior', 'economic')),
  description text,
  affected_industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  impact_level text NOT NULL CHECK (impact_level IN ('low', 'medium', 'high', 'transformative')),
  opportunity text,
  time_horizon text CHECK (time_horizon IN ('immediate', 'short_term', 'medium_term', 'long_term')),
  momentum integer NOT NULL DEFAULT 0,
  confidence numeric NOT NULL DEFAULT 0.5,
  signal_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_market_trends_workspace ON market_trends(workspace_id);
CREATE INDEX IF NOT EXISTS idx_market_trends_profile ON market_trends(market_profile_id);
CREATE INDEX IF NOT EXISTS idx_market_trends_type ON market_trends(trend_type);
CREATE INDEX IF NOT EXISTS idx_market_trends_impact ON market_trends(impact_level);

ALTER TABLE market_trends ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_market_trends" ON market_trends;
CREATE POLICY "select_market_trends" ON market_trends FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_trends.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "insert_market_trends" ON market_trends;
CREATE POLICY "insert_market_trends" ON market_trends FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_trends.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "update_market_trends" ON market_trends;
CREATE POLICY "update_market_trends" ON market_trends FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_trends.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_trends.workspace_id AND wm.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_market_trends" ON market_trends;
CREATE POLICY "delete_market_trends" ON market_trends FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = market_trends.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_market_opportunity_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_market_profiles_updated_at ON market_profiles;
CREATE TRIGGER trigger_market_profiles_updated_at BEFORE UPDATE ON market_profiles FOR EACH ROW EXECUTE FUNCTION update_market_opportunity_updated_at();

DROP TRIGGER IF EXISTS trigger_market_segments_updated_at ON market_segments;
CREATE TRIGGER trigger_market_segments_updated_at BEFORE UPDATE ON market_segments FOR EACH ROW EXECUTE FUNCTION update_market_opportunity_updated_at();

DROP TRIGGER IF EXISTS trigger_market_opportunities_updated_at ON market_opportunities;
CREATE TRIGGER trigger_market_opportunities_updated_at BEFORE UPDATE ON market_opportunities FOR EACH ROW EXECUTE FUNCTION update_market_opportunity_updated_at();

DROP TRIGGER IF EXISTS trigger_market_scores_updated_at ON market_scores;
CREATE TRIGGER trigger_market_scores_updated_at BEFORE UPDATE ON market_scores FOR EACH ROW EXECUTE FUNCTION update_market_opportunity_updated_at();

DROP TRIGGER IF EXISTS trigger_target_lists_updated_at ON target_account_lists;
CREATE TRIGGER trigger_target_lists_updated_at BEFORE UPDATE ON target_account_lists FOR EACH ROW EXECUTE FUNCTION update_market_opportunity_updated_at();

DROP TRIGGER IF EXISTS trigger_market_trends_updated_at ON market_trends;
CREATE TRIGGER trigger_market_trends_updated_at BEFORE UPDATE ON market_trends FOR EACH ROW EXECUTE FUNCTION update_market_opportunity_updated_at();
