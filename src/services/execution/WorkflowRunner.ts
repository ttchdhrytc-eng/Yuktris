// ============================================================
// WorkflowRunner — Executes workflow plans step by step
// ============================================================

import { supabase } from '@/lib/supabase';
import { jobQueue } from './JobQueue';
import { executionContext } from './ExecutionContext';
import { checkpointManager } from './CheckpointManager';
import { executionLogger } from './ExecutionLogger';
import { eventBus } from './EventBus';
import { stateMachine } from './StateMachine';
import type { WorkflowPlan, WorkflowStep, WorkflowState } from '@/types/execution-engine';

class WorkflowRunner {
  // Start a new workflow
  async startWorkflow(params: {
    plan: WorkflowPlan;
    workspaceId?: string | null;
  }): Promise<string> {
    // Create workflow record
    const { data, error } = await supabase
      .from('execution_workflows')
      .insert({
        workspace_id: params.workspaceId ?? null,
        workflow_name: params.plan.workflowName,
        workflow_version: params.plan.version,
        status: 'planning',
        execution_plan: params.plan as unknown as Record<string, unknown>,
        context: params.plan.context,
      })
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Failed to create workflow: ${error.message}`);
    const workflowId = (data as { id: string } | null)?.id ?? '';

    // Initialize execution context
    executionContext.create(workflowId, params.plan.context);

    await executionLogger.logEvent({
      workflowId,
      eventType: 'workflow_planned',
      eventData: { workflow_name: params.plan.workflowName, steps: params.plan.steps.length },
    });

    eventBus.emit({
      type: 'workflow_planned',
      workflowId,
      data: { workflow_name: params.plan.workflowName },
      timestamp: new Date().toISOString(),
    });

    // Enqueue all jobs
    await this.enqueueSteps(workflowId, params.plan.steps);

    // Update status to running
    await this.updateWorkflowStatus(workflowId, 'running');

    await executionLogger.logEvent({
      workflowId,
      eventType: 'workflow_started',
      eventData: { steps: params.plan.steps.length },
    });

    eventBus.emit({
      type: 'workflow_started',
      workflowId,
      timestamp: new Date().toISOString(),
    });

    return workflowId;
  }

  // Pause a running workflow
  async pauseWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'paused');
    await checkpointManager.saveCheckpoint(workflowId);

    await supabase
      .from('execution_jobs')
      .update({ status: 'paused' })
      .eq('workflow_id', workflowId)
      .eq('status', 'running');

    await executionLogger.logEvent({
      workflowId,
      eventType: 'workflow_paused',
    });

    eventBus.emit({ type: 'workflow_paused', workflowId, timestamp: new Date().toISOString() });
  }

  // Resume a paused workflow
  async resumeWorkflow(workflowId: string): Promise<void> {
    await checkpointManager.restoreCheckpoint(workflowId);

    // Requeue paused jobs
    const { data: pausedJobs } = await supabase
      .from('execution_jobs')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('status', 'paused');

    if (pausedJobs) {
      for (const job of (pausedJobs as Array<{ id: string }>)) {
        await jobQueue.requeue(job.id);
      }
    }

    await this.updateWorkflowStatus(workflowId, 'running');

    await executionLogger.logEvent({
      workflowId,
      eventType: 'workflow_resumed',
    });

    eventBus.emit({ type: 'workflow_resumed', workflowId, timestamp: new Date().toISOString() });
  }

  // Cancel a workflow
  async cancelWorkflow(workflowId: string): Promise<void> {
    await this.updateWorkflowStatus(workflowId, 'cancelled');

    await supabase
      .from('execution_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('workflow_id', workflowId)
      .in('status', ['pending', 'queued', 'waiting', 'running', 'paused']);

    await executionLogger.logEvent({
      workflowId,
      eventType: 'workflow_cancelled',
    });

    eventBus.emit({ type: 'workflow_cancelled', workflowId, timestamp: new Date().toISOString() });

    executionContext.clear(workflowId);
  }

  // Retry a failed workflow
  async retryWorkflow(workflowId: string): Promise<void> {
    const restored = await checkpointManager.restoreCheckpoint(workflowId);
    if (!restored) throw new Error('Cannot retry — checkpoint not available.');

    // Requeue failed jobs
    const { data: failedJobs } = await supabase
      .from('execution_jobs')
      .select('id')
      .eq('workflow_id', workflowId)
      .eq('status', 'failed');

    if (failedJobs) {
      for (const job of (failedJobs as Array<{ id: string }>)) {
        await jobQueue.requeue(job.id);
      }
    }

    await this.updateWorkflowStatus(workflowId, 'running');

    await executionLogger.logEvent({
      workflowId,
      eventType: 'retry_triggered',
      eventData: { recovered_jobs: failedJobs?.length ?? 0 },
    });

    eventBus.emit({ type: 'retry_triggered', workflowId, timestamp: new Date().toISOString() });
  }

  // Check if a workflow is complete and update status
  async checkCompletion(workflowId: string): Promise<boolean> {
    const { data: jobs } = await supabase
      .from('execution_jobs')
      .select('status')
      .eq('workflow_id', workflowId);

    if (!jobs || jobs.length === 0) return false;

    const statuses = (jobs as Array<{ status: string }>).map((j) => j.status);
    const hasRunning = statuses.some((s) => ['running', 'queued', 'waiting', 'pending', 'retrying', 'paused'].includes(s));
    const hasFailed = statuses.includes('failed');
    const allCompleted = statuses.every((s) => ['completed', 'cancelled', 'dead_letter'].includes(s));

    if (!hasRunning && allCompleted) {
      const failed = statuses.filter((s) => s === 'failed' || s === 'dead_letter').length;
      const newStatus: WorkflowState = failed > 0 ? 'completed' : 'completed';

      await this.updateWorkflowStatus(workflowId, newStatus);

      await supabase
        .from('execution_workflows')
        .update({ completed_at: new Date().toISOString() })
        .eq('id', workflowId);

      await executionLogger.logEvent({
        workflowId,
        eventType: 'workflow_completed',
        eventData: { failed_jobs: failed },
      });

      eventBus.emit({
        type: 'workflow_completed',
        workflowId,
        timestamp: new Date().toISOString(),
      });

      executionContext.clear(workflowId);
      return true;
    }

    if (!hasRunning && hasFailed) {
      await this.updateWorkflowStatus(workflowId, 'failed');

      await executionLogger.logEvent({
        workflowId,
        eventType: 'workflow_failed',
      });

      eventBus.emit({
        type: 'workflow_failed',
        workflowId,
        timestamp: new Date().toISOString(),
      });
    }

    return false;
  }

  // Enqueue all steps as jobs
  private async enqueueSteps(workflowId: string, steps: WorkflowStep[]): Promise<void> {
    for (const step of steps) {
      await jobQueue.enqueue({
        workflowId,
        jobName: step.jobName,
        jobType: step.jobType,
        workerType: step.workerType,
        priority: step.priority ?? 'normal',
        payload: step.payload,
        maxAttempts: step.maxAttempts ?? 3,
      });
    }
  }

  // Update workflow status with state machine validation
  private async updateWorkflowStatus(workflowId: string, newStatus: WorkflowState): Promise<void> {
    const { data: current } = await supabase
      .from('execution_workflows')
      .select('status')
      .eq('id', workflowId)
      .maybeSingle();

    const currentStatus = (current as { status: string } | null)?.status as WorkflowState ?? 'pending';

    try {
      stateMachine.transitionWorkflow(currentStatus, newStatus);
    } catch {
      // Allow force transitions for cancellation
      if (newStatus !== 'cancelled') throw new Error('Invalid workflow transition');
    }

    const updateData: Record<string, unknown> = { status: newStatus };
    if (newStatus === 'running' && !current) {
      updateData.started_at = new Date().toISOString();
    }

    await supabase
      .from('execution_workflows')
      .update(updateData)
      .eq('id', workflowId);
  }
}

export const workflowRunner = new WorkflowRunner();
