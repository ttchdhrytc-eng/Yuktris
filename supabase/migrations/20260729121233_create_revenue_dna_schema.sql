/*
# Create Revenue DNA Profile tables

1. Purpose
   Stores the persistent "Revenue DNA" — the deep business intelligence profile
   that every AI agent queries before making decisions. Includes buyer personas,
   competitor intelligence, value propositions, trust signals, and messaging guidance.

2. New Tables
   - `revenue_dna_profiles` — the master Revenue DNA profile per workspace
     - business_identity, core_services, target_industries, ideal_customer_characteristics
     - market_position, differentiators, business_strengths, pain_points_solved
     - customer_outcomes, buyer_personas_summary, buying_committee, buying_signals
     - disqualifiers, messaging_tone, sales_motion, typical_objections
     - offer_types, geographies, languages, technologies, trust_signals
     - content_assets, keywords, categories, brand_positioning
     - company_size, geographic_markets, sales_motion_detail
     - confidence_score, completion_percentage, status
   - `buyer_personas` — detailed personas for each buyer role
     - role, responsibilities, goals, kpis, daily_challenges
     - common_objections, buying_authority, preferred_communication_style
     - linkedin_behavior, email_behavior, typical_questions, recommended_messaging_style
   - `competitor_intelligence` — competitor knowledge base
     - competitor_name, competitor_type (direct/indirect/alternative)
     - key_differentiators, pricing_positioning, messaging_differences
     - strengths, weaknesses, competitive_opportunities
   - `value_propositions` — generated value props and messaging hooks
     - proposition_type (primary/secondary/industry_specific/persona_specific)
     - target_industry, target_persona, content
     - email_hooks, linkedin_hooks, opening_messages
     - conversation_starters, trust_builders, social_proof_suggestions, cta_suggestions

3. Security
   - RLS enabled on all tables
   - Owner-scoped via workspace membership check (is_workspace_member)
*/

-- ============================================================
-- REVENUE DNA PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS revenue_dna_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  business_analysis_id uuid REFERENCES business_analysis(id) ON DELETE SET NULL,

  -- Business Identity
  business_identity jsonb NOT NULL DEFAULT '{}'::jsonb,
  core_services jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_industries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ideal_customer_characteristics jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Market Position
  market_position jsonb NOT NULL DEFAULT '{}'::jsonb,
  differentiators jsonb NOT NULL DEFAULT '[]'::jsonb,
  business_strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  brand_positioning text,

  -- Pain Points & Outcomes
  pain_points_solved jsonb NOT NULL DEFAULT '[]'::jsonb,
  customer_outcomes jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Buying Intelligence
  buying_committee jsonb NOT NULL DEFAULT '[]'::jsonb,
  buying_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  disqualifiers jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Sales Motion
  sales_motion text CHECK (sales_motion IN ('smb', 'mid_market', 'enterprise', 'mixed')),
  sales_motion_detail text,
  typical_objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  offer_types jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Geography & Tech
  geographies jsonb NOT NULL DEFAULT '[]'::jsonb,
  languages jsonb NOT NULL DEFAULT '[]'::jsonb,
  technologies jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Trust & Content
  trust_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_assets jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Metadata
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  company_size text,
  geographic_markets jsonb NOT NULL DEFAULT '[]'::jsonb,
  market_maturity text,

  -- Scoring
  confidence_score numeric NOT NULL DEFAULT 0,
  completion_percentage numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_revenue_dna_workspace ON revenue_dna_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS idx_revenue_dna_status ON revenue_dna_profiles(status);

ALTER TABLE revenue_dna_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_revenue_dna_profiles" ON revenue_dna_profiles;
CREATE POLICY "select_revenue_dna_profiles" ON revenue_dna_profiles
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_dna_profiles.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_revenue_dna_profiles" ON revenue_dna_profiles;
CREATE POLICY "insert_revenue_dna_profiles" ON revenue_dna_profiles
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_dna_profiles.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_revenue_dna_profiles" ON revenue_dna_profiles;
CREATE POLICY "update_revenue_dna_profiles" ON revenue_dna_profiles
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_dna_profiles.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_dna_profiles.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_revenue_dna_profiles" ON revenue_dna_profiles;
CREATE POLICY "delete_revenue_dna_profiles" ON revenue_dna_profiles
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = revenue_dna_profiles.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- BUYER PERSONAS
-- ============================================================
CREATE TABLE IF NOT EXISTS buyer_personas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_dna_id uuid NOT NULL REFERENCES revenue_dna_profiles(id) ON DELETE CASCADE,

  role text NOT NULL,
  responsibilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  goals jsonb NOT NULL DEFAULT '[]'::jsonb,
  kpis jsonb NOT NULL DEFAULT '[]'::jsonb,
  daily_challenges jsonb NOT NULL DEFAULT '[]'::jsonb,
  common_objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  buying_authority text,
  preferred_communication_style text,
  linkedin_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_behavior jsonb NOT NULL DEFAULT '{}'::jsonb,
  typical_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  recommended_messaging_style text,

  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_buyer_personas_workspace ON buyer_personas(workspace_id);
CREATE INDEX IF NOT EXISTS idx_buyer_personas_dna ON buyer_personas(revenue_dna_id);

ALTER TABLE buyer_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_buyer_personas" ON buyer_personas;
CREATE POLICY "select_buyer_personas" ON buyer_personas
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = buyer_personas.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_buyer_personas" ON buyer_personas;
CREATE POLICY "insert_buyer_personas" ON buyer_personas
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = buyer_personas.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_buyer_personas" ON buyer_personas;
CREATE POLICY "update_buyer_personas" ON buyer_personas
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = buyer_personas.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = buyer_personas.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_buyer_personas" ON buyer_personas;
CREATE POLICY "delete_buyer_personas" ON buyer_personas
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = buyer_personas.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COMPETITOR INTELLIGENCE
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_dna_id uuid NOT NULL REFERENCES revenue_dna_profiles(id) ON DELETE CASCADE,

  competitor_name text NOT NULL,
  competitor_type text NOT NULL CHECK (competitor_type IN ('direct', 'indirect', 'alternative')),
  key_differentiators jsonb NOT NULL DEFAULT '[]'::jsonb,
  pricing_positioning text,
  messaging_differences jsonb NOT NULL DEFAULT '[]'::jsonb,
  strengths jsonb NOT NULL DEFAULT '[]'::jsonb,
  weaknesses jsonb NOT NULL DEFAULT '[]'::jsonb,
  competitive_opportunities jsonb NOT NULL DEFAULT '[]'::jsonb,
  website text,

  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_competitor_intel_workspace ON competitor_intelligence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_competitor_intel_dna ON competitor_intelligence(revenue_dna_id);

ALTER TABLE competitor_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_competitor_intelligence" ON competitor_intelligence;
CREATE POLICY "select_competitor_intelligence" ON competitor_intelligence
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = competitor_intelligence.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_competitor_intelligence" ON competitor_intelligence;
CREATE POLICY "insert_competitor_intelligence" ON competitor_intelligence
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = competitor_intelligence.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_competitor_intelligence" ON competitor_intelligence;
CREATE POLICY "update_competitor_intelligence" ON competitor_intelligence
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = competitor_intelligence.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = competitor_intelligence.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_competitor_intelligence" ON competitor_intelligence;
CREATE POLICY "delete_competitor_intelligence" ON competitor_intelligence
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = competitor_intelligence.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- VALUE PROPOSITIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS value_propositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_dna_id uuid NOT NULL REFERENCES revenue_dna_profiles(id) ON DELETE CASCADE,

  proposition_type text NOT NULL CHECK (proposition_type IN ('primary', 'secondary', 'industry_specific', 'persona_specific')),
  target_industry text,
  target_persona text,
  content text NOT NULL,

  email_hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  linkedin_hooks jsonb NOT NULL DEFAULT '[]'::jsonb,
  opening_messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  conversation_starters jsonb NOT NULL DEFAULT '[]'::jsonb,
  trust_builders jsonb NOT NULL DEFAULT '[]'::jsonb,
  social_proof_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_suggestions jsonb NOT NULL DEFAULT '[]'::jsonb,

  confidence_score numeric NOT NULL DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_value_props_workspace ON value_propositions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_value_props_dna ON value_propositions(revenue_dna_id);
CREATE INDEX IF NOT EXISTS idx_value_props_type ON value_propositions(proposition_type);

ALTER TABLE value_propositions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_value_propositions" ON value_propositions;
CREATE POLICY "select_value_propositions" ON value_propositions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = value_propositions.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "insert_value_propositions" ON value_propositions;
CREATE POLICY "insert_value_propositions" ON value_propositions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = value_propositions.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "update_value_propositions" ON value_propositions;
CREATE POLICY "update_value_propositions" ON value_propositions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = value_propositions.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = value_propositions.workspace_id AND wm.user_id = auth.uid()));

DROP POLICY IF EXISTS "delete_value_propositions" ON value_propositions;
CREATE POLICY "delete_value_propositions" ON value_propositions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = value_propositions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_revenue_dna_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_revenue_dna_updated_at ON revenue_dna_profiles;
CREATE TRIGGER trigger_revenue_dna_updated_at
  BEFORE UPDATE ON revenue_dna_profiles
  FOR EACH ROW EXECUTE FUNCTION update_revenue_dna_updated_at();

DROP TRIGGER IF EXISTS trigger_buyer_personas_updated_at ON buyer_personas;
CREATE TRIGGER trigger_buyer_personas_updated_at
  BEFORE UPDATE ON buyer_personas
  FOR EACH ROW EXECUTE FUNCTION update_revenue_dna_updated_at();

DROP TRIGGER IF EXISTS trigger_competitor_intel_updated_at ON competitor_intelligence;
CREATE TRIGGER trigger_competitor_intel_updated_at
  BEFORE UPDATE ON competitor_intelligence
  FOR EACH ROW EXECUTE FUNCTION update_revenue_dna_updated_at();

DROP TRIGGER IF EXISTS trigger_value_props_updated_at ON value_propositions;
CREATE TRIGGER trigger_value_props_updated_at
  BEFORE UPDATE ON value_propositions
  FOR EACH ROW EXECUTE FUNCTION update_revenue_dna_updated_at();
