/*
# Create Research Intelligence Engine Schema

## Overview
Creates the database layer for the Enterprise Research Intelligence Engine —
the centralized research platform that all AI agents use for company and
prospect intelligence. No agent calls Firecrawl/Tavily/etc. directly; they
all route through this engine.

## New Tables (3)
1. research_requests — Tracks each research operation (who, what, status, provider).
2. company_intelligence — Normalized intelligence model for a company (the unified output).
3. research_sources — Source attribution for each intelligence record (provenance tracking).

## Security
- RLS enabled on all 3 tables, scoped to authenticated users via workspace membership.
- 4 CRUD policies per table (select/insert/update/delete), no FOR ALL.
- All ownership checks use is_workspace_member() or workspace_id matching.
- Functions use SECURITY DEFINER with SET search_path = public where needed.
*/

-- ============================================================
-- 1. research_requests
-- ============================================================

CREATE TABLE IF NOT EXISTS research_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  request_type text NOT NULL DEFAULT 'company_profile' CHECK (request_type IN (
    'company_profile', 'technology_stack', 'seo_analysis', 'business_model',
    'buying_signals', 'growth_signals', 'full_intelligence', 'refresh'
  )),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'planning', 'in_progress', 'aggregating',
    'normalizing', 'completed', 'failed', 'cancelled'
  )),
  provider text,
  providers_used text[] DEFAULT '{}',
  confidence_score numeric,
  error_message text,
  result_summary jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_research_requests_workspace_id ON research_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_research_requests_status ON research_requests(status);
CREATE INDEX IF NOT EXISTS idx_research_requests_company_name ON research_requests(company_name);
CREATE INDEX IF NOT EXISTS idx_research_requests_created_at ON research_requests(created_at DESC);

ALTER TABLE research_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_research_requests" ON research_requests;
CREATE POLICY "select_research_requests" ON research_requests
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_research_requests" ON research_requests;
CREATE POLICY "insert_research_requests" ON research_requests
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_research_requests" ON research_requests;
CREATE POLICY "update_research_requests" ON research_requests
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_research_requests" ON research_requests;
CREATE POLICY "delete_research_requests" ON research_requests
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 2. company_intelligence
-- ============================================================

CREATE TABLE IF NOT EXISTS company_intelligence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  website text,
  industry text,
  sub_industry text,
  business_model text,
  company_size text,
  locations jsonb DEFAULT '[]',
  summary text,
  technology_stack jsonb DEFAULT '[]',
  services jsonb DEFAULT '[]',
  products jsonb DEFAULT '[]',
  target_market jsonb DEFAULT '[]',
  brand_positioning text,
  seo_summary jsonb DEFAULT '{}',
  social_profiles jsonb DEFAULT '[]',
  contact_information jsonb DEFAULT '{}',
  buying_signals jsonb DEFAULT '[]',
  growth_signals jsonb DEFAULT '[]',
  decision_makers jsonb DEFAULT '[]',
  competitive_positioning jsonb DEFAULT '{}',
  confidence_score numeric,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_company_intelligence_workspace_id ON company_intelligence(workspace_id);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_company_name ON company_intelligence(company_name);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_website ON company_intelligence(website);
CREATE INDEX IF NOT EXISTS idx_company_intelligence_last_updated ON company_intelligence(last_updated DESC);

ALTER TABLE company_intelligence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_company_intelligence" ON company_intelligence;
CREATE POLICY "select_company_intelligence" ON company_intelligence
  FOR SELECT TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_company_intelligence" ON company_intelligence;
CREATE POLICY "insert_company_intelligence" ON company_intelligence
  FOR INSERT TO authenticated
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_company_intelligence" ON company_intelligence;
CREATE POLICY "update_company_intelligence" ON company_intelligence
  FOR UPDATE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id))
  WITH CHECK ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_company_intelligence" ON company_intelligence;
CREATE POLICY "delete_company_intelligence" ON company_intelligence
  FOR DELETE TO authenticated
  USING ((workspace_id IS NULL) OR is_workspace_member(workspace_id));

-- ============================================================
-- 3. research_sources
-- ============================================================

CREATE TABLE IF NOT EXISTS research_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_intelligence_id uuid NOT NULL REFERENCES company_intelligence(id) ON DELETE CASCADE,
  provider text NOT NULL,
  source_url text,
  confidence_score numeric,
  retrieved_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_research_sources_ci_id ON research_sources(company_intelligence_id);
CREATE INDEX IF NOT EXISTS idx_research_sources_provider ON research_sources(provider);

ALTER TABLE research_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_research_sources" ON research_sources;
CREATE POLICY "select_research_sources" ON research_sources
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_intelligence ci
      WHERE ci.id = research_sources.company_intelligence_id
        AND (ci.workspace_id IS NULL OR is_workspace_member(ci.workspace_id))
    )
  );

DROP POLICY IF EXISTS "insert_research_sources" ON research_sources;
CREATE POLICY "insert_research_sources" ON research_sources
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_intelligence ci
      WHERE ci.id = research_sources.company_intelligence_id
        AND (ci.workspace_id IS NULL OR is_workspace_member(ci.workspace_id))
    )
  );

DROP POLICY IF EXISTS "update_research_sources" ON research_sources;
CREATE POLICY "update_research_sources" ON research_sources
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_intelligence ci
      WHERE ci.id = research_sources.company_intelligence_id
        AND (ci.workspace_id IS NULL OR is_workspace_member(ci.workspace_id))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_intelligence ci
      WHERE ci.id = research_sources.company_intelligence_id
        AND (ci.workspace_id IS NULL OR is_workspace_member(ci.workspace_id))
    )
  );

DROP POLICY IF EXISTS "delete_research_sources" ON research_sources;
CREATE POLICY "delete_research_sources" ON research_sources
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM company_intelligence ci
      WHERE ci.id = research_sources.company_intelligence_id
        AND (ci.workspace_id IS NULL OR is_workspace_member(ci.workspace_id))
    )
  );

-- ============================================================
-- 4. Trigger: update_company_intelligence_updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_company_intelligence_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trigger_company_intelligence_updated_at ON company_intelligence;
CREATE TRIGGER trigger_company_intelligence_updated_at
  BEFORE UPDATE ON company_intelligence
  FOR EACH ROW
  EXECUTE FUNCTION update_company_intelligence_updated_at();
