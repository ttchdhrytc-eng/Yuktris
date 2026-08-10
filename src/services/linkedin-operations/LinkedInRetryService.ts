// ============================================================
// LinkedInRetryService — Automatic retry with smart logic
// ============================================================

import { supabase } from '@/lib/supabase';
import type { FailureType } from '@/types/linkedin-operations';

class LinkedInRetryService {
  private retryableFailures: FailureType[] = ['network', 'rate_limit', 'unknown'];
  private nonRetryableFailures: FailureType[] = ['policy_violation', 'authentication', 'session_expired', 'captcha'];

  // ----------------------------------------------------------
  // Determine if a failure is retryable
  // ----------------------------------------------------------

  isRetryable(failureType: FailureType): boolean {
    return this.retryableFailures.includes(failureType);
  }

  // ----------------------------------------------------------
  // Calculate retry delay with exponential backoff
  // ----------------------------------------------------------

  calculateDelay(retryCount: number, failureType: FailureType): number {
    const baseDelay = 60000; // 1 minute
    const maxDelay = 3600000; // 1 hour

    if (failureType === 'rate_limit') {
      return Math.min(baseDelay * Math.pow(4, retryCount), maxDelay);
    }

    return Math.min(baseDelay * Math.pow(2, retryCount), maxDelay);
  }

  // ----------------------------------------------------------
  // Record a failure
  // ----------------------------------------------------------

  async recordFailure(workspaceId: string, params: {
    linkedin_account_id?: string;
    execution_job_id?: string;
    contact_id?: string;
    failure_type: FailureType;
    failure_message: string;
    failure_payload?: Record<string, unknown>;
  }): Promise<string> {
    const isRetryable = this.isRetryable(params.failure_type);
    const { data, error } = await supabase
      .from('linkedin_failures')
      .insert({
        workspace_id: workspaceId,
        linkedin_account_id: params.linkedin_account_id ?? null,
        execution_job_id: params.execution_job_id ?? null,
        contact_id: params.contact_id ?? null,
        failure_type: params.failure_type,
        failure_message: params.failure_message,
        failure_payload: params.failure_payload ?? {},
        is_retryable: isRetryable,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }

  // ----------------------------------------------------------
  // Record a retry attempt
  // ----------------------------------------------------------

  async recordRetry(workspaceId: string, params: {
    execution_job_id: string;
    failure_id?: string;
    retry_attempt: number;
    retry_reason?: string;
    retry_delay_ms?: number;
    retry_result?: 'success' | 'failed' | 'pending';
  }): Promise<void> {
    await supabase.from('linkedin_retry_history').insert({
      workspace_id: workspaceId,
      execution_job_id: params.execution_job_id,
      failure_id: params.failure_id ?? null,
      retry_attempt: params.retry_attempt,
      retry_reason: params.retry_reason ?? null,
      retry_delay_ms: params.retry_delay_ms ?? null,
      retry_result: params.retry_result ?? 'pending',
    });
  }

  // ----------------------------------------------------------
  // Get jobs that need retrying
  // ----------------------------------------------------------

  async getRetryableJobs(workspaceId: string): Promise<Array<{ id: string; retry_count: number; max_retries: number; error_message: string | null }>> {
    const { data } = await supabase
      .from('linkedin_execution_jobs')
      .select('id, retry_count, max_retries, error_message')
      .eq('workspace_id', workspaceId)
      .eq('status', 'failed')
      .filter('retry_count', 'lt', 'max_retries')
      .limit(10);
    return (data ?? []) as Array<{ id: string; retry_count: number; max_retries: number; error_message: string | null }>;
  }

  // ----------------------------------------------------------
  // Schedule a retry
  // ----------------------------------------------------------

  async scheduleRetry(workspaceId: string, jobId: string, retryCount: number, failureType: FailureType): Promise<void> {
    const delayMs = this.calculateDelay(retryCount, failureType);
    const scheduledAt = new Date(Date.now() + delayMs).toISOString();

    await supabase.from('linkedin_execution_jobs').update({
      status: 'retrying',
      scheduled_at: scheduledAt,
      retry_count: retryCount + 1,
    }).eq('id', jobId);

    await this.recordRetry(workspaceId, {
      execution_job_id: jobId,
      retry_attempt: retryCount + 1,
      retry_reason: `Auto-retry after ${failureType}`,
      retry_delay_ms: delayMs,
      retry_result: 'pending',
    });
  }

  // ----------------------------------------------------------
  // Resolve a failure
  // ----------------------------------------------------------

  async resolveFailure(failureId: string): Promise<void> {
    await supabase.from('linkedin_failures').update({
      resolved: true,
      resolved_at: new Date().toISOString(),
    }).eq('id', failureId);
  }

  // ----------------------------------------------------------
  // Load unresolved failures
  // ----------------------------------------------------------

  async loadFailures(workspaceId: string): Promise<unknown[]> {
    const { data } = await supabase
      .from('linkedin_failures')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(30);
    return data ?? [];
  }

  // ----------------------------------------------------------
  // Load retry history
  // ----------------------------------------------------------

  async loadRetryHistory(workspaceId: string): Promise<unknown[]> {
    const { data } = await supabase
      .from('linkedin_retry_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(30);
    return data ?? [];
  }
}

export const linkedinRetryService = new LinkedInRetryService();
