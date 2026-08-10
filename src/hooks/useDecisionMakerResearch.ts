// ============================================================
// React Query Hooks — Decision Maker Research Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { dmResearchService, DM_STAGES } from '@/services/decision-maker-research';
import { agentOrchestrator } from '@/services/agents';
import type { FullDecisionMakerResearch, ExportFormat } from '@/types/decision-maker-research';

// ============================================================
// Query Keys
// ============================================================

export const dmKeys = {
  all: ['decision-maker-research'] as const,
  latest: (wsId: string) => [...dmKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...dmKeys.all, 'detail', id] as const,
};

// ============================================================
// useDecisionMakerResearch — Load latest research for workspace
// ============================================================

export function useDecisionMakerResearch() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: dmKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullDecisionMakerResearch | null> => {
      if (!workspace) return null;
      return dmResearchService.loadLatestResearch(workspace.id);
    },
  });
}

// ============================================================
// useStartResearch — Run full research pipeline
// The DM research generation pipeline uses mock data internally.
// Disabled until wired to real providers.
// ============================================================

export function useStartResearch() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { companyIndex?: number }): Promise<FullDecisionMakerResearch | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'linkedin_intelligence_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Research failed');
      return dmResearchService.loadLatestResearch(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dmKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Research failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshResearch — Refresh an existing research record
// ============================================================

export function useRefreshResearch() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_researchId: string): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'linkedin_intelligence_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dmKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteResearch — Delete a research record
// ============================================================

export function useDeleteResearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (researchId: string): Promise<void> => {
      await dmResearchService.deleteResearch(researchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: dmKeys.all });
      toast.success('Research deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete research.');
    },
  });
}

// ============================================================
// useExportResearch — Export research data
// ============================================================

export function useExportResearch() {
  return useMutation({
    mutationFn: async (params: { research: FullDecisionMakerResearch; format: ExportFormat }): Promise<void> => {
      const config = dmResearchService.exportConfiguration(params.research, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Contacts exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_DM_COMPANIES, MOCK_DM_RECOMMENDATIONS } from '@/services/decision-maker-research/mockData';

// ============================================================
// Convenience exports
// ============================================================

export { DM_STAGES };
