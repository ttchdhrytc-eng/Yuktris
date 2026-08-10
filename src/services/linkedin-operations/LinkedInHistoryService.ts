// ============================================================
// LinkedInHistoryService — Action history and logging
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LinkedInActionHistory, LinkedInExecutionLog, ActionResult, LogLevel } from '@/types/linkedin-operations';

class LinkedInHistoryService {
  async recordAction(workspaceId: string, params: {
    linkedin_account_id?: string;
    execution_job_id?: string;
    company_id?: string;
    contact_id?: string;
    campaign_id?: string;
    sequence_id?: string;
    action_type: string;
    action_result: ActionResult;
    action_payload?: Record<string, unknown>;
    response_payload?: Record<string, unknown>;
    error_message?: string;
    duration_ms?: number;
    screenshot_path?: string;
    retry_count?: number;
  }): Promise<void> {
    await supabase.from('linkedin_action_history').insert({
      workspace_id: workspaceId,
      linkedin_account_id: params.linkedin_account_id ?? null,
      execution_job_id: params.execution_job_id ?? null,
      company_id: params.company_id ?? null,
      contact_id: params.contact_id ?? null,
      campaign_id: params.campaign_id ?? null,
      sequence_id: params.sequence_id ?? null,
      action_type: params.action_type,
      action_result: params.action_result,
      action_payload: params.action_payload ?? {},
      response_payload: params.response_payload ?? {},
      error_message: params.error_message ?? null,
      duration_ms: params.duration_ms ?? null,
      screenshot_path: params.screenshot_path ?? null,
      retry_count: params.retry_count ?? 0,
    });
  }

  async log(workspaceId: string, params: {
    linkedin_account_id?: string;
    execution_job_id?: string;
    log_level: LogLevel;
    log_message: string;
    log_metadata?: Record<string, unknown>;
  }): Promise<void> {
    await supabase.from('linkedin_execution_logs').insert({
      workspace_id: workspaceId,
      linkedin_account_id: params.linkedin_account_id ?? null,
      execution_job_id: params.execution_job_id ?? null,
      log_level: params.log_level,
      log_message: params.log_message,
      log_metadata: params.log_metadata ?? {},
    });
  }

  async loadHistory(workspaceId: string): Promise<LinkedInActionHistory[]> {
    const { data } = await supabase
      .from('linkedin_action_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as LinkedInActionHistory[];
  }

  async loadLogs(workspaceId: string): Promise<LinkedInExecutionLog[]> {
    const { data } = await supabase
      .from('linkedin_execution_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);
    return (data ?? []) as LinkedInExecutionLog[];
  }

  async loadTodayHistory(workspaceId: string): Promise<LinkedInActionHistory[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data } = await supabase
      .from('linkedin_action_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('created_at', `${today}T00:00:00`)
      .order('created_at', { ascending: false });
    return (data ?? []) as LinkedInActionHistory[];
  }
}

export const linkedinHistoryService = new LinkedInHistoryService();
