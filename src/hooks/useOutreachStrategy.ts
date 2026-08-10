// ============================================================
// React Query Hooks — Outreach Strategy Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { outreachStrategyService, OUTREACH_STAGES } from '@/services/outreach-strategy';
import { agentOrchestrator } from '@/services/agents';
import type { FullOutreachCampaign, ExportFormat } from '@/types/outreach-strategy';

// ============================================================
// Query Keys
// ============================================================

export const outreachKeys = {
  all: ['outreach-strategy'] as const,
  latest: (wsId: string) => [...outreachKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...outreachKeys.all, 'detail', id] as const,
};

// ============================================================
// useOutreachStrategy — Load latest campaign for workspace
// ============================================================

export function useOutreachStrategy() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: outreachKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullOutreachCampaign | null> => {
      if (!workspace) return null;
      return outreachStrategyService.loadLatestCampaign(workspace.id);
    },
  });
}

// ============================================================
// useGenerateStrategy — Run full campaign generation pipeline
// The outreach strategy generation pipeline uses mock data internally.
// Disabled until wired to real providers.
// ============================================================

export function useGenerateStrategy() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { prospectIndex?: number }): Promise<FullOutreachCampaign | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'follow_up_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Campaign generation failed');
      return outreachStrategyService.loadLatestCampaign(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outreachKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Campaign generation failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshStrategy — Refresh an existing campaign
// ============================================================

export function useRefreshStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string): Promise<void> => {
      await outreachStrategyService.refreshCampaign(campaignId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outreachKeys.all });
      toast.success('Outreach campaign refreshed successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteStrategy — Delete a campaign
// ============================================================

export function useDeleteStrategy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (campaignId: string): Promise<void> => {
      await outreachStrategyService.deleteCampaign(campaignId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: outreachKeys.all });
      toast.success('Outreach campaign deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete campaign.');
    },
  });
}

// ============================================================
// useExportStrategy — Export campaign data
// ============================================================

export function useExportStrategy() {
  return useMutation({
    mutationFn: async (params: { campaign: FullOutreachCampaign; format: ExportFormat }): Promise<void> => {
      const config = outreachStrategyService.exportConfiguration(params.campaign, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Campaign exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { OUTREACH_STAGES };

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_CAMPAIGNS, MOCK_AI_RECOMMENDATIONS } from '@/services/outreach-strategy/mockData';
