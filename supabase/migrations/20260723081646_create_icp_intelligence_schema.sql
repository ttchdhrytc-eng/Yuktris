/*
# Create ICP Intelligence Agent Schema

## Overview
Creates the complete database schema for the ICP (Ideal Customer Profile) Intelligence Agent.
This agent runs after both the Business Intelligence Agent and Market Intelligence Agent complete.
It generates multiple ICPs with company profiles, decision makers, pain points, goals, buying triggers,
negative filters, and sales navigator filters.

## New Tables (8 total)

1. **icps** — Main ICP records. Each ICP represents a distinct ideal customer profile with scores,
   confidence, priority, and estimated conversion rate. Links to business_analysis and market_analysis.

2. **icp_company_profile** — Company-level attributes for each ICP: industry, sub-industry, company size,
   revenue range, employee count, funding stage, business model, technology stack, geography.

3. **icp_decision_makers** — Key decision-maker personas for each ICP: department, job title, seniority,
   responsibilities, authority score, priority.

4. **icp_pain_points** — Pain points for each ICP: severity, urgency, business impact, recommended solution.

5. **icp_goals** — Business goals for each ICP: goal text, priority, category (revenue, marketing, operational, technology).

6. **icp_buying_triggers** — Events that trigger buying behavior: trigger type, description, confidence, priority.

7. **icp_negative_filters** — Exclusion criteria (negative ICP): filter type, value, reason.
   filter_type can be: industry, country, company_size, technology, revenue_range.

8. **sales_navigator_filters** — Pre-built LinkedIn Sales Navigator search filters for each ICP:
   industry, company size, location, keywords, titles, departments, technology, boolean query.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member() function.
- Child tables (2-8) scope through icps table using EXISTS subquery.
- 4 CRUD policies per table (select, insert, update, delete) — no FOR ALL.
- All policies use TO authenticated.

## Important Notes
1. The icps table has a `priority` column (primary, secondary, tertiary) to rank ICPs.
2. Only one ICP per workspace can be `primary` at a time — enforced at application level.
3. The `status` column tracks generation lifecycle: queued, processing, completed, failed.
4. All child tables cascade delete when an ICP is deleted.
5. Indexes created on workspace_id (icps) and icp_id (all child tables) for query performance.
6. The updated_at trigger on icps auto-updates the timestamp on row modification.
*/

-- ============================================================
-- 1. icps (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS icps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  business_analysis_id uuid REFERENCES business_analysis(id) ON DELETE SET NULL,
  market_analysis_id uuid REFERENCES market_analysis(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  priority text NOT NULL DEFAULT 'secondary' CHECK (priority IN ('primary', 'secondary', 'tertiary')),
  confidence integer NOT NULL DEFAULT 0,
  opportunity_score integer NOT NULL DEFAULT 0,
  competition_score integer NOT NULL DEFAULT 0,
  revenue_score integer NOT NULL DEFAULT 0,
  conversion_rate numeric(5,2) DEFAULT 0,
  estimated_deal_size text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icps_workspace_id ON icps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_icps_priority ON icps(priority);
CREATE INDEX IF NOT EXISTS idx_icps_status ON icps(status);

ALTER TABLE icps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icps" ON icps;
CREATE POLICY "select_own_icps" ON icps FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_icps" ON icps;
CREATE POLICY "insert_own_icps" ON icps FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_icps" ON icps;
CREATE POLICY "update_own_icps" ON icps FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_icps" ON icps;
CREATE POLICY "delete_own_icps" ON icps FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. icp_company_profile
-- ============================================================

CREATE TABLE IF NOT EXISTS icp_company_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  industry text,
  sub_industry text,
  company_size text,
  revenue_range text,
  employee_count text,
  funding_stage text,
  business_model text,
  technology_stack text[] DEFAULT '{}',
  country text,
  region text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_company_profile_icp_id ON icp_company_profile(icp_id);

ALTER TABLE icp_company_profile ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_profiles" ON icp_company_profile;
CREATE POLICY "select_own_icp_profiles" ON icp_company_profile FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_company_profile.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_icp_profiles" ON icp_company_profile;
CREATE POLICY "insert_own_icp_profiles" ON icp_company_profile FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_company_profile.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_icp_profiles" ON icp_company_profile;
CREATE POLICY "update_own_icp_profiles" ON icp_company_profile FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_company_profile.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_company_profile.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_icp_profiles" ON icp_company_profile;
CREATE POLICY "delete_own_icp_profiles" ON icp_company_profile FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_company_profile.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- 3. icp_decision_makers
-- ============================================================

CREATE TABLE IF NOT EXISTS icp_decision_makers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  department text,
  job_title text,
  seniority text,
  responsibilities text,
  authority_score integer DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_decision_makers_icp_id ON icp_decision_makers(icp_id);

ALTER TABLE icp_decision_makers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_decision_makers" ON icp_decision_makers;
CREATE POLICY "select_own_icp_decision_makers" ON icp_decision_makers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_decision_makers.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_icp_decision_makers" ON icp_decision_makers;
CREATE POLICY "insert_own_icp_decision_makers" ON icp_decision_makers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_decision_makers.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_icp_decision_makers" ON icp_decision_makers;
CREATE POLICY "update_own_icp_decision_makers" ON icp_decision_makers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_decision_makers.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_decision_makers.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_icp_decision_makers" ON icp_decision_makers;
CREATE POLICY "delete_own_icp_decision_makers" ON icp_decision_makers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_decision_makers.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- 4. icp_pain_points
-- ============================================================

CREATE TABLE IF NOT EXISTS icp_pain_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  pain_point text NOT NULL,
  severity text DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  urgency text DEFAULT 'medium' CHECK (urgency IN ('low', 'medium', 'high', 'immediate')),
  business_impact text,
  recommended_solution text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_pain_points_icp_id ON icp_pain_points(icp_id);

ALTER TABLE icp_pain_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_pain_points" ON icp_pain_points;
CREATE POLICY "select_own_icp_pain_points" ON icp_pain_points FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_pain_points.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_icp_pain_points" ON icp_pain_points;
CREATE POLICY "insert_own_icp_pain_points" ON icp_pain_points FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_pain_points.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_icp_pain_points" ON icp_pain_points;
CREATE POLICY "update_own_icp_pain_points" ON icp_pain_points FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_pain_points.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_pain_points.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_icp_pain_points" ON icp_pain_points;
CREATE POLICY "delete_own_icp_pain_points" ON icp_pain_points FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_pain_points.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- 5. icp_goals
-- ============================================================

CREATE TABLE IF NOT EXISTS icp_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  goal text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  category text DEFAULT 'business' CHECK (category IN ('business', 'revenue', 'marketing', 'operational', 'technology')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_goals_icp_id ON icp_goals(icp_id);

ALTER TABLE icp_goals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_goals" ON icp_goals;
CREATE POLICY "select_own_icp_goals" ON icp_goals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_goals.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_icp_goals" ON icp_goals;
CREATE POLICY "insert_own_icp_goals" ON icp_goals FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_goals.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_icp_goals" ON icp_goals;
CREATE POLICY "update_own_icp_goals" ON icp_goals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_goals.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_goals.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_icp_goals" ON icp_goals;
CREATE POLICY "delete_own_icp_goals" ON icp_goals FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_goals.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- 6. icp_buying_triggers
-- ============================================================

CREATE TABLE IF NOT EXISTS icp_buying_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  description text,
  confidence integer DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_buying_triggers_icp_id ON icp_buying_triggers(icp_id);

ALTER TABLE icp_buying_triggers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_triggers" ON icp_buying_triggers;
CREATE POLICY "select_own_icp_triggers" ON icp_buying_triggers FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_buying_triggers.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_icp_triggers" ON icp_buying_triggers;
CREATE POLICY "insert_own_icp_triggers" ON icp_buying_triggers FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_buying_triggers.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_icp_triggers" ON icp_buying_triggers;
CREATE POLICY "update_own_icp_triggers" ON icp_buying_triggers FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_buying_triggers.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_buying_triggers.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_icp_triggers" ON icp_buying_triggers;
CREATE POLICY "delete_own_icp_triggers" ON icp_buying_triggers FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_buying_triggers.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- 7. icp_negative_filters
-- ============================================================

CREATE TABLE IF NOT EXISTS icp_negative_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  filter_type text NOT NULL CHECK (filter_type IN ('industry', 'country', 'company_size', 'technology', 'revenue_range')),
  value text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_icp_negative_filters_icp_id ON icp_negative_filters(icp_id);

ALTER TABLE icp_negative_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_icp_negative_filters" ON icp_negative_filters;
CREATE POLICY "select_own_icp_negative_filters" ON icp_negative_filters FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_negative_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_icp_negative_filters" ON icp_negative_filters;
CREATE POLICY "insert_own_icp_negative_filters" ON icp_negative_filters FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_negative_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_icp_negative_filters" ON icp_negative_filters;
CREATE POLICY "update_own_icp_negative_filters" ON icp_negative_filters FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_negative_filters.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_negative_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_icp_negative_filters" ON icp_negative_filters;
CREATE POLICY "delete_own_icp_negative_filters" ON icp_negative_filters FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = icp_negative_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- 8. sales_navigator_filters
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_navigator_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icp_id uuid NOT NULL REFERENCES icps(id) ON DELETE CASCADE,
  industry text[] DEFAULT '{}',
  company_size text[] DEFAULT '{}',
  location text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  titles text[] DEFAULT '{}',
  departments text[] DEFAULT '{}',
  technology text[] DEFAULT '{}',
  boolean_query text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sales_navigator_filters_icp_id ON sales_navigator_filters(icp_id);

ALTER TABLE sales_navigator_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sales_nav_filters" ON sales_navigator_filters;
CREATE POLICY "select_own_sales_nav_filters" ON sales_navigator_filters FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = sales_navigator_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_sales_nav_filters" ON sales_navigator_filters;
CREATE POLICY "insert_own_sales_nav_filters" ON sales_navigator_filters FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = sales_navigator_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_sales_nav_filters" ON sales_navigator_filters;
CREATE POLICY "update_own_sales_nav_filters" ON sales_navigator_filters FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = sales_navigator_filters.icp_id AND is_workspace_member(icps.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = sales_navigator_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_sales_nav_filters" ON sales_navigator_filters;
CREATE POLICY "delete_own_sales_nav_filters" ON sales_navigator_filters FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM icps WHERE icps.id = sales_navigator_filters.icp_id AND is_workspace_member(icps.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on icps
-- ============================================================

CREATE OR REPLACE FUNCTION update_icp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_icp_updated_at ON icps;
CREATE TRIGGER trigger_icp_updated_at
  BEFORE UPDATE ON icps
  FOR EACH ROW
  EXECUTE FUNCTION update_icp_updated_at();
