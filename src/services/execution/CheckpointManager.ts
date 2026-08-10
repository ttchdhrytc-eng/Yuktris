// ============================================================
// CheckpointManager — Saves and restores workflow state
// ============================================================

import { supabase } from '@/lib/supabase';
import { executionContext } from './ExecutionContext';
import { executionLogger } from './ExecutionLogger';
import { eventBus } from './EventBus';
import type { WorkflowState } from '@/types/execution-engine';

class CheckpointManager {
  async saveCheckpoint(workflowId: string, stepId?: string): Promise<void> {
    const ctx = executionContext.get(workflowId);
    if (!ctx) return;

    // Persist context to database
    await supabase
      .from('execution_workflows')
      .update({
        context: ctx as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      })
      .eq('id', workflowId);

    await executionLogger.logEvent({
      workflowId,
      eventType: 'checkpoint_saved',
      eventData: { step_id: stepId, context_version: ctx.version },
    });

    eventBus.emit({
      type: 'checkpoint_saved',
      workflowId,
      data: { step_id: stepId, context_version: ctx.version },
      timestamp: new Date().toISOString(),
    });
  }

  async restoreCheckpoint(workflowId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('execution_workflows')
      .select('context, status, execution_plan')
      .eq('id', workflowId)
      .maybeSingle();

    if (error || !data) return false;

    const record = data as { context: Record<string, unknown> | null; status: string; execution_plan: Record<string, unknown> | null };

    if (record.context) {
      executionContext.create(workflowId, record.context);
      return true;
    }

    return false;
  }

  async getCompletedSteps(workflowId: string): Promise<string[]> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('job_name')
      .eq('workflow_id', workflowId)
      .eq('status', 'completed');

    if (error) return [];
    return ((data ?? []) as Array<{ job_name: string }>).map((j) => j.job_name);
  }

  async canResume(workflowId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('execution_workflows')
      .select('status')
      .eq('id', workflowId)
      .maybeSingle();

    if (error || !data) return false;
    const status = (data as { status: string }).status as WorkflowState;
    return status === 'paused' || status === 'failed';
  }
}

export const checkpointManager = new CheckpointManager();
