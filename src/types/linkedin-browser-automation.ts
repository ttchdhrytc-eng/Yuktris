// ============================================================
// LinkedIn Session Management Types
// ============================================================

export type LinkedInAccountStatus = 'active' | 'paused' | 'restricted' | 'banned' | 'expired' | 'pending_login' | 'disconnected';
export type LinkedInSessionStatus = 'connected' | 'disconnected' | 'expired' | 'reconnecting';
export type LinkedInSessionHealth = 'active' | 'expired' | 'revoked' | 'refreshing' | 'invalid';
export type SessionEventType =
  | 'created' | 'refreshed' | 'expired' | 'validated' | 'restored' | 'revoked'
  | 'login_success' | 'login_failed' | 'captcha_detected' | 'restriction_detected' | 'rate_limit_detected';

// ── Session Lifecycle States ─────────────────────────────────
export type SessionLifecycleState =
  | 'new'
  | 'authenticating'
  | 'authenticated'
  | 'restoring'
  | 'active'
  | 'verifying'
  | 'expired'
  | 'failed'
  | 'reconnect_required';

export type SessionHealthStatus =
  | 'new'
  | 'healthy'
  | 'warning'
  | 'expired'
  | 'disconnected'
  | 'browser_lost'
  | 'browserbase_missing'
  | 'playwright_lost'
  | 'auth_failed'
  | 'corrupted';

export interface LinkedInAccount {
  id: string;
  workspace_id: string;
  account_name: string;
  linkedin_email: string;
  profile_url: string | null;
  profile_name: string | null;
  profile_headline: string | null;
  profile_picture_url: string | null;
  status: LinkedInAccountStatus;
  session_status: LinkedInSessionStatus;
  connection_state: string;
  last_validated_at: string | null;
  last_error: string | null;
  dry_run_enabled: boolean;
  last_login_at: string | null;
  last_activity_at: string | null;
  daily_connection_limit: number;
  daily_message_limit: number;
  daily_profile_visit_limit: number;
  hourly_action_limit: number;
  connections_today: number;
  messages_today: number;
  profile_visits_today: number;
  actions_this_hour: number;
  last_limit_reset_at: string;
  browserbase_session_id: string | null;
  browser_connected_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LinkedInSession {
  id: string;
  workspace_id: string;
  account_id: string;
  session_name: string;
  cookies_encrypted: string | null;
  storage_state_encrypted: string | null;
  local_storage_encrypted: string | null;
  session_storage_encrypted: string | null;
  encrypted: boolean;
  encryption_key_id: string | null;
  user_agent: string | null;
  viewport: { width: number; height: number } | null;
  timezone: string | null;
  locale: string | null;
  language: string | null;
  browser_version: string | null;
  playwright_version: string | null;
  browserbase_session_id: string | null;
  browser_fingerprint: Record<string, unknown>;
  status: LinkedInSessionHealth;
  connection_state: SessionLifecycleState;
  health_status: SessionHealthStatus;
  authenticated: boolean;
  authenticated_at: string | null;
  last_validated_at: string | null;
  last_used_at: string | null;
  last_activity_at: string | null;
  expires_at: string | null;
  failure_reason: string | null;
  retry_count: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LinkedInSessionBackup {
  id: string;
  workspace_id: string;
  account_id: string;
  session_id: string | null;
  backup_name: string;
  cookies_encrypted: string | null;
  storage_state_encrypted: string | null;
  encrypted: boolean;
  backup_type: 'manual' | 'auto' | 'pre_refresh';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LinkedInLoginHistory {
  id: string;
  workspace_id: string;
  account_id: string;
  login_status: 'success' | 'failed' | 'captcha' | '2fa' | 'restricted' | 'error';
  ip_address: string | null;
  user_agent: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LinkedInDevice {
  id: string;
  workspace_id: string;
  account_id: string;
  device_name: string;
  fingerprint: Record<string, unknown>;
  user_agent: string | null;
  ip_address: string | null;
  timezone: string | null;
  trusted: boolean;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LinkedInSessionEvent {
  id: string;
  workspace_id: string;
  account_id: string;
  session_id: string | null;
  event_type: SessionEventType;
  event_data: Record<string, unknown>;
  created_at: string;
}

// ── Execution Queue Types ───────────────────────────────────

export type ExecutionStatus = 'pending' | 'running' | 'waiting' | 'retry' | 'failed' | 'completed' | 'cancelled' | 'escalated';
export type ExecutionPriority = 1 | 2 | 3 | 4;
export type PriorityLabel = 'critical' | 'high' | 'medium' | 'low';

export interface BrowserExecutionQueueItem {
  id: string;
  workspace_id: string;
  account_id: string | null;
  worker_id: string | null;
  session_id: string | null;
  agent_id: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
  priority: ExecutionPriority;
  priority_label: PriorityLabel;
  status: ExecutionStatus;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  escalated_at: string | null;
  escalation_reason: string | null;
  parent_job_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BrowserExecutionHistory {
  id: string;
  workspace_id: string;
  queue_id: string | null;
  account_id: string | null;
  worker_id: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
  status: 'completed' | 'failed' | 'cancelled' | 'escalated';
  result: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  retry_count: number;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BrowserExecutionLog {
  id: string;
  workspace_id: string;
  execution_id: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface BrowserExecutionFailure {
  id: string;
  workspace_id: string;
  execution_id: string;
  account_id: string | null;
  worker_id: string | null;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  screenshot_path: string | null;
  url: string | null;
  retry_count: number;
  resolved: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BrowserRetryQueueItem {
  id: string;
  workspace_id: string;
  execution_id: string;
  original_queue_id: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  next_retry_at: string;
  last_error: string | null;
  backoff_seconds: number;
  status: 'waiting' | 'scheduled' | 'executing' | 'completed' | 'exhausted';
  created_at: string;
  updated_at: string;
}

export interface BrowserDeadLetterItem {
  id: string;
  workspace_id: string;
  execution_id: string;
  original_queue_id: string | null;
  account_id: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
  failure_reason: string;
  retry_count: number;
  last_error: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Conversation Types ──────────────────────────────────────

export type ConversationStage = 'initial' | 'engaged' | 'qualified' | 'objection' | 'negotiation' | 'meeting_scheduled' | 'closed_won' | 'closed_lost' | 'nurture';
export type ConversationHealth = 'active' | 'stalled' | 'dormant' | 'replied' | 'hot' | 'cold';
export type MessageDirection = 'inbound' | 'outbound';
export type IntentCategory = 'buying' | 'informational' | 'objection' | 'positive' | 'negative' | 'neutral' | 'meeting_request' | 'follow_up' | 'disqualification';
export type ObjectionType = 'price' | 'timing' | 'authority' | 'need' | 'trust' | 'competitor' | 'budget' | 'process' | 'risk' | 'other';
export type ConversationActionType = 'send_reply' | 'schedule_followup' | 'handle_objection' | 'qualify' | 'score_lead' | 'detect_meeting' | 'escalate' | 'mark_hot' | 'nurture' | 'disqualify';

export interface LinkedInConversation {
  id: string;
  workspace_id: string;
  account_id: string;
  prospect_name: string;
  prospect_profile_url: string | null;
  prospect_headline: string | null;
  prospect_company: string | null;
  prospect_title: string | null;
  conversation_urn: string | null;
  stage: ConversationStage;
  health: ConversationHealth;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_message_direction: MessageDirection | null;
  unread_count: number;
  total_messages: number;
  ai_enabled: boolean;
  auto_reply_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LinkedInMessage {
  id: string;
  workspace_id: string;
  conversation_id: string;
  account_id: string;
  direction: MessageDirection;
  message_type: string;
  body: string;
  sender_name: string | null;
  sender_profile_url: string | null;
  linkedin_message_urn: string | null;
  ai_generated: boolean;
  ai_confidence: number | null;
  approved: boolean;
  approved_by: string | null;
  approved_at: string | null;
  read_at: string | null;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Meeting Types ────────────────────────────────────────────

export type CalendarProvider = 'google' | 'outlook';
export type MeetingType = 'discovery' | 'demo' | 'follow_up' | 'negotiation' | 'closing';
export type MeetingRequestStatus = 'pending' | 'slots_generated' | 'slots_proposed' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type MeetingSlotStatus = 'available' | 'proposed' | 'confirmed' | 'rejected' | 'expired';
export type MeetingProvider = 'google_meet' | 'zoom' | 'outlook' | 'teams' | 'other';

export interface CalendarConnection {
  id: string;
  workspace_id: string;
  provider: CalendarProvider;
  email: string;
  status: 'active' | 'expired' | 'error' | 'disconnected';
  calendar_id: string | null;
  last_synced_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CalendarEvent {
  id: string;
  workspace_id: string;
  connection_id: string;
  external_event_id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string;
  timezone: string | null;
  attendees: unknown[];
  location: string | null;
  meeting_url: string | null;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LinkedInMeetingRequest {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  account_id: string | null;
  prospect_name: string;
  prospect_email: string | null;
  prospect_timezone: string | null;
  meeting_type: MeetingType;
  duration_minutes: number;
  preferred_dates: unknown[];
  status: MeetingRequestStatus;
  notes: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LinkedInMeetingSlot {
  id: string;
  workspace_id: string;
  meeting_request_id: string;
  start_time: string;
  end_time: string;
  timezone: string;
  status: MeetingSlotStatus;
  conflict_detected: boolean;
  conflict_details: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LinkedInMeetingConfirmation {
  id: string;
  workspace_id: string;
  meeting_request_id: string;
  slot_id: string;
  confirmed_start: string;
  confirmed_end: string;
  timezone: string;
  meeting_url: string | null;
  meeting_provider: MeetingProvider | null;
  calendar_event_id: string | null;
  prospect_confirmed: boolean;
  prospect_confirmed_at: string | null;
  crm_updated: boolean;
  linkedin_notified: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LinkedInMeetingReminder {
  id: string;
  workspace_id: string;
  meeting_confirmation_id: string;
  reminder_type: '24h' | '1h' | '15m' | '5m' | 'post_meeting';
  scheduled_for: string;
  channel: 'linkedin' | 'email' | 'slack' | 'sms';
  message: string | null;
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ── Auth Interaction Types ─────────────────────────────────

export type AuthInteractionType =
  | 'progress' | 'screenshot' | 'challenge' | 'credential_request'
  | 'credential_response' | 'session_saved' | 'error';

export type AuthInteractionStep =
  | 'creating_session' | 'launching_browser' | 'opening_linkedin'
  | 'waiting_for_login' | 'challenge_detected' | 'saving_session'
  | 'connected' | 'login_timeout' | 'login_failed';

export type ChallengeType = 'email_otp' | 'captcha' | 'two_factor' | 'phone_verification';

export interface LinkedInAuthInteraction {
  id: string;
  workspace_id: string;
  account_id: string;
  queue_item_id: string | null;
  interaction_type: AuthInteractionType;
  step: string;
  message: string;
  screenshot_path: string | null;
  challenge_type: ChallengeType | null;
  challenge_description: string | null;
  status: 'pending' | 'completed' | 'expired' | 'cancelled';
  user_response: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export interface LinkedInSessionHeartbeat {
  id: string;
  workspace_id: string;
  account_id: string;
  session_id: string | null;
  worker_id: string | null;
  status: 'alive' | 'expired' | 'refreshing';
  url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
