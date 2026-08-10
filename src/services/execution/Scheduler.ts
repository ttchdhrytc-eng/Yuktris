// ============================================================
// Scheduler — Manages delayed, scheduled, and recurring jobs
// ============================================================

import { supabase } from '@/lib/supabase';
import { jobQueue } from './JobQueue';
import type { JobType, WorkerType } from '@/types/execution-engine';

class Scheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();

  // Schedule a delayed job
  scheduleDelayed(
    workflowId: string,
    jobName: string,
    workerType: WorkerType,
    delayMs: number,
    payload?: Record<string, unknown>,
  ): string {
    const timerId = crypto.randomUUID();
    const timer = setTimeout(async () => {
      await jobQueue.enqueue({
        workflowId,
        jobName,
        jobType: 'delayed' as JobType,
        workerType,
        payload,
      });
      this.timers.delete(timerId);
    }, delayMs);

    this.timers.set(timerId, timer);
    return timerId;
  }

  // Schedule a job at a specific time
  scheduleAt(
    workflowId: string,
    jobName: string,
    workerType: WorkerType,
    scheduledAt: Date,
    payload?: Record<string, unknown>,
  ): string {
    const delayMs = scheduledAt.getTime() - Date.now();
    if (delayMs <= 0) {
      jobQueue.enqueue({
        workflowId,
        jobName,
        jobType: 'scheduled' as JobType,
        workerType,
        payload,
      });
      return '';
    }
    return this.scheduleDelayed(workflowId, jobName, workerType, delayMs, payload);
  }

  // Schedule a recurring job
  scheduleRecurring(
    workflowId: string,
    jobName: string,
    workerType: WorkerType,
    intervalMs: number,
    payload?: Record<string, unknown>,
  ): string {
    const timerId = crypto.randomUUID();
    const timer = setInterval(async () => {
      await jobQueue.enqueue({
        workflowId,
        jobName,
        jobType: 'recurring' as JobType,
        workerType,
        payload,
      });
    }, intervalMs);

    this.timers.set(timerId, timer);
    return timerId;
  }

  // Cancel a scheduled job
  cancel(timerId: string): void {
    const timer = this.timers.get(timerId);
    if (timer) {
      clearTimeout(timer);
      clearInterval(timer);
      this.timers.delete(timerId);
    }
  }

  // Cancel all scheduled jobs
  cancelAll(): void {
    for (const [, timer] of this.timers) {
      clearTimeout(timer);
      clearInterval(timer);
    }
    this.timers.clear();
  }

  // Process scheduled jobs from the database
  async processScheduledJobs(): Promise<number> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('id')
      .eq('status', 'pending')
      .eq('job_type', 'scheduled')
      .filter('created_at', 'lte', now);

    if (error || !data) return 0;

    let count = 0;
    for (const job of (data as Array<{ id: string }>)) {
      await jobQueue.requeue(job.id);
      count++;
    }

    return count;
  }

  getActiveCount(): number {
    return this.timers.size;
  }
}

export const scheduler = new Scheduler();
