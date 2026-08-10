/*
# Business Intelligence Agent — Database Schema

## Overview
Creates three new tables to support the Business Intelligence Agent module.
This agent researches and understands a customer's business from their website
before any sales activity begins. It stores the full analysis, extracted web pages,
and AI-generated business insights.

## New Tables

### 1. business_analysis
The main analysis record for a workspace's website.
- `id` (uuid, primary key)
- `workspace_id` (uuid, FK to workspaces, cascade delete)
- `website` (text, the URL that was analyzed)
- `company_name` (text)
- `industry` (text)
- `country` (text)
- `language` (text, detected site language)
- `timezone` (text)
- `description` (text, company description)
- `business_model` (text)
- `products` (jsonb — array of product descriptions)
- `services` (jsonb — array of service descriptions)
- `pricing_model` (text)
- `target_audience` (text)
- `usp` (text — unique value proposition)
- `customer_problems` (jsonb — array of problem statements)
- `business_goals` (jsonb — array of goal statements)
- `revenue_model` (text)
- `competitive_position` (text)
- `confidence_score` (numeric, 0–100)
- `business_category` (text, auto-detected category)
- `primary_icp` (text, primary ideal customer profile)
- `completion_percentage` (numeric, 0–100)
- `analysis_status` (text: queued | processing | completed | failed)
- `error_message` (text, nullable — failure reason if status = failed)
- `created_at` (timestamptz)
- `updated_at` (timestamptz, auto-updated via trigger)

### 2. website_pages
Pages extracted from the crawled website.
- `id` (uuid, primary key)
- `analysis_id` (uuid, FK to business_analysis, cascade delete)
- `page_title` (text)
- `url` (text)
- `page_type` (text: homepage | services | pricing | blog | resources | contact | faq | testimonials | case_studies | other)
- `content` (text, extracted page content)
- `summary` (text, AI-generated summary of the page)
- `metadata` (jsonb, additional page metadata)
- `created_at` (timestamptz)

### 3. business_insights
AI-generated strategic insights for the business.
- `id` (uuid, primary key)
- `analysis_id` (uuid, FK to business_analysis, cascade delete)
- `strengths` (jsonb — array of strength statements)
- `weaknesses` (jsonb — array of weakness statements)
- `opportunities` (jsonb — array of opportunity statements)
- `risks` (jsonb — array of risk statements)
- `executive_summary` (text)
- `raw_json` (jsonb — full raw analysis data)
- `created_at` (timestamptz)

## Security (RLS)
- RLS enabled on all three tables.
- All tables are workspace-scoped:
  - `business_analysis`: direct `workspace_id` column, checked via `is_workspace_member()`.
  - `website_pages` and `business_insights`: scoped through `analysis_id` → `business_analysis.workspace_id`.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE), `TO authenticated`.
- The existing `is_workspace_member()` function is reused.

## Important Notes
1. The `update_updated_at_column()` trigger function already exists from the initial migration.
2. A new trigger is added for `business_analysis.updated_at`.
3. Indexes are created on `workspace_id`, `analysis_id`, and `analysis_status` for query performance.
*/

-- ============================================================
-- BUSINESS_ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS business_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  website text NOT NULL,
  company_name text,
  industry text,
  country text,
  language text,
  timezone text,
  description text,
  business_model text,
  products jsonb DEFAULT '[]'::jsonb,
  services jsonb DEFAULT '[]'::jsonb,
  pricing_model text,
  target_audience text,
  usp text,
  customer_problems jsonb DEFAULT '[]'::jsonb,
  business_goals jsonb DEFAULT '[]'::jsonb,
  revenue_model text,
  competitive_position text,
  confidence_score numeric DEFAULT 0,
  business_category text,
  primary_icp text,
  completion_percentage numeric DEFAULT 0,
  analysis_status text NOT NULL DEFAULT 'queued' CHECK (analysis_status IN ('queued', 'processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE business_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WEBSITE_PAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS website_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES business_analysis(id) ON DELETE CASCADE,
  page_title text,
  url text NOT NULL,
  page_type text NOT NULL DEFAULT 'other' CHECK (page_type IN ('homepage', 'services', 'pricing', 'blog', 'resources', 'contact', 'faq', 'testimonials', 'case_studies', 'other')),
  content text,
  summary text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE website_pages ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BUSINESS_INSIGHTS
-- ============================================================
CREATE TABLE IF NOT EXISTS business_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES business_analysis(id) ON DELETE CASCADE,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  opportunities jsonb DEFAULT '[]'::jsonb,
  risks jsonb DEFAULT '[]'::jsonb,
  executive_summary text,
  raw_json jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE business_insights ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ba_workspace ON business_analysis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ba_status ON business_analysis(analysis_status);
CREATE INDEX IF NOT EXISTS idx_wp_analysis ON website_pages(analysis_id);
CREATE INDEX IF NOT EXISTS idx_bi_analysis ON business_insights(analysis_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trigger_ba_updated_at ON business_analysis;
CREATE TRIGGER trigger_ba_updated_at BEFORE UPDATE ON business_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS POLICIES — business_analysis
-- ============================================================
DROP POLICY IF EXISTS "select_ws_ba" ON business_analysis;
CREATE POLICY "select_ws_ba" ON business_analysis FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_ba" ON business_analysis;
CREATE POLICY "insert_ws_ba" ON business_analysis FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_ba" ON business_analysis;
CREATE POLICY "update_ws_ba" ON business_analysis FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_ba" ON business_analysis;
CREATE POLICY "delete_ws_ba" ON business_analysis FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- RLS POLICIES — website_pages (scoped through analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_wp" ON website_pages;
CREATE POLICY "select_ws_wp" ON website_pages FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = website_pages.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_wp" ON website_pages;
CREATE POLICY "insert_ws_wp" ON website_pages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = website_pages.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_wp" ON website_pages;
CREATE POLICY "update_ws_wp" ON website_pages FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = website_pages.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = website_pages.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_wp" ON website_pages;
CREATE POLICY "delete_ws_wp" ON website_pages FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = website_pages.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );

-- ============================================================
-- RLS POLICIES — business_insights (scoped through analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_bi" ON business_insights;
CREATE POLICY "select_ws_bi" ON business_insights FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = business_insights.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_bi" ON business_insights;
CREATE POLICY "insert_ws_bi" ON business_insights FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = business_insights.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_bi" ON business_insights;
CREATE POLICY "update_ws_bi" ON business_insights FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = business_insights.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = business_insights.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_bi" ON business_insights;
CREATE POLICY "delete_ws_bi" ON business_insights FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM business_analysis WHERE business_analysis.id = business_insights.analysis_id AND is_workspace_member(business_analysis.workspace_id))
  );