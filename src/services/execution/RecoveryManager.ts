// ============================================================
// RecoveryManager — Recovers failed workflows and workers
// ============================================================

import { supabase } from '@/lib/supabase';
import { checkpointManager } from './CheckpointManager';
import { jobQueue } from './JobQueue';
import { executionLogger } from './ExecutionLogger';
import { eventBus } from './EventBus';

class RecoveryManager {
  // Recover a paused or failed workflow
  async recoverWorkflow(workflowId: string): Promise<boolean> {
    const canResume = await checkpointManager.canResume(workflowId);
    if (!canResume) return false;

    const restored = await checkpointManager.restoreCheckpoint(workflowId);
    if (!restored) return false;

    // Requeue any jobs that were running when the workflow failed
    const { data: runningJobs, error } = await supabase
      .from('execution_jobs')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('status', 'running');

    if (!error && runningJobs) {
      for (const job of (runningJobs as Array<{ id: string }>)) {
        await jobQueue.requeue(job.id);
      }
    }

    // Update workflow status to queued
    await supabase
      .from('execution_workflows')
      .update({ status: 'queued' })
      .eq('id', workflowId);

    await executionLogger.logEvent({
      workflowId,
      eventType: 'workflow_resumed',
      eventData: { recovered: true },
    });

    return true;
  }

  // Requeue all retrying jobs
  async processRetryingJobs(): Promise<number> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('id')
      .eq('status', 'retrying');

    if (error || !data) return 0;

    let count = 0;
    for (const job of (data as Array<{ id: string }>)) {
      await jobQueue.requeue(job.id);
      count++;
    }

    return count;
  }

  // Move stale running jobs back to queued
  async recoverStaleJobs(staleAfterMs: number = 120_000): Promise<number> {
    const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('id')
      .eq('status', 'running')
      .lt('started_at', cutoff);

    if (error || !data) return 0;

    let count = 0;
    for (const job of (data as Array<{ id: string }>)) {
      await jobQueue.requeue(job.id);
      count++;
    }

    return count;
  }

  // Clean up completed workflows older than specified days
  async cleanupOldWorkflows(daysOld: number = 30): Promise<number> {
    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('execution_workflows')
      .delete()
      .in('status', ['completed', 'cancelled', 'failed'])
      .lt('created_at', cutoff)
      .select('id');

    if (error) {
      console.error('[RecoveryManager] Cleanup failed:', error.message);
      return 0;
    }
    return data?.length ?? 0;
  }
}

export const recoveryManager = new RecoveryManager();
