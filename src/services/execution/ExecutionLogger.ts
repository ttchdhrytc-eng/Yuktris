// ============================================================
// ExecutionLogger — Centralized execution event logging
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ExecutionEventType } from '@/types/execution-engine';

class ExecutionLogger {
  async logEvent(params: {
    workflowId?: string | null;
    jobId?: string | null;
    eventType: ExecutionEventType;
    eventData?: Record<string, unknown> | null;
  }): Promise<void> {
    const { error } = await supabase.from('execution_events').insert({
      workflow_id: params.workflowId ?? null,
      job_id: params.jobId ?? null,
      event_type: params.eventType,
      event_data: params.eventData ?? null,
    });
    if (error) console.error('[ExecutionLogger] Failed to log event:', error.message);
  }

  async getEvents(params: {
    workflowId?: string;
    jobId?: string;
    limit?: number;
  }): Promise<Record<string, unknown>[]> {
    let query = supabase
      .from('execution_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 100);

    if (params.workflowId) query = query.eq('workflow_id', params.workflowId);
    if (params.jobId) query = query.eq('job_id', params.jobId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load events: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }
}

export const executionLogger = new ExecutionLogger();
