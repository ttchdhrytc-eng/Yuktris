/*
# Phase 11 — Proposal Intelligence Engine Schema
#
# New tables only — reuses existing proposal_projects, proposal_versions,
# proposal_sections, proposal_pricing, proposal_templates, proposal_approvals,
# proposal_reviews, proposal_assets.
*/

-- ============================================================
-- PROPOSAL REQUESTS (AI-detected proposal readiness)
-- ============================================================
CREATE TABLE proposal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES meeting_scheduler(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE SET NULL,
  prospect_name text,
  company_name text,
  trigger_reason text NOT NULL CHECK (trigger_reason IN (
    'meeting_outcome', 'buying_stage', 'meeting_score', 'conversation_rec', 'manual'
  )),
  trigger_data jsonb DEFAULT '{}'::jsonb,
  buying_stage text,
  meeting_score integer,
  estimated_deal_value numeric(12,2),
  urgency text DEFAULT 'medium' CHECK (urgency IN ('low','medium','high','critical')),
  confidence_score numeric DEFAULT 0.5,
  reasoning text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','generating','generated','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_requests_workspace ON proposal_requests(workspace_id);
CREATE INDEX idx_proposal_requests_status ON proposal_requests(status);
CREATE INDEX idx_proposal_requests_meeting ON proposal_requests(meeting_id);
CREATE INDEX idx_proposal_requests_company ON proposal_requests(company_id);

ALTER TABLE proposal_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_requests" ON proposal_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_requests.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_requests" ON proposal_requests FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_requests.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_requests" ON proposal_requests FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_requests.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_requests.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_requests" ON proposal_requests FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_requests.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL PACKAGES (Good/Better/Best/Enterprise/Custom)
-- ============================================================
CREATE TABLE proposal_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  package_tier text NOT NULL CHECK (package_tier IN ('good','better','best','enterprise','custom')),
  package_name text NOT NULL,
  description text,
  features jsonb DEFAULT '[]'::jsonb,
  deliverables jsonb DEFAULT '[]'::jsonb,
  timeline_weeks integer,
  price numeric(12,2),
  roi_estimate jsonb DEFAULT '{}'::jsonb,
  recommended_audience text,
  is_recommended boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_packages_workspace ON proposal_packages(workspace_id);
CREATE INDEX idx_proposal_packages_project ON proposal_packages(project_id);
CREATE INDEX idx_proposal_packages_version ON proposal_packages(version_id);

ALTER TABLE proposal_packages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_packages" ON proposal_packages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_packages.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_packages" ON proposal_packages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_packages.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_packages" ON proposal_packages FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_packages.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_packages.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_packages" ON proposal_packages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_packages.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL OPTIONS (investment options)
-- ============================================================
CREATE TABLE proposal_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  option_name text NOT NULL,
  option_type text NOT NULL CHECK (option_type IN ('investment','payment','term','addon')),
  description text,
  investment_amount numeric(12,2),
  term_months integer,
  monthly_cost numeric(12,2),
  total_cost numeric(12,2),
  savings_estimate numeric(12,2),
  benefits jsonb DEFAULT '[]'::jsonb,
  is_recommended boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_options_workspace ON proposal_options(workspace_id);
CREATE INDEX idx_proposal_options_project ON proposal_options(project_id);

ALTER TABLE proposal_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_options" ON proposal_options FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_options.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_options" ON proposal_options FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_options.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_options" ON proposal_options FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_options.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_options.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_options" ON proposal_options FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_options.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL ROI
-- ============================================================
CREATE TABLE proposal_roi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  investment_amount numeric(12,2) NOT NULL,
  annual_savings numeric(12,2),
  revenue_increase numeric(12,2),
  productivity_gain_hours numeric(12,2),
  productivity_gain_value numeric(12,2),
  payback_period_months numeric(5,1),
  break_even_month integer,
  roi_1_year numeric(5,2),
  roi_3_year numeric(5,2),
  roi_5_year numeric(5,2),
  business_impact text,
  total_3_year_value numeric(12,2),
  total_5_year_value numeric(12,2),
  confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_roi_workspace ON proposal_roi(workspace_id);
CREATE INDEX idx_proposal_roi_project ON proposal_roi(project_id);

ALTER TABLE proposal_roi ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_roi" ON proposal_roi FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_roi.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_roi" ON proposal_roi FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_roi.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_roi" ON proposal_roi FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_roi.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_roi.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_roi" ON proposal_roi FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_roi.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL BUSINESS CASE
-- ============================================================
CREATE TABLE proposal_business_case (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  problem_statement text NOT NULL,
  financial_impact text,
  opportunity_cost text,
  recommended_investment text,
  expected_return text,
  strategic_benefits jsonb DEFAULT '[]'::jsonb,
  operational_benefits jsonb DEFAULT '[]'::jsonb,
  executive_summary text,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_biz_case_workspace ON proposal_business_case(workspace_id);
CREATE INDEX idx_proposal_biz_case_project ON proposal_business_case(project_id);

ALTER TABLE proposal_business_case ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_biz_case" ON proposal_business_case FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_business_case.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_biz_case" ON proposal_business_case FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_business_case.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_biz_case" ON proposal_business_case FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_business_case.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_business_case.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_biz_case" ON proposal_business_case FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_business_case.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL TIMELINE
-- ============================================================
CREATE TABLE proposal_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  phase_name text NOT NULL,
  phase_description text,
  start_week integer,
  end_week integer,
  milestones jsonb DEFAULT '[]'::jsonb,
  deliverables jsonb DEFAULT '[]'::jsonb,
  dependencies jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_timeline_workspace ON proposal_timeline(workspace_id);
CREATE INDEX idx_proposal_timeline_project ON proposal_timeline(project_id);

ALTER TABLE proposal_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_timeline" ON proposal_timeline FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_timeline.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_timeline" ON proposal_timeline FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_timeline.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_timeline" ON proposal_timeline FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_timeline.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_timeline.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_timeline" ON proposal_timeline FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_timeline.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL SCOPE
-- ============================================================
CREATE TABLE proposal_scope (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  scope_item text NOT NULL,
  scope_type text DEFAULT 'included' CHECK (scope_type IN ('included','excluded','optional','addon')),
  description text,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_scope_workspace ON proposal_scope(workspace_id);
CREATE INDEX idx_proposal_scope_project ON proposal_scope(project_id);

ALTER TABLE proposal_scope ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_scope" ON proposal_scope FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_scope.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_scope" ON proposal_scope FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_scope.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_scope" ON proposal_scope FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_scope.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_scope.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_scope" ON proposal_scope FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_scope.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL DELIVERABLES
-- ============================================================
CREATE TABLE proposal_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  deliverable_name text NOT NULL,
  description text,
  delivery_week integer,
  acceptance_criteria text,
  dependencies jsonb DEFAULT '[]'::jsonb,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_deliverables_workspace ON proposal_deliverables(workspace_id);
CREATE INDEX idx_proposal_deliverables_project ON proposal_deliverables(project_id);

ALTER TABLE proposal_deliverables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_deliverables" ON proposal_deliverables FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_deliverables.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_deliverables" ON proposal_deliverables FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_deliverables.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_deliverables" ON proposal_deliverables FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_deliverables.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_deliverables.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_deliverables" ON proposal_deliverables FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_deliverables.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL ASSUMPTIONS
-- ============================================================
CREATE TABLE proposal_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  assumption_text text NOT NULL,
  assumption_type text DEFAULT 'general' CHECK (assumption_type IN ('general','technical','financial','timeline','resource','scope')),
  impact text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_assumptions_workspace ON proposal_assumptions(workspace_id);
CREATE INDEX idx_proposal_assumptions_project ON proposal_assumptions(project_id);

ALTER TABLE proposal_assumptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_assumptions" ON proposal_assumptions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_assumptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_assumptions" ON proposal_assumptions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_assumptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_assumptions" ON proposal_assumptions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_assumptions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_assumptions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_assumptions" ON proposal_assumptions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_assumptions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL DEPENDENCIES
-- ============================================================
CREATE TABLE proposal_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  dependency_text text NOT NULL,
  dependency_type text DEFAULT 'external' CHECK (dependency_type IN ('external','internal','client','third_party','technical')),
  mitigation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_dependencies_workspace ON proposal_dependencies(workspace_id);
CREATE INDEX idx_proposal_dependencies_project ON proposal_dependencies(project_id);

ALTER TABLE proposal_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_dependencies" ON proposal_dependencies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_dependencies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_dependencies" ON proposal_dependencies FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_dependencies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_dependencies" ON proposal_dependencies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_dependencies.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 from workspace_members wm WHERE wm.workspace_id = proposal_dependencies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_dependencies" ON proposal_dependencies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_dependencies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL RISKS
-- ============================================================
CREATE TABLE proposal_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  risk_text text NOT NULL,
  risk_type text DEFAULT 'general' CHECK (risk_type IN ('general','technical','financial','timeline','scope','resource')),
  probability text DEFAULT 'medium' CHECK (probability IN ('low','medium','high')),
  impact text DEFAULT 'medium' CHECK (impact IN ('low','medium','high')),
  mitigation text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_risks_workspace ON proposal_risks(workspace_id);
CREATE INDEX idx_proposal_risks_project ON proposal_risks(project_id);

ALTER TABLE proposal_risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_risks" ON proposal_risks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_risks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_risks" ON proposal_risks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_risks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_risks" ON proposal_risks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_risks.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_risks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_risks" ON proposal_risks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_risks.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL TEAM
-- ============================================================
CREATE TABLE proposal_team (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  member_name text NOT NULL,
  member_role text,
  member_email text,
  responsibilities jsonb DEFAULT '[]'::jsonb,
  allocation_percentage integer DEFAULT 100,
  is_internal boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_team_workspace ON proposal_team(workspace_id);
CREATE INDEX idx_proposal_team_project ON proposal_team(project_id);

ALTER TABLE proposal_team ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_team" ON proposal_team FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_team.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_team" ON proposal_team FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_team.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_team" ON proposal_team FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_team.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_team.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_team" ON proposal_team FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_team.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL CASE STUDIES (selected for this proposal)
-- ============================================================
CREATE TABLE proposal_case_studies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  case_study_name text NOT NULL,
  industry text,
  company_size text,
  challenge text,
  solution text,
  results jsonb DEFAULT '[]'::jsonb,
  relevance_score numeric DEFAULT 0.5,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_case_studies_workspace ON proposal_case_studies(workspace_id);
CREATE INDEX idx_proposal_case_studies_project ON proposal_case_studies(project_id);

ALTER TABLE proposal_case_studies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_case_studies" ON proposal_case_studies FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_case_studies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_case_studies" ON proposal_case_studies FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_case_studies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_case_studies" ON proposal_case_studies FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_case_studies.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_case_studies.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_case_studies" ON proposal_case_studies FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_case_studies.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL TESTIMONIALS
-- ============================================================
CREATE TABLE proposal_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  quote text NOT NULL,
  author_name text,
  author_title text,
  author_company text,
  industry text,
  relevance_score numeric DEFAULT 0.5,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_testimonials_workspace ON proposal_testimonials(workspace_id);
CREATE INDEX idx_proposal_testimonials_project ON proposal_testimonials(project_id);

ALTER TABLE proposal_testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_testimonials" ON proposal_testimonials FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_testimonials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_testimonials" ON proposal_testimonials FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_testimonials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_testimonials" ON proposal_testimonials FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_testimonials.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_testimonials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_testimonials" ON proposal_testimonials FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_testimonials.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL CONTRACT TERMS
-- ============================================================
CREATE TABLE proposal_contract_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  term_name text NOT NULL,
  term_type text NOT NULL CHECK (term_type IN ('payment','delivery','warranty','ip','confidentiality','termination','sla','liability','governing_law','custom')),
  term_text text NOT NULL,
  is_negotiable boolean DEFAULT true,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_contract_terms_workspace ON proposal_contract_terms(workspace_id);
CREATE INDEX idx_proposal_contract_terms_project ON proposal_contract_terms(project_id);

ALTER TABLE proposal_contract_terms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_contract_terms" ON proposal_contract_terms FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_contract_terms.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_contract_terms" ON proposal_contract_terms FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_contract_terms.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_contract_terms" ON proposal_contract_terms FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_contract_terms.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_contract_terms.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_contract_terms" ON proposal_contract_terms FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_contract_terms.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL PAYMENT PLANS
-- ============================================================
CREATE TABLE proposal_payment_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  plan_name text NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly','quarterly','annual','milestone','upfront','hybrid')),
  total_amount numeric(12,2),
  installment_count integer,
  installment_amount numeric(12,2),
  payment_terms text,
  discount_percentage numeric(5,2),
  is_recommended boolean DEFAULT false,
  sort_order integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_payment_plans_workspace ON proposal_payment_plans(workspace_id);
CREATE INDEX idx_proposal_payment_plans_project ON proposal_payment_plans(project_id);

ALTER TABLE proposal_payment_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_payment_plans" ON proposal_payment_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_payment_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_payment_plans" ON proposal_payment_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_payment_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_payment_plans" ON proposal_payment_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_payment_plans.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_payment_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_payment_plans" ON proposal_payment_plans FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_payment_plans.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL DISCOUNT RULES
-- ============================================================
CREATE TABLE proposal_discount_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_name text NOT NULL,
  rule_type text NOT NULL CHECK (rule_type IN ('volume','annual_commit','multi_year','startup','nonprofit','loyalty','strategic','custom')),
  discount_percentage numeric(5,2) NOT NULL,
  min_contract_value numeric(12,2),
  conditions jsonb DEFAULT '{}'::jsonb,
  requires_approval boolean DEFAULT false,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_discount_rules_workspace ON proposal_discount_rules(workspace_id);

ALTER TABLE proposal_discount_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_discount_rules" ON proposal_discount_rules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_discount_rules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_discount_rules" ON proposal_discount_rules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_discount_rules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_discount_rules" ON proposal_discount_rules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_discount_rules.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_discount_rules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_discount_rules" ON proposal_discount_rules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_discount_rules.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL NEGOTIATION
-- ============================================================
CREATE TABLE proposal_negotiation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  negotiation_round integer DEFAULT 1,
  predicted_objections jsonb DEFAULT '[]'::jsonb,
  pricing_concerns jsonb DEFAULT '[]'::jsonb,
  competitor_comparison jsonb DEFAULT '[]'::jsonb,
  discount_requests jsonb DEFAULT '[]'::jsonb,
  risk_concerns jsonb DEFAULT '[]'::jsonb,
  negotiation_guidance text,
  fallback_offers jsonb DEFAULT '[]'::jsonb,
  alternative_packages jsonb DEFAULT '[]'::jsonb,
  concessions jsonb DEFAULT '[]'::jsonb,
  red_lines jsonb DEFAULT '[]'::jsonb,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_negotiation_workspace ON proposal_negotiation(workspace_id);
CREATE INDEX idx_proposal_negotiation_project ON proposal_negotiation(project_id);

ALTER TABLE proposal_negotiation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_negotiation" ON proposal_negotiation FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_negotiation.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_negotiation" ON proposal_negotiation FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_negotiation.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_negotiation" ON proposal_negotiation FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_negotiation.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_negotiation.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_negotiation" ON proposal_negotiation FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_negotiation.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL SIGNATURES
-- ============================================================
CREATE TABLE proposal_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE CASCADE,
  signer_name text NOT NULL,
  signer_email text,
  signer_role text,
  signature_status text DEFAULT 'pending' CHECK (signature_status IN ('pending','signed','declined','expired')),
  signed_at timestamptz,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_signatures_workspace ON proposal_signatures(workspace_id);
CREATE INDEX idx_proposal_signatures_project ON proposal_signatures(project_id);

ALTER TABLE proposal_signatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_signatures" ON proposal_signatures FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_signatures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_signatures" ON proposal_signatures FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_signatures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_signatures" ON proposal_signatures FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_signatures.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_signatures.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_signatures" ON proposal_signatures FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_signatures.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL STATUS (lifecycle tracking)
-- ============================================================
CREATE TABLE proposal_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES proposal_projects(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN (
    'draft','generating','review','approved','sent','viewed','negotiating',
    'accepted','rejected','expired','withdrawn','revised'
  )),
  status_reason text,
  changed_by text NOT NULL CHECK (changed_by IN ('ai','human','system')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_status_workspace ON proposal_status(workspace_id);
CREATE INDEX idx_proposal_status_project ON proposal_status(project_id);
CREATE INDEX idx_proposal_status_current ON proposal_status(created_at DESC);

ALTER TABLE proposal_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_status" ON proposal_status FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_status.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_status" ON proposal_status FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_status.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_status" ON proposal_status FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_status.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_status.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_status" ON proposal_status FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_status.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL DELIVERY (tracking sent/opened/viewed)
-- ============================================================
CREATE TABLE proposal_delivery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES proposal_projects(id) ON DELETE CASCADE,
  version_id uuid REFERENCES proposal_versions(id) ON DELETE SET NULL,
  delivery_method text NOT NULL CHECK (delivery_method IN ('email','link','portal','pdf','in_person')),
  delivery_url text,
  recipient_email text,
  recipient_name text,
  sent_at timestamptz,
  opened_at timestamptz,
  first_view_at timestamptz,
  last_view_at timestamptz,
  view_count integer DEFAULT 0,
  time_spent_seconds integer DEFAULT 0,
  download_count integer DEFAULT 0,
  is_accepted boolean DEFAULT false,
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_delivery_workspace ON proposal_delivery(workspace_id);
CREATE INDEX idx_proposal_delivery_project ON proposal_delivery(project_id);

ALTER TABLE proposal_delivery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_delivery" ON proposal_delivery FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_delivery.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_delivery" ON proposal_delivery FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_delivery.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_delivery" ON proposal_delivery FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_delivery.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_delivery.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_delivery" ON proposal_delivery FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_delivery.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL VIEWS (section-level tracking)
-- ============================================================
CREATE TABLE proposal_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  delivery_id uuid REFERENCES proposal_delivery(id) ON DELETE CASCADE,
  section_name text,
  time_spent_seconds integer DEFAULT 0,
  viewed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_views_workspace ON proposal_views(workspace_id);
CREATE INDEX idx_proposal_views_project ON proposal_views(project_id);
CREATE INDEX idx_proposal_views_delivery ON proposal_views(delivery_id);

ALTER TABLE proposal_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_views" ON proposal_views FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_views.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_views" ON proposal_views FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_views.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_views" ON proposal_views FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_views.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_views.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_views" ON proposal_views FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_views.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL ACTIVITY (comments, questions, revision requests)
-- ============================================================
CREATE TABLE proposal_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES proposal_projects(id) ON DELETE CASCADE,
  activity_type text NOT NULL CHECK (activity_type IN ('comment','question','revision_request','status_change','approval','signature','view','download','share')),
  activity_text text,
  activity_data jsonb DEFAULT '{}'::jsonb,
  actor_name text,
  actor_type text DEFAULT 'internal' CHECK (actor_type IN ('internal','external','system','ai')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_activity_workspace ON proposal_activity(workspace_id);
CREATE INDEX idx_proposal_activity_project ON proposal_activity(project_id);
CREATE INDEX idx_proposal_activity_created ON proposal_activity(created_at DESC);

ALTER TABLE proposal_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_activity" ON proposal_activity FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_activity.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_activity" ON proposal_activity FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_activity.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_activity" ON proposal_activity FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_activity.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_activity.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_activity" ON proposal_activity FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_activity.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL NOTIFICATIONS
-- ============================================================
CREATE TABLE proposal_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid REFERENCES proposal_projects(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'proposal_ready','approval_needed','proposal_sent','proposal_viewed',
    'proposal_accepted','proposal_rejected','negotiation_started',
    'signature_requested','version_created','expiring_soon','expired',
    'revision_requested','pricing_approved','legal_review_needed'
  )),
  notification_title text NOT NULL,
  notification_message text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info','warning','error','success')),
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_notifications_workspace ON proposal_notifications(workspace_id);
CREATE INDEX idx_proposal_notifications_unread ON proposal_notifications(is_read) WHERE is_read = false;

ALTER TABLE proposal_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_notifications" ON proposal_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_notifications" ON proposal_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_notifications" ON proposal_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_notifications.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_notifications" ON proposal_notifications FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_notifications.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL AI REASONING
-- ============================================================
CREATE TABLE proposal_ai_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES proposal_projects(id) ON DELETE CASCADE,
  reasoning_type text NOT NULL CHECK (reasoning_type IN (
    'pricing','roi','timeline','package','discount','structure','negotiation','delivery'
  )),
  reasoning_text text NOT NULL,
  reasoning_data jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_ai_reasoning_workspace ON proposal_ai_reasoning(workspace_id);
CREATE INDEX idx_proposal_ai_reasoning_project ON proposal_ai_reasoning(project_id);

ALTER TABLE proposal_ai_reasoning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_ai_reasoning" ON proposal_ai_reasoning FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_ai_reasoning" ON proposal_ai_reasoning FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_ai_reasoning" ON proposal_ai_reasoning FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_ai_reasoning.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_ai_reasoning" ON proposal_ai_reasoning FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL SCORE
-- ============================================================
CREATE TABLE proposal_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES proposal_projects(id) ON DELETE CASCADE,
  win_probability integer DEFAULT 0,
  pricing_strength integer DEFAULT 0,
  competitive_position integer DEFAULT 0,
  roi_quality integer DEFAULT 0,
  proposal_quality integer DEFAULT 0,
  relationship_strength integer DEFAULT 0,
  decision_confidence integer DEFAULT 0,
  overall_score integer DEFAULT 0,
  score_explanation jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_score_workspace ON proposal_score(workspace_id);
CREATE INDEX idx_proposal_score_project ON proposal_score(project_id);
CREATE INDEX idx_proposal_score_overall ON proposal_score(overall_score DESC);

ALTER TABLE proposal_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_score" ON proposal_score FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_score" ON proposal_score FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_score" ON proposal_score FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_score.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_score" ON proposal_score FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_score.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- PROPOSAL OUTCOMES
-- ============================================================
CREATE TABLE proposal_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES proposal_projects(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('pending','accepted','rejected','negotiating','expired','withdrawn','revised')),
  outcome_reason text,
  final_deal_value numeric(12,2),
  final_discount_percentage numeric(5,2),
  negotiation_rounds integer DEFAULT 0,
  time_to_close_days integer,
  win_loss_factors jsonb DEFAULT '[]'::jsonb,
  lessons_learned jsonb DEFAULT '[]'::jsonb,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_proposal_outcomes_workspace ON proposal_outcomes(workspace_id);
CREATE INDEX idx_proposal_outcomes_project ON proposal_outcomes(project_id);

ALTER TABLE proposal_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_proposal_outcomes" ON proposal_outcomes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_outcomes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_proposal_outcomes" ON proposal_outcomes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_outcomes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_proposal_outcomes" ON proposal_outcomes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_outcomes.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_outcomes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_proposal_outcomes" ON proposal_outcomes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = proposal_outcomes.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_pi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_proposal_requests_pi_updated_at ON proposal_requests;
CREATE TRIGGER trigger_proposal_requests_pi_updated_at BEFORE UPDATE ON proposal_requests FOR EACH ROW EXECUTE FUNCTION update_pi_updated_at();
