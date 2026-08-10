// ============================================================
// WorkerPool — Manages worker lifecycle and assignment
// ============================================================

import { workerRegistry } from './WorkerRegistry';
import { jobQueue } from './JobQueue';
import { executionLogger } from './ExecutionLogger';
import { eventBus } from './EventBus';
import type { IWorker, WorkerType, WorkerJob, WorkerResult } from '@/types/execution-engine';

class WorkerPool {
  private activeJobs = new Map<string, AbortController>();

  async assignJob(workerName: string, job: WorkerJob): Promise<WorkerResult> {
    const worker = workerRegistry.get(workerName);
    if (!worker) throw new Error(`Worker not found: ${workerName}`);

    const controller = new AbortController();
    this.activeJobs.set(job.jobId, controller);

    await workerRegistry.updateStatus(workerName, 'busy', job.jobId);

    await executionLogger.logEvent({
      workflowId: job.workflowId,
      jobId: job.jobId,
      eventType: 'worker_assigned',
      eventData: { worker_name: workerName },
    });

    eventBus.emit({
      type: 'worker_assigned',
      workflowId: job.workflowId,
      jobId: job.jobId,
      workerName,
      timestamp: new Date().toISOString(),
    });

    const startTime = Date.now();

    try {
      const result = await worker.execute(job);
      const executionTimeMs = Date.now() - startTime;

      await workerRegistry.updateStatus(workerName, 'idle', null);

      await executionLogger.logEvent({
        workflowId: job.workflowId,
        jobId: job.jobId,
        eventType: 'worker_released',
        eventData: { worker_name: workerName, execution_time_ms: executionTimeMs },
      });

      eventBus.emit({
        type: 'worker_released',
        workflowId: job.workflowId,
        jobId: job.jobId,
        workerName,
        timestamp: new Date().toISOString(),
      });

      return { ...result, executionTimeMs };
    } catch (err) {
      await workerRegistry.updateStatus(workerName, 'error', null);
      return {
        jobId: job.jobId,
        status: 'failed',
        error: err instanceof Error ? err.message : 'Worker execution failed.',
        executionTimeMs: Date.now() - startTime,
      };
    } finally {
      this.activeJobs.delete(job.jobId);
    }
  }

  cancelJob(jobId: string): void {
    const controller = this.activeJobs.get(jobId);
    if (controller) {
      controller.abort();
      this.activeJobs.delete(jobId);
    }
  }

  getActiveJobCount(): number {
    return this.activeJobs.size;
  }

  getAvailableWorkers(workerType?: WorkerType): IWorker[] {
    const workers = workerRegistry.getAll();
    return workerType ? workers.filter((w) => w.workerType === workerType) : workers;
  }

  async initializeAll(): Promise<void> {
    const workers = workerRegistry.getAll();
    for (const worker of workers) {
      try {
        await worker.initialize();
        await workerRegistry.registerInDatabase(worker.workerName, worker.workerType);
      } catch (err) {
        console.error(`[WorkerPool] Failed to initialize ${worker.workerName}:`, err);
      }
    }
  }
}

export const workerPool = new WorkerPool();
