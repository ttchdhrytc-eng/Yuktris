/*
# Phase 17 Part 2 — Enterprise Integration Hub: Marketplace, Installs, Settings, Templates, Metrics, Performance, Monitor, History, Exports, Imports, Security, Audit, Notifications, Scheduler, Queue, Versions, Backups
*/

-- ============================================================
-- INTEGRATION MARKETPLACE — browsable app catalog
-- ============================================================
CREATE TABLE integration_marketplace (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  app_name text NOT NULL,
  app_description text,
  app_category text NOT NULL,
  app_features text[] DEFAULT '{}'::text[],
  app_benefits text[] DEFAULT '{}'::text[],
  app_screenshots text[] DEFAULT '{}'::text[],
  app_icon text,
  popularity_score integer DEFAULT 0,
  install_count integer DEFAULT 0,
  rating numeric(3,2) DEFAULT 0,
  review_count integer DEFAULT 0,
  is_featured boolean DEFAULT false,
  is_verified boolean DEFAULT true,
  pricing_type text DEFAULT 'free' CHECK (pricing_type IN ('free','freemium','paid','enterprise','custom')),
  pricing_details jsonb DEFAULT '{}'::jsonb,
  setup_difficulty text DEFAULT 'easy' CHECK (setup_difficulty IN ('easy','medium','hard','expert')),
  estimated_setup_minutes integer DEFAULT 5,
  documentation_url text,
  support_url text,
  tags text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_marketplace_category ON integration_marketplace(app_category);
CREATE INDEX idx_integration_marketplace_featured ON integration_marketplace(is_featured) WHERE is_featured = true;
ALTER TABLE integration_marketplace ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_marketplace" ON integration_marketplace FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_integration_marketplace" ON integration_marketplace FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_integration_marketplace" ON integration_marketplace FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_integration_marketplace" ON integration_marketplace FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INTEGRATION INSTALLS — workspace app installations
-- ============================================================
CREATE TABLE integration_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  marketplace_id uuid REFERENCES integration_marketplace(id) ON DELETE SET NULL,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE CASCADE,
  provider_id uuid NOT NULL REFERENCES integration_providers(id) ON DELETE CASCADE,
  install_status text DEFAULT 'installed' CHECK (install_status IN ('installed','configuring','active','disabled','uninstalled','error')),
  install_version text DEFAULT '1.0.0',
  config jsonb DEFAULT '{}'::jsonb,
  permissions jsonb DEFAULT '{}'::jsonb,
  installed_by uuid REFERENCES auth.users(id),
  installed_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_installs_workspace ON integration_installs(workspace_id);
CREATE INDEX idx_integration_installs_status ON integration_installs(install_status);
ALTER TABLE integration_installs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_installs" ON integration_installs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_installs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_installs" ON integration_installs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_installs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_installs" ON integration_installs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_installs.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_installs.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_installs" ON integration_installs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_installs.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION SETTINGS
-- ============================================================
CREATE TABLE integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  setting_key text NOT NULL,
  setting_value text,
  setting_type text DEFAULT 'string' CHECK (setting_type IN ('string','number','boolean','json','array','secret')),
  is_encrypted boolean DEFAULT false,
  is_required boolean DEFAULT false,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_integration_settings_conn_key ON integration_settings(connection_id, setting_key);
ALTER TABLE integration_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_settings" ON integration_settings FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_settings.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_settings" ON integration_settings FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_settings.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_settings" ON integration_settings FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_settings.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_settings.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_settings" ON integration_settings FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_settings.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION TEMPLATES
-- ============================================================
CREATE TABLE integration_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id uuid REFERENCES integration_providers(id) ON DELETE CASCADE,
  template_name text NOT NULL,
  template_description text,
  template_category text NOT NULL,
  template_config jsonb DEFAULT '{}'::jsonb,
  field_mappings jsonb DEFAULT '{}'::jsonb,
  sync_rules jsonb DEFAULT '{}'::jsonb,
  is_public boolean DEFAULT true,
  is_official boolean DEFAULT false,
  usage_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_templates_category ON integration_templates(template_category);
ALTER TABLE integration_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_templates" ON integration_templates FOR SELECT TO authenticated USING (is_public = true OR (workspace_id IS NOT NULL AND EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_templates.workspace_id AND wm.user_id = auth.uid())));
CREATE POLICY "insert_integration_templates" ON integration_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_integration_templates" ON integration_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_integration_templates" ON integration_templates FOR DELETE TO authenticated USING (true);

-- ============================================================
-- INTEGRATION METRICS
-- ============================================================
CREATE TABLE integration_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  metric_name text NOT NULL,
  metric_value numeric(14,2),
  metric_unit text,
  metric_category text DEFAULT 'performance' CHECK (metric_category IN ('performance','reliability','throughput','latency','error','usage','sync','webhook')),
  measurement_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_metrics_connection ON integration_metrics(connection_id);
CREATE INDEX idx_integration_metrics_date ON integration_metrics(measurement_date DESC);
ALTER TABLE integration_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_metrics" ON integration_metrics FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_metrics" ON integration_metrics FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_metrics" ON integration_metrics FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_metrics.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_metrics.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_metrics" ON integration_metrics FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_metrics.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION PERFORMANCE
-- ============================================================
CREATE TABLE integration_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  performance_date date NOT NULL DEFAULT CURRENT_DATE,
  total_syncs integer DEFAULT 0,
  successful_syncs integer DEFAULT 0,
  failed_syncs integer DEFAULT 0,
  avg_sync_duration_ms integer DEFAULT 0,
  total_api_calls integer DEFAULT 0,
  avg_api_latency_ms integer DEFAULT 0,
  total_records_synced integer DEFAULT 0,
  error_rate numeric(5,2) DEFAULT 0,
  uptime_percent numeric(5,2) DEFAULT 100,
  overall_score numeric(5,2) DEFAULT 100,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_performance_connection ON integration_performance(connection_id);
CREATE INDEX idx_integration_performance_date ON integration_performance(performance_date DESC);
ALTER TABLE integration_performance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_performance" ON integration_performance FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_performance" ON integration_performance FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_performance" ON integration_performance FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_performance.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_performance.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_performance" ON integration_performance FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_performance.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION MONITOR
-- ============================================================
CREATE TABLE integration_monitor (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  monitor_type text NOT NULL CHECK (monitor_type IN ('health','latency','error_rate','quota','sync','webhook','auth','custom')),
  monitor_status text DEFAULT 'ok' CHECK (monitor_status IN ('ok','warning','critical','unknown')),
  current_value numeric(14,2),
  threshold_value numeric(14,2),
  message text,
  last_checked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_monitor_connection ON integration_monitor(connection_id);
ALTER TABLE integration_monitor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_monitor" ON integration_monitor FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_monitor.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_monitor" ON integration_monitor FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_monitor.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_monitor" ON integration_monitor FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_monitor.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_monitor.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_monitor" ON integration_monitor FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_monitor.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION HISTORY (audit log)
-- ============================================================
CREATE TABLE integration_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  action_type text NOT NULL CHECK (action_type IN ('connect','disconnect','sync','config_change','token_refresh','credential_rotate','install','uninstall','enable','disable','webhook_subscribe','webhook_unsubscribe','permission_change','export','import','resolve_conflict','retry')),
  action_description text,
  action_data jsonb DEFAULT '{}'::jsonb,
  performed_by uuid REFERENCES auth.users(id),
  performed_by_type text DEFAULT 'user' CHECK (performed_by_type IN ('user','system','ai_agent','api')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_history_workspace ON integration_history(workspace_id);
CREATE INDEX idx_integration_history_connection ON integration_history(connection_id);
CREATE INDEX idx_integration_history_created ON integration_history(created_at DESC);
ALTER TABLE integration_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_history" ON integration_history FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_history" ON integration_history FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_history" ON integration_history FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_history.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_history.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_history" ON integration_history FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_history.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION EXPORTS
-- ============================================================
CREATE TABLE integration_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  export_type text NOT NULL,
  entity_type text NOT NULL,
  total_records integer DEFAULT 0,
  exported_records integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','partial')),
  file_format text DEFAULT 'json' CHECK (file_format IN ('json','csv','xml','xlsx','yaml')),
  file_url text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_exports_workspace ON integration_exports(workspace_id);
ALTER TABLE integration_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_exports" ON integration_exports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_exports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_exports" ON integration_exports FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_exports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_exports" ON integration_exports FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_exports.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_exports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_exports" ON integration_exports FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_exports.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION IMPORTS
-- ============================================================
CREATE TABLE integration_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  import_type text NOT NULL,
  entity_type text NOT NULL,
  total_records integer DEFAULT 0,
  imported_records integer DEFAULT 0,
  failed_records integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','partial')),
  file_format text DEFAULT 'json' CHECK (file_format IN ('json','csv','xml','xlsx','yaml')),
  file_url text,
  started_at timestamptz,
  completed_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_imports_workspace ON integration_imports(workspace_id);
ALTER TABLE integration_imports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_imports" ON integration_imports FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_imports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_imports" ON integration_imports FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_imports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_imports" ON integration_imports FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_imports.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_imports.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_imports" ON integration_imports FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_imports.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION SECURITY
-- ============================================================
CREATE TABLE integration_security (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  security_type text NOT NULL CHECK (security_type IN ('oauth_scope','ip_whitelist','encryption','audit','compliance','token_rotation','secret_vault','access_control')),
  security_config jsonb DEFAULT '{}'::jsonb,
  is_enabled boolean DEFAULT true,
  last_audit_at timestamptz,
  audit_result text,
  vulnerabilities text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_security_connection ON integration_security(connection_id);
ALTER TABLE integration_security ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_security" ON integration_security FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_security.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_security" ON integration_security FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_security.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_security" ON integration_security FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_security.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_security.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_security" ON integration_security FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_security.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION NOTIFICATIONS
-- ============================================================
CREATE TABLE integration_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE CASCADE,
  notification_type text NOT NULL CHECK (notification_type IN ('connected','disconnected','sync_completed','sync_failed','error','warning','health_degraded','token_expired','rate_limit','conflict','webhook_failed','quota_warning')),
  notification_title text NOT NULL,
  notification_message text,
  priority text DEFAULT 'medium' CHECK (priority IN ('critical','high','medium','low')),
  is_read boolean DEFAULT false,
  read_at timestamptz,
  action_taken text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_notifications_unread ON integration_notifications(is_read) WHERE is_read = false;
CREATE INDEX idx_integration_notifications_workspace ON integration_notifications(workspace_id);
ALTER TABLE integration_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_notifications" ON integration_notifications FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_notifications" ON integration_notifications FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_notifications" ON integration_notifications FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_notifications.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_notifications.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_notifications" ON integration_notifications FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_notifications.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION SCHEDULER
-- ============================================================
CREATE TABLE integration_scheduler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  schedule_name text NOT NULL,
  cron_expression text NOT NULL,
  sync_type text DEFAULT 'incremental' CHECK (sync_type IN ('full','incremental','delta','realtime')),
  entity_types text[] DEFAULT '{}'::text[],
  is_active boolean DEFAULT true,
  last_run_at timestamptz,
  next_run_at timestamptz,
  run_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_scheduler_connection ON integration_scheduler(connection_id);
CREATE INDEX idx_integration_scheduler_next_run ON integration_scheduler(next_run_at) WHERE is_active = true;
ALTER TABLE integration_scheduler ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_scheduler" ON integration_scheduler FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scheduler.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_scheduler" ON integration_scheduler FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scheduler.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_scheduler" ON integration_scheduler FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scheduler.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scheduler.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_scheduler" ON integration_scheduler FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_scheduler.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION QUEUE
-- ============================================================
CREATE TABLE integration_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  queue_item_type text NOT NULL CHECK (queue_item_type IN ('sync','webhook','export','import','retry','notification','cleanup')),
  priority_score integer DEFAULT 50,
  queue_position integer DEFAULT 0,
  is_locked boolean DEFAULT false,
  locked_at timestamptz,
  payload jsonb DEFAULT '{}'::jsonb,
  status text DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','dead_letter')),
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_queue_workspace ON integration_queue(workspace_id);
CREATE INDEX idx_integration_queue_pending ON integration_queue(status) WHERE status = 'pending';
ALTER TABLE integration_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_queue" ON integration_queue FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_queue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_queue" ON integration_queue FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_queue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_queue" ON integration_queue FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_queue.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_queue.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_queue" ON integration_queue FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_queue.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION VERSIONS
-- ============================================================
CREATE TABLE integration_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  version_notes text,
  change_summary text,
  config_snapshot jsonb DEFAULT '{}'::jsonb,
  is_current boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_versions_connection ON integration_versions(connection_id);
ALTER TABLE integration_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_versions" ON integration_versions FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_versions" ON integration_versions FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_versions" ON integration_versions FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_versions.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_versions.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_versions" ON integration_versions FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_versions.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION BACKUPS
-- ============================================================
CREATE TABLE integration_backups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  backup_type text DEFAULT 'config' CHECK (backup_type IN ('config','full','schema','credentials','mapping')),
  backup_data jsonb DEFAULT '{}'::jsonb,
  file_size_bytes integer DEFAULT 0,
  is_restorable boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_backups_connection ON integration_backups(connection_id);
ALTER TABLE integration_backups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_backups" ON integration_backups FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_backups.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_backups" ON integration_backups FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_backups.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_backups" ON integration_backups FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_backups.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_backups.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_backups" ON integration_backups FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_backups.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION AUDIT
-- ============================================================
CREATE TABLE integration_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  audit_type text NOT NULL CHECK (audit_type IN ('access','config','sync','credential','permission','security','compliance','data_access','export','import')),
  audit_action text NOT NULL,
  audit_description text,
  audit_data jsonb DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  performed_by uuid REFERENCES auth.users(id),
  performed_by_type text DEFAULT 'user' CHECK (performed_by_type IN ('user','system','ai_agent','api')),
  severity text DEFAULT 'info' CHECK (severity IN ('info','low','medium','high','critical')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_audit_workspace ON integration_audit(workspace_id);
CREATE INDEX idx_integration_audit_connection ON integration_audit(connection_id);
CREATE INDEX idx_integration_audit_created ON integration_audit(created_at DESC);
ALTER TABLE integration_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_audit" ON integration_audit FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_audit.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_audit" ON integration_audit FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_audit.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_audit" ON integration_audit FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_audit.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_audit.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_audit" ON integration_audit FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_audit.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION WORKFLOWS
-- ============================================================
CREATE TABLE integration_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workflow_name text NOT NULL,
  workflow_description text,
  trigger_connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  target_connection_id uuid REFERENCES integration_connections(id) ON DELETE SET NULL,
  workflow_type text DEFAULT 'sequential' CHECK (workflow_type IN ('sequential','parallel','conditional','event_driven')),
  is_active boolean DEFAULT true,
  execution_count integer DEFAULT 0,
  last_executed_at timestamptz,
  ai_reasoning text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_workflows_workspace ON integration_workflows(workspace_id);
ALTER TABLE integration_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_workflows" ON integration_workflows FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_workflows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_workflows" ON integration_workflows FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_workflows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_workflows" ON integration_workflows FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_workflows.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_workflows.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_workflows" ON integration_workflows FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_workflows.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- INTEGRATION ACCOUNTS (external accounts linked to connections)
-- ============================================================
CREATE TABLE integration_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES integration_connections(id) ON DELETE CASCADE,
  external_account_id text NOT NULL,
  external_account_type text,
  external_account_name text,
  external_account_email text,
  external_metadata jsonb DEFAULT '{}'::jsonb,
  is_primary boolean DEFAULT false,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_integration_accounts_connection ON integration_accounts(connection_id);
CREATE INDEX idx_integration_accounts_external ON integration_accounts(external_account_id);
ALTER TABLE integration_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "select_integration_accounts" ON integration_accounts FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "insert_integration_accounts" ON integration_accounts FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "update_integration_accounts" ON integration_accounts FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_accounts.workspace_id AND wm.user_id = auth.uid())) WITH CHECK (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_accounts.workspace_id AND wm.user_id = auth.uid()));
CREATE POLICY "delete_integration_accounts" ON integration_accounts FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM workspace_members wm WHERE wm.workspace_id = integration_accounts.workspace_id AND wm.user_id = auth.uid()));

-- ============================================================
-- UPDATED_AT TRIGGERS (Part 2)
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'integration_marketplace','integration_installs','integration_settings','integration_templates',
    'integration_monitor','integration_exports','integration_imports','integration_security',
    'integration_notifications','integration_scheduler','integration_workflows','integration_accounts'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trigger_%I_ei_updated ON %I;', t, t);
    EXECUTE format('CREATE TRIGGER trigger_%I_ei_updated BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_integration_updated_at();', t, t);
  END LOOP;
END $$;
