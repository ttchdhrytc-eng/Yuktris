/*
# Phase 18: Enterprise Platform Schema — Part 3: White Label & Enterprise Admin

1. New Tables
- `white_label_settings` — Per-workspace white label configuration
- `custom_domains` — Custom domain mappings for white-labeled workspaces
- `branding_assets` — Logos, colors, fonts, CSS overrides
- `enterprise_organizations` — Enterprise org hierarchy (parent of workspaces)
- `enterprise_departments` — Departments within enterprise orgs
- `enterprise_regions` — Geographic regions for enterprise orgs
- `enterprise_business_units` — Business units within enterprise orgs
- `enterprise_teams` — Teams within workspaces
- `enterprise_roles` — Custom enterprise roles beyond the default 5
- `enterprise_audit_logs` — Enterprise-level audit trail
- `enterprise_sso_configs` — SSO/SAML configuration per enterprise org
- `enterprise_security_policies` — IP restrictions, password policies, session policies
- `enterprise_compliance` — SOC2, ISO, GDPR compliance tracking

2. Security
- All tables RLS enabled, workspace-scoped
- Enterprise audit logs are append-only
*/

CREATE TABLE IF NOT EXISTS white_label_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  is_white_labeled boolean NOT NULL DEFAULT false,
  platform_name text NOT NULL DEFAULT 'Revenue AI',
  platform_tagline text,
  custom_ai_name text,
  custom_ceo_name text,
  custom_agent_prefix text,
  custom_terminology jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_navigation jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  custom_footer text,
  custom_header text,
  login_page_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  email_template_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_template_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  report_template_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  dashboard_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_white_label_settings_workspace_id ON white_label_settings(workspace_id);
ALTER TABLE white_label_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_white_label" ON white_label_settings;
CREATE POLICY "select_own_white_label" ON white_label_settings FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = white_label_settings.workspace_id));
DROP POLICY IF EXISTS "insert_own_white_label" ON white_label_settings;
CREATE POLICY "insert_own_white_label" ON white_label_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = white_label_settings.workspace_id));
DROP POLICY IF EXISTS "update_own_white_label" ON white_label_settings;
CREATE POLICY "update_own_white_label" ON white_label_settings FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = white_label_settings.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = white_label_settings.workspace_id));
DROP POLICY IF EXISTS "delete_own_white_label" ON white_label_settings;
CREATE POLICY "delete_own_white_label" ON white_label_settings FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = white_label_settings.workspace_id));

CREATE TABLE IF NOT EXISTS custom_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL UNIQUE,
  domain_type text NOT NULL DEFAULT 'full',
  ssl_status text NOT NULL DEFAULT 'pending',
  dns_verified boolean NOT NULL DEFAULT false,
  dns_records jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_custom_domains_workspace_id ON custom_domains(workspace_id);
ALTER TABLE custom_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_custom_domains" ON custom_domains;
CREATE POLICY "select_own_custom_domains" ON custom_domains FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = custom_domains.workspace_id));
DROP POLICY IF EXISTS "insert_own_custom_domains" ON custom_domains;
CREATE POLICY "insert_own_custom_domains" ON custom_domains FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = custom_domains.workspace_id));
DROP POLICY IF EXISTS "update_own_custom_domains" ON custom_domains;
CREATE POLICY "update_own_custom_domains" ON custom_domains FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = custom_domains.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = custom_domains.workspace_id));
DROP POLICY IF EXISTS "delete_own_custom_domains" ON custom_domains;
CREATE POLICY "delete_own_custom_domains" ON custom_domains FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = custom_domains.workspace_id));

CREATE TABLE IF NOT EXISTS branding_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  asset_type text NOT NULL,
  asset_name text NOT NULL,
  asset_url text,
  asset_data jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_branding_assets_workspace_id ON branding_assets(workspace_id);
ALTER TABLE branding_assets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_branding_assets" ON branding_assets;
CREATE POLICY "select_own_branding_assets" ON branding_assets FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = branding_assets.workspace_id));
DROP POLICY IF EXISTS "insert_own_branding_assets" ON branding_assets;
CREATE POLICY "insert_own_branding_assets" ON branding_assets FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = branding_assets.workspace_id));
DROP POLICY IF EXISTS "update_own_branding_assets" ON branding_assets;
CREATE POLICY "update_own_branding_assets" ON branding_assets FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = branding_assets.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = branding_assets.workspace_id));
DROP POLICY IF EXISTS "delete_own_branding_assets" ON branding_assets;
CREATE POLICY "delete_own_branding_assets" ON branding_assets FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = branding_assets.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  org_name text NOT NULL,
  org_slug text NOT NULL,
  org_type text NOT NULL DEFAULT 'enterprise',
  parent_org_id uuid REFERENCES enterprise_organizations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  contract_type text,
  contract_start_date timestamptz,
  contract_end_date timestamptz,
  seat_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_organizations_workspace_id ON enterprise_organizations(workspace_id);
ALTER TABLE enterprise_organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_orgs" ON enterprise_organizations;
CREATE POLICY "select_own_enterprise_orgs" ON enterprise_organizations FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_organizations.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_orgs" ON enterprise_organizations;
CREATE POLICY "insert_own_enterprise_orgs" ON enterprise_organizations FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_organizations.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_orgs" ON enterprise_organizations;
CREATE POLICY "update_own_enterprise_orgs" ON enterprise_organizations FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_organizations.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_organizations.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_orgs" ON enterprise_organizations;
CREATE POLICY "delete_own_enterprise_orgs" ON enterprise_organizations FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_organizations.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enterprise_org_id uuid REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  department_name text NOT NULL,
  department_head_id uuid,
  budget_allocation numeric(12,2),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_departments_workspace_id ON enterprise_departments(workspace_id);
ALTER TABLE enterprise_departments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_depts" ON enterprise_departments;
CREATE POLICY "select_own_enterprise_depts" ON enterprise_departments FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_departments.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_depts" ON enterprise_departments;
CREATE POLICY "insert_own_enterprise_depts" ON enterprise_departments FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_departments.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_depts" ON enterprise_departments;
CREATE POLICY "update_own_enterprise_depts" ON enterprise_departments FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_departments.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_departments.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_depts" ON enterprise_departments;
CREATE POLICY "delete_own_enterprise_depts" ON enterprise_departments FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_departments.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enterprise_org_id uuid REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  region_name text NOT NULL,
  region_code text,
  countries text[] NOT NULL DEFAULT ARRAY[]::text[],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_regions_workspace_id ON enterprise_regions(workspace_id);
ALTER TABLE enterprise_regions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_regions" ON enterprise_regions;
CREATE POLICY "select_own_enterprise_regions" ON enterprise_regions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_regions.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_regions" ON enterprise_regions;
CREATE POLICY "insert_own_enterprise_regions" ON enterprise_regions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_regions.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_regions" ON enterprise_regions;
CREATE POLICY "update_own_enterprise_regions" ON enterprise_regions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_regions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_regions.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_regions" ON enterprise_regions;
CREATE POLICY "delete_own_enterprise_regions" ON enterprise_regions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_regions.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enterprise_org_id uuid REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  bu_name text NOT NULL,
  bu_code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_business_units_workspace_id ON enterprise_business_units(workspace_id);
ALTER TABLE enterprise_business_units ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_bus" ON enterprise_business_units;
CREATE POLICY "select_own_enterprise_bus" ON enterprise_business_units FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_business_units.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_bus" ON enterprise_business_units;
CREATE POLICY "insert_own_enterprise_bus" ON enterprise_business_units FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_business_units.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_bus" ON enterprise_business_units;
CREATE POLICY "update_own_enterprise_bus" ON enterprise_business_units FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_business_units.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_business_units.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_bus" ON enterprise_business_units;
CREATE POLICY "delete_own_enterprise_bus" ON enterprise_business_units FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_business_units.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  team_name text NOT NULL,
  team_description text,
  team_lead_id uuid,
  department_id uuid REFERENCES enterprise_departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_teams_workspace_id ON enterprise_teams(workspace_id);
ALTER TABLE enterprise_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_teams" ON enterprise_teams;
CREATE POLICY "select_own_enterprise_teams" ON enterprise_teams FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_teams.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_teams" ON enterprise_teams;
CREATE POLICY "insert_own_enterprise_teams" ON enterprise_teams FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_teams.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_teams" ON enterprise_teams;
CREATE POLICY "update_own_enterprise_teams" ON enterprise_teams FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_teams.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_teams.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_teams" ON enterprise_teams;
CREATE POLICY "delete_own_enterprise_teams" ON enterprise_teams FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_teams.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  resource_type text,
  resource_id text,
  ip_address text,
  user_agent text,
  severity text NOT NULL DEFAULT 'info',
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_workspace_id ON enterprise_audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_enterprise_audit_logs_created_at ON enterprise_audit_logs(created_at DESC);
ALTER TABLE enterprise_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_audit" ON enterprise_audit_logs;
CREATE POLICY "select_own_enterprise_audit" ON enterprise_audit_logs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_audit_logs.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_audit" ON enterprise_audit_logs;
CREATE POLICY "insert_own_enterprise_audit" ON enterprise_audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_audit_logs.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_sso_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  enterprise_org_id uuid REFERENCES enterprise_organizations(id) ON DELETE CASCADE,
  sso_type text NOT NULL DEFAULT 'saml',
  sso_entity_id text,
  sso_login_url text,
  sso_logout_url text,
  sso_certificate text,
  sso_metadata_url text,
  scim_endpoint_url text,
  scim_bearer_token_hash text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_sso_workspace_id ON enterprise_sso_configs(workspace_id);
ALTER TABLE enterprise_sso_configs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_sso" ON enterprise_sso_configs;
CREATE POLICY "select_own_enterprise_sso" ON enterprise_sso_configs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_sso_configs.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_sso" ON enterprise_sso_configs;
CREATE POLICY "insert_own_enterprise_sso" ON enterprise_sso_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_sso_configs.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_sso" ON enterprise_sso_configs;
CREATE POLICY "update_own_enterprise_sso" ON enterprise_sso_configs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_sso_configs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_sso_configs.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_sso" ON enterprise_sso_configs;
CREATE POLICY "delete_own_enterprise_sso" ON enterprise_sso_configs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_sso_configs.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_security_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  policy_type text NOT NULL,
  policy_name text NOT NULL,
  policy_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_enforced boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_security_policies_workspace_id ON enterprise_security_policies(workspace_id);
ALTER TABLE enterprise_security_policies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_security" ON enterprise_security_policies;
CREATE POLICY "select_own_enterprise_security" ON enterprise_security_policies FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_security_policies.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_security" ON enterprise_security_policies;
CREATE POLICY "insert_own_enterprise_security" ON enterprise_security_policies FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_security_policies.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_security" ON enterprise_security_policies;
CREATE POLICY "update_own_enterprise_security" ON enterprise_security_policies FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_security_policies.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_security_policies.workspace_id));
DROP POLICY IF EXISTS "delete_own_enterprise_security" ON enterprise_security_policies;
CREATE POLICY "delete_own_enterprise_security" ON enterprise_security_policies FOR DELETE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_security_policies.workspace_id));

CREATE TABLE IF NOT EXISTS enterprise_compliance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  compliance_type text NOT NULL,
  compliance_status text NOT NULL DEFAULT 'not_started',
  compliance_score integer,
  last_audit_date timestamptz,
  next_audit_date timestamptz,
  findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  remediation_plan jsonb,
  data_residency_region text,
  retention_policy_days integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_enterprise_compliance_workspace_id ON enterprise_compliance(workspace_id);
ALTER TABLE enterprise_compliance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "select_own_enterprise_compliance" ON enterprise_compliance;
CREATE POLICY "select_own_enterprise_compliance" ON enterprise_compliance FOR SELECT TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_compliance.workspace_id));
DROP POLICY IF EXISTS "insert_own_enterprise_compliance" ON enterprise_compliance;
CREATE POLICY "insert_own_enterprise_compliance" ON enterprise_compliance FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_compliance.workspace_id));
DROP POLICY IF EXISTS "update_own_enterprise_compliance" ON enterprise_compliance;
CREATE POLICY "update_own_enterprise_compliance" ON enterprise_compliance FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_compliance.workspace_id)) WITH CHECK (auth.uid() IN (SELECT user_id FROM workspace_members WHERE workspace_id = enterprise_compliance.workspace_id));