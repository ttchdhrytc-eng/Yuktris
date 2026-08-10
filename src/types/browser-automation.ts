// ============================================================
// Browser Automation Types
// ============================================================

export type BrowserType = 'chromium' | 'firefox' | 'webkit';

export type WorkerStatus =
  | 'idle'
  | 'busy'
  | 'launching'
  | 'closing'
  | 'crashed'
  | 'error'
  | 'offline'
  | 'maintenance';

export type QueueStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'retrying'
  | 'failed'
  | 'cancelled';

export type ActionType =
  | 'visit'
  | 'click'
  | 'type'
  | 'scroll'
  | 'hover'
  | 'wait'
  | 'screenshot'
  | 'evaluate'
  | 'fill'
  | 'select'
  | 'press'
  | 'upload'
  | 'download'
  | 'reload'
  | 'go_back'
  | 'go_forward'
  | 'close_page'
  | 'new_page'
  | 'get_text'
  | 'get_attribute'
  | 'wait_for_selector'
  | 'wait_for_navigation';

export type ScreenshotType = 'before' | 'after' | 'error' | 'debug';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface BrowserSession {
  id: string;
  workspace_id: string;
  name: string;
  session_type: string;
  cookies: unknown[];
  storage_state: Record<string, unknown>;
  local_storage: Record<string, unknown>;
  session_storage: Record<string, unknown>;
  encrypted: boolean;
  encryption_key_id: string | null;
  user_agent: string | null;
  viewport: { width: number; height: number } | null;
  timezone: string | null;
  locale: string | null;
  status: string;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrowserWorker {
  id: string;
  workspace_id: string;
  worker_id: string;
  provider: string;
  status: WorkerStatus;
  browser_version: string | null;
  fingerprint: Record<string, unknown> | null;
  proxy_config: Record<string, unknown> | null;
  session_id: string | null;
  queue_depth: number;
  last_heartbeat: string | null;
  last_activity: string | null;
  total_tasks: number;
  total_errors: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface BrowserPage {
  id: string;
  workspace_id: string;
  worker_id: string;
  page_index: number;
  url: string | null;
  title: string | null;
  status: string;
  load_time_ms: number | null;
  network_error_count: number;
  last_network_error: string | null;
  screenshot_path: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrowserAction {
  id: string;
  workspace_id: string;
  worker_id: string | null;
  page_id: string | null;
  session_id: string | null;
  queue_id: string | null;
  action_type: ActionType;
  action_params: Record<string, unknown>;
  status: QueueStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  screenshot_before_path: string | null;
  screenshot_after_path: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface BrowserQueueItem {
  id: string;
  workspace_id: string;
  worker_id: string | null;
  session_id: string | null;
  agent_id: string | null;
  action_type: ActionType;
  action_params: Record<string, unknown>;
  priority: number;
  status: QueueStatus;
  retry_count: number;
  max_retries: number;
  error: string | null;
  result: Record<string, unknown> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  created_at: string;
  updated_at: string;
}

export interface BrowserError {
  id: string;
  workspace_id: string;
  worker_id: string | null;
  page_id: string | null;
  action_id: string | null;
  queue_id: string | null;
  error_type: string;
  error_message: string;
  stack_trace: string | null;
  screenshot_path: string | null;
  url: string | null;
  retry_count: number;
  resolved: boolean;
  resolved_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BrowserLog {
  id: string;
  workspace_id: string;
  worker_id: string | null;
  page_id: string | null;
  level: LogLevel;
  category: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface BrowserHealth {
  id: string;
  workspace_id: string;
  worker_id: string;
  cpu_usage: number;
  memory_usage_mb: number;
  current_url: string | null;
  last_action: string | null;
  page_load_time_ms: number | null;
  network_error_count: number;
  crash_count: number;
  is_responsive: boolean;
  uptime_seconds: number;
  recorded_at: string;
}

export interface BrowserScreenshot {
  id: string;
  workspace_id: string;
  worker_id: string | null;
  page_id: string | null;
  action_id: string | null;
  screenshot_type: ScreenshotType;
  storage_path: string;
  url: string | null;
  page_title: string | null;
  viewport: { width: number; height: number } | null;
  file_size_bytes: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}
