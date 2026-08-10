/*
# Market Intelligence Agent — Database Schema

## Overview
Creates six new tables to support the Market Intelligence Agent module.
This agent runs after the Business Intelligence Agent completes its analysis.
It analyzes industries, countries, competitors, market trends, and buying signals
to produce a recommended Go-To-Market strategy.

## New Tables

### 1. market_analysis
The main market analysis record, linked to a workspace and optionally to a business analysis.
- `id` (uuid, PK)
- `workspace_id` (uuid, FK to workspaces, cascade delete)
- `business_analysis_id` (uuid, nullable, FK to business_analysis, cascade delete)
- `market_status` (text: queued | processing | completed | failed)
- `market_size` (text, human-readable market size estimate)
- `growth_score` (numeric 0–100)
- `competition_score` (numeric 0–100)
- `opportunity_score` (numeric 0–100)
- `confidence_score` (numeric 0–100)
- `recommended_strategy` (text, AI-generated GTM strategy)
- `executive_summary` (text)
- `error_message` (text, nullable)
- `created_at`, `updated_at` (timestamptz, auto-updated)

### 2. industry_analysis
Industry-level opportunity analysis rows.
- `id` (uuid, PK)
- `market_analysis_id` (uuid, FK to market_analysis, cascade delete)
- `industry_name` (text)
- `market_size` (text)
- `growth_rate` (text, e.g. "12% YoY")
- `competition_level` (text: low | medium | high | very_high)
- `opportunity_score` (numeric 0–100)
- `priority` (text: low | medium | high | critical)
- `recommended` (boolean)

### 3. country_analysis
Country-level opportunity analysis rows.
- `id` (uuid, PK)
- `market_analysis_id` (uuid, FK to market_analysis, cascade delete)
- `country` (text)
- `market_size` (text)
- `competition` (text: low | medium | high)
- `language` (text)
- `buying_power` (numeric 0–100)
- `opportunity_score` (numeric 0–100)
- `recommended` (boolean)

### 4. competitor_analysis
Competitor landscape analysis rows.
- `id` (uuid, PK)
- `market_analysis_id` (uuid, FK to market_analysis, cascade delete)
- `competitor` (text)
- `website` (text)
- `pricing_model` (text)
- `market_position` (text)
- `strengths` (jsonb — array of strings)
- `weaknesses` (jsonb — array of strings)
- `market_share` (text, nullable)

### 5. trend_analysis
Market trend analysis rows.
- `id` (uuid, PK)
- `market_analysis_id` (uuid, FK to market_analysis, cascade delete)
- `trend` (text)
- `impact` (text: low | medium | high | transformative)
- `opportunity` (text, description of the opportunity)
- `confidence` (numeric 0–100)

### 6. buying_signals
Buying signal detection rows.
- `id` (uuid, PK)
- `market_analysis_id` (uuid, FK to market_analysis, cascade delete)
- `signal_name` (text)
- `description` (text)
- `priority` (text: low | medium | high | critical)
- `confidence` (numeric 0–100)

## Security (RLS)
- RLS enabled on all six tables.
- `market_analysis`: direct `workspace_id` column, checked via `is_workspace_member()`.
- Child tables: scoped through `market_analysis_id` → `market_analysis.workspace_id`.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE), `TO authenticated`.
- The existing `is_workspace_member()` and `update_updated_at_column()` functions are reused.

## Important Notes
1. New trigger added for `market_analysis.updated_at`.
2. Indexes on `workspace_id`, `market_analysis_id`, and `market_status`.
3. All child tables use ON DELETE CASCADE from `market_analysis`.
*/

-- ============================================================
-- MARKET_ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS market_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  business_analysis_id uuid REFERENCES business_analysis(id) ON DELETE SET NULL,
  market_status text NOT NULL DEFAULT 'queued' CHECK (market_status IN ('queued', 'processing', 'completed', 'failed')),
  market_size text,
  growth_score numeric DEFAULT 0,
  competition_score numeric DEFAULT 0,
  opportunity_score numeric DEFAULT 0,
  confidence_score numeric DEFAULT 0,
  recommended_strategy text,
  executive_summary text,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE market_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDUSTRY_ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS industry_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_analysis_id uuid NOT NULL REFERENCES market_analysis(id) ON DELETE CASCADE,
  industry_name text NOT NULL,
  market_size text,
  growth_rate text,
  competition_level text DEFAULT 'medium' CHECK (competition_level IN ('low', 'medium', 'high', 'very_high')),
  opportunity_score numeric DEFAULT 0,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  recommended boolean DEFAULT false
);
ALTER TABLE industry_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COUNTRY_ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS country_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_analysis_id uuid NOT NULL REFERENCES market_analysis(id) ON DELETE CASCADE,
  country text NOT NULL,
  market_size text,
  competition text DEFAULT 'medium' CHECK (competition IN ('low', 'medium', 'high')),
  language text,
  buying_power numeric DEFAULT 0,
  opportunity_score numeric DEFAULT 0,
  recommended boolean DEFAULT false
);
ALTER TABLE country_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- COMPETITOR_ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS competitor_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_analysis_id uuid NOT NULL REFERENCES market_analysis(id) ON DELETE CASCADE,
  competitor text NOT NULL,
  website text,
  pricing_model text,
  market_position text,
  strengths jsonb DEFAULT '[]'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  market_share text
);
ALTER TABLE competitor_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TREND_ANALYSIS
-- ============================================================
CREATE TABLE IF NOT EXISTS trend_analysis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_analysis_id uuid NOT NULL REFERENCES market_analysis(id) ON DELETE CASCADE,
  trend text NOT NULL,
  impact text DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high', 'transformative')),
  opportunity text,
  confidence numeric DEFAULT 0
);
ALTER TABLE trend_analysis ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- BUYING_SIGNALS
-- ============================================================
CREATE TABLE IF NOT EXISTS buying_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  market_analysis_id uuid NOT NULL REFERENCES market_analysis(id) ON DELETE CASCADE,
  signal_name text NOT NULL,
  description text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  confidence numeric DEFAULT 0
);
ALTER TABLE buying_signals ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_ma_workspace ON market_analysis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ma_status ON market_analysis(market_status);
CREATE INDEX IF NOT EXISTS idx_ma_business ON market_analysis(business_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ia_market ON industry_analysis(market_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ca_market ON country_analysis(market_analysis_id);
CREATE INDEX IF NOT EXISTS idx_cmpa_market ON competitor_analysis(market_analysis_id);
CREATE INDEX IF NOT EXISTS idx_ta_market ON trend_analysis(market_analysis_id);
CREATE INDEX IF NOT EXISTS idx_bs_market ON buying_signals(market_analysis_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
DROP TRIGGER IF EXISTS trigger_ma_updated_at ON market_analysis;
CREATE TRIGGER trigger_ma_updated_at BEFORE UPDATE ON market_analysis
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- RLS POLICIES — market_analysis
-- ============================================================
DROP POLICY IF EXISTS "select_ws_ma" ON market_analysis;
CREATE POLICY "select_ws_ma" ON market_analysis FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_ws_ma" ON market_analysis;
CREATE POLICY "insert_ws_ma" ON market_analysis FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_ws_ma" ON market_analysis;
CREATE POLICY "update_ws_ma" ON market_analysis FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_ws_ma" ON market_analysis;
CREATE POLICY "delete_ws_ma" ON market_analysis FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- RLS POLICIES — industry_analysis (scoped through market_analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_ia" ON industry_analysis;
CREATE POLICY "select_ws_ia" ON industry_analysis FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = industry_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_ia" ON industry_analysis;
CREATE POLICY "insert_ws_ia" ON industry_analysis FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = industry_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_ia" ON industry_analysis;
CREATE POLICY "update_ws_ia" ON industry_analysis FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = industry_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = industry_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_ia" ON industry_analysis;
CREATE POLICY "delete_ws_ia" ON industry_analysis FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = industry_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );

-- ============================================================
-- RLS POLICIES — country_analysis (scoped through market_analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_ca" ON country_analysis;
CREATE POLICY "select_ws_ca" ON country_analysis FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = country_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_ca" ON country_analysis;
CREATE POLICY "insert_ws_ca" ON country_analysis FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = country_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_ca" ON country_analysis;
CREATE POLICY "update_ws_ca" ON country_analysis FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = country_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = country_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_ca" ON country_analysis;
CREATE POLICY "delete_ws_ca" ON country_analysis FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = country_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );

-- ============================================================
-- RLS POLICIES — competitor_analysis (scoped through market_analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_cmpa" ON competitor_analysis;
CREATE POLICY "select_ws_cmpa" ON competitor_analysis FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = competitor_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_cmpa" ON competitor_analysis;
CREATE POLICY "insert_ws_cmpa" ON competitor_analysis FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = competitor_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_cmpa" ON competitor_analysis;
CREATE POLICY "update_ws_cmpa" ON competitor_analysis FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = competitor_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = competitor_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_cmpa" ON competitor_analysis;
CREATE POLICY "delete_ws_cmpa" ON competitor_analysis FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = competitor_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );

-- ============================================================
-- RLS POLICIES — trend_analysis (scoped through market_analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_ta" ON trend_analysis;
CREATE POLICY "select_ws_ta" ON trend_analysis FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = trend_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_ta" ON trend_analysis;
CREATE POLICY "insert_ws_ta" ON trend_analysis FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = trend_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_ta" ON trend_analysis;
CREATE POLICY "update_ws_ta" ON trend_analysis FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = trend_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = trend_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_ta" ON trend_analysis;
CREATE POLICY "delete_ws_ta" ON trend_analysis FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = trend_analysis.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );

-- ============================================================
-- RLS POLICIES — buying_signals (scoped through market_analysis)
-- ============================================================
DROP POLICY IF EXISTS "select_ws_bs" ON buying_signals;
CREATE POLICY "select_ws_bs" ON buying_signals FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = buying_signals.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "insert_ws_bs" ON buying_signals;
CREATE POLICY "insert_ws_bs" ON buying_signals FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = buying_signals.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "update_ws_bs" ON buying_signals;
CREATE POLICY "update_ws_bs" ON buying_signals FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = buying_signals.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = buying_signals.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );
DROP POLICY IF EXISTS "delete_ws_bs" ON buying_signals;
CREATE POLICY "delete_ws_bs" ON buying_signals FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM market_analysis WHERE market_analysis.id = buying_signals.market_analysis_id AND is_workspace_member(market_analysis.workspace_id))
  );