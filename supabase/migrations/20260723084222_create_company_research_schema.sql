/*
# Create Company Research Agent Schema

## Overview
Creates the complete database schema for the Company Research Agent.
This agent performs deep intelligence gathering for every discovered company,
building comprehensive business profiles before Decision Maker Research.

## New Tables (7 total)

1. **company_research** — Main research record. Links to workspace and a discovered company.
   Tracks research status, research score, confidence score, and executive summary.

2. **company_profiles** — Company overview data: name, website, industry, sub-industry,
   headquarters, employee count, annual revenue, company size, business model, target market.

3. **products_services** — Products and services offered by the company:
   name, category, pricing model, target audience, competitive advantage.

4. **technology_profiles** — Technology stack detected for the company:
   category (frontend/backend/hosting/crm/etc), technology name, version, confidence.

5. **growth_signals** — Growth indicators: funding, hiring, expansion, acquisitions,
   partnerships, new offices, new products, leadership changes. Each has priority and confidence.

6. **digital_presence** — Digital footprint across platforms: website, blog, LinkedIn,
   Facebook, Instagram, X (Twitter), YouTube, GitHub, review platforms. Stores URL, followers, activity score.

7. **company_business_analysis** — SWOT analysis and market positioning:
   strengths, weaknesses, opportunities, threats, market position, competitive advantages.
   (Named with "company_" prefix to avoid collision with the existing business_analysis table
   from the Business Intelligence Agent.)

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member() function.
- Child tables (2-7) scope through company_research using EXISTS subquery.
- 4 CRUD policies per table (select, insert, update, delete) — no FOR ALL.
- All policies use TO authenticated.

## Important Notes
1. company_research links to prospect_discovery_companies via company_id (loose reference, no FK constraint).
2. All child tables cascade delete when a company_research record is deleted.
3. Indexes created on workspace_id, company_id, research_id, and research_status for query performance.
4. The updated_at trigger on company_research auto-updates the timestamp.
*/

-- ============================================================
-- 1. company_research (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS company_research (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid,
  research_status text NOT NULL DEFAULT 'queued' CHECK (research_status IN ('queued', 'processing', 'completed', 'failed')),
  research_score integer DEFAULT 0,
  confidence_score integer DEFAULT 0,
  executive_summary text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_research_workspace_id ON company_research(workspace_id);
CREATE INDEX IF NOT EXISTS idx_company_research_company_id ON company_research(company_id);
CREATE INDEX IF NOT EXISTS idx_company_research_status ON company_research(research_status);

ALTER TABLE company_research ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_company_research" ON company_research;
CREATE POLICY "select_own_company_research" ON company_research FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_company_research" ON company_research;
CREATE POLICY "insert_own_company_research" ON company_research FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_company_research" ON company_research;
CREATE POLICY "update_own_company_research" ON company_research FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_company_research" ON company_research;
CREATE POLICY "delete_own_company_research" ON company_research FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. company_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS company_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES company_research(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  sub_industry text,
  headquarters text,
  founded text,
  locations text[] DEFAULT '{}',
  employee_count text,
  annual_revenue text,
  company_size text,
  business_model text,
  target_market text,
  mission text,
  vision text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_research_id ON company_profiles(research_id);

ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_company_profiles" ON company_profiles;
CREATE POLICY "select_own_company_profiles" ON company_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_company_profiles" ON company_profiles;
CREATE POLICY "insert_own_company_profiles" ON company_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_company_profiles" ON company_profiles;
CREATE POLICY "update_own_company_profiles" ON company_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_company_profiles" ON company_profiles;
CREATE POLICY "delete_own_company_profiles" ON company_profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

-- ============================================================
-- 3. products_services
-- ============================================================

CREATE TABLE IF NOT EXISTS products_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES company_research(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text,
  pricing_model text,
  target_audience text,
  competitive_advantage text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_services_research_id ON products_services(research_id);

ALTER TABLE products_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_products_services" ON products_services;
CREATE POLICY "select_own_products_services" ON products_services FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = products_services.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_products_services" ON products_services;
CREATE POLICY "insert_own_products_services" ON products_services FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = products_services.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_products_services" ON products_services;
CREATE POLICY "update_own_products_services" ON products_services FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = products_services.research_id AND is_workspace_member(company_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = products_services.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_products_services" ON products_services;
CREATE POLICY "delete_own_products_services" ON products_services FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = products_services.research_id AND is_workspace_member(company_research.workspace_id))
  );

-- ============================================================
-- 4. technology_profiles
-- ============================================================

CREATE TABLE IF NOT EXISTS technology_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES company_research(id) ON DELETE CASCADE,
  category text NOT NULL,
  technology_name text NOT NULL,
  version text,
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_technology_profiles_research_id ON technology_profiles(research_id);
CREATE INDEX IF NOT EXISTS idx_technology_profiles_category ON technology_profiles(category);

ALTER TABLE technology_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_technology_profiles" ON technology_profiles;
CREATE POLICY "select_own_technology_profiles" ON technology_profiles FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = technology_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_technology_profiles" ON technology_profiles;
CREATE POLICY "insert_own_technology_profiles" ON technology_profiles FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = technology_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_technology_profiles" ON technology_profiles;
CREATE POLICY "update_own_technology_profiles" ON technology_profiles FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = technology_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = technology_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_technology_profiles" ON technology_profiles;
CREATE POLICY "delete_own_technology_profiles" ON technology_profiles FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = technology_profiles.research_id AND is_workspace_member(company_research.workspace_id))
  );

-- ============================================================
-- 5. growth_signals
-- ============================================================

CREATE TABLE IF NOT EXISTS growth_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES company_research(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN ('funding', 'hiring', 'expansion', 'acquisition', 'partnership', 'new_office', 'new_product', 'leadership_change')),
  description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  confidence integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_signals_research_id ON growth_signals(research_id);
CREATE INDEX IF NOT EXISTS idx_growth_signals_signal_type ON growth_signals(signal_type);

ALTER TABLE growth_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_growth_signals" ON growth_signals;
CREATE POLICY "select_own_growth_signals" ON growth_signals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = growth_signals.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_growth_signals" ON growth_signals;
CREATE POLICY "insert_own_growth_signals" ON growth_signals FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = growth_signals.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_growth_signals" ON growth_signals;
CREATE POLICY "update_own_growth_signals" ON growth_signals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = growth_signals.research_id AND is_workspace_member(company_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = growth_signals.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_growth_signals" ON growth_signals;
CREATE POLICY "delete_own_growth_signals" ON growth_signals FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = growth_signals.research_id AND is_workspace_member(company_research.workspace_id))
  );

-- ============================================================
-- 6. digital_presence
-- ============================================================

CREATE TABLE IF NOT EXISTS digital_presence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES company_research(id) ON DELETE CASCADE,
  platform text NOT NULL,
  url text,
  followers text,
  activity_score integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digital_presence_research_id ON digital_presence(research_id);
CREATE INDEX IF NOT EXISTS idx_digital_presence_platform ON digital_presence(platform);

ALTER TABLE digital_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_digital_presence" ON digital_presence;
CREATE POLICY "select_own_digital_presence" ON digital_presence FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = digital_presence.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_digital_presence" ON digital_presence;
CREATE POLICY "insert_own_digital_presence" ON digital_presence FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = digital_presence.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_digital_presence" ON digital_presence;
CREATE POLICY "update_own_digital_presence" ON digital_presence FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = digital_presence.research_id AND is_workspace_member(company_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = digital_presence.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_digital_presence" ON digital_presence;
CREATE POLICY "delete_own_digital_presence" ON digital_presence FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = digital_presence.research_id AND is_workspace_member(company_research.workspace_id))
  );

-- ============================================================
-- 7. company_business_analysis (SWOT — prefixed to avoid collision)
-- ============================================================

CREATE TABLE IF NOT EXISTS company_business_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  research_id uuid NOT NULL REFERENCES company_research(id) ON DELETE CASCADE,
  strengths text[] DEFAULT '{}',
  weaknesses text[] DEFAULT '{}',
  opportunities text[] DEFAULT '{}',
  threats text[] DEFAULT '{}',
  business_risks text[] DEFAULT '{}',
  market_position text,
  competitive_advantages text[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_business_analysis_research_id ON company_business_analysis(research_id);

ALTER TABLE company_business_analysis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_company_business_analysis" ON company_business_analysis;
CREATE POLICY "select_own_company_business_analysis" ON company_business_analysis FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_business_analysis.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_company_business_analysis" ON company_business_analysis;
CREATE POLICY "insert_own_company_business_analysis" ON company_business_analysis FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_business_analysis.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_company_business_analysis" ON company_business_analysis;
CREATE POLICY "update_own_company_business_analysis" ON company_business_analysis FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_business_analysis.research_id AND is_workspace_member(company_research.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_business_analysis.research_id AND is_workspace_member(company_research.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_company_business_analysis" ON company_business_analysis;
CREATE POLICY "delete_own_company_business_analysis" ON company_business_analysis FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM company_research WHERE company_research.id = company_business_analysis.research_id AND is_workspace_member(company_research.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on company_research
-- ============================================================

CREATE OR REPLACE FUNCTION update_company_research_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_company_research_updated_at ON company_research;
CREATE TRIGGER trigger_company_research_updated_at
  BEFORE UPDATE ON company_research
  FOR EACH ROW
  EXECUTE FUNCTION update_company_research_updated_at();