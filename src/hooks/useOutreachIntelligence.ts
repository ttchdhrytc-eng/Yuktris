import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { outreachIntelligenceService } from '@/services/outreach-intelligence';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { prospectDiscoveryService } from '@/services/prospect-discovery-engine';

export const outreachIntelKeys = {
  all: ['outreach-intelligence'] as const,
  dashboard: (wsId: string) => ['outreach-intelligence', 'dashboard', wsId] as const,
  prospects: (wsId: string) => ['outreach-intelligence', 'prospects', wsId] as const,
  cta: (wsId: string) => ['outreach-intelligence', 'cta', wsId] as const,
  icebreakers: (wsId: string) => ['outreach-intelligence', 'icebreakers', wsId] as const,
  trustSignals: (wsId: string) => ['outreach-intelligence', 'trust-signals', wsId] as const,
  reasoning: (wsId: string) => ['outreach-intelligence', 'reasoning', wsId] as const,
};

export function useOutreachDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: outreachIntelKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return outreachIntelligenceService.loadDashboard(workspace.id);
    },
    refetchInterval: 10000,
  });
}

export function useOutreachProspects() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: outreachIntelKeys.prospects(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return outreachIntelligenceService.loadAllProspects(workspace.id);
    },
  });
}

export function useCTALibrary() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: outreachIntelKeys.cta(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return outreachIntelligenceService.loadCTALibrary(workspace.id);
    },
  });
}

export function useIcebreakerLibrary() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: outreachIntelKeys.icebreakers(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return outreachIntelligenceService.loadIcebreakerLibrary(workspace.id);
    },
  });
}

export function useTrustSignalLibrary() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: outreachIntelKeys.trustSignals(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return outreachIntelligenceService.loadTrustSignalLibrary(workspace.id);
    },
  });
}

export function useOutreachReasoning() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: outreachIntelKeys.reasoning(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      return outreachIntelligenceService.loadReasoning(workspace.id);
    },
  });
}

export function useGenerateOutreachIntelligence() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      // Load discovered companies from Phase 6
      const companies = await prospectDiscoveryService.loadCompanies(workspace.id);
      const prospectIds = companies.slice(0, 20).map((c) => ({ companyId: c.id }));
      return outreachIntelligenceService.generateBatch(workspace.id, prospectIds);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: outreachIntelKeys.all });
      toast.success('Outreach intelligence generated for top prospects.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate outreach intelligence.'),
  });
}
