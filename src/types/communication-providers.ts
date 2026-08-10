// ============================================================
// Enterprise Communication Provider Layer — Type Definitions
// ============================================================

export type ProviderKey =
  | 'gmail' | 'outlook' | 'linkedin_messaging' | 'whatsapp_business'
  | 'slack' | 'microsoft_teams' | 'twilio_sms' | 'custom' | 'future';

export type ProviderType = 'email' | 'messaging' | 'sms' | 'custom' | 'future';
export type AuthType = 'oauth' | 'api_key' | 'webhook' | 'service';

export type ConnectionStatus =
  | 'connected' | 'disconnected' | 'expired' | 'error' | 'pending' | 'connecting';

export type ConnectionHealth =
  | 'healthy' | 'degraded' | 'expired' | 'error' | 'unknown';

export type EventType =
  | 'connected' | 'disconnected' | 'token_refreshed' | 'sync_started'
  | 'sync_completed' | 'error' | 'webhook_received' | 'rate_limited'
  | 'retried' | 'failed_over' | 'health_check' | 'capability_check';

export type EventStatus = 'success' | 'failure' | 'warning' | 'info';

export type OperationType =
  | 'send_message' | 'schedule_message' | 'cancel_message'
  | 'search_messages' | 'get_thread' | 'get_message'
  | 'list_folders' | 'sync' | 'connect' | 'disconnect'
  | 'refresh' | 'health_check' | 'register_webhook' | 'process_webhook';

export type OperationStatus =
  | 'pending' | 'success' | 'failure' | 'timeout' | 'rate_limited' | 'retrying';

export type Direction = 'outbound' | 'inbound';

export type CapabilityKey =
  | 'initialize' | 'connect' | 'disconnect' | 'refresh' | 'health_check'
  | 'validate' | 'send_message' | 'schedule_message' | 'cancel_message'
  | 'search_messages' | 'get_thread' | 'get_message' | 'list_folders'
  | 'sync' | 'register_webhook' | 'process_webhook';

export type WebhookStatus = 'active' | 'inactive' | 'error' | 'processing';

// ============================================================
// Database Records
// ============================================================

export type CommunicationProviderRecord = {
  id: string;
  provider_key: ProviderKey;
  provider_name: string;
  provider_type: ProviderType;
  auth_type: AuthType;
  description: string | null;
  icon: string | null;
  color: string | null;
  priority: number;
  is_active: boolean;
  is_built_in: boolean;
  capabilities: string[];
  default_scopes: string[];
  auth_url: string | null;
  token_url: string | null;
  docs_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProviderConnectionRecord = {
  id: string;
  workspace_id: string;
  provider_id: string;
  provider_key: ProviderKey;
  status: ConnectionStatus;
  connection_health: ConnectionHealth;
  connected_account: string | null;
  connected_account_id: string | null;
  credentials: Record<string, unknown>;
  scopes: string[];
  token_expires_at: string | null;
  last_sync_at: string | null;
  last_health_check_at: string | null;
  sync_cursor: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderCapabilityRecord = {
  id: string;
  provider_id: string;
  capability_key: string;
  capability_name: string;
  is_supported: boolean;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
};

export type ProviderHealthRecord = {
  id: string;
  connection_id: string;
  health_status: ConnectionHealth;
  latency_ms: number | null;
  is_healthy: boolean;
  error_message: string | null;
  consecutive_failures: number;
  last_checked_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ProviderEventRecord = {
  id: string;
  connection_id: string | null;
  provider_id: string | null;
  workspace_id: string | null;
  event_type: EventType;
  event_status: EventStatus;
  message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ProviderLogRecord = {
  id: string;
  connection_id: string | null;
  workspace_id: string | null;
  operation: OperationType;
  direction: Direction | null;
  message_id: string | null;
  thread_id: string | null;
  status: OperationStatus;
  latency_ms: number | null;
  request_data: Record<string, unknown>;
  response_data: Record<string, unknown>;
  error_message: string | null;
  created_at: string;
};

export type ProviderRateLimitRecord = {
  id: string;
  connection_id: string;
  limit_window: string;
  max_requests: number;
  current_count: number;
  reset_at: string | null;
  remaining: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type ProviderWebhookRecord = {
  id: string;
  connection_id: string | null;
  provider_id: string | null;
  workspace_id: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
  subscribed_events: string[];
  webhook_status: WebhookStatus;
  raw_payload: Record<string, unknown>;
  processed_payload: Record<string, unknown>;
  is_processed: boolean;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
};

// ============================================================
// Provider Interface
// ============================================================

export type ProviderContext = {
  connectionId: string;
  workspaceId: string;
  providerKey: ProviderKey;
  connectedAccount: string | null;
  credentials: Record<string, unknown>;
  metadata: Record<string, unknown>;
};

export type SendMessageRequest = {
  to: string | string[];
  subject?: string;
  body: string;
  cc?: string[];
  bcc?: string[];
  attachments?: { filename: string; content_type: string; size: number }[];
  metadata?: Record<string, unknown>;
};

export type SendMessageResult = {
  message_id: string;
  thread_id?: string;
  status: OperationStatus;
  provider_response: Record<string, unknown>;
};

export type ScheduleMessageRequest = SendMessageRequest & {
  scheduled_at: string;
};

export type SearchMessagesRequest = {
  query?: string;
  folder?: string;
  limit?: number;
  cursor?: string;
  filters?: Record<string, unknown>;
};

export type SearchMessagesResult = {
  messages: ProviderMessage[];
  next_cursor: string | null;
  total: number;
};

export type ProviderMessage = {
  id: string;
  thread_id: string | null;
  subject: string | null;
  from: string;
  to: string[];
  cc?: string[];
  body: string;
  snippet: string | null;
  received_at: string | null;
  sent_at: string | null;
  is_read: boolean;
  labels?: string[];
  folder?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderThread = {
  id: string;
  subject: string | null;
  messages: ProviderMessage[];
  snippet: string | null;
  participant_count: number;
  last_message_at: string | null;
};

export type ProviderFolder = {
  id: string;
  name: string;
  type: string;
  unread_count: number;
  total_count: number;
};

export type SyncResult = {
  connection_id: string;
  provider_key: ProviderKey;
  synced: boolean;
  new_messages: number;
  updated_messages: number;
  sync_cursor: string | null;
  last_sync: string;
  error: string | null;
};

export type HealthCheckResult = {
  connection_id: string;
  provider_key: ProviderKey;
  healthy: boolean;
  health: ConnectionHealth;
  latency_ms: number | null;
  status: ConnectionStatus;
  token_expired: boolean;
  token_expires_at: string | null;
  last_checked_at: string;
  errors: string[];
};

export type ConnectResult = {
  auth_url?: string;
  state?: string;
  connected: boolean;
  connection_id?: string;
  error: string | null;
};

export type RefreshResult = {
  connection_id: string;
  provider_key: ProviderKey;
  refreshed: boolean;
  expires_at: string | null;
  error: string | null;
};

export type WebhookRegistration = {
  webhook_id: string;
  webhook_url: string;
  subscribed_events: string[];
  status: WebhookStatus;
};

export type WebhookProcessResult = {
  processed: boolean;
  message_id?: string;
  thread_id?: string;
  error: string | null;
};

export type ICommunicationProvider = {
  providerKey: ProviderKey;
  providerName: string;

  initialize(workspaceId: string): Promise<ProviderConnectionRecord>;
  connect(params: { workspaceId: string; connectionId: string; redirectUri?: string; scopes?: string[] }): Promise<ConnectResult>;
  disconnect(connectionId: string): Promise<void>;
  refresh(connectionId: string): Promise<RefreshResult>;
  healthCheck(connectionId: string): Promise<HealthCheckResult>;
  validate(connectionId: string): Promise<boolean>;
  sendMessage(ctx: ProviderContext, request: SendMessageRequest): Promise<SendMessageResult>;
  scheduleMessage(ctx: ProviderContext, request: ScheduleMessageRequest): Promise<SendMessageResult>;
  cancelMessage(ctx: ProviderContext, messageId: string): Promise<boolean>;
  searchMessages(ctx: ProviderContext, request: SearchMessagesRequest): Promise<SearchMessagesResult>;
  getThread(ctx: ProviderContext, threadId: string): Promise<ProviderThread>;
  getMessage(ctx: ProviderContext, messageId: string): Promise<ProviderMessage>;
  listFolders(ctx: ProviderContext): Promise<ProviderFolder[]>;
  sync(ctx: ProviderContext, cursor?: string): Promise<SyncResult>;
  registerWebhook(ctx: ProviderContext, events: string[]): Promise<WebhookRegistration>;
  processWebhook(ctx: ProviderContext, payload: Record<string, unknown>): Promise<WebhookProcessResult>;
};

// ============================================================
// Provider Definition (static metadata)
// ============================================================

export type ProviderDefinition = {
  key: ProviderKey;
  name: string;
  type: ProviderType;
  authType: AuthType;
  description: string;
  icon: string;
  color: string;
  priority: number;
  isBuiltIn: boolean;
  capabilities: CapabilityKey[];
  defaultScopes: string[];
  authUrl?: string;
  tokenUrl?: string;
  docsUrl?: string;
};

// ============================================================
// API Request / Response Types
// ============================================================

export type ConnectRequest = {
  providerKey: ProviderKey;
  workspaceId: string;
  redirectUri?: string;
  scopes?: string[];
};

export type DisconnectRequest = {
  connectionId: string;
};

export type TestConnectionRequest = {
  connectionId: string;
};

export type SyncRequest = {
  connectionId: string;
  cursor?: string;
};

export type ProviderHealthSummary = {
  total: number;
  healthy: number;
  degraded: number;
  expired: number;
  error: number;
  unknown: number;
};

export type ProviderAnalytics = {
  total_connections: number;
  connected: number;
  disconnected: number;
  total_messages_sent: number;
  total_messages_failed: number;
  total_retries: number;
  total_webhooks_received: number;
  total_webhooks_processed: number;
  success_rate: number;
  avg_latency_ms: number | null;
  provider_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  recent_events: ProviderEventRecord[];
  recent_logs: ProviderLogRecord[];
};

// ============================================================
// View Models
// ============================================================

export type ProviderConnectionViewModel = ProviderConnectionRecord & {
  provider: CommunicationProviderRecord | null;
  capabilities: ProviderCapabilityRecord[];
  latest_health: ProviderHealthRecord | null;
  is_expired: boolean;
  needs_reconnect: boolean;
};
