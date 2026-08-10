/*
# Phase 6 — AI Prospect Discovery Engine Schema

## Strategy
- Extend existing `companies` table with discovery-specific columns
- Extend existing `contacts` table with discovery-specific columns
- Extend existing `contact_profiles` table with enrichment columns
- Extend existing `prospect_recommendations` table with AI recommendation columns
- Create new tables: company_locations, company_technologies, company_signals,
  contact_social_profiles, contact_skills, prospect_scores, prospect_lists,
  prospect_list_members, discovery_jobs, provider_sources, provider_sync_logs
*/

-- ============================================================
-- EXTEND companies TABLE
-- ============================================================
ALTER TABLE companies ADD COLUMN IF NOT EXISTS employee_count text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS estimated_revenue text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS headquarters text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS funding_stage text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS growth_score integer DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS market_score integer DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS opportunity_score integer DEFAULT 0;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0.5;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS growth_stage text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS hiring_activity boolean DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_companies_workspace ON companies(workspace_id);
CREATE INDEX IF NOT EXISTS idx_companies_industry ON companies(industry);
CREATE INDEX IF NOT EXISTS idx_companies_opportunity_score ON companies(opportunity_score DESC);

-- ============================================================
-- EXTEND contacts TABLE
-- ============================================================
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id) ON DELETE SET NULL;
ALTER TABLE contacts ALTER COLUMN research_id DROP NOT NULL;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0.5;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS public_email text;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_contacts_workspace ON contacts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- ============================================================
-- EXTEND contact_profiles TABLE
-- ============================================================
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS personal_summary text;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS public_activity jsonb DEFAULT '{}'::jsonb;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS recent_posts jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS recent_news jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS website_signals jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS buying_signals jsonb DEFAULT '[]'::jsonb;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0.5;
ALTER TABLE contact_profiles ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================
-- EXTEND prospect_recommendations TABLE
-- ============================================================
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS why_company text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS why_person text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS why_now text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS reply_probability numeric;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS meeting_probability numeric;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS suggested_campaign text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS suggested_messaging_angle text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS suggested_cta text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS recommended_persona text;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS confidence_score numeric DEFAULT 0.5;
ALTER TABLE prospect_recommendations ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- ============================================================
-- COMPANY LOCATIONS
-- ============================================================
CREATE TABLE company_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  location_type text NOT NULL DEFAULT 'headquarters' CHECK (location_type IN ('headquarters', 'office', 'regional', 'subsidiary')),
  city text,
  state text,
  country text,
  timezone text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_locations_company ON company_locations(company_id);
CREATE INDEX idx_company_locations_workspace ON company_locations(workspace_id);

ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_company_locations" ON company_locations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_locations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_company_locations" ON company_locations FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_locations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_company_locations" ON company_locations FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_locations.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_locations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_company_locations" ON company_locations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_locations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COMPANY TECHNOLOGIES
-- ============================================================
CREATE TABLE company_technologies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  technology_name text NOT NULL,
  category text,
  subcategory text,
  confidence_score numeric DEFAULT 0.5,
  detected_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_tech_company ON company_technologies(company_id);
CREATE INDEX idx_company_tech_workspace ON company_technologies(workspace_id);
CREATE INDEX idx_company_tech_name ON company_technologies(technology_name);

ALTER TABLE company_technologies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_company_technologies" ON company_technologies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_technologies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_company_technologies" ON company_technologies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_technologies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_company_technologies" ON company_technologies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_technologies.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_technologies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_company_technologies" ON company_technologies FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_technologies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- COMPANY SIGNALS
-- ============================================================
CREATE TABLE company_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN (
    'buying_intent', 'growth', 'technology', 'hiring', 'market',
    'executive', 'funding', 'expansion', 'product_launch', 'leadership_change',
    'vendor_change', 'compliance_change', 'merger_acquisition'
  )),
  signal_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  signal_strength numeric DEFAULT 0.5,
  signal_source text,
  detected_at timestamptz DEFAULT now(),
  confidence_score numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_signals_company ON company_signals(company_id);
CREATE INDEX idx_company_signals_workspace ON company_signals(workspace_id);
CREATE INDEX idx_company_signals_type ON company_signals(signal_type);

ALTER TABLE company_signals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_company_signals" ON company_signals FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_signals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_company_signals" ON company_signals FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_signals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_company_signals" ON company_signals FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_signals.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_signals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_company_signals" ON company_signals FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = company_signals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONTACT SOCIAL PROFILES
-- ============================================================
CREATE TABLE contact_social_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('linkedin', 'twitter', 'github', 'facebook', 'instagram', 'youtube', 'other')),
  profile_url text,
  username text,
  follower_count integer,
  post_frequency text,
  last_active text,
  confidence_score numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_social_contact ON contact_social_profiles(contact_id);
CREATE INDEX idx_contact_social_workspace ON contact_social_profiles(workspace_id);

ALTER TABLE contact_social_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_contact_social" ON contact_social_profiles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_social_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_contact_social" ON contact_social_profiles FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_social_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_contact_social" ON contact_social_profiles FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_social_profiles.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_social_profiles.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_contact_social" ON contact_social_profiles FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_social_profiles.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CONTACT SKILLS
-- ============================================================
CREATE TABLE contact_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  skill_name text NOT NULL,
  skill_category text,
  proficiency text CHECK (proficiency IN ('beginner', 'intermediate', 'advanced', 'expert')),
  confidence_score numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_skills_contact ON contact_skills(contact_id);
CREATE INDEX idx_contact_skills_workspace ON contact_skills(workspace_id);
CREATE INDEX idx_contact_skills_name ON contact_skills(skill_name);

ALTER TABLE contact_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_contact_skills" ON contact_skills FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_skills.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_contact_skills" ON contact_skills FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_skills.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_contact_skills" ON contact_skills FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_skills.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_skills.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_contact_skills" ON contact_skills FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = contact_skills.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROSPECT SCORES
-- ============================================================
CREATE TABLE prospect_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  company_score integer DEFAULT 0,
  decision_maker_score integer DEFAULT 0,
  relationship_score integer DEFAULT 0,
  reply_probability numeric DEFAULT 0,
  meeting_probability numeric DEFAULT 0,
  revenue_probability numeric DEFAULT 0,
  overall_prospect_score integer DEFAULT 0,
  scoring_factors jsonb DEFAULT '{}'::jsonb,
  ai_explanation text,
  confidence_score numeric DEFAULT 0.5,
  scored_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_prospect_scores_workspace ON prospect_scores(workspace_id);
CREATE INDEX idx_prospect_scores_company ON prospect_scores(company_id);
CREATE INDEX idx_prospect_scores_contact ON prospect_scores(contact_id);
CREATE INDEX idx_prospect_scores_overall ON prospect_scores(overall_prospect_score DESC);

ALTER TABLE prospect_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_prospect_scores" ON prospect_scores FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_prospect_scores" ON prospect_scores FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_prospect_scores" ON prospect_scores FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_scores.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_prospect_scores" ON prospect_scores FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_scores.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROSPECT LISTS
-- ============================================================
CREATE TABLE prospect_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  list_name text NOT NULL,
  description text,
  filter_criteria jsonb DEFAULT '{}'::jsonb,
  member_count integer DEFAULT 0,
  is_dynamic boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_prospect_lists_workspace ON prospect_lists(workspace_id);

ALTER TABLE prospect_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_prospect_lists" ON prospect_lists FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_lists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_prospect_lists" ON prospect_lists FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_lists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_prospect_lists" ON prospect_lists FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_lists.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_lists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_prospect_lists" ON prospect_lists FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_lists.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROSPECT LIST MEMBERS
-- ============================================================
CREATE TABLE prospect_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_list_id uuid NOT NULL REFERENCES prospect_lists(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (company_id IS NOT NULL OR contact_id IS NOT NULL)
);

CREATE INDEX idx_prospect_list_members_list ON prospect_list_members(prospect_list_id);
CREATE INDEX idx_prospect_list_members_workspace ON prospect_list_members(workspace_id);
CREATE INDEX idx_prospect_list_members_company ON prospect_list_members(company_id);
CREATE INDEX idx_prospect_list_members_contact ON prospect_list_members(contact_id);

ALTER TABLE prospect_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_prospect_list_members" ON prospect_list_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_list_members.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_prospect_list_members" ON prospect_list_members FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_list_members.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_prospect_list_members" ON prospect_list_members FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_list_members.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_list_members.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_prospect_list_members" ON prospect_list_members FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = prospect_list_members.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- DISCOVERY JOBS
-- ============================================================
CREATE TABLE discovery_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  revenue_strategy_id uuid REFERENCES revenue_strategies(id) ON DELETE SET NULL,
  job_type text NOT NULL CHECK (job_type IN ('company_discovery', 'contact_discovery', 'enrichment', 'scoring', 'full_pipeline')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  provider_used text,
  search_criteria jsonb DEFAULT '{}'::jsonb,
  companies_found integer DEFAULT 0,
  contacts_found integer DEFAULT 0,
  duplicates_merged integer DEFAULT 0,
  crm_matches integer DEFAULT 0,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_discovery_jobs_workspace ON discovery_jobs(workspace_id);
CREATE INDEX idx_discovery_jobs_status ON discovery_jobs(status);
CREATE INDEX idx_discovery_jobs_type ON discovery_jobs(job_type);

ALTER TABLE discovery_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_discovery_jobs" ON discovery_jobs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = discovery_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_discovery_jobs" ON discovery_jobs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = discovery_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_discovery_jobs" ON discovery_jobs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = discovery_jobs.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = discovery_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_discovery_jobs" ON discovery_jobs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = discovery_jobs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROVIDER SOURCES
-- ============================================================
CREATE TABLE provider_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_name text NOT NULL,
  provider_type text NOT NULL CHECK (provider_type IN ('linkedin', 'sales_navigator', 'apollo', 'zoominfo', 'clearbit', 'crunchbase', 'people_data_labs', 'hunter', 'rocketreach', 'firecrawl', 'tavily', 'ai_gateway')),
  is_active boolean DEFAULT true,
  api_key_configured boolean DEFAULT false,
  rate_limit_remaining integer,
  rate_limit_reset_at timestamptz,
  last_used_at timestamptz,
  total_requests integer DEFAULT 0,
  successful_requests integer DEFAULT 0,
  failed_requests integer DEFAULT 0,
  capabilities jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_sources_workspace ON provider_sources(workspace_id);
CREATE INDEX idx_provider_sources_name ON provider_sources(provider_name);

ALTER TABLE provider_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_provider_sources" ON provider_sources FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sources.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_provider_sources" ON provider_sources FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sources.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_provider_sources" ON provider_sources FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sources.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sources.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_provider_sources" ON provider_sources FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sources.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROVIDER SYNC LOGS
-- ============================================================
CREATE TABLE provider_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_source_id uuid REFERENCES provider_sources(id) ON DELETE SET NULL,
  provider_name text NOT NULL,
  operation text NOT NULL CHECK (operation IN ('company_search', 'company_enrich', 'contact_search', 'contact_enrich', 'signal_detection', 'scoring')),
  status text NOT NULL CHECK (status IN ('success', 'failed', 'partial', 'rate_limited')),
  request_params jsonb DEFAULT '{}'::jsonb,
  response_summary jsonb DEFAULT '{}'::jsonb,
  records_returned integer DEFAULT 0,
  error_message text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_sync_logs_workspace ON provider_sync_logs(workspace_id);
CREATE INDEX idx_provider_sync_logs_provider ON provider_sync_logs(provider_name);
CREATE INDEX idx_provider_sync_logs_created ON provider_sync_logs(created_at DESC);

ALTER TABLE provider_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_provider_sync_logs" ON provider_sync_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sync_logs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_provider_sync_logs" ON provider_sync_logs FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sync_logs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_provider_sync_logs" ON provider_sync_logs FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sync_logs.workspace_id AND wm.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sync_logs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_provider_sync_logs" ON provider_sync_logs FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = provider_sync_logs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_pd_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_prospect_scores_updated_at ON prospect_scores;
CREATE TRIGGER trigger_prospect_scores_updated_at BEFORE UPDATE ON prospect_scores FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_prospect_lists_updated_at ON prospect_lists;
CREATE TRIGGER trigger_prospect_lists_updated_at BEFORE UPDATE ON prospect_lists FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_discovery_jobs_updated_at ON discovery_jobs;
CREATE TRIGGER trigger_discovery_jobs_updated_at BEFORE UPDATE ON discovery_jobs FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_provider_sources_updated_at ON provider_sources;
CREATE TRIGGER trigger_provider_sources_updated_at BEFORE UPDATE ON provider_sources FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_companies_pd_updated_at ON companies;
CREATE TRIGGER trigger_companies_pd_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_contacts_pd_updated_at ON contacts;
CREATE TRIGGER trigger_contacts_pd_updated_at BEFORE UPDATE ON contacts FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_contact_profiles_pd_updated_at ON contact_profiles;
CREATE TRIGGER trigger_contact_profiles_pd_updated_at BEFORE UPDATE ON contact_profiles FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();

DROP TRIGGER IF EXISTS trigger_prospect_recs_pd_updated_at ON prospect_recommendations;
CREATE TRIGGER trigger_prospect_recs_pd_updated_at BEFORE UPDATE ON prospect_recommendations FOR EACH ROW EXECUTE FUNCTION update_pd_updated_at();
