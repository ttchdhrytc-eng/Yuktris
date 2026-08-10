/*
# Create Enterprise Communication Provider Layer Schema

## Overview
Builds the database schema for a reusable Communication Provider Layer.
Business engines route all messaging through this layer instead of
calling Gmail, Outlook, LinkedIn, WhatsApp, Slack, Teams, or SMS APIs
directly. New providers can be added without modifying business logic.

## New Tables (8)

1. `communication_providers` — Registry of all available communication
   providers (Gmail, Outlook, LinkedIn Messaging, WhatsApp Business,
   Slack, Microsoft Teams, Twilio SMS, Custom, Future). Seeded with 9
   supported providers.

2. `provider_connections` — Active connections between a workspace and
   a communication provider. Stores encrypted credentials, scopes,
   token expiry, sync state, connection health.

3. `provider_capabilities` — Capability matrix per provider declaring
   which capabilities (send_message, schedule_message, search_messages,
   get_thread, list_folders, sync, register_webhook, process_webhook,
   etc.) are supported and enabled.

4. `provider_health` — Health check snapshots: healthy/degraded/error
   state, latency (ms), consecutive failure counts.

5. `provider_events` — Lifecycle events: connected, disconnected,
   token_refreshed, sync_started, sync_completed, error,
   webhook_received, rate_limited, retried, failed_over.

6. `provider_logs` — Detailed audit log of every operation: operation
   type, direction, message ID, status, latency, request/response
   metadata, error details.

7. `provider_rate_limits` — Rate limit configuration and usage tracking
   per connection: limit window, max requests, current count, reset
   time, remaining quota.

8. `provider_webhooks` — Webhook registrations and incoming webhook
   payloads: webhook URL, secret, subscribed events, raw payload,
   processed status.

## Security
- RLS enabled on every table.
- `communication_providers` readable by all authenticated users (catalog).
- `provider_connections` and all child tables scoped to workspace owner
  via `auth.uid() = workspaces.owner_id` ownership checks.
- Child tables (health, events, logs, rate_limits, webhooks) inherit
  access through the `provider_connections` foreign key chain.

## Important Notes
1. `communication_providers` is pre-seeded with 9 provider definitions.
2. All child tables reference `provider_connections` via foreign keys
   with `ON DELETE CASCADE` for automatic cleanup.
3. `provider_connections.credentials` is `jsonb` and intended to hold
   encrypted token/key material — encryption happens in the service
   layer before insert.
4. Indexes added on `workspace_id`, `connection_id`, `provider_id`,
   and `created_at` for query performance.
*/

-- ============================================================
-- 1. communication_providers
-- ============================================================

CREATE TABLE IF NOT EXISTS communication_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text UNIQUE NOT NULL,
  provider_name text NOT NULL,
  provider_type text NOT NULL DEFAULT 'oauth',
  auth_type text NOT NULL DEFAULT 'oauth',
  description text,
  icon text,
  color text,
  priority integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  is_built_in boolean NOT NULL DEFAULT true,
  capabilities text[] NOT NULL DEFAULT ARRAY[]::text[],
  default_scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  auth_url text,
  token_url text,
  docs_url text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE communication_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_communication_providers" ON communication_providers;
CREATE POLICY "select_communication_providers" ON communication_providers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_communication_providers" ON communication_providers;
CREATE POLICY "insert_communication_providers" ON communication_providers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_communication_providers" ON communication_providers;
CREATE POLICY "update_communication_providers" ON communication_providers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. provider_connections
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  provider_id uuid NOT NULL REFERENCES communication_providers(id) ON DELETE CASCADE,
  provider_key text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected',
  connection_health text NOT NULL DEFAULT 'unknown',
  connected_account text,
  connected_account_id text,
  credentials jsonb NOT NULL DEFAULT '{}'::jsonb,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  token_expires_at timestamptz,
  last_sync_at timestamptz,
  last_health_check_at timestamptz,
  sync_cursor text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_provider_connections" ON provider_connections;
CREATE POLICY "select_own_provider_connections" ON provider_connections
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_connections.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "insert_own_provider_connections" ON provider_connections;
CREATE POLICY "insert_own_provider_connections" ON provider_connections
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_connections.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "update_own_provider_connections" ON provider_connections;
CREATE POLICY "update_own_provider_connections" ON provider_connections
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_connections.workspace_id
    AND workspaces.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_connections.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "delete_own_provider_connections" ON provider_connections;
CREATE POLICY "delete_own_provider_connections" ON provider_connections
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_connections.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

-- ============================================================
-- 3. provider_capabilities
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES communication_providers(id) ON DELETE CASCADE,
  capability_key text NOT NULL,
  capability_name text NOT NULL,
  is_supported boolean NOT NULL DEFAULT true,
  is_enabled boolean NOT NULL DEFAULT true,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, capability_key)
);

ALTER TABLE provider_capabilities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_provider_capabilities" ON provider_capabilities;
CREATE POLICY "select_provider_capabilities" ON provider_capabilities
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 4. provider_health
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES provider_connections(id) ON DELETE CASCADE,
  health_status text NOT NULL DEFAULT 'unknown',
  latency_ms integer,
  is_healthy boolean NOT NULL DEFAULT false,
  error_message text,
  consecutive_failures integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_provider_health" ON provider_health;
CREATE POLICY "select_own_provider_health" ON provider_health
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_health.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "insert_own_provider_health" ON provider_health;
CREATE POLICY "insert_own_provider_health" ON provider_health
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_health.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "update_own_provider_health" ON provider_health;
CREATE POLICY "update_own_provider_health" ON provider_health
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_health.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_health.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

-- ============================================================
-- 5. provider_events
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES provider_connections(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES communication_providers(id) ON DELETE SET NULL,
  workspace_id uuid,
  event_type text NOT NULL,
  event_status text NOT NULL DEFAULT 'info',
  message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_provider_events" ON provider_events;
CREATE POLICY "select_own_provider_events" ON provider_events
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_events.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "insert_own_provider_events" ON provider_events;
CREATE POLICY "insert_own_provider_events" ON provider_events
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_events.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

-- ============================================================
-- 6. provider_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES provider_connections(id) ON DELETE CASCADE,
  workspace_id uuid,
  operation text NOT NULL,
  direction text,
  message_id text,
  thread_id text,
  status text NOT NULL DEFAULT 'pending',
  latency_ms integer,
  request_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  response_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_provider_logs" ON provider_logs;
CREATE POLICY "select_own_provider_logs" ON provider_logs
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_logs.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "insert_own_provider_logs" ON provider_logs;
CREATE POLICY "insert_own_provider_logs" ON provider_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_logs.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

-- ============================================================
-- 7. provider_rate_limits
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES provider_connections(id) ON DELETE CASCADE,
  limit_window text NOT NULL DEFAULT 'per_minute',
  max_requests integer NOT NULL DEFAULT 60,
  current_count integer NOT NULL DEFAULT 0,
  reset_at timestamptz,
  remaining integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_provider_rate_limits" ON provider_rate_limits;
CREATE POLICY "select_own_provider_rate_limits" ON provider_rate_limits
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_rate_limits.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "insert_own_provider_rate_limits" ON provider_rate_limits;
CREATE POLICY "insert_own_provider_rate_limits" ON provider_rate_limits
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_rate_limits.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "update_own_provider_rate_limits" ON provider_rate_limits;
CREATE POLICY "update_own_provider_rate_limits" ON provider_rate_limits
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_rate_limits.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM provider_connections
    WHERE provider_connections.id = provider_rate_limits.connection_id
    AND EXISTS (
      SELECT 1 FROM workspaces
      WHERE workspaces.id = provider_connections.workspace_id
      AND workspaces.owner_id = auth.uid()
    )
  ));

-- ============================================================
-- 8. provider_webhooks
-- ============================================================

CREATE TABLE IF NOT EXISTS provider_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid REFERENCES provider_connections(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES communication_providers(id) ON DELETE SET NULL,
  workspace_id uuid,
  webhook_url text,
  webhook_secret text,
  subscribed_events text[] NOT NULL DEFAULT ARRAY[]::text[],
  webhook_status text NOT NULL DEFAULT 'active',
  raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_processed boolean NOT NULL DEFAULT false,
  processed_at timestamptz,
  processing_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE provider_webhooks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_provider_webhooks" ON provider_webhooks;
CREATE POLICY "select_own_provider_webhooks" ON provider_webhooks
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_webhooks.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "insert_own_provider_webhooks" ON provider_webhooks;
CREATE POLICY "insert_own_provider_webhooks" ON provider_webhooks
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_webhooks.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

DROP POLICY IF EXISTS "update_own_provider_webhooks" ON provider_webhooks;
CREATE POLICY "update_own_provider_webhooks" ON provider_webhooks
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_webhooks.workspace_id
    AND workspaces.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM workspaces
    WHERE workspaces.id = provider_webhooks.workspace_id
    AND workspaces.owner_id = auth.uid()
  ));

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_provider_connections_workspace ON provider_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_connections_provider ON provider_connections(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_connections_status ON provider_connections(status);
CREATE INDEX IF NOT EXISTS idx_provider_health_connection ON provider_health(connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_health_created ON provider_health(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_events_connection ON provider_events(connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_workspace ON provider_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_events_created ON provider_events(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_logs_connection ON provider_logs(connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_workspace ON provider_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_logs_created ON provider_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_rate_limits_connection ON provider_rate_limits(connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_webhooks_connection ON provider_webhooks(connection_id);
CREATE INDEX IF NOT EXISTS idx_provider_webhooks_workspace ON provider_webhooks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_provider_webhooks_created ON provider_webhooks(created_at);
CREATE INDEX IF NOT EXISTS idx_provider_capabilities_provider ON provider_capabilities(provider_id);

-- ============================================================
-- updated_at triggers
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_communication_providers_updated ON communication_providers;
CREATE TRIGGER trg_communication_providers_updated
  BEFORE UPDATE ON communication_providers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_connections_updated ON provider_connections;
CREATE TRIGGER trg_provider_connections_updated
  BEFORE UPDATE ON provider_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_provider_rate_limits_updated ON provider_rate_limits;
CREATE TRIGGER trg_provider_rate_limits_updated
  BEFORE UPDATE ON provider_rate_limits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- Seed provider definitions
-- ============================================================

INSERT INTO communication_providers (provider_key, provider_name, provider_type, auth_type, description, icon, color, priority, is_built_in, capabilities, default_scopes, docs_url)
VALUES
  ('gmail', 'Google Gmail', 'email', 'oauth', 'Send and receive emails through Google Gmail.', 'mail', '#ea4335', 10, true,
    ARRAY['send_message', 'schedule_message', 'cancel_message', 'search_messages', 'get_thread', 'get_message', 'list_folders', 'sync', 'register_webhook', 'process_webhook'],
    ARRAY['https://mail.google.com/', 'https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.readonly'],
    'https://developers.google.com/gmail/api'),
  ('outlook', 'Microsoft Outlook', 'email', 'oauth', 'Send and receive emails through Microsoft Outlook.', 'mail', '#0078d4', 20, true,
    ARRAY['send_message', 'schedule_message', 'cancel_message', 'search_messages', 'get_thread', 'get_message', 'list_folders', 'sync', 'register_webhook', 'process_webhook'],
    ARRAY['https://graph.microsoft.com/Mail.Send', 'https://graph.microsoft.com/Mail.Read'],
    'https://learn.microsoft.com/graph/api/resources/message'),
  ('linkedin_messaging', 'LinkedIn Messaging', 'messaging', 'oauth', 'Send messages through LinkedIn.', 'linkedin', '#0a66c2', 30, true,
    ARRAY['send_message', 'search_messages', 'get_thread', 'sync', 'register_webhook', 'process_webhook'],
    ARRAY['r_liteprofile', 'r_emailaddress', 'w_messages'],
    'https://learn.microsoft.com/linkedin/'),
  ('whatsapp_business', 'WhatsApp Business', 'messaging', 'api_key', 'Send messages through WhatsApp Business API.', 'message-circle', '#25d366', 40, true,
    ARRAY['send_message', 'schedule_message', 'register_webhook', 'process_webhook'],
    ARRAY[]::text[],
    'https://developers.facebook.com/docs/whatsapp'),
  ('slack', 'Slack', 'messaging', 'oauth', 'Send messages through Slack.', 'message-square', '#4a154b', 50, true,
    ARRAY['send_message', 'search_messages', 'get_thread', 'list_folders', 'sync', 'register_webhook', 'process_webhook'],
    ARRAY['chat:write', 'channels:read', 'channels:history'],
    'https://api.slack.com/docs'),
  ('microsoft_teams', 'Microsoft Teams', 'messaging', 'oauth', 'Send messages through Microsoft Teams.', 'users', '#6264a7', 60, true,
    ARRAY['send_message', 'search_messages', 'get_thread', 'list_folders', 'sync', 'register_webhook', 'process_webhook'],
    ARRAY['ChannelMessage.Send', 'Channel.Read.All'],
    'https://learn.microsoft.com/graph/api/'),
  ('twilio_sms', 'Twilio SMS', 'sms', 'api_key', 'Send SMS messages through Twilio.', 'smartphone', '#f22f46', 70, true,
    ARRAY['send_message', 'schedule_message', 'register_webhook', 'process_webhook'],
    ARRAY[]::text[],
    'https://www.twilio.com/docs/sms'),
  ('custom', 'Custom Provider', 'custom', 'api_key', 'Custom communication provider plug-in.', 'plug', '#6b7280', 90, true,
    ARRAY['send_message', 'schedule_message', 'search_messages', 'get_thread', 'get_message', 'list_folders', 'sync', 'register_webhook', 'process_webhook'],
    ARRAY[]::text[],
    ''),
  ('future', 'Future Provider', 'future', 'api_key', 'Placeholder for future communication platforms.', 'sparkles', '#9ca3af', 100, true,
    ARRAY[]::text[],
    ARRAY[]::text[],
    '')
ON CONFLICT (provider_key) DO UPDATE SET
  provider_name = EXCLUDED.provider_name,
  provider_type = EXCLUDED.provider_type,
  auth_type = EXCLUDED.auth_type,
  description = EXCLUDED.description,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  priority = EXCLUDED.priority,
  capabilities = EXCLUDED.capabilities,
  default_scopes = EXCLUDED.default_scopes,
  docs_url = EXCLUDED.docs_url,
  updated_at = now();
