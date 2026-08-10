// ============================================================
// ExecutionMonitor — Real-time monitoring and metrics
// ============================================================

import { supabase } from '@/lib/supabase';
import type { ExecutionMonitorSummary, QueueStatus } from '@/types/execution-engine';

class ExecutionMonitor {
  async getSummary(): Promise<ExecutionMonitorSummary> {
    const [workflowsResult, jobsResult, workersResult] = await Promise.all([
      supabase.from('execution_workflows').select('status'),
      supabase.from('execution_jobs').select('status, created_at, completed_at'),
      supabase.from('worker_registry').select('status'),
    ]);

    const workflows = (workflowsResult.data ?? []) as Array<{ status: string }>;
    const jobs = (jobsResult.data ?? []) as Array<{ status: string; created_at: string; completed_at: string | null }>;
    const workers = (workersResult.data ?? []) as Array<{ status: string }>;

    const wfCounts = this.countByStatus(workflows.map((w) => w.status));
    const jobCounts = this.countByStatus(jobs.map((j) => j.status));
    const workerCounts = this.countByStatus(workers.map((w) => w.status));

    // Calculate average execution time from completed jobs
    const completedJobs = jobs.filter((j) => j.status === 'completed' && j.completed_at);
    let avgTime = 0;
    if (completedJobs.length > 0) {
      const totalTime = completedJobs.reduce((sum, j) => {
        const duration = new Date(j.completed_at!).getTime() - new Date(j.created_at).getTime();
        return sum + duration;
      }, 0);
      avgTime = Math.round(totalTime / completedJobs.length);
    }

    const totalJobs = jobs.length;
    const failedJobs = jobCounts.failed ?? 0;
    const failureRate = totalJobs > 0 ? Math.round((failedJobs / totalJobs) * 100) : 0;
    const retryCount = jobCounts.retrying ?? 0;

    // Throughput: jobs completed in last minute
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
    const recentCompleted = jobs.filter(
      (j) => j.status === 'completed' && j.completed_at && j.completed_at > oneMinuteAgo,
    ).length;

    return {
      total_workflows: workflows.length,
      running_workflows: wfCounts.running ?? 0,
      pending_workflows: (wfCounts.pending ?? 0) + (wfCounts.queued ?? 0),
      completed_workflows: wfCounts.completed ?? 0,
      failed_workflows: wfCounts.failed ?? 0,
      total_jobs: totalJobs,
      queued_jobs: jobCounts.queued ?? 0,
      running_jobs: jobCounts.running ?? 0,
      completed_jobs: jobCounts.completed ?? 0,
      failed_jobs: failedJobs,
      dead_letter_jobs: jobCounts.dead_letter ?? 0,
      total_workers: workers.length,
      active_workers: workers.length - (workerCounts.offline ?? 0),
      busy_workers: workerCounts.busy ?? 0,
      queue_size: (jobCounts.queued ?? 0) + (jobCounts.pending ?? 0),
      average_execution_time_ms: avgTime,
      failure_rate: failureRate,
      retry_count: retryCount,
      throughput_per_minute: recentCompleted,
    };
  }

  async getQueueStatus(): Promise<QueueStatus> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('status');

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

  async getRecentWorkflows(limit = 20): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('execution_workflows')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load workflows: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  async getRecentJobs(limit = 50): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('execution_jobs')
      .select('*, execution_workflows(workflow_name)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load jobs: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  async getRecentEvents(limit = 100): Promise<Record<string, unknown>[]> {
    const { data, error } = await supabase
      .from('execution_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to load events: ${error.message}`);
    return (data ?? []) as Record<string, unknown>[];
  }

  private countByStatus(items: string[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const item of items) {
      counts[item] = (counts[item] ?? 0) + 1;
    }
    return counts;
  }
}

export const executionMonitor = new ExecutionMonitor();
