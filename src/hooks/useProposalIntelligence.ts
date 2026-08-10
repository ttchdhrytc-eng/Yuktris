import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { proposalIntelligenceService } from '@/services/proposal-intelligence';
import { useWorkspace } from '@/contexts/WorkspaceContext';

export const proposalIntelKeys = {
  all: ['proposal-intelligence'] as const,
  dashboard: (wsId: string) => ['proposal-intelligence', 'dashboard', wsId] as const,
};

export function useProposalIntelligenceDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: proposalIntelKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      return proposalIntelligenceService.loadDashboard(workspace.id);
    },
    refetchInterval: 10000,
  });
}

export function useDetectProposalReadiness() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return proposalIntelligenceService.detectProposalReadiness(workspace.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalIntelKeys.all });
      toast.success('Proposal readiness detected from meetings.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to detect proposal readiness.'),
  });
}

export function useGenerateProposal() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (requestId: string) => {
      if (!workspace) throw new Error('No workspace');
      return proposalIntelligenceService.generateProposal(workspace.id, requestId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalIntelKeys.all });
      toast.success('Proposal generated successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate proposal.'),
  });
}

export function useSendProposal() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { projectId: string; recipientEmail: string; recipientName: string }) => {
      if (!workspace) throw new Error('No workspace');
      return proposalIntelligenceService.sendProposal(workspace.id, params.projectId, params.recipientEmail, params.recipientName);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalIntelKeys.all });
      toast.success('Proposal sent to prospect.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRecordProposalOutcome() {
  const { workspace } = useWorkspace();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { projectId: string; outcome: Record<string, unknown> }) => {
      if (!workspace) throw new Error('No workspace');
      return proposalIntelligenceService.recordOutcome(workspace.id, params.projectId, params.outcome as never);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: proposalIntelKeys.all });
      toast.success('Proposal outcome recorded.');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
