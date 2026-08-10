// ============================================================
// JobQueue — Priority-ordered job queue management
// ============================================================

import { supabase } from '@/lib/supabase';
import { eventBus } from './EventBus';
import { executionLogger } from './ExecutionLogger';
import type { JobState, JobPriority, JobType, WorkerType, QueueStatus } from '@/types/execution-engine';

const PRIORITY_ORDER: Record<JobPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

class JobQueue {
  async enqueue(params: {
    workflowId: string;
    jobName: string;
    jobType: JobType;
    workerType: WorkerType;
    priority?: JobPriority;
    payload?: Record<string, unknown>;
    maxAttempts?: number;
  }): Promise<string> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .insert({
        workflow_id: params.workflowId,
        job_name: params.jobName,
        job_type: params.jobType,
        worker_type: params.workerType,
        priority: params.priority ?? 'normal',
        status: 'queued',
        payload: params.payload ?? null,
        max_attempts: params.maxAttempts ?? 3,
      })
      .select('id')
      .maybeSingle();

    if (error) throw new Error(`Failed to enqueue job: ${error.message}`);

    const jobId = (data as { id: string } | null)?.id ?? '';

    await executionLogger.logEvent({
      workflowId: params.workflowId,
      jobId,
      eventType: 'job_queued',
      eventData: { job_name: params.jobName, priority: params.priority ?? 'normal' },
    });

    eventBus.emit({
      type: 'job_queued',
      workflowId: params.workflowId,
      jobId,
      data: { job_name: params.jobName },
      timestamp: new Date().toISOString(),
    });

    return jobId;
  }

  async dequeue(workerType?: WorkerType): Promise<Record<string, unknown> | null> {
    // Get the highest-priority queued job
    let query = supabase
      .from('execution_jobs')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(20);

    if (workerType) query = query.eq('worker_type', workerType);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to dequeue: ${error.message}`);

    const jobs = (data ?? []) as Array<Record<string, unknown>>;
    if (jobs.length === 0) return null;

    // Sort by priority in memory
    jobs.sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority as JobPriority] ?? 2;
      const pb = PRIORITY_ORDER[b.priority as JobPriority] ?? 2;
      return pa - pb;
    });

    const job = jobs[0];

    // Atomically claim the job
    const { error: updateError } = await supabase
      .from('execution_jobs')
      .update({ status: 'running', started_at: new Date().toISOString() })
      .eq('id', job.id as string)
      .eq('status', 'queued');

    if (updateError) {
      // Race condition — another worker claimed it
      return this.dequeue(workerType);
    }

    return job;
  }

  async completeJob(jobId: string, result: Record<string, unknown>): Promise<void> {
    const { error } = await supabase
      .from('execution_jobs')
      .update({
        status: 'completed',
        result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);

    if (error) throw new Error(`Failed to complete job: ${error.message}`);
  }

  async failJob(jobId: string, errorMessage: string): Promise<void> {
    const { data: job } = await supabase
      .from('execution_jobs')
      .select('attempts, max_attempts')
      .eq('id', jobId)
      .maybeSingle();

    const jobData = job as { attempts: number; max_attempts: number } | null;
    const attempts = (jobData?.attempts ?? 0) + 1;
    const maxAttempts = jobData?.max_attempts ?? 3;

    if (attempts < maxAttempts) {
      // Retry
      await supabase
        .from('execution_jobs')
        .update({
          status: 'retrying',
          attempts,
          error: errorMessage,
        })
        .eq('id', jobId);
    } else {
      // Dead letter
      await supabase
        .from('execution_jobs')
        .update({
          status: 'dead_letter',
          attempts,
          error: errorMessage,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('execution_jobs')
      .update({ status: 'cancelled', completed_at: new Date().toISOString() })
      .eq('id', jobId);
    if (error) throw new Error(`Failed to cancel job: ${error.message}`);
  }

  async requeue(jobId: string): Promise<void> {
    const { error } = await supabase
      .from('execution_jobs')
      .update({ status: 'queued', error: null })
      .eq('id', jobId);
    if (error) throw new Error(`Failed to requeue job: ${error.message}`);
  }

  async moveToDeadLetter(jobId: string, reason: string): Promise<void> {
    const { error } = await supabase
      .from('execution_jobs')
      .update({
        status: 'dead_letter',
        error: reason,
        completed_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    if (error) throw new Error(`Failed to move to dead letter: ${error.message}`);
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('status')
      .in('status', ['pending', 'queued', 'running', 'retrying', 'dead_letter']);

    if (error) throw new Error(`Failed to get queue status: ${error.message}`);

    const statuses = (data ?? []) as Array<{ status: string }>;
    const counts: QueueStatus = {
      pending: 0, queued: 0, running: 0, retrying: 0, dead_letter: 0, total: statuses.length,
    };

    for (const s of statuses) {
      const key = s.status as keyof Omit<QueueStatus, 'total'>;
      if (key in counts) counts[key]++;
    }

    return counts;
  }

  async getJobsByWorkflow(workflowId: string): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('created_at', { ascending: true });
    if (error) throw new Error(`Failed to get jobs: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  async getDeadLetterJobs(limit = 50): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('*')
      .eq('status', 'dead_letter')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Failed to get dead letter jobs: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }
}

export const jobQueue = new JobQueue();
