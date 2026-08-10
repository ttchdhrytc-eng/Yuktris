// ============================================================
// BaseWorker — Abstract base class for all workers
// ============================================================

import type {
  IWorker,
  WorkerType,
  WorkerJob,
  WorkerResult,
} from '@/types/execution-engine';

export abstract class BaseWorker implements IWorker {
  abstract workerName: string;
  abstract workerType: WorkerType;

  async initialize(): Promise<void> {
    // Override in concrete worker to setup connections, etc.
  }

  async execute(_job: WorkerJob): Promise<WorkerResult> {
    throw new Error(`${this.workerName} execute() not implemented.`);
  }

  async healthCheck(): Promise<boolean> {
    return true;
  }
}
