// ============================================================
// LinkedIn Execution Agent — Types
// ============================================================

export type ExecutionStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'stopped';

export type QueueItemStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'retry';

export type ActionType =
  | 'connection_request'
  | 'connection_accepted'
  | 'message_sent'
  | 'followup_sent'
  | 'profile_visit'
  | 'post_engagement'
  | 'reply_received'
  | 'conversation_started'
  | 'meeting_ready';

export type ActionResult =
  | 'success'
  | 'failed'
  | 'pending'
  | 'rate_limited'
  | 'daily_limit_reached'
  | 'skipped'
  | 'blocked';

// ============================================================
// Main Records
// ============================================================

export type LinkedInCampaign = {
  id: string;
  workspace_id: string;
  campaign_id: string | null;
  prospect_name: string | null;
  prospect_title: string | null;
  company_name: string | null;
  status: ExecutionStatus;
  progress: number;
  current_step: string | null;
  started_at: string | null;
  completed_at: string | null;
  execution_score: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ExecutionQueueItem = {
  id: string;
  campaign_execution_id: string;
  sequence: number;
  action_type: string;
  scheduled_at: string | null;
  executed_at: string | null;
  status: QueueItemStatus;
  retry_count: number;
  created_at: string;
};

export type LinkedInAction = {
  id: string;
  campaign_execution_id: string;
  contact_id: string | null;
  action_type: string;
  result: string | null;
  duration: number;
  error_message: string | null;
  created_at: string;
};

export type SafetyLog = {
  id: string;
  campaign_execution_id: string;
  risk_score: number;
  daily_usage: number;
  hourly_usage: number;
  cooldown_until: string | null;
  created_at: string;
};

export type PerformanceMetric = {
  id: string;
  campaign_execution_id: string;
  connections_sent: number;
  messages_sent: number;
  followups_sent: number;
  replies_received: number;
  acceptance_rate: number;
  reply_rate: number;
  positive_replies: number;
  negative_replies: number;
  ignored_count: number;
  blocked_count: number;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullLinkedInExecution = LinkedInCampaign & {
  queue: ExecutionQueueItem[];
  actions: LinkedInAction[];
  safety_log: SafetyLog | null;
  performance: PerformanceMetric | null;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type ExecutionStage =
  | 'loading_campaign'
  | 'building_queue'
  | 'validating_safety'
  | 'scheduling_actions'
  | 'executing_campaign'
  | 'updating_progress'
  | 'saving_logs';

export type ExecutionStageInfo = {
  stage: ExecutionStage;
  label: string;
  description: string;
};

// ============================================================
// Timeline Events
// ============================================================

export type ExecutionTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
  actionType?: ActionType;
};

// ============================================================
// AI Recommendations
// ============================================================

export type ExecutionAIRecommendations = {
  campaign_health: 'excellent' | 'good' | 'warning' | 'critical';
  execution_recommendations: string[];
  optimization_suggestions: string[];
  risk_alerts: string[];
  next_action: string;
};

// ============================================================
// Safety Center Data
// ============================================================

export type SafetyCenterData = {
  daily_limit: number;
  daily_used: number;
  hourly_limit: number;
  hourly_used: number;
  cooldown_active: boolean;
  cooldown_until: string | null;
  rate_limit_remaining: number;
  account_health: 'excellent' | 'good' | 'warning' | 'critical';
  risk_score: number;
};

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'json' | 'csv';

export type ExportConfig = {
  format: ExportFormat;
  data: string;
  filename: string;
};

// ============================================================
// Service Interface Types (for future API integrations)
// ============================================================

export type LinkedInConnectResult = {
  connected: boolean;
  session_id: string;
};

export type LinkedInMessageResult = {
  delivered: boolean;
  message_id: string;
};

export type SalesNavigatorLeadResult = {
  saved: boolean;
  lead_id: string;
};

export type CRMUpdateResult = {
  updated: boolean;
  lead_id: string;
};

export type QueueOperationResult = {
  success: boolean;
  queue_id: string;
};

export type WebhookDeliveryResult = {
  delivered: boolean;
  webhook_id: string;
};
