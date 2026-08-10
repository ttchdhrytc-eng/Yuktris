import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { marketOpportunityService } from '@/services/market-opportunity';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { biService } from '@/services/business-intelligence';
import { revenueDNAService } from '@/services/revenue-dna';
import type { MarketProfile, MarketSegment, MarketOpportunity } from '@/types/market-opportunity';

export const marketOppKeys = {
  all: ['market-opportunity'] as const,
  detail: (wsId: string) => ['market-opportunity', wsId] as const,
  targetList: (listId: string) => ['market-opportunity', 'target-list', listId] as const,
};

export function useMarketIntelligence() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: marketOppKeys.detail(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return marketOpportunityService.loadMarketIntelligence(workspace.id);
    },
  });
}

export function useGenerateMarketIntelligence() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const analysis = await biService.loadLatestAnalysis(workspace.id);
      const dna = await revenueDNAService.loadRevenueDNA(workspace.id);
      return marketOpportunityService.generateMarketIntelligence({
        workspaceId: workspace.id,
        website: workspace.website ?? analysis?.analysis.website ?? '',
        companyName: analysis?.analysis.company_name ?? workspace.name,
        businessAnalysis: analysis?.analysis,
        revenueDNA: dna?.profile,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketOppKeys.all });
      toast.success('Market intelligence generated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate market intelligence.'),
  });
}

export function useUpdateMarketProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketProfile> }) =>
      marketOpportunityService.updateProfile(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: marketOppKeys.all });
      toast.success('Market profile updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMarketSegment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketSegment> }) =>
      marketOpportunityService.updateSegment(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketOppKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateMarketOpportunity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<MarketOpportunity> }) =>
      marketOpportunityService.updateOpportunity(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: marketOppKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTargetListMembers(listId: string | null) {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: marketOppKeys.targetList(listId ?? ''),
    enabled: !!workspace?.id && !!listId,
    queryFn: async () => {
      if (!listId) return null;
      return marketOpportunityService.loadTargetListWithMembers(listId);
    },
  });
}
