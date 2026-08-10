export type WebhookSubscription = {
  id: string; workspace_id: string; subscription_name: string;
  endpoint_url: string; events: string[]; is_active: boolean;
  secret_id: string | null; content_type: string;
  headers: Record<string, string>; retry_count: number;
  retry_delay_seconds: number; timeout_seconds: number;
  created_at: string; updated_at: string;
};
export type WebhookEvent = {
  id: string; workspace_id: string; event_name: string;
  event_category: string; event_description: string | null;
  event_schema: Record<string, unknown>; is_active: boolean;
  created_at: string;
};
export type WebhookDelivery = {
  id: string; workspace_id: string; subscription_id: string;
  event_name: string; event_id: string | null;
  payload: Record<string, unknown>; attempt_number: number;
  status: string; http_status: number | null;
  response_body: string | null; latency_ms: number | null;
  error_message: string | null; next_retry_at: string | null;
  delivered_at: string | null; created_at: string; updated_at: string;
};
export type WebhookDeadLetter = {
  id: string; workspace_id: string; subscription_id: string | null;
  event_name: string; event_id: string | null;
  payload: Record<string, unknown>; failure_reason: string;
  total_attempts: number; last_error: string | null;
  last_attempt_at: string | null; is_replayed: boolean;
  created_at: string;
};
export type WebhookTemplate = {
  id: string; workspace_id: string; template_name: string;
  event_name: string; template_body: Record<string, unknown>;
  is_active: boolean; created_at: string; updated_at: string;
};
export type WebhookSecret = {
  id: string; workspace_id: string; secret_name: string;
  is_active: boolean; created_at: string; updated_at: string;
};
export type WebhookReplayLog = {
  id: string; workspace_id: string; delivery_id: string;
  replay_status: string; replay_response: string | null;
  replay_http_status: number | null; replayed_by: string | null;
  created_at: string;
};
export type WebhookPlatformDashboard = {
  subscriptions: WebhookSubscription[]; events: WebhookEvent[];
  deliveries: WebhookDelivery[]; deadLetters: WebhookDeadLetter[];
  templates: WebhookTemplate[]; secrets: WebhookSecret[];
  replayLogs: WebhookReplayLog[];
  totalDeliveries: number; successfulDeliveries: number;
  failedDeliveries: number; pendingDeliveries: number;
  deadLetterCount: number; successRate: number;
  avgLatency: number; deliveriesToday: number;
};
