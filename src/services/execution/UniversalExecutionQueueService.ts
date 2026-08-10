// ============================================================
// UniversalExecutionQueueService — Single gateway for all agent actions
// ============================================================
//
// Every AI agent action flows through this queue:
//   AI → Queue → Integration → Execution → Result → Memory → Knowledge Graph
//
// This service manages queue items, stats, browser workers, and failures.

import { supabase } from '@/lib/supabase';
import type {
  UniversalExecutionQueueItem,
  ExecutionQueueStats,
  ExecutionQueueStatus,
  ExecutionPriority,
  BrowserWorker,
  BrowserWorkerTask,
  IntegrationFailure,
  IntegrationUsageDaily,
} from '@/types/universal-execution-queue';

class UniversalExecutionQueueService {
  async getQueue(
    workspaceId: string,
    filters?: { status?: ExecutionQueueStatus; integration?: string }
  ): Promise<UniversalExecutionQueueItem[]> {
    let query = supabase
      .from('universal_execution_queue')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(200);

    if (filters?.status) query = query.eq('status', filters.status);
    if (filters?.integration) query = query.eq('integration', filters.integration);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load execution queue: ${error.message}`);
    return (data ?? []) as UniversalExecutionQueueItem[];
  }

  async getStats(workspaceId: string): Promise<ExecutionQueueStats> {
    const items = await this.getQueue(workspaceId);
    const total = items.length;
    const byStatus = (status: ExecutionQueueStatus) =>
      items.filter((i) => i.status === status).length;

    const byIntegration: Record<string, number> = {};
    for (const item of items) {
      byIntegration[item.integration] = (byIntegration[item.integration] ?? 0) + 1;
    }

    const completed = byStatus('completed');
    const failed = byStatus('failed');
    const successRate = completed + failed > 0 ? completed / (completed + failed) : 0;

    const durations = items
      .filter((i) => i.duration_ms !== null)
      .map((i) => i.duration_ms as number);
    const avgDurationMs =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;

    return {
      total,
      queued: byStatus('queued'),
      processing: byStatus('processing'),
      completed,
      failed,
      retrying: byStatus('retrying'),
      cancelled: byStatus('cancelled'),
      byIntegration,
      avgDurationMs,
      successRate,
    };
  }

  async enqueue(params: {
    workspaceId: string;
    agentId?: string;
    agentName?: string;
    actionType: string;
    integration: string;
    provider?: string;
    payload?: Record<string, unknown>;
    priority?: ExecutionPriority;
    scheduledAt?: string;
  }): Promise<UniversalExecutionQueueItem> {
    const { data, error } = await supabase
      .from('universal_execution_queue')
      .insert({
        workspace_id: params.workspaceId,
        agent_id: params.agentId ?? null,
        agent_name: params.agentName ?? null,
        action_type: params.actionType,
        integration: params.integration,
        provider: params.provider ?? null,
        payload: params.payload ?? {},
        priority: params.priority ?? 5,
        scheduled_at: params.scheduledAt ?? null,
      })
      .select()
      .single();
    if (error) throw new Error(`Failed to enqueue action: ${error.message}`);
    return data as UniversalExecutionQueueItem;
  }

  async cancelItem(workspaceId: string, itemId: string): Promise<void> {
    const { error } = await supabase
      .from('universal_execution_queue')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('workspace_id', workspaceId)
      .in('status', ['queued', 'retrying']);
    if (error) throw new Error(`Failed to cancel queue item: ${error.message}`);
  }

  async retryItem(workspaceId: string, itemId: string): Promise<void> {
    const { error } = await supabase
      .from('universal_execution_queue')
      .update({ status: 'queued', error: null, scheduled_at: new Date().toISOString() })
      .eq('id', itemId)
      .eq('workspace_id', workspaceId)
      .eq('status', 'failed');
    if (error) throw new Error(`Failed to retry queue item: ${error.message}`);
  }

  async getFailures(workspaceId: string): Promise<IntegrationFailure[]> {
    const { data, error } = await supabase
      .from('integration_failures')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Failed to load integration failures: ${error.message}`);
    return (data ?? []) as IntegrationFailure[];
  }

  async getUsage(workspaceId: string, days = 30): Promise<IntegrationUsageDaily[]> {
    const { data, error } = await supabase
      .from('integration_usage_daily')
      .select('*')
      .eq('workspace_id', workspaceId)
      .gte('date', new Date(Date.now() - days * 86400000).toISOString().split('T')[0])
      .order('date', { ascending: false });
    if (error) throw new Error(`Failed to load integration usage: ${error.message}`);
    return (data ?? []) as IntegrationUsageDaily[];
  }

  async getBrowserWorkers(workspaceId: string): Promise<BrowserWorker[]> {
    const { data, error } = await supabase
      .from('browser_workers')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load browser workers: ${error.message}`);
    return (data ?? []) as BrowserWorker[];
  }

  async getBrowserWorkerTasks(workspaceId: string): Promise<BrowserWorkerTask[]> {
    const { data, error } = await supabase
      .from('browser_worker_tasks')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw new Error(`Failed to load browser worker tasks: ${error.message}`);
    return (data ?? []) as BrowserWorkerTask[];
  }
}

export const executionQueueService = new UniversalExecutionQueueService();
