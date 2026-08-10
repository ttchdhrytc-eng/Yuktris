import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from './logger.js';

export interface QueueItem {
  id: string;
  workspace_id: string;
  account_id: string | null;
  worker_id: string | null;
  session_id: string | null;
  agent_id: string | null;
  action_type: string;
  action_params: Record<string, unknown>;
  priority: number;
  priority_label: string;
  status: string;
  retry_count: number;
  max_retries: number;
  next_retry_at: string | null;
  error: string | null;
  result: Record<string, unknown> | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export class Queue {
  private client: SupabaseClient;
  private workerId: string;
  private pollInterval: number;

  constructor(client: SupabaseClient, workerId: string, pollIntervalMs: number) {
    this.client = client;
    this.workerId = workerId;
    this.pollInterval = pollIntervalMs;
  }

  async claimNext(): Promise<QueueItem | null> {
    logger.info('Polling queue for tasks...', { worker_id: this.workerId });

    // Atomic claim via SECURITY DEFINER RPC (FOR UPDATE SKIP LOCKED)
    const { data, error } = await this.client.rpc('claim_queue_task', {
      p_worker_id: this.workerId,
    });

    if (error) {
      logger.error('Queue claim error', { worker_id: this.workerId, error: error.message, code: error.code });
      return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) {
      logger.info('No tasks found in queue', { worker_id: this.workerId });
      return null;
    }

    const item = Array.isArray(data) ? data[0] : data;
    if (!item || !item.id) {
      logger.info('No tasks found in queue (empty result)', { worker_id: this.workerId });
      return null;
    }

    logger.info('Claimed task', { id: item.id, action: item.action_type, account_id: item.account_id, status: item.status });
    return item as QueueItem;
  }

  async complete(itemId: string, result: Record<string, unknown>, durationMs: number) {
    const { error } = await this.client.rpc('complete_queue_task', {
      p_task_id: itemId,
      p_result: result,
      p_duration_ms: durationMs,
    });

    if (error) {
      logger.error('Failed to mark task complete', { id: itemId, error: error.message });
    } else {
      logger.info('Task completed', { id: itemId, duration_ms: durationMs });
    }
  }

  async fail(itemId: string, errorMsg: string, durationMs: number, retryable: boolean) {
    const { error } = await this.client.rpc('fail_queue_task', {
      p_task_id: itemId,
      p_error: errorMsg,
      p_duration_ms: durationMs,
      p_retryable: retryable,
    });

    if (error) {
      logger.error('Failed to mark task failed', { id: itemId, error: error.message });
    } else {
      logger.warn('Task failed', { id: itemId, error: errorMsg, retryable });
    }
  }
}
