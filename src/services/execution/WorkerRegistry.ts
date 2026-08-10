// ============================================================
// WorkerRegistry — Registry for all execution workers
// ============================================================

import { supabase } from '@/lib/supabase';
import type { IWorker, WorkerType, WorkerState, WorkerRegistryRecord } from '@/types/execution-engine';

class WorkerRegistry {
  private workers = new Map<string, IWorker>();

  register(worker: IWorker): void {
    if (this.workers.has(worker.workerName)) {
      console.warn(`[WorkerRegistry] Worker already registered: ${worker.workerName}`);
      return;
    }
    this.workers.set(worker.workerName, worker);
  }

  unregister(workerName: string): void {
    this.workers.delete(workerName);
  }

  get(workerName: string): IWorker | undefined {
    return this.workers.get(workerName);
  }

  getByType(workerType: WorkerType): IWorker[] {
    return Array.from(this.workers.values()).filter((w) => w.workerType === workerType);
  }

  getAll(): IWorker[] {
    return Array.from(this.workers.values());
  }

  has(workerName: string): boolean {
    return this.workers.has(workerName);
  }

  getNames(): string[] {
    return Array.from(this.workers.keys());
  }

  // Database operations
  async registerInDatabase(workerName: string, workerType: WorkerType): Promise<void> {
    const { error } = await supabase
      .from('worker_registry')
      .upsert({
        worker_name: workerName,
        worker_type: workerType,
        status: 'idle',
        last_heartbeat: new Date().toISOString(),
      }, { onConflict: 'worker_name' });

    if (error) console.error('[WorkerRegistry] DB registration failed:', error.message);
  }

  async updateStatus(workerName: string, status: WorkerState, currentJob?: string | null): Promise<void> {
    const { error } = await supabase
      .from('worker_registry')
      .update({
        status,
        current_job: currentJob ?? null,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('worker_name', workerName);

    if (error) console.error('[WorkerRegistry] Status update failed:', error.message);
  }

  async heartbeat(workerName: string): Promise<void> {
    const { error } = await supabase
      .from('worker_registry')
      .update({ last_heartbeat: new Date().toISOString() })
      .eq('worker_name', workerName);

    if (error) console.error('[WorkerRegistry] Heartbeat failed:', error.message);
  }

  async getAllFromDatabase(): Promise<WorkerRegistryRecord[]> {
    const { data, error } = await supabase
      .from('worker_registry')
      .select('*')
      .order('worker_name', { ascending: true });
    if (error) throw new Error(`Failed to load workers: ${error.message}`);
    return (data ?? []) as WorkerRegistryRecord[];
  }

  async markStaleWorkers(staleAfterMs: number = 60_000): Promise<number> {
    const cutoff = new Date(Date.now() - staleAfterMs).toISOString();
    const { data, error } = await supabase
      .from('worker_registry')
      .update({ status: 'offline' })
      .neq('status', 'offline')
      .lt('last_heartbeat', cutoff)
      .select('id');

    if (error) {
      console.error('[WorkerRegistry] Failed to mark stale workers:', error.message);
      return 0;
    }
    return data?.length ?? 0;
  }
}

export const workerRegistry = new WorkerRegistry();
