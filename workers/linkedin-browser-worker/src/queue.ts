import { SupabaseClient } from '@supabase/supabase-js';
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
  attempt_id: string;
  lease_expires_at: string;
  idempotency_key: string | null;
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
      p_lease_seconds: 90,
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
    return this.rememberClaim(item as QueueItem);
  }

  async complete(itemId: string, result: Record<string, unknown>, durationMs: number) {
    const attemptId = this.requireAttempt(itemId);
    const { error } = await this.client.rpc('complete_queue_task', {
      p_task_id: itemId,
      p_worker_id: this.workerId,
      p_attempt_id: attemptId,
      p_result: result,
      p_duration_ms: durationMs,
    });

    if (error) {
      logger.error('Failed to mark task complete', { id: itemId, error: error.message });
      throw error;
    } else {
      logger.info('Task completed', { id: itemId, duration_ms: durationMs });
    }
  }

  async fail(itemId: string, errorMsg: string, durationMs: number, retryable: boolean, result: Record<string, unknown> = {}) {
    const attemptId = this.requireAttempt(itemId);
    const { error } = await this.client.rpc('fail_queue_task_with_result', {
      p_task_id: itemId,
      p_worker_id: this.workerId,
      p_attempt_id: attemptId,
      p_error: errorMsg,
      p_duration_ms: durationMs,
      p_retryable: retryable,
      p_result: result,
    });

    if (error) {
      logger.error('Failed to mark task failed', { id: itemId, error: error.message });
      throw error;
    } else {
      logger.warn('Task failed', { id: itemId, error: errorMsg, retryable });
    }
  }

  private attempts = new Map<string, string>();

  rememberClaim(item: QueueItem): QueueItem {
    if (!item.attempt_id) throw new Error('Claimed queue task has no attempt ID');
    this.attempts.set(item.id, item.attempt_id);
    return item;
  }

  private requireAttempt(itemId: string): string {
    const attemptId = this.attempts.get(itemId);
    if (!attemptId) throw new Error(`No active claim ownership for queue task ${itemId}`);
    return attemptId;
  }

  async renew(itemId: string): Promise<boolean> {
    const attemptId = this.requireAttempt(itemId);
    const { data, error } = await this.client.rpc('renew_queue_lease', {
      p_task_id: itemId,
      p_worker_id: this.workerId,
      p_attempt_id: attemptId,
      p_lease_seconds: 90,
    });
    if (error) throw error;
    return data === true;
  }

  async claimNextAuthentication(): Promise<QueueItem | null> {
    logger.info('Polling authentication queue for tasks...', { worker_id: this.workerId });

    const { data, error } = await this.client.rpc('claim_linkedin_auth_task', {
      p_worker_id: this.workerId,
      p_lease_seconds: 90,
    });

    if (error) {
      logger.error('Authentication queue claim error', { worker_id: this.workerId, error: error.message, code: error.code });
      return null;
    }

    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const item = Array.isArray(data) ? data[0] : data;
    if (!item?.id) return null;
    if (item.action_type !== 'linkedin_connect')
      throw new Error(`Authentication-only claim returned prohibited action ${String(item.action_type)}`);
    logger.info('Claimed authentication task', { id: item.id, action: item.action_type, account_id: item.account_id });
    return this.rememberClaim(item as QueueItem);
  }

  async claimProductionAcceptance(authorizationId: string): Promise<QueueItem | null> {
    logger.info('Polling production acceptance queue', { worker_id: this.workerId, authorization_id: authorizationId });
    const { data, error } = await this.client.rpc('claim_production_linkedin_acceptance_task', {
      p_worker_id: this.workerId,
      p_authorization_id: authorizationId,
      p_lease_seconds: 90,
    });
    if (error) {
      logger.error('Production acceptance claim error', { worker_id: this.workerId, error: error.message, code: error.code });
      return null;
    }
    if (!data || (Array.isArray(data) && data.length === 0)) return null;
    const item = Array.isArray(data) ? data[0] : data;
    if (!item?.id) return null;
    if (item.action_type !== 'connection_request' || item.action_params?.production_acceptance_authorization_id !== authorizationId)
      throw new Error('Production acceptance claim returned an incorrectly bound task');
    return this.rememberClaim(item as QueueItem);
  }

  async recordBrowserCorrelation(itemId: string, browserbaseSessionId: string | null, persistentContextId: string | null): Promise<void> {
    const attemptId = this.requireAttempt(itemId);
    const { data, error } = await this.client.rpc('record_browser_attempt_correlation', {
      p_task_id: itemId,
      p_worker_id: this.workerId,
      p_attempt_id: attemptId,
      p_browserbase_session_id: browserbaseSessionId,
      p_persistent_context_id: persistentContextId,
    });
    if (error) throw error;
    if (data !== true) throw new Error('Browser attempt correlation ownership lost');
  }

  async recordWriteStage(itemId: string, stage: string, interactionCrossed: boolean, evidence: Record<string, unknown> = {}): Promise<void> {
    const attemptId = this.requireAttempt(itemId);
    const { data, error } = await this.client.rpc('record_linkedin_write_interaction_stage', {
      p_task_id: itemId,
      p_worker_id: this.workerId,
      p_attempt_id: attemptId,
      p_stage: stage,
      p_interaction_crossed: interactionCrossed,
      p_evidence: evidence,
    });
    if (error) throw error;
    if (data !== true) throw new Error('Write interaction stage ownership lost');
  }

  async releaseAccountLease(itemId: string): Promise<boolean> {
    const attemptId = this.requireAttempt(itemId);
    const { data, error } = await this.client.rpc('release_linkedin_account_browser_lease', {
      p_task_id: itemId,
      p_worker_id: this.workerId,
      p_attempt_id: attemptId,
    });
    if (error) throw error;
    this.attempts.delete(itemId);
    return data === true;
  }
}
