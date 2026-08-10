/*
# Phase 18: Enterprise Platform Schema — Part 1: API Platform & Developer Portal

1. New Tables
- `api_keys_v2` — API keys with scopes, rate limits, workspace isolation
- `api_oauth_clients` — OAuth2 client applications for API access
- `api_oauth_tokens` — OAuth2 access/refresh tokens
- `api_logs` — Request/response logs for all API calls
- `api_usage` — Aggregated usage metrics per workspace/key
- `api_rate_limits` — Rate limit configuration per workspace
- `api_versions` — API version metadata (v1, v2, etc.)
- `developer_apps` — Third-party developer applications
- `developer_users` — Developer portal user profiles
- `developer_organizations` — Developer organizations (companies building on the API)
- `developer_audit_logs` — Audit trail for developer portal actions
- `api_documentation` — Auto-generated API documentation entries

2. Security
- All tables have RLS enabled with workspace-scoped policies
- API keys are workspace-isolated
- Developer orgs are workspace-isolated
- Audit logs are append-only (no UPDATE/DELETE)

3. Notes
- All tables use uuid PKs with gen_random_uuid()
- All tables have created_at + updated_at
- workspace_id on every table for tenant isolation
- Indexes on workspace_id, key_hash, client_id
*/

-- API Keys
CREATE TABLE IF NOT EXISTS api_keys_v2 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  key_name text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  key_type text NOT NULL DEFAULT 'api_key',
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  expires_at timestamptz,
  last_used_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_v2_workspace_id ON api_keys_v2(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_v2_key_hash ON api_keys_v2(key_hash);
ALTER TABLE api_keys_v2 ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_api_keys" ON api_keys_v2;
CREATE POLICY "select_own_api_keys" ON api_keys_v2 FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_keys_v2.workspace_id));
DROP POLICY IF EXISTS "insert_own_api_keys" ON api_keys_v2;
CREATE POLICY "insert_own_api_keys" ON api_keys_v2 FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_keys_v2.workspace_id));
DROP POLICY IF EXISTS "update_own_api_keys" ON api_keys_v2;
CREATE POLICY "update_own_api_keys" ON api_keys_v2 FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_keys_v2.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_keys_v2.workspace_id));
DROP POLICY IF EXISTS "delete_own_api_keys" ON api_keys_v2;
CREATE POLICY "delete_own_api_keys" ON api_keys_v2 FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_keys_v2.workspace_id));

-- OAuth Clients
CREATE TABLE IF NOT EXISTS api_oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id text NOT NULL UNIQUE,
  client_secret_hash text NOT NULL,
  client_name text NOT NULL,
  redirect_uris text[] NOT NULL DEFAULT ARRAY[]::text[],
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  grant_types text[] NOT NULL DEFAULT ARRAY['authorization_code']::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_oauth_clients_workspace_id ON api_oauth_clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_oauth_clients_client_id ON api_oauth_clients(client_id);
ALTER TABLE api_oauth_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_oauth_clients" ON api_oauth_clients;
CREATE POLICY "select_own_oauth_clients" ON api_oauth_clients FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_clients.workspace_id));
DROP POLICY IF EXISTS "insert_own_oauth_clients" ON api_oauth_clients;
CREATE POLICY "insert_own_oauth_clients" ON api_oauth_clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_clients.workspace_id));
DROP POLICY IF EXISTS "update_own_oauth_clients" ON api_oauth_clients;
CREATE POLICY "update_own_oauth_clients" ON api_oauth_clients FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_clients.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_clients.workspace_id));
DROP POLICY IF EXISTS "delete_own_oauth_clients" ON api_oauth_clients;
CREATE POLICY "delete_own_oauth_clients" ON api_oauth_clients FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_clients.workspace_id));

-- OAuth Tokens
CREATE TABLE IF NOT EXISTS api_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  access_token_hash text NOT NULL,
  refresh_token_hash text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  expires_at timestamptz,
  refresh_expires_at timestamptz,
  revoked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_oauth_tokens_workspace_id ON api_oauth_tokens(workspace_id);
ALTER TABLE api_oauth_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_oauth_tokens" ON api_oauth_tokens;
CREATE POLICY "select_own_oauth_tokens" ON api_oauth_tokens FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_tokens.workspace_id));
DROP POLICY IF EXISTS "insert_own_oauth_tokens" ON api_oauth_tokens;
CREATE POLICY "insert_own_oauth_tokens" ON api_oauth_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_tokens.workspace_id));
DROP POLICY IF EXISTS "delete_own_oauth_tokens" ON api_oauth_tokens;
CREATE POLICY "delete_own_oauth_tokens" ON api_oauth_tokens FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_oauth_tokens.workspace_id));

-- API Logs
CREATE TABLE IF NOT EXISTS api_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  api_key_id uuid,
  endpoint text NOT NULL,
  method text NOT NULL,
  status_code integer NOT NULL,
  request_headers jsonb,
  request_body jsonb,
  response_headers jsonb,
  response_body jsonb,
  ip_address text,
  user_agent text,
  latency_ms integer,
  request_id text,
  api_version text DEFAULT 'v1',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_logs_workspace_id ON api_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_created_at ON api_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_endpoint ON api_logs(endpoint);
ALTER TABLE api_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_api_logs" ON api_logs;
CREATE POLICY "select_own_api_logs" ON api_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_logs.workspace_id));
DROP POLICY IF EXISTS "insert_own_api_logs" ON api_logs;
CREATE POLICY "insert_own_api_logs" ON api_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_logs.workspace_id));
DROP POLICY IF EXISTS "delete_own_api_logs" ON api_logs;
CREATE POLICY "delete_own_api_logs" ON api_logs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_logs.workspace_id));

-- API Usage
CREATE TABLE IF NOT EXISTS api_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  api_key_id uuid,
  usage_date date NOT NULL,
  request_count integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  total_cost numeric(12,4) NOT NULL DEFAULT 0,
  by_endpoint jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_method jsonb NOT NULL DEFAULT '{}'::jsonb,
  by_status jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_usage_workspace_id ON api_usage(workspace_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON api_usage(usage_date DESC);
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_api_usage" ON api_usage;
CREATE POLICY "select_own_api_usage" ON api_usage FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_usage.workspace_id));
DROP POLICY IF EXISTS "insert_own_api_usage" ON api_usage;
CREATE POLICY "insert_own_api_usage" ON api_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_usage.workspace_id));
DROP POLICY IF EXISTS "update_own_api_usage" ON api_usage;
CREATE POLICY "update_own_api_usage" ON api_usage FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_usage.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_usage.workspace_id));

-- API Rate Limits
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  plan_tier text NOT NULL DEFAULT 'free',
  requests_per_minute integer NOT NULL DEFAULT 60,
  requests_per_hour integer NOT NULL DEFAULT 1000,
  requests_per_day integer NOT NULL DEFAULT 10000,
  burst_limit integer NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_workspace_id ON api_rate_limits(workspace_id);
ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_api_rate_limits" ON api_rate_limits;
CREATE POLICY "select_own_api_rate_limits" ON api_rate_limits FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_rate_limits.workspace_id));
DROP POLICY IF EXISTS "insert_own_api_rate_limits" ON api_rate_limits;
CREATE POLICY "insert_own_api_rate_limits" ON api_rate_limits FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_rate_limits.workspace_id));
DROP POLICY IF EXISTS "update_own_api_rate_limits" ON api_rate_limits;
CREATE POLICY "update_own_api_rate_limits" ON api_rate_limits FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_rate_limits.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_rate_limits.workspace_id));

-- API Versions
CREATE TABLE IF NOT EXISTS api_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_string text NOT NULL,
  is_stable boolean NOT NULL DEFAULT false,
  is_deprecated boolean NOT NULL DEFAULT false,
  deprecation_date timestamptz,
  sunset_date timestamptz,
  release_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_versions_workspace_id ON api_versions(workspace_id);
ALTER TABLE api_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_api_versions" ON api_versions;
CREATE POLICY "select_own_api_versions" ON api_versions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_versions.workspace_id));
DROP POLICY IF EXISTS "insert_own_api_versions" ON api_versions;
CREATE POLICY "insert_own_api_versions" ON api_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_versions.workspace_id));
DROP POLICY IF EXISTS "update_own_api_versions" ON api_versions;
CREATE POLICY "update_own_api_versions" ON api_versions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_versions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_versions.workspace_id));

-- Developer Apps
CREATE TABLE IF NOT EXISTS developer_apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  developer_org_id uuid,
  app_name text NOT NULL,
  app_description text,
  app_status text NOT NULL DEFAULT 'draft',
  app_type text NOT NULL DEFAULT 'rest',
  api_key_id uuid,
  oauth_client_id text,
  webhook_url text,
  scopes text[] NOT NULL DEFAULT ARRAY[]::text[],
  rate_limit_tier text NOT NULL DEFAULT 'free',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_developer_apps_workspace_id ON developer_apps(workspace_id);
ALTER TABLE developer_apps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_developer_apps" ON developer_apps;
CREATE POLICY "select_own_developer_apps" ON developer_apps FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_apps.workspace_id));
DROP POLICY IF EXISTS "insert_own_developer_apps" ON developer_apps;
CREATE POLICY "insert_own_developer_apps" ON developer_apps FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_apps.workspace_id));
DROP POLICY IF EXISTS "update_own_developer_apps" ON developer_apps;
CREATE POLICY "update_own_developer_apps" ON developer_apps FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_apps.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_apps.workspace_id));
DROP POLICY IF EXISTS "delete_own_developer_apps" ON developer_apps;
CREATE POLICY "delete_own_developer_apps" ON developer_apps FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_apps.workspace_id));

-- Developer Users
CREATE TABLE IF NOT EXISTS developer_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  developer_org_id uuid,
  user_id uuid,
  email text NOT NULL,
  display_name text,
  role text NOT NULL DEFAULT 'developer',
  permissions text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_developer_users_workspace_id ON developer_users(workspace_id);
ALTER TABLE developer_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_developer_users" ON developer_users;
CREATE POLICY "select_own_developer_users" ON developer_users FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_users.workspace_id));
DROP POLICY IF EXISTS "insert_own_developer_users" ON developer_users;
CREATE POLICY "insert_own_developer_users" ON developer_users FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_users.workspace_id));
DROP POLICY IF EXISTS "update_own_developer_users" ON developer_users;
CREATE POLICY "update_own_developer_users" ON developer_users FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_users.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_users.workspace_id));

-- Developer Organizations
CREATE TABLE IF NOT EXISTS developer_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  org_name text NOT NULL,
  org_slug text NOT NULL,
  org_description text,
  org_status text NOT NULL DEFAULT 'active',
  plan_tier text NOT NULL DEFAULT 'free',
  billing_email text,
  api_key_id uuid,
  total_apps integer NOT NULL DEFAULT 0,
  total_requests integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_developer_organizations_workspace_id ON developer_organizations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_developer_organizations_slug ON developer_organizations(org_slug);
ALTER TABLE developer_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_developer_orgs" ON developer_organizations;
CREATE POLICY "select_own_developer_orgs" ON developer_organizations FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_organizations.workspace_id));
DROP POLICY IF EXISTS "insert_own_developer_orgs" ON developer_organizations;
CREATE POLICY "insert_own_developer_orgs" ON developer_organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_organizations.workspace_id));
DROP POLICY IF EXISTS "update_own_developer_orgs" ON developer_organizations;
CREATE POLICY "update_own_developer_orgs" ON developer_organizations FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_organizations.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_organizations.workspace_id));

-- Developer Audit Logs (append-only)
CREATE TABLE IF NOT EXISTS developer_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  developer_user_id uuid,
  developer_org_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_developer_audit_logs_workspace_id ON developer_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_developer_audit_logs_created_at ON developer_audit_logs(created_at DESC);
ALTER TABLE developer_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_dev_audit_logs" ON developer_audit_logs;
CREATE POLICY "select_own_dev_audit_logs" ON developer_audit_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_audit_logs.workspace_id));
DROP POLICY IF EXISTS "insert_own_dev_audit_logs" ON developer_audit_logs;
CREATE POLICY "insert_own_dev_audit_logs" ON developer_audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = developer_audit_logs.workspace_id));

-- API Documentation
CREATE TABLE IF NOT EXISTS api_documentation (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  api_version_id uuid,
  doc_version text NOT NULL,
  openapi_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
  swagger_spec jsonb,
  generated_at timestamptz,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_api_documentation_workspace_id ON api_documentation(workspace_id);
ALTER TABLE api_documentation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_api_docs" ON api_documentation;
CREATE POLICY "select_own_api_docs" ON api_documentation FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_documentation.workspace_id));
DROP POLICY IF EXISTS "insert_own_api_docs" ON api_documentation;
CREATE POLICY "insert_own_api_docs" ON api_documentation FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_documentation.workspace_id));
DROP POLICY IF EXISTS "update_own_api_docs" ON api_documentation;
CREATE POLICY "update_own_api_docs" ON api_documentation FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_documentation.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = api_documentation.workspace_id));

-- SDK Versions
CREATE TABLE IF NOT EXISTS sdk_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  language text NOT NULL,
  version text NOT NULL,
  download_url text,
  package_name text,
  package_registry text,
  is_stable boolean NOT NULL DEFAULT false,
  is_deprecated boolean NOT NULL DEFAULT false,
  release_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sdk_versions_workspace_id ON sdk_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sdk_versions_language ON sdk_versions(language);
ALTER TABLE sdk_versions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_sdk_versions" ON sdk_versions;
CREATE POLICY "select_own_sdk_versions" ON sdk_versions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = sdk_versions.workspace_id));
DROP POLICY IF EXISTS "insert_own_sdk_versions" ON sdk_versions;
CREATE POLICY "insert_own_sdk_versions" ON sdk_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = sdk_versions.workspace_id));
DROP POLICY IF EXISTS "update_own_sdk_versions" ON sdk_versions;
CREATE POLICY "update_own_sdk_versions" ON sdk_versions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = sdk_versions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = sdk_versions.workspace_id));