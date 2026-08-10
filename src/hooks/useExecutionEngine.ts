// ============================================================
// Execution Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { executionEngine } from '@/services/execution';

// ============================================================
// Query Keys
// ============================================================

export const executionKeys = {
  all: ['execution'] as const,
  summary: ['execution', 'summary'] as const,
  queue: ['execution', 'queue'] as const,
  workflows: (wsId: string) => [...executionKeys.all, 'workflows', wsId] as const,
  workflow: (id: string) => [...executionKeys.all, 'workflow', id] as const,
  jobs: (wsId: string) => [...executionKeys.all, 'jobs', wsId] as const,
  workers: ['execution', 'workers'] as const,
  events: (wsId: string) => [...executionKeys.all, 'events', wsId] as const,
};

// ============================================================
// useExecution — Summary metrics
// ============================================================

export function useExecution() {
  return useQuery({
    queryKey: executionKeys.summary,
    queryFn: () => executionEngine.getSummary(),
    refetchInterval: 15_000,
  });
}

// ============================================================
// useExecutionStatus — Queue status
// ============================================================

export function useExecutionStatus() {
  return useQuery({
    queryKey: executionKeys.queue,
    queryFn: () => executionEngine.getQueueStatus(),
    refetchInterval: 10_000,
  });
}

// ============================================================
// useExecutionHistory — Recent workflows
// ============================================================

export function useExecutionHistory(limit = 20) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...executionKeys.workflows(workspace?.id ?? ''), limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('execution_workflows')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 15_000,
  });
}

// ============================================================
// useJobs — Recent jobs
// ============================================================

export function useJobs(limit = 50) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...executionKeys.jobs(workspace?.id ?? ''), limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('execution_jobs')
        .select('*, execution_workflows!inner(workflow_name, workspace_id)')
        .eq('execution_workflows.workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 10_000,
  });
}

// ============================================================
// useWorkers — All registered workers
// ============================================================

export function useWorkers() {
  return useQuery({
    queryKey: executionKeys.workers,
    queryFn: () => executionEngine.getWorkersFromDatabase(),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useQueueStatus — Alias for useExecutionStatus
// ============================================================

export function useQueueStatus() {
  return useExecutionStatus();
}

// ============================================================
// useExecutionEvents — Recent events
// ============================================================

export function useExecutionEvents(limit = 100) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...executionKeys.events(workspace?.id ?? ''), limit],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('execution_events')
        .select('*, execution_workflows!inner(workspace_id)')
        .eq('execution_workflows.workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    refetchInterval: 10_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function usePauseWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) => executionEngine.pauseWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all });
      toast.success('Workflow paused.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to pause workflow.'),
  });
}

export function useResumeWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) => executionEngine.resumeWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all });
      toast.success('Workflow resumed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to resume workflow.'),
  });
}

export function useCancelWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) => executionEngine.cancelWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all });
      toast.success('Workflow cancelled.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to cancel workflow.'),
  });
}

export function useRetryWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workflowId: string) => executionEngine.retryWorkflow(workflowId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all });
      toast.success('Workflow retry triggered.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to retry workflow.'),
  });
}
