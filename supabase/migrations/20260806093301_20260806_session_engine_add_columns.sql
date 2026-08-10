/*
# LinkedIn Session Engine — Add Session Lifecycle Columns

## Purpose
Enhances the linkedin_sessions table to support the full session lifecycle:
- Browser fingerprinting (browser version, playwright version, timezone, language)
- Authentication tracking (authenticated flag, authenticated_at timestamp)
- Health monitoring (health_status, failure_reason, retry_count)
- Session lifecycle state machine (connection_state)
- Browserbase session tracking (browserbase_session_id)
- Activity tracking (last_activity_at)

## Changes to linkedin_sessions
Adds columns: browser_version, playwright_version, language, authenticated, authenticated_at,
health_status, failure_reason, retry_count, connection_state, browserbase_session_id, last_activity_at

## New/Updated RPC Functions
- save_linkedin_session (updated with new params)
- load_latest_linkedin_session (updated with new return columns)
- update_session_health (new)
- refresh_session_data (new)
- expire_session (new)
*/

-- Add session lifecycle columns to linkedin_sessions
DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS browser_version text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS playwright_version text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS language text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS authenticated boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS authenticated_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'new'
  CHECK (health_status IN ('new', 'healthy', 'warning', 'expired', 'disconnected', 'browser_lost', 'browserbase_missing', 'playwright_lost', 'auth_failed', 'corrupted'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS failure_reason text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS retry_count int NOT NULL DEFAULT 0;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS connection_state text NOT NULL DEFAULT 'new'
  CHECK (connection_state IN ('new', 'authenticating', 'authenticated', 'restoring', 'active', 'verifying', 'expired', 'failed', 'reconnect_required'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS browserbase_session_id text;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_sessions ADD COLUMN IF NOT EXISTS last_activity_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Drop existing functions that have incompatible signatures
DROP FUNCTION IF EXISTS save_linkedin_session(uuid, uuid, text, text, text, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS load_latest_linkedin_session(uuid);

-- Updated save_linkedin_session with new parameters
CREATE OR REPLACE FUNCTION save_linkedin_session(
  p_workspace_id uuid,
  p_account_id uuid,
  p_session_name text,
  p_cookies_encrypted text,
  p_storage_state_encrypted text,
  p_local_storage_encrypted text,
  p_session_storage_encrypted text,
  p_encryption_key_id text DEFAULT 'li-session-aes256-gcm-v3',
  p_user_agent text DEFAULT NULL,
  p_viewport jsonb DEFAULT NULL,
  p_browser_version text DEFAULT NULL,
  p_playwright_version text DEFAULT NULL,
  p_timezone text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_browserbase_session_id text DEFAULT NULL,
  p_browser_fingerprint jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session_id uuid;
BEGIN
  UPDATE linkedin_sessions
  SET status = 'expired', updated_at = now()
  WHERE account_id = p_account_id
    AND status = 'active';

  INSERT INTO linkedin_sessions (
    workspace_id, account_id, session_name,
    cookies_encrypted, storage_state_encrypted,
    local_storage_encrypted, session_storage_encrypted,
    encrypted, encryption_key_id,
    user_agent, viewport,
    browser_version, playwright_version,
    timezone, locale, language,
    browserbase_session_id, browser_fingerprint,
    status, connection_state, health_status,
    authenticated, authenticated_at,
    last_validated_at, last_used_at, expires_at,
    metadata
  ) VALUES (
    p_workspace_id, p_account_id, p_session_name,
    p_cookies_encrypted, p_storage_state_encrypted,
    p_local_storage_encrypted, p_session_storage_encrypted,
    true, p_encryption_key_id,
    p_user_agent, p_viewport,
    p_browser_version, p_playwright_version,
    p_timezone, p_language, p_language,
    p_browserbase_session_id, p_browser_fingerprint,
    'active', 'authenticated', 'healthy',
    true, now(),
    now(), now(), now() + interval '7 days',
    '{}'::jsonb
  )
  RETURNING id INTO v_session_id;

  RETURN v_session_id;
END;
$$;

-- Updated load_latest_linkedin_session with new return columns
CREATE OR REPLACE FUNCTION load_latest_linkedin_session(
  p_account_id uuid
)
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  account_id uuid,
  session_name text,
  cookies_encrypted text,
  storage_state_encrypted text,
  local_storage_encrypted text,
  session_storage_encrypted text,
  encrypted boolean,
  encryption_key_id text,
  user_agent text,
  viewport jsonb,
  timezone text,
  locale text,
  language text,
  browser_version text,
  playwright_version text,
  browserbase_session_id text,
  browser_fingerprint jsonb,
  status text,
  connection_state text,
  health_status text,
  authenticated boolean,
  authenticated_at timestamptz,
  last_validated_at timestamptz,
  last_used_at timestamptz,
  last_activity_at timestamptz,
  expires_at timestamptz,
  failure_reason text,
  retry_count int,
  metadata jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id, s.workspace_id, s.account_id, s.session_name,
    s.cookies_encrypted, s.storage_state_encrypted,
    s.local_storage_encrypted, s.session_storage_encrypted,
    s.encrypted, s.encryption_key_id,
    s.user_agent, s.viewport,
    s.timezone, s.locale, s.language,
    s.browser_version, s.playwright_version,
    s.browserbase_session_id, s.browser_fingerprint,
    s.status, s.connection_state, s.health_status,
    s.authenticated, s.authenticated_at,
    s.last_validated_at, s.last_used_at, s.last_activity_at,
    s.expires_at, s.failure_reason, s.retry_count,
    s.metadata
  FROM linkedin_sessions s
  WHERE s.account_id = p_account_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$;

-- New RPC: update session health
CREATE OR REPLACE FUNCTION update_session_health(
  p_session_id uuid,
  p_health_status text,
  p_failure_reason text DEFAULT NULL,
  p_connection_state text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE linkedin_sessions
  SET
    health_status = p_health_status,
    failure_reason = p_failure_reason,
    connection_state = COALESCE(p_connection_state, connection_state),
    updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- New RPC: refresh session data (cookies, storage, timestamps)
CREATE OR REPLACE FUNCTION refresh_session_data(
  p_session_id uuid,
  p_cookies_encrypted text DEFAULT NULL,
  p_storage_state_encrypted text DEFAULT NULL,
  p_local_storage_encrypted text DEFAULT NULL,
  p_session_storage_encrypted text DEFAULT NULL,
  p_last_verified_at timestamptz DEFAULT NULL,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE linkedin_sessions
  SET
    cookies_encrypted = COALESCE(p_cookies_encrypted, cookies_encrypted),
    storage_state_encrypted = COALESCE(p_storage_state_encrypted, storage_state_encrypted),
    local_storage_encrypted = COALESCE(p_local_storage_encrypted, local_storage_encrypted),
    session_storage_encrypted = COALESCE(p_session_storage_encrypted, session_storage_encrypted),
    last_validated_at = COALESCE(p_last_verified_at, last_validated_at),
    expires_at = COALESCE(p_expires_at, expires_at),
    last_used_at = now(),
    updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- New RPC: mark session as expired
CREATE OR REPLACE FUNCTION expire_session(
  p_session_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE linkedin_sessions
  SET
    status = 'expired',
    health_status = 'expired',
    connection_state = 'expired',
    failure_reason = p_reason,
    updated_at = now()
  WHERE id = p_session_id;
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION save_linkedin_session TO authenticated;
GRANT EXECUTE ON FUNCTION load_latest_linkedin_session TO authenticated;
GRANT EXECUTE ON FUNCTION update_session_health TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_session_data TO authenticated;
GRANT EXECUTE ON FUNCTION expire_session TO authenticated;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_browserbase_session ON linkedin_sessions(browserbase_session_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_health ON linkedin_sessions(health_status);
CREATE INDEX IF NOT EXISTS idx_linkedin_sessions_connection_state ON linkedin_sessions(connection_state);
