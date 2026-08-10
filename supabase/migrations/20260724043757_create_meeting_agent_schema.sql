/*
# Create Meeting Agent Schema

## Overview
Creates the complete database schema for the Meeting Agent — the
Revenue Operations handoff engine of Revenue AI.

The Meeting Agent manages every activity after a prospect has been
qualified for a meeting: meeting preparation, scheduling, execution
tracking, CRM synchronization, and post-meeting workflows.

It NEVER performs outreach or analyzes conversations. It only manages
meetings and post-meeting workflows.

It runs after Conversation AI hands off a meeting-ready prospect.

## New Tables (5 total)

1. **meeting_agent_meetings** — Main meeting record.
2. **meeting_agent_briefs** — AI-generated meeting brief per meeting.
3. **meeting_agent_preparation** — Sales preparation per meeting.
4. **meeting_agent_crm_updates** — CRM synchronization record per meeting.
5. **meeting_agent_outcomes** — Post-meeting outcome.

## Naming
All tables use the `meeting_agent_` prefix to avoid conflicts with
existing `meetings` table.

## Security
- RLS enabled on ALL tables.
- All tables scoped to workspace membership via is_workspace_member().
- Child tables scope through meetings using EXISTS subquery.
- 4 CRUD policies per table — no FOR ALL.
- All policies use TO authenticated.
*/

-- ============================================================
-- 1. meeting_agent_meetings (main table)
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_agent_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_id uuid,
  company_id uuid,
  conversation_id uuid,
  prospect_name text,
  prospect_title text,
  company_name text,
  status text NOT NULL DEFAULT 'qualified' CHECK (status IN ('qualified', 'scheduling', 'scheduled', 'completed', 'cancelled', 'rescheduled', 'no_show', 'failed')),
  meeting_type text NOT NULL DEFAULT 'discovery' CHECK (meeting_type IN ('discovery', 'demo', 'follow_up', 'technical', 'proposal', 'closing', 'check_in')),
  meeting_duration integer NOT NULL DEFAULT 30 CHECK (meeting_duration IN (15, 30, 45, 60, 90)),
  meeting_platform text NOT NULL DEFAULT 'zoom' CHECK (meeting_platform IN ('zoom', 'google_meet', 'microsoft_teams', 'in_person', 'phone')),
  meeting_time timestamptz,
  timezone text NOT NULL DEFAULT 'America/New_York',
  assigned_rep text,
  meeting_link text,
  calendar_status text NOT NULL DEFAULT 'pending' CHECK (calendar_status IN ('pending', 'synced', 'conflict', 'failed')),
  crm_status text NOT NULL DEFAULT 'pending' CHECK (crm_status IN ('pending', 'synced', 'failed')),
  meeting_readiness_score integer DEFAULT 0,
  revenue_potential numeric(12, 2) DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agent_meetings_workspace_id ON meeting_agent_meetings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agent_meetings_contact_id ON meeting_agent_meetings(contact_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agent_meetings_company_id ON meeting_agent_meetings(company_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agent_meetings_conversation_id ON meeting_agent_meetings(conversation_id);
CREATE INDEX IF NOT EXISTS idx_meeting_agent_meetings_status ON meeting_agent_meetings(status);
CREATE INDEX IF NOT EXISTS idx_meeting_agent_meetings_meeting_time ON meeting_agent_meetings(meeting_time);

ALTER TABLE meeting_agent_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meeting_agent_meetings" ON meeting_agent_meetings;
CREATE POLICY "select_own_meeting_agent_meetings" ON meeting_agent_meetings FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_meeting_agent_meetings" ON meeting_agent_meetings;
CREATE POLICY "insert_own_meeting_agent_meetings" ON meeting_agent_meetings FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_meeting_agent_meetings" ON meeting_agent_meetings;
CREATE POLICY "update_own_meeting_agent_meetings" ON meeting_agent_meetings FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_meeting_agent_meetings" ON meeting_agent_meetings;
CREATE POLICY "delete_own_meeting_agent_meetings" ON meeting_agent_meetings FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ============================================================
-- 2. meeting_agent_briefs
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_agent_briefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meeting_agent_meetings(id) ON DELETE CASCADE,
  executive_summary text,
  company_summary text,
  conversation_summary text,
  recommended_questions text[],
  recommended_services text[],
  recommended_talking_points text[],
  potential_objections text[],
  expected_outcomes text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agent_briefs_meeting_id ON meeting_agent_briefs(meeting_id);

ALTER TABLE meeting_agent_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meeting_agent_briefs" ON meeting_agent_briefs;
CREATE POLICY "select_own_meeting_agent_briefs" ON meeting_agent_briefs FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_briefs.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_meeting_agent_briefs" ON meeting_agent_briefs;
CREATE POLICY "insert_own_meeting_agent_briefs" ON meeting_agent_briefs FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_briefs.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_meeting_agent_briefs" ON meeting_agent_briefs;
CREATE POLICY "update_own_meeting_agent_briefs" ON meeting_agent_briefs FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_briefs.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_briefs.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_meeting_agent_briefs" ON meeting_agent_briefs;
CREATE POLICY "delete_own_meeting_agent_briefs" ON meeting_agent_briefs FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_briefs.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

-- ============================================================
-- 3. meeting_agent_preparation
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_agent_preparation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meeting_agent_meetings(id) ON DELETE CASCADE,
  agenda text[],
  case_studies jsonb,
  pricing_notes text,
  competitive_notes text,
  key_opportunities text[],
  risks text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agent_preparation_meeting_id ON meeting_agent_preparation(meeting_id);

ALTER TABLE meeting_agent_preparation ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meeting_agent_preparation" ON meeting_agent_preparation;
CREATE POLICY "select_own_meeting_agent_preparation" ON meeting_agent_preparation FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_preparation.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_meeting_agent_preparation" ON meeting_agent_preparation;
CREATE POLICY "insert_own_meeting_agent_preparation" ON meeting_agent_preparation FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_preparation.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_meeting_agent_preparation" ON meeting_agent_preparation;
CREATE POLICY "update_own_meeting_agent_preparation" ON meeting_agent_preparation FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_preparation.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_preparation.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_meeting_agent_preparation" ON meeting_agent_preparation;
CREATE POLICY "delete_own_meeting_agent_preparation" ON meeting_agent_preparation FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_preparation.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

-- ============================================================
-- 4. meeting_agent_crm_updates
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_agent_crm_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meeting_agent_meetings(id) ON DELETE CASCADE,
  lead_status text NOT NULL DEFAULT 'new' CHECK (lead_status IN ('new', 'contacted', 'qualified', 'opportunity', 'customer', 'disqualified')),
  opportunity_stage text NOT NULL DEFAULT 'prospecting' CHECK (opportunity_stage IN ('prospecting', 'qualification', 'needs_analysis', 'proposal', 'negotiation', 'closed_won', 'closed_lost')),
  deal_value numeric(12, 2) DEFAULT 0,
  forecast text NOT NULL DEFAULT 'pipeline' CHECK (forecast IN ('pipeline', 'best_case', 'commit', 'closed')),
  owner text,
  next_action text,
  next_action_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agent_crm_updates_meeting_id ON meeting_agent_crm_updates(meeting_id);

ALTER TABLE meeting_agent_crm_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates;
CREATE POLICY "select_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_crm_updates.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates;
CREATE POLICY "insert_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_crm_updates.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates;
CREATE POLICY "update_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_crm_updates.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_crm_updates.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates;
CREATE POLICY "delete_own_meeting_agent_crm_updates" ON meeting_agent_crm_updates FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_crm_updates.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

-- ============================================================
-- 5. meeting_agent_outcomes
-- ============================================================

CREATE TABLE IF NOT EXISTS meeting_agent_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES meeting_agent_meetings(id) ON DELETE CASCADE,
  attendance_status text NOT NULL DEFAULT 'pending' CHECK (attendance_status IN ('pending', 'attended', 'no_show', 'rescheduled', 'cancelled')),
  qualification_result text NOT NULL DEFAULT 'pending' CHECK (qualification_result IN ('pending', 'qualified', 'unqualified', 'needs_followup')),
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'moved_to_opportunity', 'followup_scheduled', 'closed_won', 'closed_lost', 'no_decision', 'disqualified')),
  next_followup date,
  followup_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_agent_outcomes_meeting_id ON meeting_agent_outcomes(meeting_id);

ALTER TABLE meeting_agent_outcomes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_meeting_agent_outcomes" ON meeting_agent_outcomes;
CREATE POLICY "select_own_meeting_agent_outcomes" ON meeting_agent_outcomes FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_outcomes.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "insert_own_meeting_agent_outcomes" ON meeting_agent_outcomes;
CREATE POLICY "insert_own_meeting_agent_outcomes" ON meeting_agent_outcomes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_outcomes.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "update_own_meeting_agent_outcomes" ON meeting_agent_outcomes;
CREATE POLICY "update_own_meeting_agent_outcomes" ON meeting_agent_outcomes FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_outcomes.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  ) WITH CHECK (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_outcomes.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

DROP POLICY IF EXISTS "delete_own_meeting_agent_outcomes" ON meeting_agent_outcomes;
CREATE POLICY "delete_own_meeting_agent_outcomes" ON meeting_agent_outcomes FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM meeting_agent_meetings WHERE meeting_agent_meetings.id = meeting_agent_outcomes.meeting_id AND is_workspace_member(meeting_agent_meetings.workspace_id))
  );

-- ============================================================
-- Trigger: auto-update updated_at on meeting_agent_meetings
-- ============================================================

CREATE OR REPLACE FUNCTION update_meeting_agent_meeting_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_meeting_agent_meeting_updated_at ON meeting_agent_meetings;
CREATE TRIGGER trigger_meeting_agent_meeting_updated_at
  BEFORE UPDATE ON meeting_agent_meetings
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_agent_meeting_updated_at();

-- ============================================================
-- Trigger: auto-update updated_at on meeting_agent_crm_updates
-- ============================================================

CREATE OR REPLACE FUNCTION update_meeting_agent_crm_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_meeting_agent_crm_updated_at ON meeting_agent_crm_updates;
CREATE TRIGGER trigger_meeting_agent_crm_updated_at
  BEFORE UPDATE ON meeting_agent_crm_updates
  FOR EACH ROW
  EXECUTE FUNCTION update_meeting_agent_crm_updated_at();