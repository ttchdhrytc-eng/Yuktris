/*
# Phase 10 — Meeting Intelligence Engine Schema
#
# 25 tables, all RLS-enabled, indexed, versioned where appropriate.
# Reuses existing google_workspace, conversations, linkedin_accounts tables.
*/

-- ============================================================
-- MEETING TYPES (reference table)
-- ============================================================
CREATE TABLE meeting_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type_code text NOT NULL CHECK (type_code IN (
    'discovery','intro_call','demo','technical_demo','pricing_discussion',
    'proposal_review','security_review','compliance_review','pilot_planning',
    'implementation_planning','executive_meeting','procurement','negotiation',
    'renewal','upsell','cross_sell','customer_success','partner_meeting',
    'investor_meeting','custom'
  )),
  type_name text NOT NULL,
  default_duration integer DEFAULT 30 CHECK (default_duration IN (15,30,45,60,90,120)),
  description text,
  required_preparation text[] DEFAULT '{}',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, type_code)
);

CREATE INDEX idx_meeting_types_workspace ON meeting_types(workspace_id);

ALTER TABLE meeting_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_types" ON meeting_types FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_types.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_types" ON meeting_types FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_types.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_types" ON meeting_types FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_types.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_types.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_types" ON meeting_types FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_types.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING PREFERENCES
-- ============================================================
CREATE TABLE meeting_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  default_duration integer DEFAULT 30 CHECK (default_duration IN (15,30,45,60,90,120)),
  default_platform text DEFAULT 'google_meet' CHECK (default_platform IN ('zoom','google_meet','microsoft_teams','in_person','phone')),
  buffer_before_minutes integer DEFAULT 5,
  buffer_after_minutes integer DEFAULT 10,
  working_hours_start text DEFAULT '09:00',
  working_hours_end text DEFAULT '17:00',
  working_days text[] DEFAULT ARRAY['monday','tuesday','wednesday','thursday','friday'],
  timezone text DEFAULT 'America/New_York',
  max_meetings_per_day integer DEFAULT 8,
  auto_generate_brief boolean DEFAULT true,
  auto_generate_agenda boolean DEFAULT true,
  auto_generate_questions boolean DEFAULT true,
  auto_generate_competitor_intel boolean DEFAULT true,
  auto_send_reminders boolean DEFAULT true,
  min_notice_hours integer DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id)
);

CREATE INDEX idx_meeting_prefs_workspace ON meeting_preferences(workspace_id);

ALTER TABLE meeting_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_prefs" ON meeting_preferences FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preferences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_prefs" ON meeting_preferences FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preferences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_prefs" ON meeting_preferences FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preferences.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preferences.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_prefs" ON meeting_preferences FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preferences.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING REQUESTS (AI-detected meeting intent)
-- ============================================================
CREATE TABLE meeting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  linkedin_account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  prospect_name text,
  prospect_title text,
  company_name text,
  detected_intent text NOT NULL CHECK (detected_intent IN ('meeting_request','demo_request','pricing_request','follow_up_requested','auto_detected')),
  meeting_urgency text DEFAULT 'medium' CHECK (meeting_urgency IN ('low','medium','high','critical')),
  buying_stage text,
  meeting_readiness_level text,
  recommended_meeting_type text,
  estimated_duration integer DEFAULT 30,
  recommended_attendees jsonb DEFAULT '[]'::jsonb,
  competitor_discussion_expected boolean DEFAULT false,
  proposal_expected boolean DEFAULT false,
  technical_questions_expected boolean DEFAULT false,
  decision_makers_attending boolean DEFAULT false,
  confidence_score numeric DEFAULT 0.5,
  reasoning text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','scheduled','expired')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_requests_workspace ON meeting_requests(workspace_id);
CREATE INDEX idx_meeting_requests_status ON meeting_requests(status);
CREATE INDEX idx_meeting_requests_conversation ON meeting_requests(conversation_id);
CREATE INDEX idx_meeting_requests_company ON meeting_requests(company_id);

ALTER TABLE meeting_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_requests" ON meeting_requests FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_requests.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_requests" ON meeting_requests FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_requests.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_requests" ON meeting_requests FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_requests.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_requests.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_requests" ON meeting_requests FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_requests.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING CANDIDATES (prospects ready for meeting)
-- ============================================================
CREATE TABLE meeting_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_request_id uuid REFERENCES meeting_requests(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  prospect_name text,
  company_name text,
  buying_stage text,
  meeting_readiness text,
  intent_score integer DEFAULT 0,
  engagement_score integer DEFAULT 0,
  overall_score integer DEFAULT 0,
  revenue_estimate numeric(12,2),
  likelihood_to_close numeric DEFAULT 0.3,
  recommended_meeting_type text,
  recommended_duration integer DEFAULT 30,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high','critical')),
  status text DEFAULT 'candidate' CHECK (status IN ('candidate','scheduled','rejected','expired')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_candidates_workspace ON meeting_candidates(workspace_id);
CREATE INDEX idx_meeting_candidates_status ON meeting_candidates(status);
CREATE INDEX idx_meeting_candidates_score ON meeting_candidates(overall_score DESC);

ALTER TABLE meeting_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_candidates" ON meeting_candidates FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_candidates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_candidates" ON meeting_candidates FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_candidates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_candidates" ON meeting_candidates FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_candidates.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_candidates.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_candidates" ON meeting_candidates FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_candidates.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING SLOTS (available time slots)
-- ============================================================
CREATE TABLE meeting_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_request_id uuid REFERENCES meeting_requests(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  slot_rank integer DEFAULT 0,
  timezone text DEFAULT 'America/New_York',
  is_available boolean DEFAULT true,
  is_selected boolean DEFAULT false,
  is_offered boolean DEFAULT false,
  prospect_response text CHECK (prospect_response IN ('pending','accepted','rejected','counter_proposed')),
  counter_slot_start timestamptz,
  counter_slot_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_slots_workspace ON meeting_slots(workspace_id);
CREATE INDEX idx_meeting_slots_request ON meeting_slots(meeting_request_id);
CREATE INDEX idx_meeting_slots_start ON meeting_slots(start_time);

ALTER TABLE meeting_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_slots" ON meeting_slots FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_slots.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_slots" ON meeting_slots FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_slots.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_slots" ON meeting_slots FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_slots.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_slots.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_slots" ON meeting_slots FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_slots.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING SCHEDULER (the actual scheduled meeting)
-- ============================================================
CREATE TABLE meeting_scheduler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_request_id uuid REFERENCES meeting_requests(id) ON DELETE SET NULL,
  meeting_candidate_id uuid REFERENCES meeting_candidates(id) ON DELETE SET NULL,
  conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES companies(id) ON DELETE SET NULL,
  meeting_type text NOT NULL CHECK (meeting_type IN (
    'discovery','intro_call','demo','technical_demo','pricing_discussion',
    'proposal_review','security_review','compliance_review','pilot_planning',
    'implementation_planning','executive_meeting','procurement','negotiation',
    'renewal','upsell','cross_sell','customer_success','partner_meeting',
    'investor_meeting','custom'
  )),
  meeting_title text NOT NULL,
  meeting_description text,
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  timezone text DEFAULT 'America/New_York',
  duration_minutes integer DEFAULT 30,
  platform text DEFAULT 'google_meet' CHECK (platform IN ('zoom','google_meet','microsoft_teams','in_person','phone')),
  meeting_link text,
  calendar_event_id text,
  google_meet_link text,
  status text DEFAULT 'pending_confirmation' CHECK (status IN (
    'pending_confirmation','confirmed','rescheduled','completed','cancelled','no_show','failed'
  )),
  prospect_name text,
  prospect_title text,
  company_name text,
  revenue_estimate numeric(12,2),
  likelihood_to_close numeric DEFAULT 0.3,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_scheduler_workspace ON meeting_scheduler(workspace_id);
CREATE INDEX idx_meeting_scheduler_status ON meeting_scheduler(status);
CREATE INDEX idx_meeting_scheduler_start ON meeting_scheduler(scheduled_start);
CREATE INDEX idx_meeting_scheduler_company ON meeting_scheduler(company_id);
CREATE INDEX idx_meeting_scheduler_contact ON meeting_scheduler(contact_id);

ALTER TABLE meeting_scheduler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_scheduler" ON meeting_scheduler FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_scheduler.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_scheduler" ON meeting_scheduler FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_scheduler.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_scheduler" ON meeting_scheduler FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_scheduler.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_scheduler.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_scheduler" ON meeting_scheduler FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_scheduler.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING CONFIRMATIONS
-- ============================================================
CREATE TABLE meeting_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  confirmed_by text NOT NULL CHECK (confirmed_by IN ('prospect','ai','human')),
  confirmation_method text CHECK (confirmation_method IN ('linkedin','email','manual','auto')),
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_confirmations_workspace ON meeting_confirmations(workspace_id);
CREATE INDEX idx_meeting_confirmations_meeting ON meeting_confirmations(meeting_id);

ALTER TABLE meeting_confirmations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_confirmations" ON meeting_confirmations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_confirmations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_confirmations" ON meeting_confirmations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_confirmations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_confirmations" ON meeting_confirmations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_confirmations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_confirmations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_confirmations" ON meeting_confirmations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_confirmations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING RESCHEDULES
-- ============================================================
CREATE TABLE meeting_reschedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  previous_start timestamptz NOT NULL,
  previous_end timestamptz NOT NULL,
  new_start timestamptz NOT NULL,
  new_end timestamptz NOT NULL,
  rescheduled_by text CHECK (rescheduled_by IN ('prospect','ai','human')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_reschedules_workspace ON meeting_reschedules(workspace_id);
CREATE INDEX idx_meeting_reschedules_meeting ON meeting_reschedules(meeting_id);

ALTER TABLE meeting_reschedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_reschedules" ON meeting_reschedules FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reschedules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_reschedules" ON meeting_reschedules FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reschedules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_reschedules" ON meeting_reschedules FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reschedules.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reschedules.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_reschedules" ON meeting_reschedules FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reschedules.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING CANCELLATIONS
-- ============================================================
CREATE TABLE meeting_cancellations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  cancelled_by text CHECK (cancelled_by IN ('prospect','ai','human')),
  reason text,
  cancelled_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_cancellations_workspace ON meeting_cancellations(workspace_id);
CREATE INDEX idx_meeting_cancellations_meeting ON meeting_cancellations(meeting_id);

ALTER TABLE meeting_cancellations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_cancellations" ON meeting_cancellations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_cancellations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_cancellations" ON meeting_cancellations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_cancellations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_cancellations" ON meeting_cancellations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_cancellations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_cancellations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_cancellations" ON meeting_cancellations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_cancellations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING ATTENDEES
-- ============================================================
CREATE TABLE meeting_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  role text,
  is_required boolean DEFAULT true,
  is_decision_maker boolean DEFAULT false,
  attendance_status text DEFAULT 'pending' CHECK (attendance_status IN ('pending','confirmed','attended','no_show','cancelled')),
  is_internal boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_attendees_workspace ON meeting_attendees(workspace_id);
CREATE INDEX idx_meeting_attendees_meeting ON meeting_attendees(meeting_id);

ALTER TABLE meeting_attendees ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_attendees" ON meeting_attendees FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_attendees.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_attendees" ON meeting_attendees FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_attendees.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_attendees" ON meeting_attendees FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_attendees.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_attendees.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_attendees" ON meeting_attendees FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_attendees.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING BRIEFS (AI-generated)
-- ============================================================
CREATE TABLE meeting_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  executive_summary text,
  company_overview text,
  prospect_overview text,
  timeline jsonb DEFAULT '[]'::jsonb,
  conversation_summary text,
  pain_points jsonb DEFAULT '[]'::jsonb,
  goals jsonb DEFAULT '[]'::jsonb,
  buying_signals jsonb DEFAULT '[]'::jsonb,
  decision_makers jsonb DEFAULT '[]'::jsonb,
  objections jsonb DEFAULT '[]'::jsonb,
  competitors jsonb DEFAULT '[]'::jsonb,
  technologies jsonb DEFAULT '[]'::jsonb,
  revenue_estimate numeric(12,2),
  likelihood_to_close numeric DEFAULT 0.3,
  next_recommendation text,
  confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_briefs_workspace ON meeting_briefs(workspace_id);
CREATE INDEX idx_meeting_briefs_meeting ON meeting_briefs(meeting_id);

ALTER TABLE meeting_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_briefs" ON meeting_briefs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_briefs" ON meeting_briefs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_briefs" ON meeting_briefs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_briefs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_briefs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_briefs" ON meeting_briefs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_briefs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING AGENDAS
-- ============================================================
CREATE TABLE meeting_agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  agenda_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_duration_minutes integer DEFAULT 30,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_agendas_workspace ON meeting_agendas(workspace_id);
CREATE INDEX idx_meeting_agendas_meeting ON meeting_agendas(meeting_id);

ALTER TABLE meeting_agendas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_agendas" ON meeting_agendas FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_agendas.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_agendas" ON meeting_agendas FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_agendas.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_agendas" ON meeting_agendas FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_agendas.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_agendas.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_agendas" ON meeting_agendas FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_agendas.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING PREPARATION (checklist + proposal prep)
-- ============================================================
CREATE TABLE meeting_preparation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  proposal_checklist jsonb DEFAULT '[]'::jsonb,
  roi_data jsonb DEFAULT '{}'::jsonb,
  case_studies jsonb DEFAULT '[]'::jsonb,
  trust_signals jsonb DEFAULT '[]'::jsonb,
  testimonials jsonb DEFAULT '[]'::jsonb,
  relevant_industries jsonb DEFAULT '[]'::jsonb,
  pricing_recommendation text,
  offer_recommendation text,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_prep_workspace ON meeting_preparation(workspace_id);
CREATE INDEX idx_meeting_prep_meeting ON meeting_preparation(meeting_id);

ALTER TABLE meeting_preparation ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_prep" ON meeting_preparation FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preparation.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_prep" ON meeting_preparation FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preparation.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_prep" ON meeting_preparation FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preparation.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preparation.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_prep" ON meeting_preparation FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_preparation.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING CHECKLISTS
-- ============================================================
CREATE TABLE meeting_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  checklist_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  completion_percentage integer DEFAULT 0,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_checklists_workspace ON meeting_checklists(workspace_id);
CREATE INDEX idx_meeting_checklists_meeting ON meeting_checklists(meeting_id);

ALTER TABLE meeting_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_checklists" ON meeting_checklists FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_checklists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_checklists" ON meeting_checklists FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_checklists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_checklists" ON meeting_checklists FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_checklists.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_checklists.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_checklists" ON meeting_checklists FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_checklists.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING COMPETITOR INTEL
-- ============================================================
CREATE TABLE meeting_competitor_intel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  competitor_name text NOT NULL,
  comparison jsonb DEFAULT '{}'::jsonb,
  weaknesses jsonb DEFAULT '[]'::jsonb,
  differentiators jsonb DEFAULT '[]'::jsonb,
  battle_cards jsonb DEFAULT '[]'::jsonb,
  objection_handling jsonb DEFAULT '[]'::jsonb,
  pricing_comparison jsonb DEFAULT '{}'::jsonb,
  migration_strategy text,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_competitor_intel_workspace ON meeting_competitor_intel(workspace_id);
CREATE INDEX idx_meeting_competitor_intel_meeting ON meeting_competitor_intel(meeting_id);

ALTER TABLE meeting_competitor_intel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_competitor_intel" ON meeting_competitor_intel FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_competitor_intel.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_competitor_intel" ON meeting_competitor_intel FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_competitor_intel.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_competitor_intel" ON meeting_competitor_intel FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_competitor_intel.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_competitor_intel.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_competitor_intel" ON meeting_competitor_intel FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_competitor_intel.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING QUESTIONS (discovery questions)
-- ============================================================
CREATE TABLE meeting_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  question_category text NOT NULL CHECK (question_category IN (
    'business','technical','budget','timeline','decision_process',
    'current_tools','competitors','success_metrics','risks','expansion_opportunities'
  )),
  question_text text NOT NULL,
  priority text DEFAULT 'medium' CHECK (priority IN ('low','medium','high')),
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_questions_workspace ON meeting_questions(workspace_id);
CREATE INDEX idx_meeting_questions_meeting ON meeting_questions(meeting_id);
CREATE INDEX idx_meeting_questions_category ON meeting_questions(question_category);

ALTER TABLE meeting_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_questions" ON meeting_questions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_questions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_questions" ON meeting_questions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_questions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_questions" ON meeting_questions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_questions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_questions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_questions" ON meeting_questions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_questions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING FOLLOWUPS
-- ============================================================
CREATE TABLE meeting_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  followup_type text NOT NULL CHECK (followup_type IN (
    'summary','action_item','responsibility','email','linkedin',
    'proposal_reminder','demo_reminder','renewal_reminder','next_meeting'
  )),
  followup_content text NOT NULL,
  assigned_to text,
  due_date timestamptz,
  is_completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_followups_workspace ON meeting_followups(workspace_id);
CREATE INDEX idx_meeting_followups_meeting ON meeting_followups(meeting_id);
CREATE INDEX idx_meeting_followups_incomplete ON meeting_followups(is_completed) WHERE is_completed = false;

ALTER TABLE meeting_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_followups" ON meeting_followups FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_followups.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_followups" ON meeting_followups FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_followups.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_followups" ON meeting_followups FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_followups.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_followups.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_followups" ON meeting_followups FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_followups.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING OUTCOMES
-- ============================================================
CREATE TABLE meeting_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN (
    'pending','moved_to_opportunity','followup_scheduled','closed_won',
    'closed_lost','no_decision','disqualified','rescheduled'
  )),
  attendance_status text DEFAULT 'pending' CHECK (attendance_status IN ('pending','attended','no_show','cancelled')),
  qualification_result text CHECK (qualification_result IN ('pending','qualified','unqualified','needs_followup')),
  next_followup text,
  followup_notes text,
  deal_value numeric(12,2),
  next_action text,
  next_action_date timestamptz,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_outcomes_workspace ON meeting_outcomes(workspace_id);
CREATE INDEX idx_meeting_outcomes_meeting ON meeting_outcomes(meeting_id);

ALTER TABLE meeting_outcomes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_outcomes" ON meeting_outcomes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_outcomes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_outcomes" ON meeting_outcomes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_outcomes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_outcomes" ON meeting_outcomes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_outcomes.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_outcomes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_outcomes" ON meeting_outcomes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_outcomes.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING SCORE
-- ============================================================
CREATE TABLE meeting_score (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  preparation_score integer DEFAULT 0,
  qualification_score integer DEFAULT 0,
  revenue_score integer DEFAULT 0,
  likelihood_to_close integer DEFAULT 0,
  risk_score integer DEFAULT 0,
  overall_score integer DEFAULT 0,
  score_explanation jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  version integer DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_score_workspace ON meeting_score(workspace_id);
CREATE INDEX idx_meeting_score_meeting ON meeting_score(meeting_id);
CREATE INDEX idx_meeting_score_overall ON meeting_score(overall_score DESC);

ALTER TABLE meeting_score ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_score" ON meeting_score FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_score" ON meeting_score FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_score" ON meeting_score FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_score.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_score.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_score" ON meeting_score FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_score.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING NOTIFICATIONS
-- ============================================================
CREATE TABLE meeting_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN (
    'meeting_detected','meeting_scheduled','meeting_confirmed','meeting_reminder',
    'meeting_rescheduled','meeting_cancelled','meeting_completed','meeting_no_show',
    'preparation_ready','brief_ready','followup_due','human_confirmation_needed'
  )),
  notification_title text NOT NULL,
  notification_message text NOT NULL,
  severity text DEFAULT 'info' CHECK (severity IN ('info','warning','error','success')),
  is_read boolean DEFAULT false,
  action_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_notifications_workspace ON meeting_notifications(workspace_id);
CREATE INDEX idx_meeting_notifications_unread ON meeting_notifications(is_read) WHERE is_read = false;

ALTER TABLE meeting_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_notifications" ON meeting_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_notifications" ON meeting_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_notifications" ON meeting_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notifications.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_notifications" ON meeting_notifications FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notifications.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING REMINDERS
-- ============================================================
CREATE TABLE meeting_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('email','linkedin','push','sms')),
  reminder_timing text NOT NULL CHECK (reminder_timing IN ('24h','1h','15m','5m','now')),
  scheduled_for timestamptz NOT NULL,
  sent_at timestamptz,
  is_sent boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_reminders_workspace ON meeting_reminders(workspace_id);
CREATE INDEX idx_meeting_reminders_meeting ON meeting_reminders(meeting_id);
CREATE INDEX idx_meeting_reminders_pending ON meeting_reminders(is_sent) WHERE is_sent = false;

ALTER TABLE meeting_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_reminders" ON meeting_reminders FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reminders.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_reminders" ON meeting_reminders FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reminders.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_reminders" ON meeting_reminders FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reminders.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reminders.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_reminders" ON meeting_reminders FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_reminders.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING AI REASONING
-- ============================================================
CREATE TABLE meeting_ai_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  reasoning_type text NOT NULL CHECK (reasoning_type IN (
    'meeting_detection','meeting_type','attendees','timing','agenda',
    'questions','competitor_intel','preparation','recommendation','scheduling'
  )),
  reasoning_text text NOT NULL,
  reasoning_data jsonb DEFAULT '{}'::jsonb,
  confidence numeric DEFAULT 0.5,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_ai_reasoning_workspace ON meeting_ai_reasoning(workspace_id);
CREATE INDEX idx_meeting_ai_reasoning_meeting ON meeting_ai_reasoning(meeting_id);

ALTER TABLE meeting_ai_reasoning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_ai_reasoning" ON meeting_ai_reasoning FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_ai_reasoning" ON meeting_ai_reasoning FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_ai_reasoning" ON meeting_ai_reasoning FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_ai_reasoning.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_ai_reasoning" ON meeting_ai_reasoning FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_ai_reasoning.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING VERSIONS (audit trail)
-- ============================================================
CREATE TABLE meeting_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  changed_by text NOT NULL CHECK (changed_by IN ('ai','human','system')),
  change_type text NOT NULL,
  change_data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_versions_workspace ON meeting_versions(workspace_id);
CREATE INDEX idx_meeting_versions_meeting ON meeting_versions(meeting_id);

ALTER TABLE meeting_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_versions" ON meeting_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_versions" ON meeting_versions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_versions" ON meeting_versions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_versions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_versions" ON meeting_versions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_versions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING NOTES
-- ============================================================
CREATE TABLE meeting_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  note_type text DEFAULT 'general' CHECK (note_type IN ('general','action_item','decision','question','risk','opportunity')),
  note_text text NOT NULL,
  is_private boolean DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_notes_workspace ON meeting_notes(workspace_id);
CREATE INDEX idx_meeting_notes_meeting ON meeting_notes(meeting_id);

ALTER TABLE meeting_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_notes" ON meeting_notes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_notes" ON meeting_notes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_notes" ON meeting_notes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notes.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_notes" ON meeting_notes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_notes.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING RECORDINGS
-- ============================================================
CREATE TABLE meeting_recordings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  recording_url text,
  recording_duration integer,
  recording_status text DEFAULT 'pending' CHECK (recording_status IN ('pending','recording','available','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_recordings_workspace ON meeting_recordings(workspace_id);
CREATE INDEX idx_meeting_recordings_meeting ON meeting_recordings(meeting_id);

ALTER TABLE meeting_recordings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_recordings" ON meeting_recordings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_recordings.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_recordings" ON meeting_recordings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_recordings.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_recordings" ON meeting_recordings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_recordings.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_recordings.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_recordings" ON meeting_recordings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_recordings.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- MEETING TRANSCRIPTS
-- ============================================================
CREATE TABLE meeting_transcripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_id uuid NOT NULL REFERENCES meeting_scheduler(id) ON DELETE CASCADE,
  transcript_text text,
  transcript_segments jsonb DEFAULT '[]'::jsonb,
  language text DEFAULT 'en',
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meeting_transcripts_workspace ON meeting_transcripts(workspace_id);
CREATE INDEX idx_meeting_transcripts_meeting ON meeting_transcripts(meeting_id);

ALTER TABLE meeting_transcripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_meeting_transcripts" ON meeting_transcripts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_transcripts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_meeting_transcripts" ON meeting_transcripts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_transcripts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_meeting_transcripts" ON meeting_transcripts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_transcripts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_transcripts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_meeting_transcripts" ON meeting_transcripts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = meeting_transcripts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_mi_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_meeting_requests_mi_updated_at ON meeting_requests;
CREATE TRIGGER trigger_meeting_requests_mi_updated_at BEFORE UPDATE ON meeting_requests FOR EACH ROW EXECUTE FUNCTION update_mi_updated_at();

DROP TRIGGER IF EXISTS trigger_meeting_scheduler_mi_updated_at ON meeting_scheduler;
CREATE TRIGGER trigger_meeting_scheduler_mi_updated_at BEFORE UPDATE ON meeting_scheduler FOR EACH ROW EXECUTE FUNCTION update_mi_updated_at();

DROP TRIGGER IF EXISTS trigger_meeting_checklists_mi_updated_at ON meeting_checklists;
CREATE TRIGGER trigger_meeting_checklists_mi_updated_at BEFORE UPDATE ON meeting_checklists FOR EACH ROW EXECUTE FUNCTION update_mi_updated_at();

DROP TRIGGER IF EXISTS trigger_meeting_prefs_mi_updated_at ON meeting_preferences;
CREATE TRIGGER trigger_meeting_prefs_mi_updated_at BEFORE UPDATE ON meeting_preferences FOR EACH ROW EXECUTE FUNCTION update_mi_updated_at();
