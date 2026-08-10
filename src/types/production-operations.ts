// Phase 19 — Production Operations Platform Types

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory =
  | 'application' | 'api' | 'ai' | 'workflow' | 'agent' | 'edge_function'
  | 'database' | 'auth' | 'webhook' | 'integration' | 'security' | 'audit' | 'system';

export type SystemLog = {
  id: string;
  workspace_id: string;
  log_level: LogLevel;
  log_source: string;
  log_message: string;
  log_metadata: Record<string, unknown>;
  correlation_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ApplicationLog = {
  id: string;
  workspace_id: string;
  log_level: LogLevel;
  log_category: LogCategory;
  source_module: string;
  log_message: string;
  stack_trace: string | null;
  correlation_id: string | null;
  request_id: string | null;
  user_id: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type MetricCategory =
  | 'cpu' | 'memory' | 'storage' | 'network' | 'database' | 'api'
  | 'ai_gateway' | 'cache' | 'queue' | 'worker' | 'latency'
  | 'throughput' | 'error_rate' | 'uptime';

export type SystemPerformanceMetric = {
  id: string;
  workspace_id: string;
  metric_name: string;
  metric_category: MetricCategory;
  metric_value: number;
  metric_unit: string | null;
  metric_labels: Record<string, unknown>;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type SpanStatus = 'ok' | 'error' | 'timeout' | 'cancelled';

export type DistributedTrace = {
  id: string;
  workspace_id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  service_name: string;
  operation_name: string;
  start_time: string;
  end_time: string | null;
  duration_ms: number | null;
  span_status: SpanStatus;
  span_attributes: Record<string, unknown>;
  span_events: unknown[];
  resource_tags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type JobStatus = 'pending' | 'active' | 'completed' | 'failed' | 'delayed' | 'cancelled' | 'dead_letter';

export type QueueJob = {
  id: string;
  workspace_id: string;
  queue_name: string;
  job_type: string;
  job_payload: Record<string, unknown>;
  priority: number;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  delay_until: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  worker_id: string | null;
  error_message: string | null;
  error_stack: string | null;
  result: Record<string, unknown> | null;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type WorkerStatus = 'idle' | 'busy' | 'paused' | 'offline' | 'error';

export type QueueWorker = {
  id: string;
  workspace_id: string;
  worker_id: string;
  worker_name: string;
  worker_type: string;
  queue_names: string[];
  status: WorkerStatus;
  concurrency: number;
  max_concurrency: number;
  current_job_id: string | null;
  jobs_completed: number;
  jobs_failed: number;
  last_heartbeat_at: string;
  started_at: string;
  stopped_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'recovering';

export type WorkerHealth = {
  id: string;
  workspace_id: string;
  worker_id: string;
  health_status: HealthStatus;
  cpu_usage: number | null;
  memory_usage: number | null;
  event_loop_lag_ms: number | null;
  active_connections: number | null;
  queue_depth: number | null;
  uptime_seconds: number | null;
  error_count: number;
  warning_count: number;
  health_metadata: Record<string, unknown>;
  checked_at: string;
  created_at: string;
  updated_at: string;
};

export type CacheType = 'redis' | 'memory' | 'api' | 'query' | 'image' | 'cdn';

export type CacheMetric = {
  id: string;
  workspace_id: string;
  cache_name: string;
  cache_type: CacheType;
  hit_count: number;
  miss_count: number;
  eviction_count: number;
  total_keys: number;
  memory_usage_bytes: number | null;
  hit_ratio: number | null;
  avg_latency_ms: number | null;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type CostCategory =
  | 'ai_spend' | 'api_usage' | 'infrastructure' | 'storage'
  | 'bandwidth' | 'edge_functions' | 'database' | 'third_party' | 'other';

export type CostTracking = {
  id: string;
  workspace_id: string;
  cost_category: CostCategory;
  cost_source: string;
  cost_amount: number;
  cost_currency: string;
  usage_quantity: number | null;
  usage_unit: string | null;
  billing_period: string | null;
  recorded_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ResourceType =
  | 'cpu' | 'memory' | 'storage' | 'network' | 'database'
  | 'edge_function' | 'worker' | 'queue' | 'cache';

export type ResourceUsage = {
  id: string;
  workspace_id: string;
  resource_type: ResourceType;
  resource_name: string;
  usage_value: number;
  usage_unit: string;
  usage_percent: number | null;
  quota_limit: number | null;
  quota_percent: number | null;
  labels: Record<string, unknown>;
  recorded_at: string;
  created_at: string;
  updated_at: string;
};

export type SecurityEventType =
  | 'login' | 'logout' | 'login_failed' | 'password_change' | 'mfa_enabled' | 'mfa_disabled'
  | 'api_key_created' | 'api_key_revoked' | 'token_refresh' | 'suspicious_activity'
  | 'brute_force_detected' | 'rate_limit_exceeded' | 'permission_change' | 'role_change'
  | 'data_export' | 'config_change' | 'session_revoked' | 'device_trust_change';

export type SecurityEvent = {
  id: string;
  workspace_id: string;
  event_type: SecurityEventType;
  event_severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  event_source: string;
  user_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  event_data: Record<string, unknown>;
  risk_score: number;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
};

export type SecurityAlertType =
  | 'brute_force' | 'credential_stuffing' | 'api_abuse' | 'suspicious_login'
  | 'rate_limit_violation' | 'unauthorized_access' | 'data_exfiltration'
  | 'malware_detected' | 'config_drift' | 'certificate_expiring'
  | 'vulnerability_detected' | 'policy_violation';

export type SecurityAlert = {
  id: string;
  workspace_id: string;
  alert_type: SecurityAlertType;
  alert_severity: 'low' | 'medium' | 'high' | 'critical';
  alert_status: 'open' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive' | 'ignored';
  alert_title: string;
  alert_description: string | null;
  alert_source: string;
  affected_resource: string | null;
  affected_user_id: string | null;
  recommended_actions: unknown[];
  evidence: Record<string, unknown>;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MFASession = {
  id: string;
  workspace_id: string;
  user_id: string;
  mfa_method: 'totp' | 'sms' | 'email' | 'backup_code' | 'hardware_key' | 'push_notification';
  mfa_status: 'pending' | 'verified' | 'failed' | 'expired';
  device_id: string | null;
  device_trust_score: number;
  session_token: string | null;
  verified_at: string | null;
  expires_at: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
};

export type FeatureFlag = {
  id: string;
  workspace_id: string;
  flag_key: string;
  flag_name: string;
  flag_description: string | null;
  flag_type: 'boolean' | 'percentage' | 'string' | 'json' | 'kill_switch';
  is_enabled: boolean;
  is_kill_switch: boolean;
  rollout_strategy: 'off' | 'global' | 'percentage' | 'workspace' | 'role' | 'beta' | 'ab_test' | 'gradual';
  rollout_percentage: number;
  target_workspaces: string[];
  target_roles: string[];
  flag_config: Record<string, unknown>;
  flag_variants: unknown[];
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FeatureRollout = {
  id: string;
  workspace_id: string;
  flag_id: string;
  rollout_status: 'planned' | 'in_progress' | 'paused' | 'completed' | 'rolled_back' | 'cancelled';
  rollout_percentage: number;
  target_segment: string | null;
  rollout_config: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  rolled_back_at: string | null;
  rollback_reason: string | null;
  experiment_id: string | null;
  control_variant: string | null;
  treatment_variant: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ReleaseVersion = {
  id: string;
  workspace_id: string;
  version_number: string;
  version_label: string | null;
  release_channel: 'stable' | 'beta' | 'canary' | 'internal';
  release_notes: string | null;
  changelog: unknown[];
  is_breaking_change: boolean;
  is_deployed: boolean;
  is_rolled_back: boolean;
  deployed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DeploymentStatus = 'pending' | 'in_progress' | 'succeeded' | 'failed' | 'rolled_back' | 'cancelled';

export type DeploymentHistory = {
  id: string;
  workspace_id: string;
  release_version_id: string | null;
  environment: 'development' | 'staging' | 'production';
  deployment_status: DeploymentStatus;
  deployment_strategy: 'rolling' | 'blue_green' | 'canary' | 'recreate';
  commit_sha: string | null;
  branch: string | null;
  deployed_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  health_check_status: 'passing' | 'failing' | 'pending' | 'skipped' | null;
  health_check_url: string | null;
  rollback_of: string | null;
  deployment_logs: unknown[];
  deployment_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EnvironmentConfig = {
  id: string;
  workspace_id: string;
  environment: 'development' | 'staging' | 'production';
  config_key: string;
  config_value: string | null;
  config_type: 'string' | 'integer' | 'boolean' | 'json' | 'secret' | 'url';
  is_secret: boolean;
  is_required: boolean;
  description: string | null;
  default_value: string | null;
  created_at: string;
  updated_at: string;
};

export type BackupJob = {
  id: string;
  workspace_id: string;
  job_name: string;
  backup_type: 'database' | 'config' | 'knowledge_graph' | 'memory' | 'storage' | 'full' | 'incremental';
  backup_scope: 'workspace' | 'global' | 'module';
  target_module: string | null;
  schedule_cron: string | null;
  is_scheduled: boolean;
  is_active: boolean;
  retention_days: number;
  storage_location: string | null;
  max_backups: number;
  encryption_enabled: boolean;
  compression_enabled: boolean;
  created_at: string;
  updated_at: string;
};

export type BackupHistory = {
  id: string;
  workspace_id: string;
  backup_job_id: string;
  backup_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'expired';
  backup_type: string;
  backup_size_bytes: number | null;
  backup_location: string | null;
  backup_format: string;
  encryption_enabled: boolean;
  checksum: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  error_message: string | null;
  is_restored: boolean;
  expires_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RestoreHistory = {
  id: string;
  workspace_id: string;
  backup_history_id: string;
  restore_status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  restore_type: 'full' | 'partial' | 'point_in_time' | 'config_only';
  point_in_time: string | null;
  target_tables: string[];
  started_at: string | null;
  completed_at: string | null;
  duration_seconds: number | null;
  restored_by: string | null;
  error_message: string | null;
  verification_status: 'pending' | 'verified' | 'failed' | 'skipped' | null;
  verification_notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type SystemComponent =
  | 'database' | 'api' | 'ai_gateway' | 'memory_engine' | 'knowledge_graph'
  | 'queue' | 'workers' | 'edge_functions' | 'storage' | 'notifications'
  | 'communication_channels' | 'integrations' | 'authentication' | 'cache'
  | 'webhook_platform' | 'api_platform' | 'overall';

export type SystemHealth = {
  id: string;
  workspace_id: string;
  component_name: SystemComponent;
  health_status: 'healthy' | 'degraded' | 'unhealthy' | 'maintenance' | 'unknown';
  health_score: number;
  response_time_ms: number | null;
  uptime_percentage: number | null;
  error_rate: number | null;
  last_check_at: string;
  last_incident_at: string | null;
  health_details: Record<string, unknown>;
  active_alerts: number;
  created_at: string;
  updated_at: string;
};

export type IncidentSeverity = 'minor' | 'moderate' | 'major' | 'critical' | 'catastrophic';
export type IncidentStatus = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'postmortem' | 'closed';

export type SystemIncident = {
  id: string;
  workspace_id: string;
  incident_title: string;
  incident_description: string | null;
  incident_severity: IncidentSeverity;
  incident_status: IncidentStatus;
  incident_type: 'outage' | 'degradation' | 'security' | 'data_loss' | 'performance' | 'configuration' | 'third_party' | 'planned_maintenance';
  affected_components: string[];
  impact_description: string | null;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  closed_at: string | null;
  duration_seconds: number | null;
  root_cause: string | null;
  resolution_actions: unknown[];
  postmortem_url: string | null;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IncidentTimeline = {
  id: string;
  workspace_id: string;
  incident_id: string;
  event_type: 'created' | 'acknowledged' | 'update' | 'escalated' | 'degraded' | 'resolved' | 'closed' | 'communication_sent' | 'rollback_started' | 'rollback_completed' | 'root_cause_identified' | 'postmortem_started' | 'postmortem_completed';
  event_message: string;
  event_status: string | null;
  event_metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PlatformMetric = {
  id: string;
  workspace_id: string;
  metric_key: string;
  metric_value: number;
  metric_dimensions: Record<string, unknown>;
  metric_timestamp: string;
  created_at: string;
  updated_at: string;
};

export type SystemSetting = {
  id: string;
  workspace_id: string;
  setting_key: string;
  setting_value: Record<string, unknown>;
  setting_category: 'general' | 'security' | 'performance' | 'monitoring' | 'backup' | 'deployment' | 'feature_flags' | 'notifications' | 'ai_operations' | 'compliance';
  setting_type: 'string' | 'integer' | 'boolean' | 'json' | 'array' | 'secret';
  is_editable: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
};

// Dashboard aggregate types
export type ProductionOpsDashboard = {
  systemLogs: SystemLog[];
  applicationLogs: ApplicationLog[];
  performanceMetrics: SystemPerformanceMetric[];
  distributedTraces: DistributedTrace[];
  queueJobs: QueueJob[];
  queueWorkers: QueueWorker[];
  workerHealth: WorkerHealth[];
  cacheMetrics: CacheMetric[];
  costTracking: CostTracking[];
  resourceUsage: ResourceUsage[];
  securityEvents: SecurityEvent[];
  securityAlerts: SecurityAlert[];
  mfaSessions: MFASession[];
  featureFlags: FeatureFlag[];
  featureRollouts: FeatureRollout[];
  releaseVersions: ReleaseVersion[];
  deploymentHistory: DeploymentHistory[];
  environmentConfigs: EnvironmentConfig[];
  backupJobs: BackupJob[];
  backupHistory: BackupHistory[];
  restoreHistory: RestoreHistory[];
  systemHealth: SystemHealth[];
  systemIncidents: SystemIncident[];
  incidentTimelines: IncidentTimeline[];
  platformMetrics: PlatformMetric[];
  systemSettings: SystemSetting[];
  // Computed metrics
  totalJobs: number;
  pendingJobs: number;
  activeJobs: number;
  failedJobs: number;
  deadLetterJobs: number;
  totalWorkers: number;
  activeWorkers: number;
  totalCost: number;
  aiSpend: number;
  apiUsageCost: number;
  infrastructureCost: number;
  openAlerts: number;
  criticalAlerts: number;
  activeIncidents: number;
  overallHealthScore: number;
  healthyComponents: number;
  degradedComponents: number;
  unhealthyComponents: number;
  totalFeatureFlags: number;
  enabledFeatureFlags: number;
  activeDeployments: number;
  completedBackups: number;
  failedBackups: number;
  totalLogs: number;
  errorLogs: number;
  warningLogs: number;
  avgResponseTime: number;
  cacheHitRatio: number;
  totalResourceUsage: number;
};
