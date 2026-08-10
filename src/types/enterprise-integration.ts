// Phase 17 — Enterprise Integration Hub Types

export type ProviderCategory = 'crm' | 'marketing' | 'communication' | 'finance' | 'calendar' | 'meetings' | 'storage' | 'database' | 'automation' | 'ai_provider' | 'documents' | 'custom';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error' | 'expired' | 'revoked' | 'paused';
export type AuthType = 'oauth2' | 'api_key' | 'basic' | 'bearer' | 'custom' | 'none';
export type SyncType = 'full' | 'incremental' | 'delta' | 'realtime' | 'manual' | 'scheduled';
export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying' | 'dead_letter';
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'critical' | 'unknown';
export type InstallStatus = 'installed' | 'configuring' | 'active' | 'disabled' | 'uninstalled' | 'error';

export interface IntegrationProvider {
  id: string; provider_key: string; provider_name: string; provider_category: ProviderCategory;
  provider_description: string | null; provider_logo: string | null; provider_website: string | null;
  auth_type: AuthType; oauth_authorize_url: string | null; oauth_token_url: string | null;
  oauth_refresh_url: string | null; oauth_scopes: string[]; default_scopes: string[];
  api_base_url: string | null; api_version: string; webhook_url_template: string | null;
  rate_limit_per_minute: number; rate_limit_per_hour: number;
  is_active: boolean; is_popular: boolean; is_enterprise: boolean;
  setup_instructions: string | null; documentation_url: string | null; sdk_available: boolean;
  version: string; created_at: string; updated_at: string;
}

export interface IntegrationConnection {
  id: string; workspace_id: string; provider_id: string; connection_name: string;
  connection_status: ConnectionStatus; auth_type: AuthType;
  external_account_id: string | null; external_account_name: string | null; external_account_email: string | null;
  external_metadata: Record<string, unknown>; last_synced_at: string | null;
  last_sync_status: string | null; last_sync_error: string | null;
  sync_frequency: string; is_active: boolean; auto_sync: boolean;
  ai_reasoning: string | null; version: number; created_by: string | null;
  created_at: string; updated_at: string;
}

export interface IntegrationSyncJob {
  id: string; workspace_id: string; connection_id: string;
  sync_type: SyncType; sync_direction: string; entity_type: string;
  status: SyncStatus; total_records: number; processed_records: number; failed_records: number;
  started_at: string | null; completed_at: string | null; duration_ms: number | null;
  error_message: string | null; retry_count: number; max_retries: number;
  next_retry_at: string | null; sync_payload: Record<string, unknown>;
  result_summary: Record<string, unknown>; ai_reasoning: string | null;
  created_at: string; updated_at: string;
}

export interface IntegrationHealth {
  id: string; workspace_id: string; connection_id: string;
  health_score: number; health_status: HealthStatus;
  latency_ms: number; error_rate: number; success_rate: number;
  last_check_at: string; uptime_percent: number; consecutive_failures: number;
  ai_reasoning: string | null; created_at: string; updated_at: string;
}

export interface IntegrationWebhook {
  id: string; workspace_id: string; connection_id: string | null;
  webhook_name: string; webhook_url: string; webhook_secret: string | null;
  subscribed_events: string[]; is_active: boolean;
  last_triggered_at: string | null; trigger_count: number; failure_count: number;
  last_response_code: number | null; created_at: string; updated_at: string;
}

export interface IntegrationWebhookEvent {
  id: string; workspace_id: string; webhook_id: string | null; connection_id: string | null;
  event_name: string; event_payload: Record<string, unknown>;
  processing_status: string; processed_at: string | null;
  response_code: number | null; error_message: string | null; retry_count: number;
  created_at: string;
}

export interface IntegrationError {
  id: string; workspace_id: string; connection_id: string | null; sync_job_id: string | null;
  error_code: string | null; error_type: string; error_message: string;
  error_details: Record<string, unknown>; is_resolved: boolean; resolved_at: string | null;
  resolution: string | null; retry_count: number; is_dead_letter: boolean; created_at: string;
}

export interface IntegrationEvent {
  id: string; workspace_id: string; connection_id: string | null;
  event_type: string; event_name: string; event_description: string | null;
  event_data: Record<string, unknown>; severity: string; created_at: string;
}

export interface MarketplaceApp {
  id: string; provider_id: string; app_name: string; app_description: string | null;
  app_category: string; app_features: string[]; app_benefits: string[];
  app_icon: string | null; popularity_score: number; install_count: number;
  rating: number; review_count: number; is_featured: boolean; is_verified: boolean;
  pricing_type: string; pricing_details: Record<string, unknown>;
  setup_difficulty: string; estimated_setup_minutes: number;
  documentation_url: string | null; support_url: string | null;
  tags: string[]; is_active: boolean; created_at: string; updated_at: string;
}

export interface IntegrationInstall {
  id: string; workspace_id: string; marketplace_id: string | null;
  connection_id: string | null; provider_id: string;
  install_status: InstallStatus; install_version: string;
  config: Record<string, unknown>; permissions: Record<string, unknown>;
  installed_by: string | null; installed_at: string; last_updated_at: string;
  created_at: string; updated_at: string;
}

export interface IntegrationConflict {
  id: string; workspace_id: string; connection_id: string; sync_job_id: string | null;
  entity_type: string; entity_id: string; conflict_type: string;
  source_data: Record<string, unknown>; target_data: Record<string, unknown>;
  resolution_strategy: string | null; resolution_data: Record<string, unknown>;
  is_resolved: boolean; resolved_at: string | null; resolved_by: string | null;
  ai_reasoning: string | null; created_at: string; updated_at: string;
}

export interface IntegrationMetric {
  id: string; workspace_id: string; connection_id: string;
  metric_name: string; metric_value: number | null; metric_unit: string | null;
  metric_category: string; measurement_date: string; created_at: string;
}

export interface IntegrationPerformance {
  id: string; workspace_id: string; connection_id: string;
  performance_date: string; total_syncs: number; successful_syncs: number; failed_syncs: number;
  avg_sync_duration_ms: number; total_api_calls: number; avg_api_latency_ms: number;
  total_records_synced: number; error_rate: number; uptime_percent: number;
  overall_score: number; ai_reasoning: string | null; created_at: string;
}

export interface IntegrationLog {
  id: string; workspace_id: string; connection_id: string | null;
  log_level: string; log_message: string; log_data: Record<string, unknown>;
  created_at: string;
}

export interface IntegrationNotification {
  id: string; workspace_id: string; connection_id: string | null;
  notification_type: string; notification_title: string; notification_message: string | null;
  priority: string; is_read: boolean; read_at: string | null;
  action_taken: string | null; created_at: string;
}

export interface IntegrationSchedule {
  id: string; workspace_id: string; connection_id: string;
  schedule_name: string; cron_expression: string; sync_type: string;
  entity_types: string[]; is_active: boolean;
  last_run_at: string | null; next_run_at: string | null;
  run_count: number; created_at: string; updated_at: string;
}

export interface IntegrationAuditEntry {
  id: string; workspace_id: string; connection_id: string | null;
  audit_type: string; audit_action: string; audit_description: string | null;
  audit_data: Record<string, unknown>; ip_address: string | null;
  performed_by: string | null; performed_by_type: string;
  severity: string; created_at: string;
}

export interface IntegrationDashboard {
  providers: IntegrationProvider[];
  connections: IntegrationConnection[];
  syncJobs: IntegrationSyncJob[];
  health: IntegrationHealth[];
  webhooks: IntegrationWebhook[];
  webhookEvents: IntegrationWebhookEvent[];
  errors: IntegrationError[];
  events: IntegrationEvent[];
  marketplace: MarketplaceApp[];
  installs: IntegrationInstall[];
  conflicts: IntegrationConflict[];
  metrics: IntegrationMetric[];
  performance: IntegrationPerformance[];
  logs: IntegrationLog[];
  notifications: IntegrationNotification[];
  schedules: IntegrationSchedule[];
  audit: IntegrationAuditEntry[];
  totalConnections: number;
  activeConnections: number;
  totalSyncJobs: number;
  pendingSyncJobs: number;
  failedSyncJobs: number;
  totalErrors: number;
  unresolvedErrors: number;
  totalWebhooks: number;
  totalInstalls: number;
  avgHealthScore: number;
  totalApiCalls: number;
}
