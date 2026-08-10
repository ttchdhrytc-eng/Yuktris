// ============================================================
// LinkedInScheduler — Schedules execution jobs
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LinkedInExecutionJob, LinkedInActionType, JobStatus } from '@/types/linkedin-operations';

class LinkedInScheduler {
  // ----------------------------------------------------------
  // Create a scheduled job
  // ----------------------------------------------------------

  async scheduleJob(workspaceId: string, params: {
    linkedin_account_id?: string;
    company_id?: string;
    contact_id?: string;
    outreach_decision_id?: string;
    campaign_id?: string;
    sequence_id?: string;
    sequence_step?: number;
    action_type: LinkedInActionType;
    priority?: number;
    scheduled_at?: string;
    action_payload?: Record<string, unknown>;
  }): Promise<LinkedInExecutionJob> {
    const { data, error } = await supabase
      .from('linkedin_execution_jobs')
      .insert({
        workspace_id: workspaceId,
        linkedin_account_id: params.linkedin_account_id ?? null,
        company_id: params.company_id ?? null,
        contact_id: params.contact_id ?? null,
        outreach_decision_id: params.outreach_decision_id ?? null,
        campaign_id: params.campaign_id ?? null,
        sequence_id: params.sequence_id ?? null,
        sequence_step: params.sequence_step ?? 0,
        action_type: params.action_type,
        status: params.scheduled_at ? 'scheduled' : 'queued',
        priority: params.priority ?? 2,
        scheduled_at: params.scheduled_at ?? null,
        action_payload: params.action_payload ?? {},
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return data as LinkedInExecutionJob;
  }

  // ----------------------------------------------------------
  // Get jobs ready to execute (scheduled time has passed)
  // ----------------------------------------------------------

  async getReadyJobs(workspaceId: string): Promise<LinkedInExecutionJob[]> {
    const now = new Date().toISOString();
    const { data } = await supabase
      .from('linkedin_execution_jobs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .in('status', ['queued', 'scheduled'])
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(10);
    return (data ?? []) as LinkedInExecutionJob[];
  }

  // ----------------------------------------------------------
  // Update job status
  // ----------------------------------------------------------

  async updateJobStatus(jobId: string, status: JobStatus, updates?: Partial<LinkedInExecutionJob>): Promise<void> {
    const updateRecord: Record<string, unknown> = { status, ...updates };
    if (status === 'running' && !updates?.started_at) updateRecord.started_at = new Date().toISOString();
    if (status === 'completed' && !updates?.completed_at) updateRecord.completed_at = new Date().toISOString();
    await supabase.from('linkedin_execution_jobs').update(updateRecord).eq('id', jobId);
  }

  // ----------------------------------------------------------
  // Load all jobs
  // ----------------------------------------------------------

  async loadJobs(workspaceId: string, status?: JobStatus): Promise<LinkedInExecutionJob[]> {
    let query = supabase.from('linkedin_execution_jobs').select('*').eq('workspace_id', workspaceId);
    if (status) query = query.eq('status', status);
    query = query.order('created_at', { ascending: false }).limit(50);
    const { data } = await query;
    return (data ?? []) as LinkedInExecutionJob[];
  }

  // ----------------------------------------------------------
  // Cancel all jobs for a campaign
  // ----------------------------------------------------------

  async cancelCampaignJobs(workspaceId: string, campaignId: string): Promise<void> {
    await supabase
      .from('linkedin_execution_jobs')
      .update({ status: 'cancelled' })
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'scheduled']);
  }

  // ----------------------------------------------------------
  // Pause all jobs for a campaign
  // ----------------------------------------------------------

  async pauseCampaignJobs(workspaceId: string, campaignId: string): Promise<void> {
    await supabase
      .from('linkedin_execution_jobs')
      .update({ status: 'paused' })
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaignId)
      .in('status', ['queued', 'scheduled']);
  }

  // ----------------------------------------------------------
  // Resume paused jobs
  // ----------------------------------------------------------

  async resumeCampaignJobs(workspaceId: string, campaignId: string): Promise<void> {
    await supabase
      .from('linkedin_execution_jobs')
      .update({ status: 'queued' })
      .eq('workspace_id', workspaceId)
      .eq('campaign_id', campaignId)
      .eq('status', 'paused');
  }
}

export const linkedinScheduler = new LinkedInScheduler();
