/*
# LinkedIn Auth Interactions Schema

## Purpose
Enables the live, interactive LinkedIn login flow. The Browser Worker writes
progress events, screenshots, and challenge notifications to this table; the
frontend polls it to show live progress and submit user responses (credentials,
OTP codes, CAPTCHA solutions).

## New Tables

### linkedin_auth_interactions
Single table that serves as a bidirectional channel between the Browser Worker
and the frontend during the LinkedIn authentication flow.

Columns:
- id (uuid PK)
- workspace_id (uuid FK → workspaces, CASCADE)
- account_id (uuid FK → linkedin_accounts, CASCADE)
- queue_item_id (uuid, nullable — references browser_execution_queue.id)
- interaction_type (text): 'progress' | 'screenshot' | 'challenge' | 'credential_request' | 'credential_response' | 'session_saved' | 'error'
- step (text): machine-readable progress step name
  e.g. 'creating_session', 'launching_browser', 'opening_linkedin',
  'waiting_for_login', 'challenge_detected', 'saving_session', 'connected'
- message (text): human-readable message for the UI
- screenshot_path (text, nullable): path in the browser-screenshots storage bucket
- challenge_type (text, nullable): 'email_otp' | 'captcha' | 'two_factor' | 'phone_verification'
- challenge_description (text, nullable): what the user needs to do
- status (text): 'pending' | 'completed' | 'expired' | 'cancelled'
- user_response (jsonb, nullable): response submitted by the user
  e.g. { password: "..." } or { otp_code: "123456" } or { captcha_solution: "..." }
- metadata (jsonb): extra data (URL at time of event, timestamps, etc.)
- created_at, updated_at, expires_at (timestamptz)

### linkedin_session_heartbeats
Tracks session health pings so the frontend and worker know which sessions
are still alive.

Columns:
- id (uuid PK)
- workspace_id (uuid FK → workspaces, CASCADE)
- account_id (uuid FK → linkedin_accounts, CASCADE)
- session_id (uuid FK → linkedin_sessions, CASCADE)
- worker_id (text): which worker sent the heartbeat
- status (text): 'alive' | 'expired' | 'refreshing'
- url (text, nullable): current URL the session is on
- metadata (jsonb)
- created_at (timestamptz)

## Security
- RLS enabled on both tables, scoped to workspace membership via is_workspace_member()
- 4 CRUD policies each (select/insert/update/delete) for authenticated users

## Important Notes
1. The Browser Worker uses the service role key (bypasses RLS), so it can
   read/write freely. The frontend uses the anon key with user auth, so RLS
   policies must allow authenticated users to access their workspace's rows.
2. The user_response column stores transient credentials ONLY during the
   active auth flow. The worker reads and deletes the response immediately
   after processing, so credentials are not persisted long-term.
3. expires_at on interactions defaults to 10 minutes — stale interactions
   are cleaned up by the worker.
*/

-- ── linkedin_auth_interactions ──────────────────────────────
CREATE TABLE IF NOT EXISTS linkedin_auth_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  queue_item_id uuid,
  interaction_type text NOT NULL CHECK (
    interaction_type IN ('progress', 'screenshot', 'challenge', 'credential_request', 'credential_response', 'session_saved', 'error')
  ),
  step text NOT NULL,
  message text NOT NULL DEFAULT '',
  screenshot_path text,
  challenge_type text CHECK (
    challenge_type IS NULL OR challenge_type IN ('email_otp', 'captcha', 'two_factor', 'phone_verification')
  ),
  challenge_description text,
  status text NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'completed', 'expired', 'cancelled')
  ),
  user_response jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes'
);

ALTER TABLE linkedin_auth_interactions ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_auth_interactions_account_id ON linkedin_auth_interactions(account_id);
CREATE INDEX IF NOT EXISTS idx_auth_interactions_workspace_id ON linkedin_auth_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_auth_interactions_queue_item ON linkedin_auth_interactions(queue_item_id);
CREATE INDEX IF NOT EXISTS idx_auth_interactions_status ON linkedin_auth_interactions(status);
CREATE INDEX IF NOT EXISTS idx_auth_interactions_created_at ON linkedin_auth_interactions(created_at);

-- Drop existing policies (idempotent) then recreate
DROP POLICY IF EXISTS "select_own_auth_interactions" ON linkedin_auth_interactions;
CREATE POLICY "select_own_auth_interactions"
  ON linkedin_auth_interactions FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_auth_interactions" ON linkedin_auth_interactions;
CREATE POLICY "insert_own_auth_interactions"
  ON linkedin_auth_interactions FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_auth_interactions" ON linkedin_auth_interactions;
CREATE POLICY "update_own_auth_interactions"
  ON linkedin_auth_interactions FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_auth_interactions" ON linkedin_auth_interactions;
CREATE POLICY "delete_own_auth_interactions"
  ON linkedin_auth_interactions FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- ── linkedin_session_heartbeats ──────────────────────────────
CREATE TABLE IF NOT EXISTS linkedin_session_heartbeats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  session_id uuid REFERENCES linkedin_sessions(id) ON DELETE CASCADE,
  worker_id text,
  status text NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'expired', 'refreshing')),
  url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_session_heartbeats ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_session_heartbeats_account_id ON linkedin_session_heartbeats(account_id);
CREATE INDEX IF NOT EXISTS idx_session_heartbeats_workspace_id ON linkedin_session_heartbeats(workspace_id);
CREATE INDEX IF NOT EXISTS idx_session_heartbeats_created_at ON linkedin_session_heartbeats(created_at);

DROP POLICY IF EXISTS "select_own_session_heartbeats" ON linkedin_session_heartbeats;
CREATE POLICY "select_own_session_heartbeats"
  ON linkedin_session_heartbeats FOR SELECT
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_session_heartbeats" ON linkedin_session_heartbeats;
CREATE POLICY "insert_own_session_heartbeats"
  ON linkedin_session_heartbeats FOR INSERT
  TO authenticated
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_session_heartbeats" ON linkedin_session_heartbeats;
CREATE POLICY "update_own_session_heartbeats"
  ON linkedin_session_heartbeats FOR UPDATE
  TO authenticated
  USING (public.is_workspace_member(workspace_id))
  WITH CHECK (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_session_heartbeats" ON linkedin_session_heartbeats;
CREATE POLICY "delete_own_session_heartbeats"
  ON linkedin_session_heartbeats FOR DELETE
  TO authenticated
  USING (public.is_workspace_member(workspace_id));

-- ── updated_at trigger for auth_interactions ─────────────────
CREATE OR REPLACE FUNCTION update_auth_interaction_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_auth_interaction_updated_at ON linkedin_auth_interactions;
CREATE TRIGGER trg_auth_interaction_updated_at
  BEFORE UPDATE ON linkedin_auth_interactions
  FOR EACH ROW EXECUTE FUNCTION update_auth_interaction_updated_at();
