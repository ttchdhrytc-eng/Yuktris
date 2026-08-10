// ============================================================
// Universal Execution Queue Types
// ============================================================

export type ExecutionQueueStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'retrying';

export type ExecutionPriority = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export interface UniversalExecutionQueueItem {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  agent_name: string | null;
  action_type: string;
  integration: string;
  provider: string | null;
  payload: Record<string, unknown>;
  priority: ExecutionPriority;
  status: ExecutionQueueStatus;
  result: Record<string, unknown> | null;
  error: string | null;
  retry_count: number;
  max_retries: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  memory_stored: boolean;
  graph_updated: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExecutionQueueStats {
  total: number;
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
  cancelled: number;
  byIntegration: Record<string, number>;
  avgDurationMs: number | null;
  successRate: number;
}

export interface BrowserWorker {
  id: string;
  workspace_id: string;
  worker_id: string;
  provider: string;
  status: 'idle' | 'busy' | 'offline' | 'error' | 'maintenance';
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

export interface BrowserWorkerTask {
  id: string;
  workspace_id: string;
  worker_id: string;
  task_type: string;
  target_url: string | null;
  payload: Record<string, unknown>;
  status: 'pending' | 'assigned' | 'running' | 'completed' | 'failed' | 'timeout';
  result: Record<string, unknown> | null;
  screenshot_url: string | null;
  logs: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  assigned_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface IntegrationFailure {
  id: string;
  workspace_id: string;
  integration: string;
  provider: string | null;
  error_code: string | null;
  error_message: string;
  endpoint: string | null;
  request_payload: Record<string, unknown> | null;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'retrying' | 'resolved' | 'dead_letter';
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface IntegrationUsageDaily {
  id: string;
  workspace_id: string;
  integration: string;
  provider: string | null;
  date: string;
  api_calls: number;
  tokens_used: number;
  cost_cents: number;
  records_synced: number;
  errors: number;
  avg_latency_ms: number | null;
}
