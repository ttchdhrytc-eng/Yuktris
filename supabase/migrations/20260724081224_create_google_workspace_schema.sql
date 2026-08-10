/*
# Create Google Workspace Integration Layer

## Overview
Creates two tables that track which Google Workspace services (Gmail,
Calendar, Meet, Contacts, Drive) are enabled for a workspace and which
OAuth scopes have been granted by the connected Google account.

## New Tables (2)

1. **google_workspace** — One row per workspace, linked to the primary
   Google account. Tracks which services are enabled, overall connection
   health, and the last health check timestamp.

2. **google_permissions** — One row per OAuth scope per workspace.
   Tracks whether each individual scope has been granted by Google,
   enabling incremental authorization (request only missing scopes).

## Security
- RLS enabled on both tables.
- google_workspace: workspace members can SELECT; owner/admin can
  INSERT/UPDATE/DELETE.
- google_permissions: workspace members can SELECT; owner/admin can
  INSERT/UPDATE/DELETE.
- All policies use is_workspace_member() for workspace isolation.
- 4 CRUD policies per table — no FOR ALL.
*/

-- ============================================================
-- 1. google_workspace
-- ============================================================

CREATE TABLE IF NOT EXISTS google_workspace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  google_account_id uuid REFERENCES google_accounts(id) ON DELETE SET NULL,
  gmail_enabled boolean NOT NULL DEFAULT false,
  calendar_enabled boolean NOT NULL DEFAULT false,
  meet_enabled boolean NOT NULL DEFAULT false,
  contacts_enabled boolean NOT NULL DEFAULT false,
  drive_enabled boolean NOT NULL DEFAULT false,
  connection_health text NOT NULL DEFAULT 'unknown' CHECK (connection_health IN ('healthy', 'degraded', 'expired', 'error', 'unknown')),
  last_health_check timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_google_workspace_workspace_id ON google_workspace(workspace_id);
CREATE INDEX IF NOT EXISTS idx_google_workspace_google_account_id ON google_workspace(google_account_id);

ALTER TABLE google_workspace ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_google_workspace" ON google_workspace;
CREATE POLICY "select_own_google_workspace" ON google_workspace
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_google_workspace" ON google_workspace;
CREATE POLICY "insert_own_google_workspace" ON google_workspace
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_workspace.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_own_google_workspace" ON google_workspace;
CREATE POLICY "update_own_google_workspace" ON google_workspace
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_workspace.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_workspace.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_own_google_workspace" ON google_workspace;
CREATE POLICY "delete_own_google_workspace" ON google_workspace
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = google_workspace.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 2. google_permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS google_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_workspace_id uuid NOT NULL REFERENCES google_workspace(id) ON DELETE CASCADE,
  scope text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  last_checked timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_google_permissions_workspace_id ON google_permissions(google_workspace_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_google_permissions_workspace_scope ON google_permissions(google_workspace_id, scope);

ALTER TABLE google_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_google_permissions" ON google_permissions;
CREATE POLICY "select_own_google_permissions" ON google_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_workspace
      WHERE google_workspace.id = google_permissions.google_workspace_id
      AND is_workspace_member(google_workspace.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_google_permissions" ON google_permissions;
CREATE POLICY "insert_own_google_permissions" ON google_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM google_workspace
      WHERE google_workspace.id = google_permissions.google_workspace_id
      AND is_workspace_member(google_workspace.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = google_workspace.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "update_own_google_permissions" ON google_permissions;
CREATE POLICY "update_own_google_permissions" ON google_permissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_workspace
      WHERE google_workspace.id = google_permissions.google_workspace_id
      AND is_workspace_member(google_workspace.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = google_workspace.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM google_workspace
      WHERE google_workspace.id = google_permissions.google_workspace_id
      AND is_workspace_member(google_workspace.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = google_workspace.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "delete_own_google_permissions" ON google_permissions;
CREATE POLICY "delete_own_google_permissions" ON google_permissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM google_workspace
      WHERE google_workspace.id = google_permissions.google_workspace_id
      AND is_workspace_member(google_workspace.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = google_workspace.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_google_workspace_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_google_workspace_updated_at ON google_workspace;
CREATE TRIGGER trigger_google_workspace_updated_at
  BEFORE UPDATE ON google_workspace
  FOR EACH ROW
  EXECUTE FUNCTION update_google_workspace_updated_at();

CREATE OR REPLACE FUNCTION update_google_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_google_permissions_updated_at ON google_permissions;
CREATE TRIGGER trigger_google_permissions_updated_at
  BEFORE UPDATE ON google_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_google_permissions_updated_at();
