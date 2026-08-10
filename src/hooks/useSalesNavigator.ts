// ============================================================
// React Query Hooks — Sales Navigator Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { snService, SN_STAGES } from '@/services/sales-navigator';
import { agentOrchestrator } from '@/services/agents';
import type { FullSalesNavigatorSearch, ExportFormat } from '@/types/sales-navigator';

// ============================================================
// Query Keys
// ============================================================

export const snKeys = {
  all: ['sales-navigator'] as const,
  latest: (wsId: string) => [...snKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...snKeys.all, 'detail', id] as const,
};

// ============================================================
// useSalesNavigator — Load latest search for workspace
// ============================================================

export function useSalesNavigator() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: snKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullSalesNavigatorSearch | null> => {
      if (!workspace) return null;
      return snService.loadLatestSearch(workspace.id);
    },
  });
}

// ============================================================
// useGenerateSearch — Run full search generation pipeline
// The Sales Navigator generation pipeline uses mock data internally.
// Disabled until wired to real LinkedIn API.
// ============================================================

export function useGenerateSearch() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { icpId?: string | null }): Promise<FullSalesNavigatorSearch | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'linkedin_intelligence_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Search generation failed');
      return snService.loadLatestSearch(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Search generation failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshSearch — Refresh an existing search
// ============================================================

export function useRefreshSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (searchId: string): Promise<void> => {
      await snService.refreshSearch(searchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snKeys.all });
      toast.success('Search refreshed successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteSearch — Delete a search
// ============================================================

export function useDeleteSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (searchId: string): Promise<void> => {
      await snService.deleteSearch(searchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: snKeys.all });
      toast.success('Search deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete search.');
    },
  });
}

// ============================================================
// useExportSearch — Export search data
// ============================================================

export function useExportSearch() {
  return useMutation({
    mutationFn: async (params: { search: FullSalesNavigatorSearch; format: ExportFormat }): Promise<void> => {
      const config = snService.exportConfiguration(params.search, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Search exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_QUALITY, MOCK_RECOMMENDATIONS, MOCK_TEMPLATES } from '@/services/sales-navigator/mockData';
export type { SearchTemplate } from '@/types/sales-navigator';

export function useTemplates() {
  return useQuery({
    queryKey: ['sales-navigator', 'templates'],
    queryFn: async () => {
      const { MOCK_TEMPLATES } = await import('@/services/sales-navigator/mockData');
      return MOCK_TEMPLATES as { id: string; name: string; description: string }[];
    },
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { SN_STAGES };
