/*
# Phase 21.7 — Meeting Booking Engine Schema

Creates 6 tables for calendar integration, meeting scheduling,
availability detection, and meeting reminders. Prefixed with
linkedin_ to avoid conflicts with pre-existing meeting_* tables.
*/

CREATE TABLE IF NOT EXISTS linkedin_calendar_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL CHECK (provider IN ('google','outlook')),
  email text NOT NULL,
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  calendar_id text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','error','disconnected')),
  last_synced_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_calendar_connections ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_calendar_connections" ON linkedin_calendar_connections;
CREATE POLICY "select_own_li_calendar_connections" ON linkedin_calendar_connections FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_calendar_connections" ON linkedin_calendar_connections;
CREATE POLICY "insert_own_li_calendar_connections" ON linkedin_calendar_connections FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_calendar_connections" ON linkedin_calendar_connections;
CREATE POLICY "update_own_li_calendar_connections" ON linkedin_calendar_connections FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_calendar_connections" ON linkedin_calendar_connections;
CREATE POLICY "delete_own_li_calendar_connections" ON linkedin_calendar_connections FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES linkedin_calendar_connections(id) ON DELETE CASCADE,
  external_event_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text,
  attendees jsonb NOT NULL DEFAULT '[]'::jsonb,
  location text,
  meeting_url text,
  status text NOT NULL DEFAULT 'confirmed',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_calendar_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_calendar_events" ON linkedin_calendar_events;
CREATE POLICY "select_own_li_calendar_events" ON linkedin_calendar_events FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_calendar_events" ON linkedin_calendar_events;
CREATE POLICY "insert_own_li_calendar_events" ON linkedin_calendar_events FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_calendar_events" ON linkedin_calendar_events;
CREATE POLICY "update_own_li_calendar_events" ON linkedin_calendar_events FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_calendar_events" ON linkedin_calendar_events;
CREATE POLICY "delete_own_li_calendar_events" ON linkedin_calendar_events FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_meeting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES linkedin_conversations(id) ON DELETE SET NULL,
  account_id uuid REFERENCES linkedin_accounts(id) ON DELETE SET NULL,
  prospect_name text NOT NULL,
  prospect_email text,
  prospect_timezone text,
  meeting_type text NOT NULL DEFAULT 'discovery',
  duration_minutes int NOT NULL DEFAULT 30,
  preferred_dates jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_meeting_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_meeting_requests" ON linkedin_meeting_requests;
CREATE POLICY "select_own_li_meeting_requests" ON linkedin_meeting_requests FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_meeting_requests" ON linkedin_meeting_requests;
CREATE POLICY "insert_own_li_meeting_requests" ON linkedin_meeting_requests FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_meeting_requests" ON linkedin_meeting_requests;
CREATE POLICY "update_own_li_meeting_requests" ON linkedin_meeting_requests FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_meeting_requests" ON linkedin_meeting_requests;
CREATE POLICY "delete_own_li_meeting_requests" ON linkedin_meeting_requests FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_meeting_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_request_id uuid NOT NULL REFERENCES linkedin_meeting_requests(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','proposed','confirmed','rejected','expired')),
  conflict_detected boolean NOT NULL DEFAULT false,
  conflict_details jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_meeting_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_meeting_slots" ON linkedin_meeting_slots;
CREATE POLICY "select_own_li_meeting_slots" ON linkedin_meeting_slots FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_meeting_slots" ON linkedin_meeting_slots;
CREATE POLICY "insert_own_li_meeting_slots" ON linkedin_meeting_slots FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_meeting_slots" ON linkedin_meeting_slots;
CREATE POLICY "update_own_li_meeting_slots" ON linkedin_meeting_slots FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_meeting_slots" ON linkedin_meeting_slots;
CREATE POLICY "delete_own_li_meeting_slots" ON linkedin_meeting_slots FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_meeting_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_request_id uuid NOT NULL REFERENCES linkedin_meeting_requests(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES linkedin_meeting_slots(id) ON DELETE CASCADE,
  confirmed_start timestamptz NOT NULL,
  confirmed_end timestamptz NOT NULL,
  timezone text NOT NULL DEFAULT 'UTC',
  meeting_url text,
  meeting_provider text CHECK (meeting_provider IN ('google_meet','zoom','outlook','teams','other')),
  calendar_event_id uuid REFERENCES linkedin_calendar_events(id) ON DELETE SET NULL,
  prospect_confirmed boolean NOT NULL DEFAULT false,
  prospect_confirmed_at timestamptz,
  crm_updated boolean NOT NULL DEFAULT false,
  linkedin_notified boolean NOT NULL DEFAULT false,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_meeting_confirmations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_meeting_confirmations" ON linkedin_meeting_confirmations;
CREATE POLICY "select_own_li_meeting_confirmations" ON linkedin_meeting_confirmations FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_meeting_confirmations" ON linkedin_meeting_confirmations;
CREATE POLICY "insert_own_li_meeting_confirmations" ON linkedin_meeting_confirmations FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_meeting_confirmations" ON linkedin_meeting_confirmations;
CREATE POLICY "update_own_li_meeting_confirmations" ON linkedin_meeting_confirmations FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_meeting_confirmations" ON linkedin_meeting_confirmations;
CREATE POLICY "delete_own_li_meeting_confirmations" ON linkedin_meeting_confirmations FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE TABLE IF NOT EXISTS linkedin_meeting_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  meeting_confirmation_id uuid NOT NULL REFERENCES linkedin_meeting_confirmations(id) ON DELETE CASCADE,
  reminder_type text NOT NULL CHECK (reminder_type IN ('24h','1h','15m','5m','post_meeting')),
  scheduled_for timestamptz NOT NULL,
  channel text NOT NULL DEFAULT 'linkedin' CHECK (channel IN ('linkedin','email','slack','sms')),
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  sent_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE linkedin_meeting_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_li_meeting_reminders" ON linkedin_meeting_reminders;
CREATE POLICY "select_own_li_meeting_reminders" ON linkedin_meeting_reminders FOR SELECT TO authenticated USING (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "insert_own_li_meeting_reminders" ON linkedin_meeting_reminders;
CREATE POLICY "insert_own_li_meeting_reminders" ON linkedin_meeting_reminders FOR INSERT TO authenticated WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "update_own_li_meeting_reminders" ON linkedin_meeting_reminders;
CREATE POLICY "update_own_li_meeting_reminders" ON linkedin_meeting_reminders FOR UPDATE TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));
DROP POLICY IF EXISTS "delete_own_li_meeting_reminders" ON linkedin_meeting_reminders;
CREATE POLICY "delete_own_li_meeting_reminders" ON linkedin_meeting_reminders FOR DELETE TO authenticated USING (is_workspace_member(workspace_id));

CREATE INDEX IF NOT EXISTS idx_li_calendar_connections_workspace ON linkedin_calendar_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_li_calendar_events_connection ON linkedin_calendar_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_li_calendar_events_start_time ON linkedin_calendar_events(start_time);
CREATE INDEX IF NOT EXISTS idx_li_meeting_requests_workspace ON linkedin_meeting_requests(workspace_id);
CREATE INDEX IF NOT EXISTS idx_li_meeting_slots_request ON linkedin_meeting_slots(meeting_request_id);
CREATE INDEX IF NOT EXISTS idx_li_meeting_confirmations_request ON linkedin_meeting_confirmations(meeting_request_id);
CREATE INDEX IF NOT EXISTS idx_li_meeting_reminders_scheduled ON linkedin_meeting_reminders(scheduled_for);

DROP TRIGGER IF EXISTS trg_li_calendar_connections_updated_at ON linkedin_calendar_connections;
CREATE TRIGGER trg_li_calendar_connections_updated_at BEFORE UPDATE ON linkedin_calendar_connections FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_li_calendar_events_updated_at ON linkedin_calendar_events;
CREATE TRIGGER trg_li_calendar_events_updated_at BEFORE UPDATE ON linkedin_calendar_events FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP TRIGGER IF EXISTS trg_li_meeting_requests_updated_at ON linkedin_meeting_requests;
CREATE TRIGGER trg_li_meeting_requests_updated_at BEFORE UPDATE ON linkedin_meeting_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();
