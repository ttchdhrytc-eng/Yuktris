/*
# Phase 21.2 — LinkedIn Browser Session Management Schema

## Purpose
Stores LinkedIn account credentials, encrypted browser sessions (cookies, storage state),
session backups, login history, device fingerprints, and session lifecycle events.

## New Tables

1. **linkedin_accounts** — Registered LinkedIn accounts per workspace. Tracks account status,
   daily/hourly action limits, and current usage counters. One row per LinkedIn account.

2. **linkedin_sessions** — Encrypted Playwright storage states for each account. Supports
   multiple sessions per account (e.g. different devices). Tracks expiration, last login,
   IP, timezone, browser fingerprint.

3. **linkedin_session_backups** — Point-in-time backups of session storage state. Enables
   session restore after expiry or corruption.

4. **linkedin_login_history** — Audit log of every login attempt (success/failure, IP, user agent).

5. **linkedin_devices** — Trusted device fingerprints for each account. Used for session
   validation and anomaly detection.

6. **linkedin_session_events** — Lifecycle events for sessions: created, refreshed, expired,
   validated, restored, revoked.

## Security
- RLS enabled on all tables, scoped to authenticated users via workspace membership.
- Sensitive columns (cookies, storage_state, local_storage, session_storage, credentials)
  stored as encrypted text.
- All policies use `is_workspace_member()` for ownership checks.
*/

-- ── Helper: workspace membership check ──────────────────────
-- (uses existing is_workspace_member function if available)

-- ── 1. linkedin_accounts ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_name text NOT NULL,
  linkedin_email text NOT NULL,
  profile_url text,
  profile_name text,
  profile_headline text,
  profile_picture_url text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','restricted','banned','expired','pending_login')),
  session_status text NOT NULL DEFAULT 'disconnected' CHECK (session_status IN ('connected','disconnected','expired','reconnecting')),
  last_login_at timestamptz,
  last_activity_at timestamptz,
  daily_connection_limit int NOT NULL DEFAULT 20,
  daily_message_limit int NOT NULL DEFAULT 50,
  daily_profile_visit_limit int NOT NULL DEFAULT 80,
  hourly_action_limit int NOT NULL DEFAULT 15,
  connections_today int NOT NULL DEFAULT 0,
  messages_today int NOT NULL DEFAULT 0,
  profile_visits_today int NOT NULL DEFAULT 0,
  actions_this_hour int NOT NULL DEFAULT 0,
  last_limit_reset_at timestamptz DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_accounts" ON linkedin_accounts;
CREATE POLICY "select_own_linkedin_accounts" ON linkedin_accounts FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_accounts" ON linkedin_accounts;
CREATE POLICY "insert_own_linkedin_accounts" ON linkedin_accounts FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_linkedin_accounts" ON linkedin_accounts;
CREATE POLICY "update_own_linkedin_accounts" ON linkedin_accounts FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_linkedin_accounts" ON linkedin_accounts;
CREATE POLICY "delete_own_linkedin_accounts" ON linkedin_accounts FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 2. linkedin_sessions ────────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  session_name text NOT NULL,
  cookies_encrypted text,
  storage_state_encrypted text,
  local_storage_encrypted text,
  session_storage_encrypted text,
  encrypted boolean NOT NULL DEFAULT true,
  encryption_key_id text,
  user_agent text,
  viewport jsonb,
  timezone text,
  locale text,
  browser_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','refreshing','invalid')),
  last_validated_at timestamptz,
  expires_at timestamptz,
  last_used_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_sessions" ON linkedin_sessions;
CREATE POLICY "select_own_linkedin_sessions" ON linkedin_sessions FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_sessions" ON linkedin_sessions;
CREATE POLICY "insert_own_linkedin_sessions" ON linkedin_sessions FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_linkedin_sessions" ON linkedin_sessions;
CREATE POLICY "update_own_linkedin_sessions" ON linkedin_sessions FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_linkedin_sessions" ON linkedin_sessions;
CREATE POLICY "delete_own_linkedin_sessions" ON linkedin_sessions FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 3. linkedin_session_backups ──────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_session_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  session_id uuid REFERENCES linkedin_sessions(id) ON DELETE SET NULL,
  backup_name text NOT NULL,
  cookies_encrypted text,
  storage_state_encrypted text,
  encrypted boolean NOT NULL DEFAULT true,
  backup_type text NOT NULL DEFAULT 'manual' CHECK (backup_type IN ('manual','auto','pre_refresh')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_session_backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_session_backups" ON linkedin_session_backups;
CREATE POLICY "select_own_linkedin_session_backups" ON linkedin_session_backups FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_session_backups" ON linkedin_session_backups;
CREATE POLICY "insert_own_linkedin_session_backups" ON linkedin_session_backups FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_linkedin_session_backups" ON linkedin_session_backups;
CREATE POLICY "delete_own_linkedin_session_backups" ON linkedin_session_backups FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 4. linkedin_login_history ────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_login_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  login_status text NOT NULL CHECK (login_status IN ('success','failed','captcha','2fa','restricted','error')),
  ip_address text,
  user_agent text,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_login_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_login_history" ON linkedin_login_history;
CREATE POLICY "select_own_linkedin_login_history" ON linkedin_login_history FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_login_history" ON linkedin_login_history;
CREATE POLICY "insert_own_linkedin_login_history" ON linkedin_login_history FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

-- ── 5. linkedin_devices ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_devices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  device_name text NOT NULL,
  fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_agent text,
  ip_address text,
  timezone text,
  trusted boolean NOT NULL DEFAULT false,
  last_seen_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_devices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_devices" ON linkedin_devices;
CREATE POLICY "select_own_linkedin_devices" ON linkedin_devices FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_devices" ON linkedin_devices;
CREATE POLICY "insert_own_linkedin_devices" ON linkedin_devices FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "update_own_linkedin_devices" ON linkedin_devices;
CREATE POLICY "update_own_linkedin_devices" ON linkedin_devices FOR UPDATE
  TO authenticated USING (is_workspace_member(workspace_id)) WITH CHECK (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "delete_own_linkedin_devices" ON linkedin_devices;
CREATE POLICY "delete_own_linkedin_devices" ON linkedin_devices FOR DELETE
  TO authenticated USING (is_workspace_member(workspace_id));

-- ── 6. linkedin_session_events ──────────────────────────────

CREATE TABLE IF NOT EXISTS linkedin_session_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES linkedin_accounts(id) ON DELETE CASCADE,
  session_id uuid REFERENCES linkedin_sessions(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','refreshed','expired','validated','restored','revoked','login_success','login_failed','captcha_detected','restriction_detected','rate_limit_detected')),
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE linkedin_session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_linkedin_session_events" ON linkedin_session_events;
CREATE POLICY "select_own_linkedin_session_events" ON linkedin_session_events FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_linkedin_session_events" ON linkedin_session_events;
CREATE POLICY "insert_own_linkedin_session_events" ON linkedin_session_events FOR INSERT
  TO authenticated WITH CHECK (is_workspace_member(workspace_id));

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_linkedin_accounts_workspace ON linkedin_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_workspace ON linkedin_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_account ON linkedin_sessions(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_session_backups_account ON linkedin_session_backups(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_login_history_account ON linkedin_login_history(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_devices_account ON linkedin_devices(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_session_events_account ON linkedin_session_events(account_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_session_events_session ON linkedin_session_events(session_id);

-- ── updated_at triggers ─────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_linkedin_accounts_updated_at ON linkedin_accounts;
CREATE TRIGGER trg_linkedin_accounts_updated_at BEFORE UPDATE ON linkedin_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_linkedin_sessions_updated_at ON linkedin_sessions;
CREATE TRIGGER trg_linkedin_sessions_updated_at BEFORE UPDATE ON linkedin_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
