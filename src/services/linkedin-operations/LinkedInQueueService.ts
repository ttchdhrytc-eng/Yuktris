// ============================================================
// LinkedInQueueService — Manages the execution queue
// ============================================================

import { supabase } from '@/lib/supabase';
import type { LinkedInQueueItem, LinkedInActionType } from '@/types/linkedin-operations';

class LinkedInQueueService {
  async enqueue(workspaceId: string, params: {
    linkedin_account_id?: string;
    execution_job_id?: string;
    contact_id?: string;
    company_id?: string;
    action_type: LinkedInActionType;
    priority?: number;
    scheduled_at?: string;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('linkedin_queue')
      .insert({
        workspace_id: workspaceId,
        linkedin_account_id: params.linkedin_account_id ?? null,
        execution_job_id: params.execution_job_id ?? null,
        contact_id: params.contact_id ?? null,
        company_id: params.company_id ?? null,
        action_type: params.action_type,
        priority: params.priority ?? 2,
        scheduled_at: params.scheduled_at ?? null,
        status: 'queued',
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    return data.id;
  }

  async dequeue(workspaceId: string): Promise<LinkedInQueueItem | null> {
    const now = new Date().toISOString();

    // Atomically claim the next queued item
    const { data: items } = await supabase
      .from('linkedin_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'queued')
      .or(`scheduled_at.is.null,scheduled_at.lte.${now}`)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1);

    if (!items || items.length === 0) return null;

    const item = items[0] as LinkedInQueueItem;
    const { error: lockError } = await supabase
      .from('linkedin_queue')
      .update({
        status: 'processing',
        locked_at: now,
        locked_by: `worker_${Date.now()}`,
        attempts: item.attempts + 1,
      })
      .eq('id', item.id)
      .eq('status', 'queued');

    if (lockError) return null;
    return item;
  }

  async complete(queueId: string): Promise<void> {
    await supabase.from('linkedin_queue').update({ status: 'completed' }).eq('id', queueId);
  }

  async fail(queueId: string): Promise<void> {
    await supabase.from('linkedin_queue').update({ status: 'failed' }).eq('id', queueId);
  }

  async cancel(queueId: string): Promise<void> {
    await supabase.from('linkedin_queue').update({ status: 'cancelled' }).eq('id', queueId);
  }

  async loadQueue(workspaceId: string): Promise<LinkedInQueueItem[]> {
    const { data } = await supabase
      .from('linkedin_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(50);
    return (data ?? []) as LinkedInQueueItem[];
  }

  async loadPending(workspaceId: string): Promise<LinkedInQueueItem[]> {
    const { data } = await supabase
      .from('linkedin_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('status', 'queued')
      .order('priority', { ascending: true })
      .limit(20);
    return (data ?? []) as LinkedInQueueItem[];
  }

  async clearCompleted(workspaceId: string): Promise<void> {
    await supabase.from('linkedin_queue').delete().eq('workspace_id', workspaceId).eq('status', 'completed');
  }
}

export const linkedinQueueService = new LinkedInQueueService();
