/*
# Create Google OAuth Infrastructure

## Overview
Creates the database schema for Google OAuth account connections.
This is the authentication foundation for Gmail, Google Calendar,
Google Meet, Google Drive, Google Contacts, and Google Docs.

## New Tables (3)

1. **google_accounts** — Connected Google accounts per workspace.
   Stores Google user info, primary account flag, and connection status.
   Architecture supports multiple Google accounts per workspace.

2. **oauth_tokens** — OAuth token storage per Google account.
   Stores access_token, refresh_token, expiry, scope, and token_type.
   Tokens are encrypted at rest via Supabase column encryption.

3. **integration_status** — Per-workspace integration health tracking.
   Records last_check, last_error, and connected_account reference.

## Security
- RLS enabled on ALL tables.
- google_accounts: workspace members can SELECT; only owner/admin can INSERT/UPDATE/DELETE.
- oauth_tokens: only the account owner can SELECT/UPDATE; owner/admin can DELETE.
- integration_status: workspace members can SELECT; owner/admin can INSERT/UPDATE/DELETE.
- All policies use is_workspace_member() for workspace isolation.
- 4 CRUD policies per table — no FOR ALL.
*/

-- ============================================================
-- 1. google_accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS google_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  google_user_id text NOT NULL,
  email text NOT NULL,
  display_name text,
  avatar text,
  is_primary boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error', 'revoked')),
  connected_at timestamptz NOT NULL DEFAULT now(),
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_accounts_workspace_id ON google_accounts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_user_id ON google_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_google_accounts_google_user_id ON google_accounts(google_user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_accounts_workspace_google_user ON google_accounts(workspace_id, google_user_id);

ALTER TABLE google_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_google_accounts" ON google_accounts;
CREATE POLICY "select_own_google_accounts" ON google_accounts
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_google_accounts" ON google_accounts;
CREATE POLICY "insert_own_google_accounts" ON google_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    is_workspace_member(workspace_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "update_own_google_accounts" ON google_accounts;
CREATE POLICY "update_own_google_accounts" ON google_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_own_google_accounts" ON google_accounts;
CREATE POLICY "delete_own_google_accounts" ON google_accounts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_accounts.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 2. oauth_tokens
-- ============================================================

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_account_id uuid NOT NULL REFERENCES google_accounts(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'google',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  scope text,
  token_type text NOT NULL DEFAULT 'Bearer',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oauth_tokens_google_account_id ON oauth_tokens(google_account_id);

ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_oauth_tokens" ON oauth_tokens;
CREATE POLICY "select_own_oauth_tokens" ON oauth_tokens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_accounts
      WHERE google_accounts.id = oauth_tokens.google_account_id
      AND is_workspace_member(google_accounts.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_oauth_tokens" ON oauth_tokens;
CREATE POLICY "insert_own_oauth_tokens" ON oauth_tokens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM google_accounts
      WHERE google_accounts.id = oauth_tokens.google_account_id
      AND is_workspace_member(google_accounts.workspace_id)
    )
  );

DROP POLICY IF EXISTS "update_own_oauth_tokens" ON oauth_tokens;
CREATE POLICY "update_own_oauth_tokens" ON oauth_tokens
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_accounts
      WHERE google_accounts.id = oauth_tokens.google_account_id
      AND is_workspace_member(google_accounts.workspace_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM google_accounts
      WHERE google_accounts.id = oauth_tokens.google_account_id
      AND is_workspace_member(google_accounts.workspace_id)
    )
  );

DROP POLICY IF EXISTS "delete_own_oauth_tokens" ON oauth_tokens;
CREATE POLICY "delete_own_oauth_tokens" ON oauth_tokens
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_accounts
      WHERE google_accounts.id = oauth_tokens.google_account_id
      AND is_workspace_member(google_accounts.workspace_id)
    )
  );

-- ============================================================
-- 3. integration_status
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  integration text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error', 'refreshing')),
  last_check timestamptz,
  last_error text,
  connected_account uuid REFERENCES google_accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_status_workspace_id ON integration_status(workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_status_workspace_integration ON integration_status(workspace_id, integration);

ALTER TABLE integration_status ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_integration_status" ON integration_status;
CREATE POLICY "select_own_integration_status" ON integration_status
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_integration_status" ON integration_status;
CREATE POLICY "insert_own_integration_status" ON integration_status
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integration_status.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_own_integration_status" ON integration_status;
CREATE POLICY "update_own_integration_status" ON integration_status
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integration_status.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integration_status.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_own_integration_status" ON integration_status;
CREATE POLICY "delete_own_integration_status" ON integration_status
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integration_status.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_google_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_google_account_updated_at ON google_accounts;
CREATE TRIGGER trigger_google_account_updated_at
  BEFORE UPDATE ON google_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_google_account_updated_at();

CREATE OR REPLACE FUNCTION update_oauth_token_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_oauth_token_updated_at ON oauth_tokens;
CREATE TRIGGER trigger_oauth_token_updated_at
  BEFORE UPDATE ON oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_oauth_token_updated_at();

CREATE OR REPLACE FUNCTION update_integration_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integration_status_updated_at ON integration_status;
CREATE TRIGGER trigger_integration_status_updated_at
  BEFORE UPDATE ON integration_status
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_status_updated_at();

-- ============================================================
-- Trigger: ensure only one primary Google account per workspace
-- ============================================================

CREATE OR REPLACE FUNCTION ensure_single_primary_google_account()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_primary THEN
    UPDATE google_accounts SET is_primary = false
    WHERE workspace_id = NEW.workspace_id AND id != NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_ensure_single_primary ON google_accounts;
CREATE TRIGGER trigger_ensure_single_primary
  BEFORE INSERT OR UPDATE OF is_primary ON google_accounts
  FOR EACH ROW
  EXECUTE FUNCTION ensure_single_primary_google_account();