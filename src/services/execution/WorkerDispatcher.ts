// ============================================================
// WorkerDispatcher — Dispatches jobs to workers
// ============================================================

import { workerRegistry } from './WorkerRegistry';
import { workerPool } from './WorkerPool';
import { jobQueue } from './JobQueue';
import { executionLogger } from './ExecutionLogger';
import { eventBus } from './EventBus';
import type { WorkerType, WorkerJob, WorkerResult } from '@/types/execution-engine';

class WorkerDispatcher {
  private running = false;
  private pollInterval: ReturnType<typeof setInterval> | null = null;

  start(pollMs: number = 2000): void {
    if (this.running) return;
    this.running = true;
    this.pollInterval = setInterval(() => this.dispatch().catch(console.error), pollMs);
  }

  stop(): void {
    this.running = false;
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async dispatchOnce(): Promise<void> {
    await this.dispatch();
  }

  private async dispatch(): Promise<void> {
    if (!this.running) return;

    // Try to dequeue and dispatch a job
    const job = await jobQueue.dequeue();
    if (!job) return;

    const jobRecord = job as Record<string, unknown>;
    const workerType = jobRecord.worker_type as WorkerType;

    // Find an available worker for this job type
    const workers = workerRegistry.getByType(workerType);
    if (workers.length === 0) {
      // No worker available — requeue
      await jobQueue.requeue(jobRecord.id as string);
      return;
    }

    const worker = workers[0];

    const workerJob: WorkerJob = {
      jobId: jobRecord.id as string,
      workflowId: jobRecord.workflow_id as string,
      jobName: jobRecord.job_name as string,
      jobType: jobRecord.job_type as WorkerJob['jobType'],
      workerType,
      payload: (jobRecord.payload as Record<string, unknown>) ?? {},
      attempts: (jobRecord.attempts as number) ?? 0,
      maxAttempts: (jobRecord.max_attempts as number) ?? 3,
    };

    await executionLogger.logEvent({
      workflowId: workerJob.workflowId,
      jobId: workerJob.jobId,
      eventType: 'job_started',
      eventData: { job_name: workerJob.jobName, worker_name: worker.workerName },
    });

    eventBus.emit({
      type: 'job_started',
      workflowId: workerJob.workflowId,
      jobId: workerJob.jobId,
      workerName: worker.workerName,
      timestamp: new Date().toISOString(),
    });

    const result: WorkerResult = await workerPool.assignJob(worker.workerName, workerJob);

    if (result.status === 'completed') {
      await jobQueue.completeJob(workerJob.jobId, result.result ?? {});

      await executionLogger.logEvent({
        workflowId: workerJob.workflowId,
        jobId: workerJob.jobId,
        eventType: 'job_completed',
        eventData: { execution_time_ms: result.executionTimeMs },
      });

      eventBus.emit({
        type: 'job_completed',
        workflowId: workerJob.workflowId,
        jobId: workerJob.jobId,
        timestamp: new Date().toISOString(),
      });
    } else if (result.status === 'failed') {
      await jobQueue.failJob(workerJob.jobId, result.error ?? 'Unknown error');

      await executionLogger.logEvent({
        workflowId: workerJob.workflowId,
        jobId: workerJob.jobId,
        eventType: 'job_failed',
        eventData: { error: result.error },
      });

      eventBus.emit({
        type: 'job_failed',
        workflowId: workerJob.workflowId,
        jobId: workerJob.jobId,
        timestamp: new Date().toISOString(),
      });
    }
  }
}

export const workerDispatcher = new WorkerDispatcher();
