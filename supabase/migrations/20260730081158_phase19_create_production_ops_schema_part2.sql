/*
# Phase 19 — Production Operations Platform (Part 2/3)

## Security, Backup, DevOps, Feature Flags & System Health Tables

### New Tables (16)
1. security_events — Security event log (logins, access changes, suspicious activity)
2. security_alerts — Alert-level security incidents with severity and status
3. mfa_sessions — Multi-factor auth session tracking
4. feature_flags — Feature flag definitions with rollout config
5. feature_rollouts — Per-flag rollout state (percentage, workspace, role)
6. release_versions — Release version tracking with changelog
7. deployment_history — Deployment records with environment, status, rollback
8. environment_configs — Environment variable configs per environment
9. backup_jobs — Backup job definitions and schedules
10. backup_history — Backup execution records
11. restore_history — Restore execution records
12. system_health — Component health status snapshots
13. system_incidents — Incident records with severity and status
14. incident_timelines — Incident timeline events (updates, acknowledgements, resolutions)
15. platform_metrics — Aggregated platform-level KPIs
16. system_settings — Platform-wide configuration settings

### Security
- RLS enabled on every table
- 4 CRUD policies per table scoped via workspace_members join
*/

-- 1. security_events
CREATE TABLE IF NOT EXISTS security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('login','logout','login_failed','password_change','mfa_enabled','mfa_disabled','api_key_created','api_key_revoked','token_refresh','suspicious_activity','brute_force_detected','rate_limit_exceeded','permission_change','role_change','data_export','config_change','session_revoked','device_trust_change')),
  event_severity text NOT NULL DEFAULT 'info' CHECK (event_severity IN ('info','low','medium','high','critical')),
  event_source text NOT NULL,
  user_id uuid,
  ip_address text,
  user_agent text,
  event_data jsonb DEFAULT '{}'::jsonb,
  risk_score numeric DEFAULT 0,
  is_resolved boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_security_events_workspace ON security_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(event_severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created ON security_events(created_at DESC);

DROP POLICY IF EXISTS "select_own_security_events" ON security_events;
CREATE POLICY "select_own_security_events" ON security_events FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_events.workspace_id));
DROP POLICY IF EXISTS "insert_own_security_events" ON security_events;
CREATE POLICY "insert_own_security_events" ON security_events FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_events.workspace_id));
DROP POLICY IF EXISTS "update_own_security_events" ON security_events;
CREATE POLICY "update_own_security_events" ON security_events FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_events.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_events.workspace_id));
DROP POLICY IF EXISTS "delete_own_security_events" ON security_events;
CREATE POLICY "delete_own_security_events" ON security_events FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_events.workspace_id));

-- 2. security_alerts
CREATE TABLE IF NOT EXISTS security_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  alert_type text NOT NULL CHECK (alert_type IN ('brute_force','credential_stuffing','api_abuse','suspicious_login','rate_limit_violation','unauthorized_access','data_exfiltration','malware_detected','config_drift','certificate_expiring','vulnerability_detected','policy_violation')),
  alert_severity text NOT NULL DEFAULT 'medium' CHECK (alert_severity IN ('low','medium','high','critical')),
  alert_status text NOT NULL DEFAULT 'open' CHECK (alert_status IN ('open','acknowledged','investigating','resolved','false_positive','ignored')),
  alert_title text NOT NULL,
  alert_description text,
  alert_source text NOT NULL,
  affected_resource text,
  affected_user_id uuid,
  recommended_actions jsonb DEFAULT '[]'::jsonb,
  evidence jsonb DEFAULT '{}'::jsonb,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  resolved_by uuid,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE security_alerts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_security_alerts_workspace ON security_alerts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(alert_severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(alert_status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at DESC);

DROP POLICY IF EXISTS "select_own_security_alerts" ON security_alerts;
CREATE POLICY "select_own_security_alerts" ON security_alerts FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_alerts.workspace_id));
DROP POLICY IF EXISTS "insert_own_security_alerts" ON security_alerts;
CREATE POLICY "insert_own_security_alerts" ON security_alerts FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_alerts.workspace_id));
DROP POLICY IF EXISTS "update_own_security_alerts" ON security_alerts;
CREATE POLICY "update_own_security_alerts" ON security_alerts FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_alerts.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_alerts.workspace_id));
DROP POLICY IF EXISTS "delete_own_security_alerts" ON security_alerts;
CREATE POLICY "delete_own_security_alerts" ON security_alerts FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = security_alerts.workspace_id));

-- 3. mfa_sessions
CREATE TABLE IF NOT EXISTS mfa_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  user_id uuid NOT NULL,
  mfa_method text NOT NULL CHECK (mfa_method IN ('totp','sms','email','backup_code','hardware_key','push_notification')),
  mfa_status text NOT NULL DEFAULT 'pending' CHECK (mfa_status IN ('pending','verified','failed','expired')),
  device_id text,
  device_trust_score numeric DEFAULT 0,
  session_token text,
  verified_at timestamptz,
  expires_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE mfa_sessions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_workspace ON mfa_sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user ON mfa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_status ON mfa_sessions(mfa_status);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_created ON mfa_sessions(created_at DESC);

DROP POLICY IF EXISTS "select_own_mfa_sessions" ON mfa_sessions;
CREATE POLICY "select_own_mfa_sessions" ON mfa_sessions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = mfa_sessions.workspace_id));
DROP POLICY IF EXISTS "insert_own_mfa_sessions" ON mfa_sessions;
CREATE POLICY "insert_own_mfa_sessions" ON mfa_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = mfa_sessions.workspace_id));
DROP POLICY IF EXISTS "update_own_mfa_sessions" ON mfa_sessions;
CREATE POLICY "update_own_mfa_sessions" ON mfa_sessions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = mfa_sessions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = mfa_sessions.workspace_id));
DROP POLICY IF EXISTS "delete_own_mfa_sessions" ON mfa_sessions;
CREATE POLICY "delete_own_mfa_sessions" ON mfa_sessions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = mfa_sessions.workspace_id));

-- 4. feature_flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  flag_key text NOT NULL,
  flag_name text NOT NULL,
  flag_description text,
  flag_type text NOT NULL DEFAULT 'boolean' CHECK (flag_type IN ('boolean','percentage','string','json','kill_switch')),
  is_enabled boolean NOT NULL DEFAULT false,
  is_kill_switch boolean NOT NULL DEFAULT false,
  rollout_strategy text NOT NULL DEFAULT 'off' CHECK (rollout_strategy IN ('off','global','percentage','workspace','role','beta','ab_test','gradual')),
  rollout_percentage numeric NOT NULL DEFAULT 0 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_workspaces text[] DEFAULT '{}'::text[],
  target_roles text[] DEFAULT '{}'::text[],
  flag_config jsonb DEFAULT '{}'::jsonb,
  flag_variants jsonb DEFAULT '[]'::jsonb,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_feature_flags_workspace ON feature_flags(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feature_flags_key ON feature_flags(flag_key);
CREATE INDEX IF NOT EXISTS idx_feature_flags_enabled ON feature_flags(is_enabled);
CREATE INDEX IF NOT EXISTS idx_feature_flags_type ON feature_flags(flag_type);

DROP POLICY IF EXISTS "select_own_feature_flags" ON feature_flags;
CREATE POLICY "select_own_feature_flags" ON feature_flags FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_flags.workspace_id));
DROP POLICY IF EXISTS "insert_own_feature_flags" ON feature_flags;
CREATE POLICY "insert_own_feature_flags" ON feature_flags FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_flags.workspace_id));
DROP POLICY IF EXISTS "update_own_feature_flags" ON feature_flags;
CREATE POLICY "update_own_feature_flags" ON feature_flags FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_flags.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_flags.workspace_id));
DROP POLICY IF EXISTS "delete_own_feature_flags" ON feature_flags;
CREATE POLICY "delete_own_feature_flags" ON feature_flags FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_flags.workspace_id));

-- 5. feature_rollouts
CREATE TABLE IF NOT EXISTS feature_rollouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  flag_id uuid NOT NULL,
  rollout_status text NOT NULL DEFAULT 'planned' CHECK (rollout_status IN ('planned','in_progress','paused','completed','rolled_back','cancelled')),
  rollout_percentage numeric NOT NULL DEFAULT 0,
  target_segment text,
  rollout_config jsonb DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  rolled_back_at timestamptz,
  rollback_reason text,
  experiment_id text,
  control_variant text,
  treatment_variant text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE feature_rollouts ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_workspace ON feature_rollouts(workspace_id);
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_flag ON feature_rollouts(flag_id);
CREATE INDEX IF NOT EXISTS idx_feature_rollouts_status ON feature_rollouts(rollout_status);

DROP POLICY IF EXISTS "select_own_feature_rollouts" ON feature_rollouts;
CREATE POLICY "select_own_feature_rollouts" ON feature_rollouts FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_rollouts.workspace_id));
DROP POLICY IF EXISTS "insert_own_feature_rollouts" ON feature_rollouts;
CREATE POLICY "insert_own_feature_rollouts" ON feature_rollouts FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_rollouts.workspace_id));
DROP POLICY IF EXISTS "update_own_feature_rollouts" ON feature_rollouts;
CREATE POLICY "update_own_feature_rollouts" ON feature_rollouts FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_rollouts.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_rollouts.workspace_id));
DROP POLICY IF EXISTS "delete_own_feature_rollouts" ON feature_rollouts;
CREATE POLICY "delete_own_feature_rollouts" ON feature_rollouts FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = feature_rollouts.workspace_id));

-- 6. release_versions
CREATE TABLE IF NOT EXISTS release_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  version_number text NOT NULL,
  version_label text,
  release_channel text NOT NULL DEFAULT 'stable' CHECK (release_channel IN ('stable','beta','canary','internal')),
  release_notes text,
  changelog jsonb DEFAULT '[]'::jsonb,
  is_breaking_change boolean DEFAULT false,
  is_deployed boolean DEFAULT false,
  is_rolled_back boolean DEFAULT false,
  deployed_at timestamptz,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE release_versions ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_release_versions_workspace ON release_versions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_release_versions_version ON release_versions(version_number);
CREATE INDEX IF NOT EXISTS idx_release_versions_channel ON release_versions(release_channel);

DROP POLICY IF EXISTS "select_own_release_versions" ON release_versions;
CREATE POLICY "select_own_release_versions" ON release_versions FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = release_versions.workspace_id));
DROP POLICY IF EXISTS "insert_own_release_versions" ON release_versions;
CREATE POLICY "insert_own_release_versions" ON release_versions FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = release_versions.workspace_id));
DROP POLICY IF EXISTS "update_own_release_versions" ON release_versions;
CREATE POLICY "update_own_release_versions" ON release_versions FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = release_versions.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = release_versions.workspace_id));
DROP POLICY IF EXISTS "delete_own_release_versions" ON release_versions;
CREATE POLICY "delete_own_release_versions" ON release_versions FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = release_versions.workspace_id));

-- 7. deployment_history
CREATE TABLE IF NOT EXISTS deployment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  release_version_id uuid,
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  deployment_status text NOT NULL DEFAULT 'pending' CHECK (deployment_status IN ('pending','in_progress','succeeded','failed','rolled_back','cancelled')),
  deployment_strategy text NOT NULL DEFAULT 'rolling' CHECK (deployment_strategy IN ('rolling','blue_green','canary','recreate')),
  commit_sha text,
  branch text,
  deployed_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  health_check_status text CHECK (health_check_status IN ('passing','failing','pending','skipped')),
  health_check_url text,
  rollback_of uuid,
  deployment_logs jsonb DEFAULT '[]'::jsonb,
  deployment_metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE deployment_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_deployment_history_workspace ON deployment_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_deployment_history_env ON deployment_history(environment);
CREATE INDEX IF NOT EXISTS idx_deployment_history_status ON deployment_history(deployment_status);
CREATE INDEX IF NOT EXISTS idx_deployment_history_created ON deployment_history(created_at DESC);

DROP POLICY IF EXISTS "select_own_deployment_history" ON deployment_history;
CREATE POLICY "select_own_deployment_history" ON deployment_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = deployment_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_deployment_history" ON deployment_history;
CREATE POLICY "insert_own_deployment_history" ON deployment_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = deployment_history.workspace_id));
DROP POLICY IF EXISTS "update_own_deployment_history" ON deployment_history;
CREATE POLICY "update_own_deployment_history" ON deployment_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = deployment_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = deployment_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_deployment_history" ON deployment_history;
CREATE POLICY "delete_own_deployment_history" ON deployment_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = deployment_history.workspace_id));

-- 8. environment_configs
CREATE TABLE IF NOT EXISTS environment_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  config_key text NOT NULL,
  config_value text,
  config_type text NOT NULL DEFAULT 'string' CHECK (config_type IN ('string','integer','boolean','json','secret','url')),
  is_secret boolean NOT NULL DEFAULT false,
  is_required boolean DEFAULT false,
  description text,
  default_value text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE environment_configs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_env_configs_workspace ON environment_configs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_env_configs_env ON environment_configs(environment);
CREATE INDEX IF NOT EXISTS idx_env_configs_key ON environment_configs(config_key);

DROP POLICY IF EXISTS "select_own_environment_configs" ON environment_configs;
CREATE POLICY "select_own_environment_configs" ON environment_configs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = environment_configs.workspace_id));
DROP POLICY IF EXISTS "insert_own_environment_configs" ON environment_configs;
CREATE POLICY "insert_own_environment_configs" ON environment_configs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = environment_configs.workspace_id));
DROP POLICY IF EXISTS "update_own_environment_configs" ON environment_configs;
CREATE POLICY "update_own_environment_configs" ON environment_configs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = environment_configs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = environment_configs.workspace_id));
DROP POLICY IF EXISTS "delete_own_environment_configs" ON environment_configs;
CREATE POLICY "delete_own_environment_configs" ON environment_configs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = environment_configs.workspace_id));

-- 9. backup_jobs
CREATE TABLE IF NOT EXISTS backup_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  job_name text NOT NULL,
  backup_type text NOT NULL CHECK (backup_type IN ('database','config','knowledge_graph','memory','storage','full','incremental')),
  backup_scope text NOT NULL DEFAULT 'workspace' CHECK (backup_scope IN ('workspace','global','module')),
  target_module text,
  schedule_cron text,
  is_scheduled boolean DEFAULT false,
  is_active boolean DEFAULT true,
  retention_days integer NOT NULL DEFAULT 30,
  storage_location text,
  max_backups integer DEFAULT 10,
  encryption_enabled boolean DEFAULT true,
  compression_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE backup_jobs ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_backup_jobs_workspace ON backup_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_type ON backup_jobs(backup_type);
CREATE INDEX IF NOT EXISTS idx_backup_jobs_active ON backup_jobs(is_active);

DROP POLICY IF EXISTS "select_own_backup_jobs" ON backup_jobs;
CREATE POLICY "select_own_backup_jobs" ON backup_jobs FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_jobs.workspace_id));
DROP POLICY IF EXISTS "insert_own_backup_jobs" ON backup_jobs;
CREATE POLICY "insert_own_backup_jobs" ON backup_jobs FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_jobs.workspace_id));
DROP POLICY IF EXISTS "update_own_backup_jobs" ON backup_jobs;
CREATE POLICY "update_own_backup_jobs" ON backup_jobs FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_jobs.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_jobs.workspace_id));
DROP POLICY IF EXISTS "delete_own_backup_jobs" ON backup_jobs;
CREATE POLICY "delete_own_backup_jobs" ON backup_jobs FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_jobs.workspace_id));

-- 10. backup_history
CREATE TABLE IF NOT EXISTS backup_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  backup_job_id uuid NOT NULL,
  backup_status text NOT NULL DEFAULT 'pending' CHECK (backup_status IN ('pending','in_progress','completed','failed','cancelled','expired')),
  backup_type text NOT NULL,
  backup_size_bytes bigint,
  backup_location text,
  backup_format text DEFAULT 'sql',
  encryption_enabled boolean DEFAULT false,
  checksum text,
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  error_message text,
  is_restored boolean DEFAULT false,
  expires_at timestamptz,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE backup_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_backup_history_workspace ON backup_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_job ON backup_history(backup_job_id);
CREATE INDEX IF NOT EXISTS idx_backup_history_status ON backup_history(backup_status);
CREATE INDEX IF NOT EXISTS idx_backup_history_created ON backup_history(created_at DESC);

DROP POLICY IF EXISTS "select_own_backup_history" ON backup_history;
CREATE POLICY "select_own_backup_history" ON backup_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_backup_history" ON backup_history;
CREATE POLICY "insert_own_backup_history" ON backup_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_history.workspace_id));
DROP POLICY IF EXISTS "update_own_backup_history" ON backup_history;
CREATE POLICY "update_own_backup_history" ON backup_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_backup_history" ON backup_history;
CREATE POLICY "delete_own_backup_history" ON backup_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = backup_history.workspace_id));

-- 11. restore_history
CREATE TABLE IF NOT EXISTS restore_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  backup_history_id uuid NOT NULL,
  restore_status text NOT NULL DEFAULT 'pending' CHECK (restore_status IN ('pending','in_progress','completed','failed','cancelled')),
  restore_type text NOT NULL DEFAULT 'full' CHECK (restore_type IN ('full','partial','point_in_time','config_only')),
  point_in_time timestamptz,
  target_tables text[] DEFAULT '{}'::text[],
  started_at timestamptz,
  completed_at timestamptz,
  duration_seconds integer,
  restored_by uuid,
  error_message text,
  verification_status text CHECK (verification_status IN ('pending','verified','failed','skipped')),
  verification_notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE restore_history ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_restore_history_workspace ON restore_history(workspace_id);
CREATE INDEX IF NOT EXISTS idx_restore_history_backup ON restore_history(backup_history_id);
CREATE INDEX IF NOT EXISTS idx_restore_history_status ON restore_history(restore_status);
CREATE INDEX IF NOT EXISTS idx_restore_history_created ON restore_history(created_at DESC);

DROP POLICY IF EXISTS "select_own_restore_history" ON restore_history;
CREATE POLICY "select_own_restore_history" ON restore_history FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = restore_history.workspace_id));
DROP POLICY IF EXISTS "insert_own_restore_history" ON restore_history;
CREATE POLICY "insert_own_restore_history" ON restore_history FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = restore_history.workspace_id));
DROP POLICY IF EXISTS "update_own_restore_history" ON restore_history;
CREATE POLICY "update_own_restore_history" ON restore_history FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = restore_history.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = restore_history.workspace_id));
DROP POLICY IF EXISTS "delete_own_restore_history" ON restore_history;
CREATE POLICY "delete_own_restore_history" ON restore_history FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = restore_history.workspace_id));

-- 12. system_health
CREATE TABLE IF NOT EXISTS system_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  component_name text NOT NULL CHECK (component_name IN ('database','api','ai_gateway','memory_engine','knowledge_graph','queue','workers','edge_functions','storage','notifications','communication_channels','integrations','authentication','cache','webhook_platform','api_platform','overall')),
  health_status text NOT NULL DEFAULT 'healthy' CHECK (health_status IN ('healthy','degraded','unhealthy','maintenance','unknown')),
  health_score numeric NOT NULL DEFAULT 100 CHECK (health_score >= 0 AND health_score <= 100),
  response_time_ms integer,
  uptime_percentage numeric,
  error_rate numeric,
  last_check_at timestamptz DEFAULT now(),
  last_incident_at timestamptz,
  health_details jsonb DEFAULT '{}'::jsonb,
  active_alerts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE system_health ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_system_health_workspace ON system_health(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_health_component ON system_health(component_name);
CREATE INDEX IF NOT EXISTS idx_system_health_status ON system_health(health_status);
CREATE INDEX IF NOT EXISTS idx_system_health_score ON system_health(health_score);

DROP POLICY IF EXISTS "select_own_system_health" ON system_health;
CREATE POLICY "select_own_system_health" ON system_health FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_health.workspace_id));
DROP POLICY IF EXISTS "insert_own_system_health" ON system_health;
CREATE POLICY "insert_own_system_health" ON system_health FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_health.workspace_id));
DROP POLICY IF EXISTS "update_own_system_health" ON system_health;
CREATE POLICY "update_own_system_health" ON system_health FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_health.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_health.workspace_id));
DROP POLICY IF EXISTS "delete_own_system_health" ON system_health;
CREATE POLICY "delete_own_system_health" ON system_health FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_health.workspace_id));

-- 13. system_incidents
CREATE TABLE IF NOT EXISTS system_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  incident_title text NOT NULL,
  incident_description text,
  incident_severity text NOT NULL DEFAULT 'minor' CHECK (incident_severity IN ('minor','moderate','major','critical','catastrophic')),
  incident_status text NOT NULL DEFAULT 'investigating' CHECK (incident_status IN ('investigating','identified','monitoring','resolved','postmortem','closed')),
  incident_type text NOT NULL CHECK (incident_type IN ('outage','degradation','security','data_loss','performance','configuration','third_party','planned_maintenance')),
  affected_components text[] DEFAULT '{}'::text[],
  impact_description text,
  detected_at timestamptz DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  closed_at timestamptz,
  duration_seconds integer,
  root_cause text,
  resolution_actions jsonb DEFAULT '[]'::jsonb,
  postmortem_url text,
  assigned_to uuid,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE system_incidents ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_system_incidents_workspace ON system_incidents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_incidents_severity ON system_incidents(incident_severity);
CREATE INDEX IF NOT EXISTS idx_system_incidents_status ON system_incidents(incident_status);
CREATE INDEX IF NOT EXISTS idx_system_incidents_created ON system_incidents(created_at DESC);

DROP POLICY IF EXISTS "select_own_system_incidents" ON system_incidents;
CREATE POLICY "select_own_system_incidents" ON system_incidents FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_incidents.workspace_id));
DROP POLICY IF EXISTS "insert_own_system_incidents" ON system_incidents;
CREATE POLICY "insert_own_system_incidents" ON system_incidents FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_incidents.workspace_id));
DROP POLICY IF EXISTS "update_own_system_incidents" ON system_incidents;
CREATE POLICY "update_own_system_incidents" ON system_incidents FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_incidents.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_incidents.workspace_id));
DROP POLICY IF EXISTS "delete_own_system_incidents" ON system_incidents;
CREATE POLICY "delete_own_system_incidents" ON system_incidents FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_incidents.workspace_id));

-- 14. incident_timelines
CREATE TABLE IF NOT EXISTS incident_timelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  incident_id uuid NOT NULL,
  event_type text NOT NULL CHECK (event_type IN ('created','acknowledged','update','escalated','degraded','resolved','closed','communication_sent','rollback_started','rollback_completed','root_cause_identified','postmortem_started','postmortem_completed')),
  event_message text NOT NULL,
  event_status text,
  event_metadata jsonb DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE incident_timelines ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_incident_timelines_workspace ON incident_timelines(workspace_id);
CREATE INDEX IF NOT EXISTS idx_incident_timelines_incident ON incident_timelines(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_timelines_type ON incident_timelines(event_type);
CREATE INDEX IF NOT EXISTS idx_incident_timelines_created ON incident_timelines(created_at DESC);

DROP POLICY IF EXISTS "select_own_incident_timelines" ON incident_timelines;
CREATE POLICY "select_own_incident_timelines" ON incident_timelines FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = incident_timelines.workspace_id));
DROP POLICY IF EXISTS "insert_own_incident_timelines" ON incident_timelines;
CREATE POLICY "insert_own_incident_timelines" ON incident_timelines FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = incident_timelines.workspace_id));
DROP POLICY IF EXISTS "update_own_incident_timelines" ON incident_timelines;
CREATE POLICY "update_own_incident_timelines" ON incident_timelines FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = incident_timelines.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = incident_timelines.workspace_id));
DROP POLICY IF EXISTS "delete_own_incident_timelines" ON incident_timelines;
CREATE POLICY "delete_own_incident_timelines" ON incident_timelines FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = incident_timelines.workspace_id));

-- 15. platform_metrics
CREATE TABLE IF NOT EXISTS platform_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  metric_key text NOT NULL,
  metric_value numeric NOT NULL,
  metric_dimensions jsonb DEFAULT '{}'::jsonb,
  metric_timestamp timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE platform_metrics ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_platform_metrics_workspace ON platform_metrics(workspace_id);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_key ON platform_metrics(metric_key);
CREATE INDEX IF NOT EXISTS idx_platform_metrics_timestamp ON platform_metrics(metric_timestamp DESC);

DROP POLICY IF EXISTS "select_own_platform_metrics" ON platform_metrics;
CREATE POLICY "select_own_platform_metrics" ON platform_metrics FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = platform_metrics.workspace_id));
DROP POLICY IF EXISTS "insert_own_platform_metrics" ON platform_metrics;
CREATE POLICY "insert_own_platform_metrics" ON platform_metrics FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = platform_metrics.workspace_id));
DROP POLICY IF EXISTS "update_own_platform_metrics" ON platform_metrics;
CREATE POLICY "update_own_platform_metrics" ON platform_metrics FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = platform_metrics.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = platform_metrics.workspace_id));
DROP POLICY IF EXISTS "delete_own_platform_metrics" ON platform_metrics;
CREATE POLICY "delete_own_platform_metrics" ON platform_metrics FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = platform_metrics.workspace_id));

-- 16. system_settings
CREATE TABLE IF NOT EXISTS system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  setting_key text NOT NULL,
  setting_value jsonb DEFAULT '{}'::jsonb,
  setting_category text NOT NULL DEFAULT 'general' CHECK (setting_category IN ('general','security','performance','monitoring','backup','deployment','feature_flags','notifications','ai_operations','compliance')),
  setting_type text NOT NULL DEFAULT 'string' CHECK (setting_type IN ('string','integer','boolean','json','array','secret')),
  is_editable boolean DEFAULT true,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_system_settings_workspace ON system_settings(workspace_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_key ON system_settings(setting_key);
CREATE INDEX IF NOT EXISTS idx_system_settings_category ON system_settings(setting_category);

DROP POLICY IF EXISTS "select_own_system_settings" ON system_settings;
CREATE POLICY "select_own_system_settings" ON system_settings FOR SELECT TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_settings.workspace_id));
DROP POLICY IF EXISTS "insert_own_system_settings" ON system_settings;
CREATE POLICY "insert_own_system_settings" ON system_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_settings.workspace_id));
DROP POLICY IF EXISTS "update_own_system_settings" ON system_settings;
CREATE POLICY "update_own_system_settings" ON system_settings FOR UPDATE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_settings.workspace_id)) WITH CHECK (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_settings.workspace_id));
DROP POLICY IF EXISTS "delete_own_system_settings" ON system_settings;
CREATE POLICY "delete_own_system_settings" ON system_settings FOR DELETE TO authenticated USING (auth.uid() IN (SELECT workspace_members.user_id FROM workspace_members WHERE workspace_members.workspace_id = system_settings.workspace_id));