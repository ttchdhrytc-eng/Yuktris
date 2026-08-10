// ============================================================
// ExecutionRuntime — Manages the runtime lifecycle
// ============================================================

import { workerDispatcher } from './WorkerDispatcher';
import { workerPool } from './WorkerPool';
import { recoveryManager } from './RecoveryManager';
import { scheduler } from './Scheduler';
import { executionMonitor } from './ExecutionMonitor';

class ExecutionRuntime {
  private running = false;
  private maintenanceInterval: ReturnType<typeof setInterval> | null = null;

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    // Initialize all workers
    await workerPool.initializeAll();

    // Start the dispatcher (polls for jobs)
    workerDispatcher.start(2000);

    // Start maintenance loop (recovery, stale job cleanup)
    this.maintenanceInterval = setInterval(async () => {
      await this.maintenance();
    }, 30_000);

    console.log('[ExecutionRuntime] Started.');
  }

  stop(): void {
    this.running = false;
    workerDispatcher.stop();
    if (this.maintenanceInterval) {
      clearInterval(this.maintenanceInterval);
      this.maintenanceInterval = null;
    }
    console.log('[ExecutionRuntime] Stopped.');
  }

  isRunning(): boolean {
    return this.running;
  }

  private async maintenance(): Promise<void> {
    if (!this.running) return;

    try {
      // Recover stale jobs
      await recoveryManager.recoverStaleJobs();

      // Process retrying jobs
      await recoveryManager.processRetryingJobs();

      // Process scheduled jobs
      await scheduler.processScheduledJobs();
    } catch (err) {
      console.error('[ExecutionRuntime] Maintenance error:', err);
    }
  }

  async getHealth(): Promise<{ running: boolean; dispatcherActive: boolean; queueSize: number; activeWorkers: number }> {
    const queueStatus = await executionMonitor.getQueueStatus();
    return {
      running: this.running,
      dispatcherActive: this.running,
      queueSize: queueStatus.queued + queueStatus.pending,
      activeWorkers: workerPool.getActiveJobCount(),
    };
  }
}

export const executionRuntime = new ExecutionRuntime();
