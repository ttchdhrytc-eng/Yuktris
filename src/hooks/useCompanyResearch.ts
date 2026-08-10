// ============================================================
// React Query Hooks — Company Research Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { companyResearchService, RESEARCH_STAGES } from '@/services/company-research';
import { agentOrchestrator } from '@/services/agents';
import type { FullCompanyResearch, ExportFormat } from '@/types/company-research';

// ============================================================
// Query Keys
// ============================================================

export const crKeys = {
  all: ['company-research'] as const,
  latest: (wsId: string) => [...crKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...crKeys.all, 'detail', id] as const,
};

// ============================================================
// useCompanyResearch — Load latest research for workspace
// ============================================================

export function useCompanyResearch() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: crKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullCompanyResearch | null> => {
      if (!workspace) return null;
      return companyResearchService.loadLatestResearch(workspace.id);
    },
  });
}

// ============================================================
// useStartResearch — Run full research pipeline
// The company research generation pipeline uses mock data internally.
// Disabled until wired to real providers.
// ============================================================

export function useStartResearch() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { companyIndex?: number }): Promise<FullCompanyResearch | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'company_intelligence_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '', domain: workspace.website ?? null, website: workspace.website ?? null },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Research failed');
      return companyResearchService.loadLatestResearch(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crKeys.all });
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
        agentName: 'company_intelligence_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '', domain: workspace.website ?? null, website: workspace.website ?? null },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crKeys.all });
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
      await companyResearchService.deleteResearch(researchId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: crKeys.all });
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
    mutationFn: async (params: { research: FullCompanyResearch; format: ExportFormat }): Promise<void> => {
      const config = companyResearchService.exportConfiguration(params.research, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Research exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_COMPANIES, MOCK_RECOMMENDATIONS } from '@/services/company-research/mockData';

// ============================================================
// Convenience exports
// ============================================================

export { RESEARCH_STAGES };
