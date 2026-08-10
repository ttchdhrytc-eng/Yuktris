import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { revenueDNAService } from '@/services/revenue-dna';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { biService } from '@/services/business-intelligence';
import type { RevenueDNAProfile, BuyerPersona, CompetitorIntelligence, ValueProposition } from '@/types/revenue-dna';

export const dnaKeys = {
  all: ['revenue-dna'] as const,
  detail: (wsId: string) => ['revenue-dna', wsId] as const,
};

export function useRevenueDNA() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: dnaKeys.detail(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return revenueDNAService.loadRevenueDNA(workspace.id);
    },
  });
}

export function useGenerateRevenueDNA() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const analysis = await biService.loadLatestAnalysis(workspace.id);
      return revenueDNAService.generateRevenueDNA({
        workspaceId: workspace.id,
        website: workspace.website ?? analysis?.analysis.website ?? '',
        companyName: analysis?.analysis.company_name ?? workspace.name,
        businessAnalysisId: analysis?.analysis.id,
        businessAnalysis: analysis?.analysis,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dnaKeys.all });
      toast.success('Revenue DNA generated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate Revenue DNA.'),
  });
}

export function useUpdateRevenueDNAProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<RevenueDNAProfile> }) =>
      revenueDNAService.updateProfile(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: dnaKeys.all });
      toast.success('Profile updated.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBuyerPersona() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<BuyerPersona> }) =>
      revenueDNAService.updatePersona(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: dnaKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateCompetitor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<CompetitorIntelligence> }) =>
      revenueDNAService.updateCompetitor(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: dnaKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateValueProp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ValueProposition> }) =>
      revenueDNAService.updateValueProp(id, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: dnaKeys.all }),
    onError: (err: Error) => toast.error(err.message),
  });
}
