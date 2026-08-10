/*
# Phase 17 Part 1 — Enterprise Integration Hub: Providers, Connections, Accounts, Credentials, Scopes, Sync Jobs, Logs, Errors, Health, Status, Events, Triggers, Webhooks
*/

-- ============================================================
-- INTEGRATION PROVIDERS — catalog of all connectable apps
-- ============================================================
CREATE TABLE integration_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_key text NOT NULL UNIQUE,
  provider_name text NOT NULL,
  provider_category text NOT NULL CHECK (provider_category IN ('crm','marketing','communication','finance','calendar','meetings','storage','database','automation','ai_provider','documents','custom')),
  provider_description text,
  provider_logo text,
  provider_website text,
  auth_type text DEFAULT 'oauth2' CHECK (auth_type IN ('oauth2','api_key','basic','bearer','custom','none')),
  oauth_authorize_url text,
  oauth_token_url text,
  oauth_refresh_url text,
  oauth_scopes text[] DEFAULT '{}',
  default_scopes text[] DEFAULT '{}',
  api_base_url text,
  api_version text DEFAULT 'v1',
  webhook_url_template text,
  rate_limit_per_minute integer DEFAULT 60,
  rate_limit_per_hour integer DEFAULT 1000,
  is_active boolean DEFAULT true,
  is_popular boolean DEFAULT false,
  is_enterprise boolean DEFAULT false,
  setup_instructions text,
  documentation_url text,
  sdk_available boolean DEFAULT false,
  version text DEFAULT '1.0.0',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_providers_category ON integration_providers(provider_category);
CREATE INDEX idx_integration_providers_active ON integration_providers(is_active) WHERE is_active = true;
ALTER TABLE integration_providers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_providers" ON integration_providers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_integration_providers" ON integration_providers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_integration_providers" ON integration_providers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_integration_providers" ON integration_providers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INTEGRATION CONNECTIONS — workspace-level connections
-- ============================================================
CREATE TABLE integration_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  connection_name text NOT NULL,
  connection_status text DEFAULT 'disconnected' CHECK (connection_status IN ('disconnected','connecting','connected','error','expired','revoked','paused')),
  auth_type text NOT NULL CHECK (auth_type IN ('oauth2','api_key','basic','bearer','custom','none')),
  external_account_id text,
  external_account_name text,
  external_account_email text,
  external_metadata jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text,
  sync_frequency text DEFAULT 'manual' CHECK (sync_frequency IN ('realtime','hourly','daily','weekly','manual')),
  is_active boolean DEFAULT true,
  auto_sync boolean DEFAULT false,
  ai_reasoning text,
  version integer DEFAULT 1,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_integration_connections_ws_provider ON integration_connections(workspace_id, provider_id);
CREATE INDEX idx_integration_connections_workspace ON integration_connections(workspace_id);
CREATE INDEX idx_integration_connections_status ON integration_connections(connection_status);
ALTER TABLE integration_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_connections" ON integration_connections FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_connections.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_connections" ON integration_connections FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_connections.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_connections" ON integration_connections FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_connections.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_connections.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_connections" ON integration_connections FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_connections.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION CREDENTIALS — encrypted credential store
-- ============================================================
CREATE TABLE integration_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  credential_type text NOT NULL CHECK (credential_type IN ('oauth_access_token','oauth_refresh_token','api_key','basic_auth','bearer_token','custom','client_secret')),
  encrypted_value text NOT NULL,
  expires_at timestamptz,
  scopes text[] DEFAULT '{}',
  is_valid boolean DEFAULT true,
  last_validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_credentials_connection ON integration_credentials(connection_id);
ALTER TABLE integration_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_credentials" ON integration_credentials FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_credentials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_credentials" ON integration_credentials FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_credentials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_credentials" ON integration_credentials FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_credentials.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_credentials.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_credentials" ON integration_credentials FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_credentials.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION SCOPES
-- ============================================================
CREATE TABLE integration_scopes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  scope_name text NOT NULL,
  scope_description text,
  is_granted boolean DEFAULT true,
  granted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_scopes_connection ON integration_scopes(connection_id);
ALTER TABLE integration_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_scopes" ON integration_scopes FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scopes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_scopes" ON integration_scopes FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scopes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_scopes" ON integration_scopes FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scopes.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scopes.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_scopes" ON integration_scopes FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scopes.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION SYNC JOBS
-- ============================================================
CREATE TABLE integration_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  sync_type text NOT NULL CHECK (sync_type IN ('full','incremental','delta','realtime','manual','scheduled')),
  sync_direction text DEFAULT 'bidirectional' CHECK (sync_direction IN ('import','export','bidirectional')),
  entity_type text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','cancelled','retrying','dead_letter')),
  total_records integer DEFAULT 0,
  processed_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  duration_ms integer,
  error_message text,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  next_retry_at timestamptz,
  sync_payload jsonb DEFAULT '{}'::jsonb,
  result_summary jsonb DEFAULT '{}'::jsonb,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_sync_jobs_workspace ON integration_sync_jobs(workspace_id);
CREATE INDEX idx_integration_sync_jobs_connection ON integration_sync_jobs(connection_id);
CREATE INDEX idx_integration_sync_jobs_status ON integration_sync_jobs(status);
ALTER TABLE integration_sync_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_sync_jobs" ON integration_sync_jobs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_sync_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_sync_jobs" ON integration_sync_jobs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_sync_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_sync_jobs" ON integration_sync_jobs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_sync_jobs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_sync_jobs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_sync_jobs" ON integration_sync_jobs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_sync_jobs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION ERRORS
-- ============================================================
CREATE TABLE integration_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  sync_job_id uuid REFERENCES integration_sync_jobs(id) ON DELETE SET NULL,
  error_code text,
  error_type text NOT NULL CHECK (error_type IN ('auth','rate_limit','network','validation','server','timeout','permission','data','conflict','unknown')),
  error_message text NOT NULL,
  error_details jsonb DEFAULT '{}'::jsonb,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolution text,
  retry_count integer DEFAULT 0,
  is_dead_letter boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_errors_workspace ON integration_errors(workspace_id);
CREATE INDEX idx_integration_errors_unresolved ON integration_errors(is_resolved) WHERE is_resolved = false;
CREATE INDEX idx_integration_errors_dead_letter ON integration_errors(is_dead_letter) WHERE is_dead_letter = true;
ALTER TABLE integration_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_errors" ON integration_errors FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_errors.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_errors" ON integration_errors FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_errors.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_errors" ON integration_errors FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_errors.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_errors.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_errors" ON integration_errors FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_errors.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION HEALTH
-- ============================================================
CREATE TABLE integration_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  health_score numeric(5,2) DEFAULT 100,
  health_status text DEFAULT 'healthy' CHECK (health_status IN ('healthy','degraded','unhealthy','critical','unknown')),
  latency_ms integer DEFAULT 0,
  error_rate numeric(5,2) DEFAULT 0,
  success_rate numeric(5,2) DEFAULT 100,
  last_check_at timestamptz NOT NULL DEFAULT now(),
  uptime_percent numeric(5,2) DEFAULT 100,
  consecutive_failures integer DEFAULT 0,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_integration_health_connection ON integration_health(connection_id);
ALTER TABLE integration_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_health" ON integration_health FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_health" ON integration_health FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_health" ON integration_health FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_health.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_health.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_health" ON integration_health FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_health.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION EVENTS
-- ============================================================
CREATE TABLE integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('connected','disconnected','sync_started','sync_completed','sync_failed','token_refreshed','token_expired','credential_rotated','webhook_received','webhook_processed','webhook_failed','error','health_check','config_changed','scope_changed','paused','resumed')),
  event_name text NOT NULL,
  event_description text,
  event_data jsonb DEFAULT '{}'::jsonb,
  severity text DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_events_workspace ON integration_events(workspace_id);
CREATE INDEX idx_integration_events_connection ON integration_events(connection_id);
CREATE INDEX idx_integration_events_created ON integration_events(created_at DESC);
ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_events" ON integration_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_events" ON integration_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_events" ON integration_events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_events.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_events" ON integration_events FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_events.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION TRIGGERS
-- ============================================================
CREATE TABLE integration_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  trigger_name text NOT NULL,
  trigger_type text DEFAULT 'event' CHECK (trigger_type IN ('event','schedule','threshold','condition','manual','webhook')),
  trigger_condition jsonb DEFAULT '{}'::jsonb,
  trigger_action text NOT NULL,
  action_config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  last_fired_at timestamptz,
  fire_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_triggers_connection ON integration_triggers(connection_id);
ALTER TABLE integration_triggers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_triggers" ON integration_triggers FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_triggers.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_triggers" ON integration_triggers FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_triggers.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_triggers" ON integration_triggers FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_triggers.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_triggers.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_triggers" ON integration_triggers FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_triggers.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION WEBHOOKS
-- ============================================================
CREATE TABLE integration_webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  webhook_name text NOT NULL,
  webhook_url text NOT NULL,
  webhook_secret text,
  subscribed_events text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  last_triggered_at timestamptz,
  trigger_count integer DEFAULT 0,
  failure_count integer DEFAULT 0,
  last_response_code integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_webhooks_workspace ON integration_webhooks(workspace_id);
ALTER TABLE integration_webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_webhooks" ON integration_webhooks FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhooks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_webhooks" ON integration_webhooks FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhooks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_webhooks" ON integration_webhooks FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhooks.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhooks.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_webhooks" ON integration_webhooks FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhooks.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION WEBHOOK EVENTS
-- ============================================================
CREATE TABLE integration_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  webhook_id uuid REFERENCES integration_webhooks(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  event_name text NOT NULL,
  event_payload jsonb DEFAULT '{}'::jsonb,
  processing_status text DEFAULT 'pending' CHECK (processing_status IN ('pending','processing','processed','failed','dead_letter')),
  processed_at timestamptz,
  response_code integer,
  error_message text,
  retry_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_webhook_events_workspace ON integration_webhook_events(workspace_id);
CREATE INDEX idx_integration_webhook_events_pending ON integration_webhook_events(processing_status) WHERE processing_status = 'pending';
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_webhook_events" ON integration_webhook_events FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhook_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_webhook_events" ON integration_webhook_events FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhook_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_webhook_events" ON integration_webhook_events FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhook_events.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhook_events.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_webhook_events" ON integration_webhook_events FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_webhook_events.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION API KEYS (for external API access to our platform)
-- ============================================================
CREATE TABLE integration_api_keys_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  key_type text DEFAULT 'api_key' CHECK (key_type IN ('api_key','service_account','webhook_secret')),
  scopes text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  last_used_at timestamptz,
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_api_keys_v2_workspace ON integration_api_keys_v2(workspace_id);
CREATE INDEX idx_integration_api_keys_v2_hash ON integration_api_keys_v2(key_hash);
ALTER TABLE integration_api_keys_v2 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_api_keys_v2" ON integration_api_keys_v2 FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_api_keys_v2.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_api_keys_v2" ON integration_api_keys_v2 FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_api_keys_v2.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_api_keys_v2" ON integration_api_keys_v2 FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_api_keys_v2.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_api_keys_v2.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_api_keys_v2" ON integration_api_keys_v2 FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_api_keys_v2.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION RATE LIMITS
-- ============================================================
CREATE TABLE integration_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  limit_period text DEFAULT 'minute' CHECK (limit_period IN ('second','minute','hour','day')),
  limit_value integer NOT NULL,
  current_count integer DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now(),
  reset_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_rate_limits_connection ON integration_rate_limits(connection_id);
ALTER TABLE integration_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_rate_limits" ON integration_rate_limits FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_rate_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_rate_limits" ON integration_rate_limits FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_rate_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_rate_limits" ON integration_rate_limits FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_rate_limits.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_rate_limits.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_rate_limits" ON integration_rate_limits FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_rate_limits.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION USAGE
-- ============================================================
CREATE TABLE integration_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT CURRENT_DATE,
  api_calls integer DEFAULT 0,
  sync_runs integer DEFAULT 0,
  webhooks_received integer DEFAULT 0,
  records_synced integer DEFAULT 0,
  data_transferred_mb numeric(10,2) DEFAULT 0,
  error_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_usage_connection ON integration_usage(connection_id);
CREATE INDEX idx_integration_usage_date ON integration_usage(usage_date DESC);
ALTER TABLE integration_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_usage" ON integration_usage FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_usage" ON integration_usage FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_usage" ON integration_usage FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_usage.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_usage.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_usage" ON integration_usage FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_usage.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION FIELD MAPPING
-- ============================================================
CREATE TABLE integration_field_mapping (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  source_field text NOT NULL,
  target_field text NOT NULL,
  transformation_rule text,
  is_required boolean DEFAULT false,
  default_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_field_mapping_connection ON integration_field_mapping(connection_id);
ALTER TABLE integration_field_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_field_mapping" ON integration_field_mapping FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_field_mapping.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_field_mapping" ON integration_field_mapping FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_field_mapping.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_field_mapping" ON integration_field_mapping FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_field_mapping.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_field_mapping.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_field_mapping" ON integration_field_mapping FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_field_mapping.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION SCHEMA (external entity schemas)
-- ============================================================
CREATE TABLE integration_schema (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  schema_definition jsonb NOT NULL DEFAULT '{}'::jsonb,
  field_count integer DEFAULT 0,
  is_cached boolean DEFAULT true,
  cached_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_schema_connection ON integration_schema(connection_id);
ALTER TABLE integration_schema ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_schema" ON integration_schema FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_schema.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_schema" ON integration_schema FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_schema.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_schema" ON integration_schema FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_schema.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_schema.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_schema" ON integration_schema FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_schema.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION TRANSFORMATIONS
-- ============================================================
CREATE TABLE integration_transformations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  transformation_name text NOT NULL,
  entity_type text NOT NULL,
  transformation_type text DEFAULT 'mapping' CHECK (transformation_type IN ('mapping','filter','enrich','aggregate','custom','ai_enrichment')),
  transformation_rule jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_transformations_connection ON integration_transformations(connection_id);
ALTER TABLE integration_transformations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_transformations" ON integration_transformations FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_transformations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_transformations" ON integration_transformations FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_transformations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_transformations" ON integration_transformations FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_transformations.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_transformations.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_transformations" ON integration_transformations FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_transformations.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION CONFLICTS
-- ============================================================
CREATE TABLE integration_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  sync_job_id uuid REFERENCES integration_sync_jobs(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  conflict_type text DEFAULT 'data_mismatch' CHECK (conflict_type IN ('data_mismatch','duplicate','missing_field','type_mismatch','version_conflict','permission_denied')),
  source_data jsonb DEFAULT '{}'::jsonb,
  target_data jsonb DEFAULT '{}'::jsonb,
  resolution_strategy text CHECK (resolution_strategy IN ('source_wins','target_wins','manual','merge','ai_resolve')),
  resolution_data jsonb DEFAULT '{}'::jsonb,
  is_resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id),
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_conflicts_workspace ON integration_conflicts(workspace_id);
CREATE INDEX idx_integration_conflicts_unresolved ON integration_conflicts(is_resolved) WHERE is_resolved = false;
ALTER TABLE integration_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_conflicts" ON integration_conflicts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_conflicts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_conflicts" ON integration_conflicts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_conflicts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_conflicts" ON integration_conflicts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_conflicts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_conflicts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_conflicts" ON integration_conflicts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_conflicts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION RETRIES
-- ============================================================
CREATE TABLE integration_retries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  sync_job_id uuid REFERENCES integration_sync_jobs(id) ON DELETE SET NULL,
  retry_type text NOT NULL CHECK (retry_type IN ('sync','webhook','auth','api_call','export','import')),
  retry_attempt integer NOT NULL DEFAULT 1,
  max_retries integer DEFAULT 3,
  next_retry_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','succeeded','failed','exhausted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_retries_pending ON integration_retries(status) WHERE status = 'pending';
ALTER TABLE integration_retries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_retries" ON integration_retries FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_retries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_retries" ON integration_retries FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_retries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_retries" ON integration_retries FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_retries.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_retries.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_retries" ON integration_retries FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_retries.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS
-- ============================================================
CREATE OR REPLACE FUNCTION update_integration_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'integration_providers','integration_connections','integration_credentials','integration_sync_jobs',
    'integration_health','integration_triggers','integration_webhooks','integration_api_keys_v2',
    'integration_rate_limits','integration_field_mapping','integration_schema','integration_transformations',
    'integration_conflicts','integration_retries'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_ei_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_ei_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_integration_updated_at();', t, t);
  END LOOP;
END $$;
