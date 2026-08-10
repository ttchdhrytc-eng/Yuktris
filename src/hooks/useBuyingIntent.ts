// ============================================================
// React Query Hooks — Buying Intent Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { buyingIntentService, INTENT_STAGES } from '@/services/buying-intent';
import { agentOrchestrator } from '@/services/agents';
import type { FullBuyingIntentAnalysis, ExportFormat, PriorityQueueEntry } from '@/types/buying-intent';

// ============================================================
// Query Keys
// ============================================================

export const intentKeys = {
  all: ['buying-intent'] as const,
  latest: (wsId: string) => [...intentKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...intentKeys.all, 'detail', id] as const,
  queue: ['buying-intent', 'priority-queue'] as const,
};

// ============================================================
// useBuyingIntent — Load latest analysis for workspace
// ============================================================

export function useBuyingIntent() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: intentKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullBuyingIntentAnalysis | null> => {
      if (!workspace) return null;
      return buyingIntentService.loadLatestAnalysis(workspace.id);
    },
  });
}

// ============================================================
// useAnalyzeIntent — Run full intent analysis pipeline
// The buying intent generation pipeline uses mock data internally.
// Disabled until wired to real providers.
// ============================================================

export function useAnalyzeIntent() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { companyIndex?: number }): Promise<FullBuyingIntentAnalysis | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'buying_signal_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Analysis failed');
      return buyingIntentService.loadLatestAnalysis(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: intentKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Analysis failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshIntent — Refresh an existing analysis
// ============================================================

export function useRefreshIntent() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_analysisId: string): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'buying_signal_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: intentKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteIntent — Delete an analysis
// ============================================================

export function useDeleteIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string): Promise<void> => {
      await buyingIntentService.deleteAnalysis(analysisId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: intentKeys.all });
      toast.success('Intent analysis deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete analysis.');
    },
  });
}

// ============================================================
// useExportIntent — Export analysis data
// ============================================================

export function useExportIntent() {
  return useMutation({
    mutationFn: async (params: { analysis: FullBuyingIntentAnalysis; format: ExportFormat }): Promise<void> => {
      const config = buyingIntentService.exportConfiguration(params.analysis, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Intent analysis exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// usePriorityQueue — Get the priority queue from the database
// ============================================================

export function usePriorityQueue() {
  const { workspace } = useWorkspace();

  return useQuery<PriorityQueueEntry[]>({
    queryKey: intentKeys.queue,
    enabled: !!workspace?.id,
    queryFn: () => buyingIntentService.getPriorityQueue(),
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { INTENT_STAGES };

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_INTENT_COMPANIES, MOCK_PRIORITY_QUEUE, MOCK_AI_RECOMMENDATIONS } from '@/services/buying-intent/mockData';
