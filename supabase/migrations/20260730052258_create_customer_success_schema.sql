/*
# Phase 13 — Customer Success, Account Intelligence & Expansion Engine
# 40+ tables: customer management, onboarding, success, renewals, expansion, churn, advocacy.
*/

-- ============================================================
-- CUSTOMER ACCOUNTS
-- ============================================================
CREATE TABLE customer_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  deal_id uuid REFERENCES pipeline_deals(id) ON DELETE SET NULL,
  account_name text NOT NULL,
  account_tier text DEFAULT 'standard' CHECK (account_tier IN ('standard','growth','enterprise','strategic')),
  account_status text DEFAULT 'active' CHECK (account_status IN ('active','onboarding','at_risk','churned','paused','trial')),
  contract_start_date date,
  contract_end_date date,
  contract_value numeric(14,2) DEFAULT 0,
  mrr numeric(14,2) DEFAULT 0,
  arr numeric(14,2) DEFAULT 0,
  industry text,
  geography text,
  employee_count integer,
  executive_sponsor text,
  primary_contact_id uuid,
  cs_owner text,
  last_health_check timestamptz,
  last_contact_at timestamptz,
  last_meeting_at timestamptz,
  last_qbr_at timestamptz,
  health_score integer DEFAULT 50,
  churn_risk_score integer DEFAULT 0,
  expansion_score integer DEFAULT 0,
  renewal_probability integer DEFAULT 50,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_accounts_workspace ON customer_accounts(workspace_id);
CREATE INDEX idx_customer_accounts_company ON customer_accounts(company_id);
CREATE INDEX idx_customer_accounts_status ON customer_accounts(account_status);
CREATE INDEX idx_customer_accounts_health ON customer_accounts(health_score);
CREATE INDEX idx_customer_accounts_churn_risk ON customer_accounts(churn_risk_score);
ALTER TABLE customer_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_accounts" ON customer_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_accounts" ON customer_accounts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_accounts" ON customer_accounts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_accounts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_accounts" ON customer_accounts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_accounts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER CONTACTS
-- ============================================================
CREATE TABLE customer_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  contact_role text,
  contact_title text,
  is_primary boolean DEFAULT false,
  is_executive_sponsor boolean DEFAULT false,
  is_champion boolean DEFAULT false,
  is_decision_maker boolean DEFAULT false,
  relationship_score integer DEFAULT 50,
  engagement_level text DEFAULT 'medium' CHECK (engagement_level IN ('low','medium','high','very_high')),
  last_contact_at timestamptz,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_contacts_workspace ON customer_contacts(workspace_id);
CREATE INDEX idx_customer_contacts_account ON customer_contacts(customer_account_id);
ALTER TABLE customer_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_contacts" ON customer_contacts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_contacts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_contacts" ON customer_contacts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_contacts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_contacts" ON customer_contacts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_contacts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_contacts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_contacts" ON customer_contacts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_contacts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER HEALTH
-- ============================================================
CREATE TABLE customer_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  health_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_health_score integer DEFAULT 50,
  relationship_score integer DEFAULT 50,
  engagement_score integer DEFAULT 50,
  product_adoption_score integer DEFAULT 50,
  communication_score integer DEFAULT 50,
  expansion_score integer DEFAULT 50,
  renewal_probability integer DEFAULT 50,
  churn_probability integer DEFAULT 0,
  executive_relationship_score integer DEFAULT 50,
  customer_satisfaction_score integer DEFAULT 50,
  health_factors jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  supporting_evidence jsonb DEFAULT '[]'::jsonb,
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_health_workspace ON customer_health(workspace_id);
CREATE INDEX idx_customer_health_account ON customer_health(customer_account_id);
CREATE INDEX idx_customer_health_date ON customer_health(health_date DESC);
ALTER TABLE customer_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_health" ON customer_health FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_health" ON customer_health FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_health" ON customer_health FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_health.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_health" ON customer_health FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_health.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER SEGMENTS
-- ============================================================
CREATE TABLE customer_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  segment_name text NOT NULL,
  segment_type text DEFAULT 'custom' CHECK (segment_type IN ('tier','industry','geography','size','health','churn_risk','expansion','custom')),
  segment_criteria jsonb DEFAULT '{}'::jsonb,
  customer_count integer DEFAULT 0,
  total_arr numeric(14,2) DEFAULT 0,
  avg_health_score integer DEFAULT 50,
  avg_churn_risk integer DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_segments_workspace ON customer_segments(workspace_id);
ALTER TABLE customer_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_segments" ON customer_segments FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_segments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_segments" ON customer_segments FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_segments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_segments" ON customer_segments FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_segments.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_segments.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_segments" ON customer_segments FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_segments.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER JOURNEY
-- ============================================================
CREATE TABLE customer_journey (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  journey_stage text NOT NULL CHECK (journey_stage IN ('prospect','onboarding','activation','adoption','expansion','renewal','advocacy','churn')),
  stage_entered_at timestamptz NOT NULL DEFAULT now(),
  stage_exited_at timestamptz,
  duration_days integer,
  stage_data jsonb DEFAULT '{}'::jsonb,
  milestone_achieved boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_journey_workspace ON customer_journey(workspace_id);
CREATE INDEX idx_customer_journey_account ON customer_journey(customer_account_id);
CREATE INDEX idx_customer_journey_stage ON customer_journey(journey_stage);
ALTER TABLE customer_journey ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_journey" ON customer_journey FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_journey.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_journey" ON customer_journey FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_journey.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_journey" ON customer_journey FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_journey.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_journey.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_journey" ON customer_journey FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_journey.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER LIFECYCLE
-- ============================================================
CREATE TABLE customer_lifecycle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  lifecycle_stage text NOT NULL CHECK (lifecycle_stage IN ('onboarding','activation','growth','maturity','expansion','renewal','churn','win_back')),
  stage_start_date date NOT NULL DEFAULT CURRENT_DATE,
  stage_end_date date,
  stage_duration_days integer,
  is_current boolean DEFAULT true,
  lifecycle_metrics jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_lifecycle_workspace ON customer_lifecycle(workspace_id);
CREATE INDEX idx_customer_lifecycle_account ON customer_lifecycle(customer_account_id);
ALTER TABLE customer_lifecycle ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_lifecycle" ON customer_lifecycle FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_lifecycle.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_lifecycle" ON customer_lifecycle FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_lifecycle.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_lifecycle" ON customer_lifecycle FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_lifecycle.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_lifecycle.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_lifecycle" ON customer_lifecycle FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_lifecycle.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER ENGAGEMENT
-- ============================================================
CREATE TABLE customer_engagement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  engagement_type text NOT NULL CHECK (engagement_type IN ('meeting','email','call','message','support_ticket','product_usage','feedback','review','referral','event','training')),
  engagement_date timestamptz NOT NULL DEFAULT now(),
  engagement_direction text DEFAULT 'outbound' CHECK (engagement_direction IN ('inbound','outbound')),
  engagement_score integer DEFAULT 50,
  sentiment text DEFAULT 'neutral' CHECK (sentiment IN ('positive','neutral','negative')),
  engagement_summary text,
  engagement_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_engagement_workspace ON customer_engagement(workspace_id);
CREATE INDEX idx_customer_engagement_account ON customer_engagement(customer_account_id);
CREATE INDEX idx_customer_engagement_date ON customer_engagement(engagement_date DESC);
ALTER TABLE customer_engagement ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_engagement" ON customer_engagement FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_engagement.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_engagement" ON customer_engagement FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_engagement.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_engagement" ON customer_engagement FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_engagement.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_engagement.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_engagement" ON customer_engagement FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_engagement.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER RELATIONSHIPS
-- ============================================================
CREATE TABLE customer_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  relationship_type text NOT NULL CHECK (relationship_type IN ('executive_sponsor','champion','decision_maker','influencer','user','blocker','detractor')),
  contact_name text NOT NULL,
  contact_title text,
  contact_email text,
  relationship_strength integer DEFAULT 50,
  engagement_frequency text DEFAULT 'monthly' CHECK (engagement_frequency IN ('weekly','biweekly','monthly','quarterly','rarely')),
  last_interaction_at timestamptz,
  relationship_notes text,
  ai_assessment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_relationships_workspace ON customer_relationships(workspace_id);
CREATE INDEX idx_customer_relationships_account ON customer_relationships(customer_account_id);
ALTER TABLE customer_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_relationships" ON customer_relationships FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_relationships.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_relationships" ON customer_relationships FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_relationships.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_relationships" ON customer_relationships FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_relationships.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_relationships.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_relationships" ON customer_relationships FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_relationships.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ONBOARDING PROJECTS
-- ============================================================
CREATE TABLE onboarding_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  project_name text NOT NULL,
  project_status text DEFAULT 'planned' CHECK (project_status IN ('planned','in_progress','completed','delayed','at_risk','cancelled')),
  start_date date,
  target_completion_date date,
  actual_completion_date date,
  progress_percentage integer DEFAULT 0,
  onboarding_owner text,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_projects_workspace ON onboarding_projects(workspace_id);
CREATE INDEX idx_onboarding_projects_account ON onboarding_projects(customer_account_id);
CREATE INDEX idx_onboarding_projects_status ON onboarding_projects(project_status);
ALTER TABLE onboarding_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_onboarding_projects" ON onboarding_projects FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_projects.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_onboarding_projects" ON onboarding_projects FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_projects.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_onboarding_projects" ON onboarding_projects FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_projects.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_projects.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_onboarding_projects" ON onboarding_projects FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_projects.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ONBOARDING TASKS
-- ============================================================
CREATE TABLE onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  onboarding_project_id uuid NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  task_description text,
  task_status text DEFAULT 'pending' CHECK (task_status IN ('pending','in_progress','completed','blocked','skipped')),
  assigned_to text,
  due_date date,
  completed_at timestamptz,
  task_order integer DEFAULT 0,
  is_milestone boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_tasks_workspace ON onboarding_tasks(workspace_id);
CREATE INDEX idx_onboarding_tasks_project ON onboarding_tasks(onboarding_project_id);
ALTER TABLE onboarding_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_onboarding_tasks" ON onboarding_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_onboarding_tasks" ON onboarding_tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_onboarding_tasks" ON onboarding_tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_tasks.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_onboarding_tasks" ON onboarding_tasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_tasks.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ONBOARDING PROGRESS
-- ============================================================
CREATE TABLE onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  onboarding_project_id uuid NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  progress_date date NOT NULL DEFAULT CURRENT_DATE,
  total_tasks integer DEFAULT 0,
  completed_tasks integer DEFAULT 0,
  blocked_tasks integer DEFAULT 0,
  progress_percentage numeric(5,2) DEFAULT 0,
  days_elapsed integer DEFAULT 0,
  days_remaining integer,
  is_on_track boolean DEFAULT true,
  ai_assessment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_progress_workspace ON onboarding_progress(workspace_id);
CREATE INDEX idx_onboarding_progress_project ON onboarding_progress(onboarding_project_id);
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_onboarding_progress" ON onboarding_progress FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_progress.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_onboarding_progress" ON onboarding_progress FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_progress.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_onboarding_progress" ON onboarding_progress FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_progress.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_progress.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_onboarding_progress" ON onboarding_progress FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_progress.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ONBOARDING CHECKLISTS
-- ============================================================
CREATE TABLE onboarding_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  onboarding_project_id uuid NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  checklist_name text NOT NULL,
  checklist_items jsonb DEFAULT '[]'::jsonb,
  completed_items integer DEFAULT 0,
  total_items integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_checklists_workspace ON onboarding_checklists(workspace_id);
ALTER TABLE onboarding_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_onboarding_checklists" ON onboarding_checklists FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_checklists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_onboarding_checklists" ON onboarding_checklists FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_checklists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_onboarding_checklists" ON onboarding_checklists FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_checklists.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_checklists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_onboarding_checklists" ON onboarding_checklists FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_checklists.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ONBOARDING DOCUMENTS
-- ============================================================
CREATE TABLE onboarding_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  onboarding_project_id uuid NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  document_name text NOT NULL,
  document_type text CHECK (document_type IN ('welcome','guide','checklist','contract','sla','training','resource')),
  document_url text,
  document_content text,
  is_delivered boolean DEFAULT false,
  delivered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_documents_workspace ON onboarding_documents(workspace_id);
ALTER TABLE onboarding_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_onboarding_documents" ON onboarding_documents FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_documents.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_onboarding_documents" ON onboarding_documents FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_documents.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_onboarding_documents" ON onboarding_documents FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_documents.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_documents.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_onboarding_documents" ON onboarding_documents FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_documents.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- ONBOARDING MILESTONES
-- ============================================================
CREATE TABLE onboarding_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  onboarding_project_id uuid NOT NULL REFERENCES onboarding_projects(id) ON DELETE CASCADE,
  milestone_name text NOT NULL,
  milestone_description text,
  target_date date,
  achieved_date date,
  is_achieved boolean DEFAULT false,
  milestone_order integer DEFAULT 0,
  ai_assessment text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_onboarding_milestones_workspace ON onboarding_milestones(workspace_id);
ALTER TABLE onboarding_milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_onboarding_milestones" ON onboarding_milestones FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_milestones.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_onboarding_milestones" ON onboarding_milestones FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_milestones.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_onboarding_milestones" ON onboarding_milestones FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_milestones.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_milestones.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_onboarding_milestones" ON onboarding_milestones FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = onboarding_milestones.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER SUCCESS PLANS
-- ============================================================
CREATE TABLE customer_success_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  plan_type text DEFAULT 'standard' CHECK (plan_type IN ('standard','enterprise','strategic','at_risk','expansion')),
  plan_status text DEFAULT 'active' CHECK (plan_status IN ('draft','active','completed','archived')),
  plan_summary text,
  success_criteria jsonb DEFAULT '[]'::jsonb,
  key_objectives jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  ai_generated boolean DEFAULT false,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  review_frequency text DEFAULT 'quarterly' CHECK (review_frequency IN ('monthly','quarterly','semi_annual','annual')),
  next_review_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_success_plans_workspace ON customer_success_plans(workspace_id);
CREATE INDEX idx_customer_success_plans_account ON customer_success_plans(customer_account_id);
ALTER TABLE customer_success_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_success_plans" ON customer_success_plans FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_success_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_success_plans" ON customer_success_plans FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_success_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_success_plans" ON customer_success_plans FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_success_plans.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_success_plans.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_success_plans" ON customer_success_plans FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_success_plans.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUCCESS GOALS
-- ============================================================
CREATE TABLE success_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  success_plan_id uuid REFERENCES customer_success_plans(id) ON DELETE SET NULL,
  goal_name text NOT NULL,
  goal_description text,
  goal_type text DEFAULT 'adoption' CHECK (goal_type IN ('adoption','engagement','expansion','retention','satisfaction','roi','milestone')),
  target_value numeric(14,2),
  current_value numeric(14,2) DEFAULT 0,
  target_date date,
  is_achieved boolean DEFAULT false,
  achieved_at timestamptz,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_success_goals_workspace ON success_goals(workspace_id);
CREATE INDEX idx_success_goals_account ON success_goals(customer_account_id);
ALTER TABLE success_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_success_goals" ON success_goals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_success_goals" ON success_goals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_success_goals" ON success_goals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_goals.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_goals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_success_goals" ON success_goals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_goals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- SUCCESS REVIEWS
-- ============================================================
CREATE TABLE success_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  review_type text DEFAULT 'quarterly' CHECK (review_type IN ('monthly','quarterly','semi_annual','annual','ad_hoc')),
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  review_status text DEFAULT 'scheduled' CHECK (review_status IN ('scheduled','completed','cancelled','overdue')),
  review_summary text,
  action_items jsonb DEFAULT '[]'::jsonb,
  attendee_count integer DEFAULT 0,
  next_review_date date,
  ai_summary text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_success_reviews_workspace ON success_reviews(workspace_id);
CREATE INDEX idx_success_reviews_account ON success_reviews(customer_account_id);
ALTER TABLE success_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_success_reviews" ON success_reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_reviews.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_success_reviews" ON success_reviews FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_reviews.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_success_reviews" ON success_reviews FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_reviews.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_reviews.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_success_reviews" ON success_reviews FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = success_reviews.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXECUTIVE BUSINESS REVIEWS
-- ============================================================
CREATE TABLE executive_business_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  review_date date NOT NULL DEFAULT CURRENT_DATE,
  review_status text DEFAULT 'scheduled' CHECK (review_status IN ('scheduled','completed','cancelled','overdue')),
  review_type text DEFAULT 'qbr' CHECK (review_type IN ('qbr','ebr','annual','strategic')),
  executive_summary text,
  key_achievements jsonb DEFAULT '[]'::jsonb,
  key_challenges jsonb DEFAULT '[]'::jsonb,
  roi_analysis jsonb DEFAULT '{}'::jsonb,
  value_delivered text,
  future_roadmap jsonb DEFAULT '[]'::jsonb,
  action_items jsonb DEFAULT '[]'::jsonb,
  attendees jsonb DEFAULT '[]'::jsonb,
  ai_generated boolean DEFAULT false,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  next_review_date date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_exec_business_reviews_workspace ON executive_business_reviews(workspace_id);
CREATE INDEX idx_exec_business_reviews_account ON executive_business_reviews(customer_account_id);
ALTER TABLE executive_business_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_exec_business_reviews" ON executive_business_reviews FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_business_reviews.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_exec_business_reviews" ON executive_business_reviews FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_business_reviews.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_exec_business_reviews" ON executive_business_reviews FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_business_reviews.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_business_reviews.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_exec_business_reviews" ON executive_business_reviews FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = executive_business_reviews.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER RISK
-- ============================================================
CREATE TABLE customer_risk (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  risk_type text NOT NULL CHECK (risk_type IN ('churn','revenue_loss','adoption','engagement','executive','competitive','contract','pricing','support','onboarding','roi','leadership')),
  risk_level text NOT NULL DEFAULT 'medium' CHECK (risk_level IN ('low','medium','high','critical')),
  risk_score integer DEFAULT 50,
  risk_description text,
  detected_at timestamptz NOT NULL DEFAULT now(),
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  mitigation_plan text,
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_risk_workspace ON customer_risk(workspace_id);
CREATE INDEX idx_customer_risk_account ON customer_risk(customer_account_id);
CREATE INDEX idx_customer_risk_unresolved ON customer_risk(is_resolved) WHERE is_resolved = false;
ALTER TABLE customer_risk ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_risk" ON customer_risk FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_risk.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_risk" ON customer_risk FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_risk.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_risk" ON customer_risk FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_risk.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_risk.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_risk" ON customer_risk FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_risk.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER SENTIMENT
-- ============================================================
CREATE TABLE customer_sentiment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  sentiment_score numeric DEFAULT 0 CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  sentiment_label text DEFAULT 'neutral' CHECK (sentiment_label IN ('very_negative','negative','neutral','positive','very_positive')),
  sentiment_source text CHECK (sentiment_source IN ('meeting','email','call','survey','feedback','social','ai_analysis')),
  sentiment_date timestamptz NOT NULL DEFAULT now(),
  sentiment_drivers jsonb DEFAULT '[]'::jsonb,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_sentiment_workspace ON customer_sentiment(workspace_id);
CREATE INDEX idx_customer_sentiment_account ON customer_sentiment(customer_account_id);
ALTER TABLE customer_sentiment ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_sentiment" ON customer_sentiment FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_sentiment.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_sentiment" ON customer_sentiment FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_sentiment.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_sentiment" ON customer_sentiment FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_sentiment.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_sentiment.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_sentiment" ON customer_sentiment FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_sentiment.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER FEEDBACK
-- ============================================================
CREATE TABLE customer_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  feedback_type text DEFAULT 'survey' CHECK (feedback_type IN ('survey','nps','csat','ces','interview','spontaneous','review')),
  feedback_score integer,
  feedback_text text,
  feedback_source text,
  feedback_date timestamptz NOT NULL DEFAULT now(),
  sentiment text DEFAULT 'neutral' CHECK (sentiment IN ('positive','neutral','negative')),
  is_actioned boolean DEFAULT false,
  ai_analysis text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_feedback_workspace ON customer_feedback(workspace_id);
CREATE INDEX idx_customer_feedback_account ON customer_feedback(customer_account_id);
ALTER TABLE customer_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_feedback" ON customer_feedback FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_feedback.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_feedback" ON customer_feedback FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_feedback.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_feedback" ON customer_feedback FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_feedback.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_feedback.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_feedback" ON customer_feedback FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_feedback.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RENEWAL PIPELINE
-- ============================================================
CREATE TABLE renewal_pipeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  renewal_date date NOT NULL,
  renewal_value numeric(14,2) DEFAULT 0,
  renewal_probability integer DEFAULT 50,
  renewal_status text DEFAULT 'pending' CHECK (renewal_status IN ('pending','in_progress','at_risk','renewed','churned','cancelled')),
  renewal_health text DEFAULT 'healthy' CHECK (renewal_health IN ('healthy','watch','at_risk','critical')),
  executive_sponsor text,
  renewal_blockers jsonb DEFAULT '[]'::jsonb,
  pricing_risk text,
  contract_risk text,
  recommended_strategy text,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  days_to_renewal integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_pipeline_workspace ON renewal_pipeline(workspace_id);
CREATE INDEX idx_renewal_pipeline_account ON renewal_pipeline(customer_account_id);
CREATE INDEX idx_renewal_pipeline_date ON renewal_pipeline(renewal_date);
CREATE INDEX idx_renewal_pipeline_status ON renewal_pipeline(renewal_status);
ALTER TABLE renewal_pipeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_pipeline" ON renewal_pipeline FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_pipeline.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_pipeline" ON renewal_pipeline FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_pipeline.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_pipeline" ON renewal_pipeline FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_pipeline.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_pipeline.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_pipeline" ON renewal_pipeline FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_pipeline.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RENEWAL FORECASTS
-- ============================================================
CREATE TABLE renewal_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  forecast_period text NOT NULL CHECK (forecast_period IN ('monthly','quarterly','annual')),
  period_start date NOT NULL,
  period_end date NOT NULL,
  total_renewal_value numeric(14,2) DEFAULT 0,
  expected_renewal_value numeric(14,2) DEFAULT 0,
  at_risk_value numeric(14,2) DEFAULT 0,
  renewal_count integer DEFAULT 0,
  avg_renewal_probability numeric(5,2) DEFAULT 0,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_forecasts_workspace ON renewal_forecasts(workspace_id);
ALTER TABLE renewal_forecasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_forecasts" ON renewal_forecasts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_forecasts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_forecasts" ON renewal_forecasts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_forecasts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_forecasts" ON renewal_forecasts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_forecasts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_forecasts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_forecasts" ON renewal_forecasts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_forecasts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RENEWAL TASKS
-- ============================================================
CREATE TABLE renewal_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  renewal_pipeline_id uuid NOT NULL REFERENCES renewal_pipeline(id) ON DELETE CASCADE,
  task_name text NOT NULL,
  task_description text,
  task_type text DEFAULT 'outreach' CHECK (task_type IN ('outreach','meeting','review','proposal','follow_up','executive','contract','pricing')),
  task_status text DEFAULT 'pending' CHECK (task_status IN ('pending','in_progress','completed','blocked')),
  assigned_to text,
  due_date date,
  completed_at timestamptz,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_tasks_workspace ON renewal_tasks(workspace_id);
CREATE INDEX idx_renewal_tasks_renewal ON renewal_tasks(renewal_pipeline_id);
ALTER TABLE renewal_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_tasks" ON renewal_tasks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_tasks" ON renewal_tasks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_tasks" ON renewal_tasks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_tasks.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_tasks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_tasks" ON renewal_tasks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_tasks.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RENEWAL REMINDERS
-- ============================================================
CREATE TABLE renewal_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  renewal_pipeline_id uuid NOT NULL REFERENCES renewal_pipeline(id) ON DELETE CASCADE,
  reminder_date date NOT NULL,
  reminder_type text DEFAULT 'upcoming' CHECK (reminder_type IN ('upcoming','urgent','overdue','executive','final')),
  reminder_message text,
  is_sent boolean DEFAULT false,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_reminders_workspace ON renewal_reminders(workspace_id);
ALTER TABLE renewal_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_reminders" ON renewal_reminders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_reminders.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_reminders" ON renewal_reminders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_reminders.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_reminders" ON renewal_reminders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_reminders.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_reminders.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_reminders" ON renewal_reminders FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_reminders.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RENEWAL HEALTH
-- ============================================================
CREATE TABLE renewal_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  renewal_pipeline_id uuid NOT NULL REFERENCES renewal_pipeline(id) ON DELETE CASCADE,
  health_date date NOT NULL DEFAULT CURRENT_DATE,
  health_score integer DEFAULT 50,
  engagement_score integer DEFAULT 50,
  sentiment_score integer DEFAULT 50,
  product_adoption_score integer DEFAULT 50,
  executive_engagement_score integer DEFAULT 50,
  risk_factors jsonb DEFAULT '[]'::jsonb,
  ai_assessment text,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_health_workspace ON renewal_health(workspace_id);
ALTER TABLE renewal_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_health" ON renewal_health FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_health" ON renewal_health FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_health" ON renewal_health FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_health.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_health" ON renewal_health FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_health.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- RENEWAL HISTORY
-- ============================================================
CREATE TABLE renewal_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  renewal_date date NOT NULL,
  renewal_value numeric(14,2),
  renewal_outcome text CHECK (renewal_outcome IN ('renewed','churned','downgraded','expanded','cancelled')),
  renewal_reason text,
  previous_value numeric(14,2),
  new_value numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_renewal_history_workspace ON renewal_history(workspace_id);
CREATE INDEX idx_renewal_history_account ON renewal_history(customer_account_id);
ALTER TABLE renewal_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_renewal_history" ON renewal_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_renewal_history" ON renewal_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_renewal_history" ON renewal_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_renewal_history" ON renewal_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = renewal_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPSELL OPPORTUNITIES
-- ============================================================
CREATE TABLE upsell_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  opportunity_name text NOT NULL,
  opportunity_description text,
  current_product text,
  upsell_product text,
  estimated_value numeric(14,2) DEFAULT 0,
  probability integer DEFAULT 50,
  likelihood_to_close integer DEFAULT 50,
  recommended_timing text,
  decision_makers jsonb DEFAULT '[]'::jsonb,
  supporting_reasons jsonb DEFAULT '[]'::jsonb,
  expansion_score integer DEFAULT 50,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  status text DEFAULT 'identified' CHECK (status IN ('identified','qualified','proposed','in_progress','won','lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_upsell_opp_workspace ON upsell_opportunities(workspace_id);
CREATE INDEX idx_upsell_opp_account ON upsell_opportunities(customer_account_id);
ALTER TABLE upsell_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_upsell_opp" ON upsell_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_upsell_opp" ON upsell_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_upsell_opp" ON upsell_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_opportunities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_upsell_opp" ON upsell_opportunities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = upsell_opportunities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CROSS SELL OPPORTUNITIES
-- ============================================================
CREATE TABLE cross_sell_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  opportunity_name text NOT NULL,
  opportunity_description text,
  original_product text,
  cross_sell_product text,
  estimated_value numeric(14,2) DEFAULT 0,
  probability integer DEFAULT 50,
  likelihood_to_close integer DEFAULT 50,
  recommended_timing text,
  decision_makers jsonb DEFAULT '[]'::jsonb,
  supporting_reasons jsonb DEFAULT '[]'::jsonb,
  expansion_score integer DEFAULT 50,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  status text DEFAULT 'identified' CHECK (status IN ('identified','qualified','proposed','in_progress','won','lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_cross_sell_opp_workspace ON cross_sell_opportunities(workspace_id);
CREATE INDEX idx_cross_sell_opp_account ON cross_sell_opportunities(customer_account_id);
ALTER TABLE cross_sell_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_cross_sell_opp" ON cross_sell_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_cross_sell_opp" ON cross_sell_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_cross_sell_opp" ON cross_sell_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_opportunities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_cross_sell_opp" ON cross_sell_opportunities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = cross_sell_opportunities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXPANSION OPPORTUNITIES
-- ============================================================
CREATE TABLE expansion_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  expansion_type text NOT NULL CHECK (expansion_type IN ('upsell','cross_sell','new_department','new_geography','enterprise','additional_licenses','premium_upgrade','professional_services','partnership')),
  opportunity_name text NOT NULL,
  opportunity_description text,
  estimated_value numeric(14,2) DEFAULT 0,
  probability integer DEFAULT 50,
  likelihood_to_close integer DEFAULT 50,
  recommended_timing text,
  decision_makers jsonb DEFAULT '[]'::jsonb,
  supporting_reasons jsonb DEFAULT '[]'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  status text DEFAULT 'identified' CHECK (status IN ('identified','qualified','proposed','in_progress','won','lost')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expansion_opp_workspace ON expansion_opportunities(workspace_id);
CREATE INDEX idx_expansion_opp_account ON expansion_opportunities(customer_account_id);
ALTER TABLE expansion_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_expansion_opp" ON expansion_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_expansion_opp" ON expansion_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_expansion_opp" ON expansion_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_opportunities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_expansion_opp" ON expansion_opportunities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_opportunities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXPANSION SCORES
-- ============================================================
CREATE TABLE expansion_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  score_date date NOT NULL DEFAULT CURRENT_DATE,
  overall_expansion_score integer DEFAULT 50,
  upsell_score integer DEFAULT 50,
  cross_sell_score integer DEFAULT 50,
  new_department_score integer DEFAULT 50,
  new_geography_score integer DEFAULT 50,
  enterprise_score integer DEFAULT 50,
  scoring_factors jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expansion_scores_workspace ON expansion_scores(workspace_id);
CREATE INDEX idx_expansion_scores_account ON expansion_scores(customer_account_id);
ALTER TABLE expansion_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_expansion_scores" ON expansion_scores FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_expansion_scores" ON expansion_scores FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_expansion_scores" ON expansion_scores FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_scores.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_scores.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_expansion_scores" ON expansion_scores FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_scores.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- EXPANSION HISTORY
-- ============================================================
CREATE TABLE expansion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  expansion_type text NOT NULL,
  expansion_value numeric(14,2) DEFAULT 0,
  expansion_date date NOT NULL DEFAULT CURRENT_DATE,
  expansion_outcome text CHECK (expansion_outcome IN ('won','lost','pending')),
  previous_arr numeric(14,2),
  new_arr numeric(14,2),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_expansion_history_workspace ON expansion_history(workspace_id);
ALTER TABLE expansion_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_expansion_history" ON expansion_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_expansion_history" ON expansion_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_expansion_history" ON expansion_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_expansion_history" ON expansion_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = expansion_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHURN PREDICTIONS
-- ============================================================
CREATE TABLE churn_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  prediction_date date NOT NULL DEFAULT CURRENT_DATE,
  churn_probability_30d numeric DEFAULT 0,
  churn_probability_60d numeric DEFAULT 0,
  churn_probability_90d numeric DEFAULT 0,
  churn_probability_annual numeric DEFAULT 0,
  churn_risk_level text DEFAULT 'low' CHECK (churn_risk_level IN ('low','medium','high','critical')),
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  supporting_signals jsonb DEFAULT '[]'::jsonb,
  mitigation_plan text,
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  prediction_version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_churn_predictions_workspace ON churn_predictions(workspace_id);
CREATE INDEX idx_churn_predictions_account ON churn_predictions(customer_account_id);
CREATE INDEX idx_churn_predictions_risk ON churn_predictions(churn_risk_level);
ALTER TABLE churn_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_churn_predictions" ON churn_predictions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_churn_predictions" ON churn_predictions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_churn_predictions" ON churn_predictions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_predictions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_predictions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_churn_predictions" ON churn_predictions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_predictions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHURN SIGNALS
-- ============================================================
CREATE TABLE churn_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  signal_type text NOT NULL CHECK (signal_type IN ('declining_engagement','no_meetings','no_replies','negative_sentiment','support_complaints','missed_milestones','low_adoption','competitor_activity','pricing_concerns','executive_disengagement','delayed_onboarding','poor_roi','budget_issues','leadership_changes','reduced_usage','contract_objection')),
  signal_description text,
  signal_strength integer DEFAULT 50,
  detected_at timestamptz NOT NULL DEFAULT now(),
  is_active boolean DEFAULT true,
  resolved_at timestamptz,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_churn_signals_workspace ON churn_signals(workspace_id);
CREATE INDEX idx_churn_signals_account ON churn_signals(customer_account_id);
CREATE INDEX idx_churn_signals_active ON churn_signals(is_active) WHERE is_active = true;
ALTER TABLE churn_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_churn_signals" ON churn_signals FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_signals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_churn_signals" ON churn_signals FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_signals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_churn_signals" ON churn_signals FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_signals.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_signals.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_churn_signals" ON churn_signals FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_signals.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHURN MODELS
-- ============================================================
CREATE TABLE churn_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  model_name text NOT NULL,
  model_type text DEFAULT 'ai_predictive' CHECK (model_type IN ('ai_predictive','logistic_regression','survival_analysis','random_forest','hybrid')),
  parameters jsonb DEFAULT '{}'::jsonb,
  accuracy_score numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  last_trained_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_churn_models_workspace ON churn_models(workspace_id);
ALTER TABLE churn_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_churn_models" ON churn_models FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_churn_models" ON churn_models FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_churn_models" ON churn_models FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_models.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_models.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_churn_models" ON churn_models FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_models.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHURN HISTORY
-- ============================================================
CREATE TABLE churn_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid REFERENCES customer_accounts(id) ON DELETE SET NULL,
  churn_date date NOT NULL,
  churn_reason text,
  lost_arr numeric(14,2) DEFAULT 0,
  lost_mrr numeric(14,2) DEFAULT 0,
  contract_length_days integer,
  last_health_score integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_churn_history_workspace ON churn_history(workspace_id);
ALTER TABLE churn_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_churn_history" ON churn_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_churn_history" ON churn_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_churn_history" ON churn_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_churn_history" ON churn_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CHURN REASONS
-- ============================================================
CREATE TABLE churn_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  reason_category text NOT NULL CHECK (reason_category IN ('product','price','service','competition','change_in_business','change_in_leadership','budget','adoption','integration','support','other')),
  reason_description text,
  frequency integer DEFAULT 1,
  avg_lost_value numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_churn_reasons_workspace ON churn_reasons(workspace_id);
ALTER TABLE churn_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_churn_reasons" ON churn_reasons FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_reasons.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_churn_reasons" ON churn_reasons FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_reasons.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_churn_reasons" ON churn_reasons FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_reasons.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_reasons.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_churn_reasons" ON churn_reasons FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = churn_reasons.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REFERRAL OPPORTUNITIES
-- ============================================================
CREATE TABLE referral_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  referral_target_company text,
  referral_target_contact text,
  referral_value numeric(14,2) DEFAULT 0,
  referral_probability integer DEFAULT 50,
  referral_status text DEFAULT 'identified' CHECK (referral_status IN ('identified','requested','introduced','in_progress','won','lost')),
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_opp_workspace ON referral_opportunities(workspace_id);
CREATE INDEX idx_referral_opp_account ON referral_opportunities(customer_account_id);
ALTER TABLE referral_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_referral_opp" ON referral_opportunities FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_referral_opp" ON referral_opportunities FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_referral_opp" ON referral_opportunities FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_opportunities.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_opportunities.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_referral_opp" ON referral_opportunities FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_opportunities.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- REFERRAL PROGRAMS
-- ============================================================
CREATE TABLE referral_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  program_name text NOT NULL,
  program_description text,
  incentive_type text DEFAULT 'discount' CHECK (incentive_type IN ('discount','cash','credit','gift','service','none')),
  incentive_value numeric(14,2) DEFAULT 0,
  program_status text DEFAULT 'active' CHECK (program_status IN ('draft','active','paused','ended')),
  total_referrals integer DEFAULT 0,
  successful_referrals integer DEFAULT 0,
  total_revenue_generated numeric(14,2) DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_referral_programs_workspace ON referral_programs(workspace_id);
ALTER TABLE referral_programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_referral_programs" ON referral_programs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_programs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_referral_programs" ON referral_programs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_programs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_referral_programs" ON referral_programs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_programs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_programs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_referral_programs" ON referral_programs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = referral_programs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER TESTIMONIALS
-- ============================================================
CREATE TABLE customer_testimonials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  testimonial_text text NOT NULL,
  testimonial_author text,
  testimonial_title text,
  testimonial_type text DEFAULT 'quote' CHECK (testimonial_type IN ('quote','video','written','social','case_study')),
  is_approved boolean DEFAULT false,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  ai_generated boolean DEFAULT false,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_testimonials_workspace ON customer_testimonials(workspace_id);
ALTER TABLE customer_testimonials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_testimonials" ON customer_testimonials FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_testimonials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_testimonials" ON customer_testimonials FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_testimonials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_testimonials" ON customer_testimonials FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_testimonials.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_testimonials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_testimonials" ON customer_testimonials FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_testimonials.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CASE STUDIES GENERATED
-- ============================================================
CREATE TABLE case_studies_generated (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  case_study_title text NOT NULL,
  case_study_content text,
  case_study_summary text,
  key_results jsonb DEFAULT '[]'::jsonb,
  industry text,
  company_size text,
  use_case text,
  is_approved boolean DEFAULT false,
  is_published boolean DEFAULT false,
  ai_generated boolean DEFAULT false,
  ai_reasoning text,
  ai_confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_case_studies_workspace ON case_studies_generated(workspace_id);
ALTER TABLE case_studies_generated ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_case_studies" ON case_studies_generated FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = case_studies_generated.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_case_studies" ON case_studies_generated FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = case_studies_generated.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_case_studies" ON case_studies_generated FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = case_studies_generated.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = case_studies_generated.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_case_studies" ON case_studies_generated FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = case_studies_generated.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- CUSTOMER CHAMPIONS
-- ============================================================
CREATE TABLE customer_champions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  customer_account_id uuid NOT NULL REFERENCES customer_accounts(id) ON DELETE CASCADE,
  champion_name text NOT NULL,
  champion_title text,
  champion_email text,
  champion_score integer DEFAULT 50,
  advocacy_type text DEFAULT 'reference' CHECK (advocacy_type IN ('reference','testimonial','case_study','referral','speaker','advisor','review')),
  engagement_level text DEFAULT 'medium' CHECK (engagement_level IN ('low','medium','high','very_high')),
  last_engaged_at timestamptz,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_customer_champions_workspace ON customer_champions(workspace_id);
ALTER TABLE customer_champions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_customer_champions" ON customer_champions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_champions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_customer_champions" ON customer_champions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_champions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_customer_champions" ON customer_champions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_champions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_champions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_customer_champions" ON customer_champions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = customer_champions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_cs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'customer_accounts','customer_contacts','customer_segments','customer_lifecycle','customer_relationships',
    'onboarding_projects','onboarding_tasks','onboarding_checklists','onboarding_documents',
    'customer_success_plans','success_goals',
    'renewal_pipeline','renewal_tasks','renewal_reminders',
    'upsell_opportunities','cross_sell_opportunities','expansion_opportunities','expansion_scores','expansion_history',
    'churn_models',
    'referral_opportunities','referral_programs','customer_testimonials','case_studies_generated','customer_champions'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_cs_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_cs_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_cs_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================
-- SEED DEFAULT CHURN MODEL
-- ============================================================
INSERT INTO churn_models (workspace_id, model_name, model_type, parameters, accuracy_score, is_active)
SELECT w.id, 'AI Churn Predictor', 'ai_predictive', '{"lookback_days": 90, "signals": ["engagement","sentiment","adoption","meetings"]}'::jsonb, 0, true
FROM workspaces w
WHERE NOT EXISTS (SELECT 1 FROM churn_models cm WHERE cm.workspace_id = w.id);
