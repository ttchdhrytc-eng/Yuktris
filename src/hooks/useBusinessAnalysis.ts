// ============================================================
// React Query Hooks — Business Intelligence Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { biService } from '@/services/business-intelligence';
import { agentOrchestrator } from '@/services/agents';
import type { BusinessAnalysis, FullAnalysis } from '@/types/business-intelligence';

// ============================================================
// Query Keys
// ============================================================

export const biKeys = {
  all: ['business-intelligence'] as const,
  analysis: (wsId: string, company: string) => [...biKeys.all, 'analysis', wsId, company] as const,
  detail: (id: string) => [...biKeys.all, 'detail', id] as const,
};

// ============================================================
// useBusinessAnalysis — Load latest analysis for workspace
// ============================================================

export function useBusinessAnalysis() {
  const { workspace, selectedCompany } = useWorkspace();

  return useQuery({
    queryKey: biKeys.analysis(workspace?.id ?? '', selectedCompany ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullAnalysis | null> => {
      if (!workspace) return null;
      return biService.loadLatestAnalysis(workspace.id, selectedCompany);
    },
  });
}

// ============================================================
// useCreateAnalysis — Start a new analysis
// The BI generation pipeline (crawl + AI summary + insights) is not yet
// wired to real providers. Disabled until implemented.
// ============================================================

export function useCreateAnalysis() {
  const { workspace, selectedCompany } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (website: string): Promise<FullAnalysis> => {
      if (!workspace) throw new Error('No active workspace');

      const analysis = await biService.startAnalysis(workspace.id, website, selectedCompany);

      const result = await agentOrchestrator.executeAgent({
        agentName: 'website_research_agent',
        input: { url: website, website, company_name: selectedCompany ?? '', companyName: selectedCompany ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });

      if (result.status === 'completed' && result.output) {
        await biService.updateAnalysis(analysis.id, {
          analysis_status: 'completed',
          completion_percentage: 100,
          executive_summary: (result.output as Record<string, unknown>)['company_overview'] as string ?? '',
        });
      } else {
        await biService.updateAnalysis(analysis.id, {
          analysis_status: 'failed',
          completion_percentage: 0,
          error_message: result.error ?? 'Analysis failed',
        });
      }

      return biService.loadLatestAnalysis(workspace.id, selectedCompany) as Promise<FullAnalysis>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Analysis failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshAnalysis — Re-run an existing analysis
// ============================================================

export function useRefreshAnalysis() {
  const { workspace, selectedCompany } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_analysisId: string): Promise<FullAnalysis> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'executive_summary_agent',
        input: { company_name: selectedCompany ?? '', companyName: selectedCompany ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
      return biService.loadLatestAnalysis(workspace.id, selectedCompany) as Promise<FullAnalysis>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteAnalysis — Delete an analysis
// ============================================================

export function useDeleteAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string): Promise<void> => {
      await biService.deleteAnalysis(analysisId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biKeys.all });
      toast.success('Analysis deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete analysis.');
    },
  });
}

// ============================================================
// useUpdateAnalysis — Update analysis fields (e.g., company info)
// ============================================================

export function useUpdateAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BusinessAnalysis> }): Promise<BusinessAnalysis> => {
      return biService.updateAnalysis(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: biKeys.all });
      toast.success('Analysis updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update analysis.');
    },
  });
}
