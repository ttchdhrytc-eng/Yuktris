import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { revenueStrategyService } from '@/services/revenue-strategy';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { revenueDNAService } from '@/services/revenue-dna';
import { marketOpportunityService } from '@/services/market-opportunity/index';
import type { RevenueStrategy, CampaignStrategy } from '@/types/revenue-strategy';

export const strategyKeys = {
  all: ['revenue-strategy'] as const,
  detail: (wsId: string) => ['revenue-strategy', wsId] as const,
};

export function useRevenueStrategy() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: strategyKeys.detail(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return revenueStrategyService.loadRevenueStrategy(workspace.id);
    },
  });
}

export function useGenerateRevenueStrategy() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const dna = await revenueDNAService.loadRevenueDNA(workspace.id);
      const marketIntel = await marketOpportunityService.loadMarketIntelligence(workspace.id);
      return revenueStrategyService.generateRevenueStrategy({
        workspaceId: workspace.id,
        revenueDNA: dna?.profile,
        marketIntel: marketIntel ? {
          profile: marketIntel.profile,
          segments: marketIntel.segments,
          opportunities: marketIntel.opportunities,
          trends: marketIntel.trends,
        } : null,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: strategyKeys.all });
      toast.success('Revenue strategy generated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate revenue strategy.'),
  });
}

export function useApproveCampaign() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async ({ campaignId, feedback }: { campaignId: string; feedback?: string }) => {
      if (!workspace) throw new Error('No workspace');
      return revenueStrategyService.approveCampaign(campaignId, workspace.id, feedback);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: strategyKeys.all });
      toast.success('Campaign approved.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDuplicateCampaign() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async ({ campaignId, strategyId }: { campaignId: string; strategyId: string }) => {
      if (!workspace) throw new Error('No workspace');
      return revenueStrategyService.duplicateCampaign(campaignId, workspace.id, strategyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: strategyKeys.all });
      toast.success('Campaign duplicated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSaveAsTemplate() {
  const qc = useQueryClient();
  const { workspace } = useWorkspace();
  return useMutation({
    mutationFn: async (campaignId: string) => {
      if (!workspace) throw new Error('No workspace');
      return revenueStrategyService.saveAsTemplate(campaignId, workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: strategyKeys.all });
      toast.success('Campaign saved as template.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRevenueStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RevenueStrategy> }) =>
      revenueStrategyService.updateStrategy(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: strategyKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCampaignStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CampaignStrategy> }) =>
      revenueStrategyService.updateCampaign(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: strategyKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}
