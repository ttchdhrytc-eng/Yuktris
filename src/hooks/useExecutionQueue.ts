// ============================================================
// useExecutionQueue — Universal Execution Queue React Query hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { executionQueueService } from '@/services/execution/UniversalExecutionQueueService';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { ExecutionQueueStatus } from '@/types/universal-execution-queue';

export function useExecutionQueue(filters?: { status?: ExecutionQueueStatus; integration?: string }) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['execution-queue', workspace?.id, filters],
    enabled: !!workspace?.id,
    queryFn: () => executionQueueService.getQueue(workspace!.id, filters),
    refetchInterval: 10_000,
  });
}

export function useExecutionQueueStats() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['execution-queue-stats', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: () => executionQueueService.getStats(workspace!.id),
    refetchInterval: 15_000,
  });
}

export function useCancelExecutionItem() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => executionQueueService.cancelItem(workspace!.id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-queue'] });
      queryClient.invalidateQueries({ queryKey: ['execution-queue-stats'] });
    },
  });
}

export function useRetryExecutionItem() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => executionQueueService.retryItem(workspace!.id, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['execution-queue'] });
      queryClient.invalidateQueries({ queryKey: ['execution-queue-stats'] });
    },
  });
}

export function useIntegrationFailures() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['integration-failures', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: () => executionQueueService.getFailures(workspace!.id),
    refetchInterval: 30_000,
  });
}

export function useIntegrationUsage(days = 30) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['integration-usage', workspace?.id, days],
    enabled: !!workspace?.id,
    queryFn: () => executionQueueService.getUsage(workspace!.id, days),
  });
}

export function useBrowserWorkers() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['browser-workers', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: () => executionQueueService.getBrowserWorkers(workspace!.id),
    refetchInterval: 30_000,
  });
}

export function useBrowserWorkerTasks() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ['browser-worker-tasks', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: () => executionQueueService.getBrowserWorkerTasks(workspace!.id),
    refetchInterval: 15_000,
  });
}
