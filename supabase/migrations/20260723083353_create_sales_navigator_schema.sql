/*
# Create Sales Navigator Intelligence Agent Schema

## Overview
Creates the complete database schema for the Sales Navigator Intelligence Agent.
This agent transforms ICPs and discovered companies into optimized LinkedIn Sales
Navigator search strategies. It runs after the Business Intelligence, Market Intelligence,
ICP Intelligence, and Prospect Discovery agents complete.

## New Tables (4 total)

1. **sales_navigator_searches** — Main search strategy record. Links to an ICP and a discovery run.
   Tracks search type (company/lead/both), quality score, coverage score, and status.

2. **company_filters** — Company-level Sales Navigator search filters for each search strategy:
   industry, company size, revenue, country, technology, company type, growth stage,
   keywords, negative keywords, and boolean query.

3. **lead_filters** — Lead-level Sales Navigator search filters for each search strategy:
   job titles, departments, seniority, years in role, years at company, relationship filters,
   location, and open profile filter flag.

4. **search_templates** — Reusable search templates that can be saved and loaded. Stores
   the full template JSON for easy re-application across different ICPs.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member() function.
- Child tables (2-3) scope through sales_navigator_searches using EXISTS subquery.
- search_templates scoped directly to workspace_id.
- 4 CRUD policies per table (select, insert, update, delete) — no FOR ALL.
- All policies use TO authenticated.

## Important Notes
1. sales_navigator_searches links to both icps (icp_id) and prospect_discovery (discovery_id).
2. company_filters and lead_filters cascade delete when a search is deleted.
3. search_templates stores the full template as JSONB for flexibility.
4. Indexes created on workspace_id, icp_id, discovery_id, and search_id for query performance.
5. The updated_at trigger on sales_navigator_searches auto-updates the timestamp.
*/

-- ============================================================
-- 1. sales_navigator_searches (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS sales_navigator_searches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  icp_id uuid REFERENCES icps(id) ON DELETE SET NULL,
  discovery_id uuid REFERENCES prospect_discovery(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  search_type text NOT NULL DEFAULT 'both' CHECK (search_type IN ('company', 'lead', 'both')),
  quality_score integer DEFAULT 0,
  coverage_score integer DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sn_searches_workspace_id ON sales_navigator_searches(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sn_searches_icp_id ON sales_navigator_searches(icp_id);
CREATE INDEX IF NOT EXISTS idx_sn_searches_discovery_id ON sales_navigator_searches(discovery_id);
CREATE INDEX IF NOT EXISTS idx_sn_searches_status ON sales_navigator_searches(status);

ALTER TABLE sales_navigator_searches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_sn_searches" ON sales_navigator_searches;
CREATE POLICY "select_own_sn_searches" ON sales_navigator_searches FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_sn_searches" ON sales_navigator_searches;
CREATE POLICY "insert_own_sn_searches" ON sales_navigator_searches FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_sn_searches" ON sales_navigator_searches;
CREATE POLICY "update_own_sn_searches" ON sales_navigator_searches FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_sn_searches" ON sales_navigator_searches;
CREATE POLICY "delete_own_sn_searches" ON sales_navigator_searches FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. company_filters
-- ============================================================

CREATE TABLE IF NOT EXISTS company_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES sales_navigator_searches(id) ON DELETE CASCADE,
  industry text[] DEFAULT '{}',
  company_size text[] DEFAULT '{}',
  revenue text[] DEFAULT '{}',
  country text[] DEFAULT '{}',
  technology text[] DEFAULT '{}',
  company_type text[] DEFAULT '{}',
  growth_stage text[] DEFAULT '{}',
  keywords text[] DEFAULT '{}',
  negative_keywords text[] DEFAULT '{}',
  boolean_query text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_filters_search_id ON company_filters(search_id);

ALTER TABLE company_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_company_filters" ON company_filters;
CREATE POLICY "select_own_company_filters" ON company_filters FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = company_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_company_filters" ON company_filters;
CREATE POLICY "insert_own_company_filters" ON company_filters FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = company_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_company_filters" ON company_filters;
CREATE POLICY "update_own_company_filters" ON company_filters FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = company_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = company_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_company_filters" ON company_filters;
CREATE POLICY "delete_own_company_filters" ON company_filters FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = company_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

-- ============================================================
-- 3. lead_filters
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_filters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  search_id uuid NOT NULL REFERENCES sales_navigator_searches(id) ON DELETE CASCADE,
  job_titles text[] DEFAULT '{}',
  departments text[] DEFAULT '{}',
  seniority text[] DEFAULT '{}',
  years_in_role text,
  years_at_company text,
  relationship text[] DEFAULT '{}',
  location text[] DEFAULT '{}',
  open_profile boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_filters_search_id ON lead_filters(search_id);

ALTER TABLE lead_filters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_lead_filters" ON lead_filters;
CREATE POLICY "select_own_lead_filters" ON lead_filters FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = lead_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_lead_filters" ON lead_filters;
CREATE POLICY "insert_own_lead_filters" ON lead_filters FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = lead_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_lead_filters" ON lead_filters;
CREATE POLICY "update_own_lead_filters" ON lead_filters FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = lead_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = lead_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_lead_filters" ON lead_filters;
CREATE POLICY "delete_own_lead_filters" ON lead_filters FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM sales_navigator_searches WHERE sales_navigator_searches.id = lead_filters.search_id AND is_workspace_member(sales_navigator_searches.workspace_id))
  );

-- ============================================================
-- 4. search_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS search_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  description text,
  template_json jsonb NOT NULL DEFAULT '{}',
  is_default boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_search_templates_workspace_id ON search_templates(workspace_id);

ALTER TABLE search_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_search_templates" ON search_templates;
CREATE POLICY "select_own_search_templates" ON search_templates FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_search_templates" ON search_templates;
CREATE POLICY "insert_own_search_templates" ON search_templates FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_search_templates" ON search_templates;
CREATE POLICY "update_own_search_templates" ON search_templates FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_search_templates" ON search_templates;
CREATE POLICY "delete_own_search_templates" ON search_templates FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- Trigger: auto-update updated_at on sales_navigator_searches
-- ============================================================

CREATE OR REPLACE FUNCTION update_sn_search_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sn_search_updated_at ON sales_navigator_searches;
CREATE TRIGGER trigger_sn_search_updated_at
  BEFORE UPDATE ON sales_navigator_searches
  FOR EACH ROW
  EXECUTE FUNCTION update_sn_search_updated_at();
