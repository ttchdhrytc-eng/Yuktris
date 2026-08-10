// ============================================================
// React Query Hooks — Market Intelligence Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { miService } from '@/services/market-intelligence';
import { agentOrchestrator } from '@/services/agents';
import type { MarketAnalysis, FullMarketAnalysis } from '@/types/market-intelligence';

// ============================================================
// Query Keys
// ============================================================

export const miKeys = {
  all: ['market-intelligence'] as const,
  analysis: (wsId: string, company: string) => [...miKeys.all, 'analysis', wsId, company] as const,
  detail: (id: string) => [...miKeys.all, 'detail', id] as const,
};

// ============================================================
// useMarketAnalysis — Load latest market analysis for workspace
// ============================================================

export function useMarketAnalysis() {
  const { workspace, selectedCompany } = useWorkspace();

  return useQuery({
    queryKey: miKeys.analysis(workspace?.id ?? '', selectedCompany ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullMarketAnalysis | null> => {
      if (!workspace) return null;
      return miService.loadLatestAnalysis(workspace.id, selectedCompany);
    },
  });
}

// ============================================================
// useCreateMarketAnalysis — Start a new analysis
// The MI generation pipeline (industry/country/competitor analysis) is not
// yet wired to real providers. Disabled until implemented.
// ============================================================

export function useCreateMarketAnalysis() {
  const { workspace, selectedCompany } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { businessAnalysisId?: string | null }): Promise<FullMarketAnalysis> => {
      if (!workspace) throw new Error('No active workspace');

      const analysis = await miService.startMarketAnalysis(workspace.id, params.businessAnalysisId, selectedCompany);

      const result = await agentOrchestrator.executeAgent({
        agentName: 'company_intelligence_agent',
        input: { company_name: selectedCompany ?? '', companyName: selectedCompany ?? '', domain: workspace.website ?? null },
        workspaceId: workspace.id,
        timeoutMs: 90_000,
      });

      if (result.status === 'completed' && result.output) {
        await miService.updateAnalysis(analysis.id, {
          market_status: 'completed',
          confidence_score: 0.75,
        });
      } else {
        await miService.updateAnalysis(analysis.id, {
          market_status: 'failed',
          confidence_score: 0,
        });
      }

      return miService.loadLatestAnalysis(workspace.id, selectedCompany) as Promise<FullMarketAnalysis>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Market analysis failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshMarketAnalysis — Re-run an existing analysis
// ============================================================

export function useRefreshMarketAnalysis() {
  const { workspace, selectedCompany } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_analysisId: string): Promise<FullMarketAnalysis> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'seo_analysis_agent',
        input: { domain: workspace.website ?? '', website: workspace.website ?? '', company_name: selectedCompany ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
      return miService.loadLatestAnalysis(workspace.id, selectedCompany) as Promise<FullMarketAnalysis>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteMarketAnalysis — Delete an analysis
// ============================================================

export function useDeleteMarketAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (analysisId: string): Promise<void> => {
      await miService.deleteAnalysis(analysisId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miKeys.all });
      toast.success('Market analysis deleted.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete analysis.');
    },
  });
}

// ============================================================
// useUpdateMarketAnalysis — Update analysis fields
// ============================================================

export function useUpdateMarketAnalysis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketAnalysis> }): Promise<MarketAnalysis> => {
      return miService.updateAnalysis(id, updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: miKeys.all });
      toast.success('Market analysis updated.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update analysis.');
    },
  });
}
