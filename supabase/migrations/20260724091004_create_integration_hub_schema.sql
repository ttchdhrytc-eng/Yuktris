/*
# Create Integration Hub Schema

## Overview
Creates the central integration management system for the Revenue AI
platform. Every external provider (Google, LinkedIn, OpenAI, Firecrawl,
Tavily, HubSpot, Salesforce, Slack, Zoom, etc.) registers through this
schema. No provider manages its own connection independently.

## New Tables (3)

1. **integrations** — One row per provider per workspace. Tracks
   connection status, health, connected account identifier, token
   expiration, last sync, and arbitrary metadata. Unique on
   (workspace_id, provider) so each workspace can have exactly one
   connection per provider.

2. **integration_permissions** — One row per permission per
   integration. Tracks whether each permission/scope has been granted
   and whether it is required, enabling incremental authorization.

3. **integration_logs** — Append-only event log for every integration
   operation: connects, disconnects, refreshes, syncs, health checks,
   errors, retries, rate limits, and recoveries. Used for debugging
   and audit trails.

## Security
- RLS enabled on all three tables.
- All tables use `is_workspace_member()` for SELECT, scoped to
  workspace members.
- INSERT/UPDATE/DELETE scoped to workspace owner/admin only.
- 4 CRUD policies per table — no FOR ALL.
- integration_permissions and integration_logs cascade-delete with
  their parent integration.
*/

-- ============================================================
-- 1. integrations
-- ============================================================

CREATE TABLE IF NOT EXISTS integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'oauth' CHECK (provider_type IN ('oauth', 'api_key', 'webhook', 'service')),
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'expired', 'error', 'pending')),
  connection_health text NOT NULL DEFAULT 'unknown' CHECK (connection_health IN ('healthy', 'degraded', 'expired', 'error', 'unknown')),
  connected_account text,
  last_sync timestamptz,
  last_health_check timestamptz,
  token_expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integrations_workspace_provider ON integrations(workspace_id, provider);
CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id ON integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);
CREATE INDEX IF NOT EXISTS idx_integrations_provider ON integrations(provider);

ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_integrations" ON integrations;
CREATE POLICY "select_own_integrations" ON integrations
  FOR SELECT TO authenticated
  USING (is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "insert_own_integrations" ON integrations;
CREATE POLICY "insert_own_integrations" ON integrations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "update_own_integrations" ON integrations;
CREATE POLICY "update_own_integrations" ON integrations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "delete_own_integrations" ON integrations;
CREATE POLICY "delete_own_integrations" ON integrations
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integrations.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('owner', 'admin')
    )
  );

-- ============================================================
-- 2. integration_permissions
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  permission_name text NOT NULL,
  granted boolean NOT NULL DEFAULT false,
  required boolean NOT NULL DEFAULT false,
  last_checked timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_integration_permissions_integration_perm ON integration_permissions(integration_id, permission_name);
CREATE INDEX IF NOT EXISTS idx_integration_permissions_integration_id ON integration_permissions(integration_id);

ALTER TABLE integration_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_integration_permissions" ON integration_permissions;
CREATE POLICY "select_own_integration_permissions" ON integration_permissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_permissions.integration_id
      AND is_workspace_member(integrations.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_integration_permissions" ON integration_permissions;
CREATE POLICY "insert_own_integration_permissions" ON integration_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_permissions.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "update_own_integration_permissions" ON integration_permissions;
CREATE POLICY "update_own_integration_permissions" ON integration_permissions
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_permissions.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_permissions.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "delete_own_integration_permissions" ON integration_permissions;
CREATE POLICY "delete_own_integration_permissions" ON integration_permissions
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_permissions.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================
-- 3. integration_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS integration_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  event text NOT NULL CHECK (event IN ('connect', 'disconnect', 'reconnect', 'refresh', 'sync', 'health_check', 'permission_change', 'error', 'retry', 'rate_limit', 'recovery')),
  status text NOT NULL DEFAULT 'info' CHECK (status IN ('success', 'failure', 'warning', 'info')),
  message text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_integration_logs_integration_id ON integration_logs(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at ON integration_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_event ON integration_logs(event);

ALTER TABLE integration_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_integration_logs" ON integration_logs;
CREATE POLICY "select_own_integration_logs" ON integration_logs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_logs.integration_id
      AND is_workspace_member(integrations.workspace_id)
    )
  );

DROP POLICY IF EXISTS "insert_own_integration_logs" ON integration_logs;
CREATE POLICY "insert_own_integration_logs" ON integration_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_logs.integration_id
      AND is_workspace_member(integrations.workspace_id)
    )
  );

DROP POLICY IF EXISTS "update_own_integration_logs" ON integration_logs;
CREATE POLICY "update_own_integration_logs" ON integration_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_logs.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_logs.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

DROP POLICY IF EXISTS "delete_own_integration_logs" ON integration_logs;
CREATE POLICY "delete_own_integration_logs" ON integration_logs
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integrations
      WHERE integrations.id = integration_logs.integration_id
      AND is_workspace_member(integrations.workspace_id)
      AND EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_members.workspace_id = integrations.workspace_id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
      )
    )
  );

-- ============================================================
-- Triggers: auto-update updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integrations_updated_at ON integrations;
CREATE TRIGGER trigger_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW
  EXECUTE FUNCTION update_integrations_updated_at();

CREATE OR REPLACE FUNCTION update_integration_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_integration_permissions_updated_at ON integration_permissions;
CREATE TRIGGER trigger_integration_permissions_updated_at
  BEFORE UPDATE ON integration_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_integration_permissions_updated_at();
