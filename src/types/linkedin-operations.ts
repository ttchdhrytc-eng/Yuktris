// ============================================================
// LinkedIn Operations Types — Phase 8
// ============================================================

export type LinkedInActionType =
  | 'connection_request' | 'withdraw_invitation' | 'first_message' | 'follow_up_message'
  | 'profile_visit' | 'follow_company' | 'like_post' | 'comment' | 'endorse_skills'
  | 'voice_note' | 'video_message';

export type JobStatus = 'queued' | 'scheduled' | 'running' | 'completed' | 'failed' | 'retrying' | 'cancelled' | 'paused';
export type QueueStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type ActionResult = 'success' | 'failed' | 'pending' | 'rate_limited' | 'policy_violation' | 'already_connected' | 'not_found' | 'blocked';
export type FailureType = 'network' | 'rate_limit' | 'policy_violation' | 'authentication' | 'session_expired' | 'captcha' | 'unknown';
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'down';
export type ConnectionStatus = 'active' | 'warming_up' | 'restricted' | 'cooldown' | 'disconnected';
export type WarmupStatus = 'not_started' | 'in_progress' | 'completed';
export type SequenceStatus = 'active' | 'paused' | 'completed' | 'draft';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped' | 'stopped';
export type StoppedReason = 'meeting_booked' | 'prospect_replied' | 'prospect_rejected' | 'campaign_paused' | 'manual_stop';
export type NotificationType = 'account_disconnected' | 'daily_limit_reached' | 'risk_score_increased' | 'queue_completed' | 'execution_failure' | 'reply_received' | 'invitation_accepted' | 'cooldown_started' | 'warmup_progress' | 'meeting_booked';
export type LogLevel = 'info' | 'warning' | 'error' | 'debug';

// ============================================================
// Database Record Types
// ============================================================

export interface LinkedInAccount {
  id: string;
  workspace_id: string;
  profile_url: string | null;
  display_name: string | null;
  headline: string | null;
  status: string;
  cookies: Record<string, unknown> | null;
  session_token: string | null;
  connection_status: ConnectionStatus;
  daily_connection_limit: number;
  daily_message_limit: number;
  weekly_connection_limit: number;
  weekly_message_limit: number;
  warmup_status: WarmupStatus;
  warmup_day: number;
  risk_score: number;
  last_activity_at: string | null;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  timezone: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedInAccountHealth {
  id: string;
  workspace_id: string;
  linkedin_account_id: string;
  health_status: HealthStatus;
  risk_score: number;
  invitation_acceptance_rate: number;
  reply_ratio: number;
  profile_views_today: number;
  connections_today: number;
  messages_today: number;
  cooldown_until: string | null;
  last_health_check: string;
  health_factors: Record<string, unknown>;
  recommendations: unknown[];
  created_at: string;
  updated_at: string;
}

export interface LinkedInDailyUsage {
  id: string;
  workspace_id: string;
  linkedin_account_id: string;
  usage_date: string;
  connections_sent: number;
  connections_accepted: number;
  messages_sent: number;
  messages_replied: number;
  profile_visits: number;
  posts_liked: number;
  posts_commented: number;
  follows: number;
  endorsements: number;
  invitations_withdrawn: number;
  total_actions: number;
  created_at: string;
  updated_at: string;
}

export interface LinkedInExecutionJob {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  outreach_decision_id: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  sequence_step: number;
  action_type: LinkedInActionType;
  status: JobStatus;
  priority: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  action_payload: Record<string, unknown>;
  result_payload: Record<string, unknown>;
  error_message: string | null;
  retry_count: number;
  max_retries: number;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedInActionHistory {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  execution_job_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  action_type: LinkedInActionType;
  action_result: ActionResult;
  action_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  error_message: string | null;
  duration_ms: number | null;
  screenshot_path: string | null;
  retry_count: number;
  created_at: string;
}

export interface LinkedInSequence {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  sequence_name: string;
  sequence_steps: unknown[];
  total_steps: number;
  status: SequenceStatus;
  created_at: string;
  updated_at: string;
}

export interface LinkedInSequenceState {
  id: string;
  workspace_id: string;
  sequence_id: string;
  linkedin_account_id: string | null;
  contact_id: string;
  company_id: string;
  current_step: number;
  step_status: StepStatus;
  started_at: string | null;
  completed_at: string | null;
  stopped_reason: string | null;
  next_action_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedInQueueItem {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  execution_job_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  action_type: LinkedInActionType;
  priority: number;
  scheduled_at: string | null;
  status: QueueStatus;
  attempts: number;
  locked_at: string | null;
  locked_by: string | null;
  created_at: string;
}

export interface LinkedInExecutionLog {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  execution_job_id: string | null;
  log_level: LogLevel;
  log_message: string;
  log_metadata: Record<string, unknown>;
  created_at: string;
}

export interface LinkedInFailure {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  execution_job_id: string | null;
  contact_id: string | null;
  failure_type: FailureType;
  failure_message: string;
  failure_payload: Record<string, unknown>;
  is_retryable: boolean;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
}

export interface LinkedInRetryHistory {
  id: string;
  workspace_id: string;
  execution_job_id: string;
  failure_id: string | null;
  retry_attempt: number;
  retry_reason: string | null;
  retry_delay_ms: number | null;
  retry_result: string | null;
  created_at: string;
}

export interface LinkedInRateLimit {
  id: string;
  workspace_id: string;
  linkedin_account_id: string;
  action_type: string;
  daily_limit: number;
  daily_used: number;
  weekly_limit: number;
  weekly_used: number;
  reset_at: string | null;
  cooldown_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface LinkedInNotification {
  id: string;
  workspace_id: string;
  linkedin_account_id: string | null;
  notification_type: NotificationType;
  notification_title: string;
  notification_message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  action_url: string | null;
  event_payload?: Record<string, unknown>;
  created_at: string;
}

// ============================================================
// Composite Types
// ============================================================

export interface LinkedInOperationsDashboard {
  totalAccounts: number;
  activeAccounts: number;
  totalJobs: number;
  queuedJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  todayActions: number;
  weeklyActions: number;
  avgRiskScore: number;
  accounts: LinkedInAccount[];
  recentJobs: LinkedInExecutionJob[];
  recentHistory: LinkedInActionHistory[];
  recentFailures: LinkedInFailure[];
  recentNotifications: LinkedInNotification[];
  recentLogs: LinkedInExecutionLog[];
  sequences: LinkedInSequence[];
  sequenceStates: LinkedInSequenceState[];
  queueItems: LinkedInQueueItem[];
  healthRecords: LinkedInAccountHealth[];
  dailyUsage: LinkedInDailyUsage[];
  rateLimits: LinkedInRateLimit[];
  retryHistory: LinkedInRetryHistory[];
}

export interface SafetyCheckResult {
  allowed: boolean;
  reason: string;
  delayMs: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

export interface AIMonitorStatus {
  status: 'idle' | 'sending_connections' | 'sending_messages' | 'waiting' | 'monitoring_replies' | 'respecting_limits' | 'processing_queue' | 'cooldown';
  message: string;
  detail: string;
}
