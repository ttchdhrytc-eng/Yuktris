/*
# LinkedIn Session Engine — Add Health Check RPC + Account Connection State

## Purpose
1. Adds `get_connected_linkedin_accounts` RPC for the worker health check loop
2. Adds `connection_state` and `health_status` columns to `linkedin_accounts` if missing
3. Adds `last_validated_at` to `linkedin_accounts` if missing

## New RPC Functions
- get_connected_linkedin_accounts() — returns all accounts with session_status = 'connected'
  for the worker's periodic health check loop

## Security
- SECURITY DEFINER, executable by authenticated role
- No new tables
*/

-- Add missing columns to linkedin_accounts if they don't exist
DO $$ BEGIN
  ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS connection_state text NOT NULL DEFAULT 'disconnected'
  CHECK (connection_state IN ('pending','creating_session','session_created','connecting_browser','connected','opening_linkedin','ready_for_login','authenticated','authenticating','requires_action','session_expired','session_invalid','restricted','disconnected','failed'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS health_status text NOT NULL DEFAULT 'disconnected'
  CHECK (health_status IN ('healthy','warning','expired','disconnected','browser_lost','browserbase_missing','playwright_lost','auth_failed','corrupted'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS last_validated_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE linkedin_accounts ADD COLUMN IF NOT EXISTS dry_run_enabled boolean NOT NULL DEFAULT false;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- RPC: get connected LinkedIn accounts for health check
CREATE OR REPLACE FUNCTION get_connected_linkedin_accounts()
RETURNS TABLE (
  id uuid,
  workspace_id uuid,
  account_name text,
  linkedin_email text,
  status text,
  session_status text,
  connection_state text,
  health_status text,
  last_validated_at timestamptz,
  last_activity_at timestamptz,
  browserbase_session_id text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id, a.workspace_id, a.account_name, a.linkedin_email,
    a.status, a.session_status, a.connection_state, a.health_status,
    a.last_validated_at, a.last_activity_at,
    a.browserbase_session_id
  FROM linkedin_accounts a
  WHERE a.session_status = 'connected'
    AND a.status = 'active';
END;
$$;

GRANT EXECUTE ON FUNCTION get_connected_linkedin_accounts TO authenticated;
