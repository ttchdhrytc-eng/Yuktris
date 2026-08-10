// ============================================================
// React Query Hooks — Personalization Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { personalizationService, PERSONALIZATION_STAGES } from '@/services/personalization';
import { agentOrchestrator } from '@/services/agents';
import type { FullPersonalizationProfile, ExportFormat } from '@/types/personalization';

// ============================================================
// Query Keys
// ============================================================

export const personalizationKeys = {
  all: ['personalization'] as const,
  latest: (wsId: string) => [...personalizationKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...personalizationKeys.all, 'detail', id] as const,
};

// ============================================================
// usePersonalization — Load latest blueprint for workspace
// ============================================================

export function usePersonalization() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: personalizationKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullPersonalizationProfile | null> => {
      if (!workspace) return null;
      return personalizationService.loadLatestBlueprint(workspace.id);
    },
  });
}

// ============================================================
// useGeneratePersonalization — Run full personalization pipeline
// The personalization generation pipeline uses mock data internally.
// Disabled until wired to real providers.
// ============================================================

export function useGeneratePersonalization() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { prospectIndex?: number }): Promise<FullPersonalizationProfile | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'email_writer_agent',
        input: { company_name: workspace.name ?? '', companyName: workspace.name ?? '' },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Personalization failed');
      return personalizationService.loadLatestBlueprint(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalizationKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Personalization failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshPersonalization — Refresh an existing blueprint
// ============================================================

export function useRefreshPersonalization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string): Promise<void> => {
      await personalizationService.refreshBlueprint(profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalizationKeys.all });
      toast.success('Personalization blueprint refreshed successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeletePersonalization — Delete a blueprint
// ============================================================

export function useDeletePersonalization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (profileId: string): Promise<void> => {
      await personalizationService.deleteBlueprint(profileId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: personalizationKeys.all });
      toast.success('Personalization blueprint deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete blueprint.');
    },
  });
}

// ============================================================
// useExportPersonalization — Export blueprint data
// ============================================================

export function useExportPersonalization() {
  return useMutation({
    mutationFn: async (params: { profile: FullPersonalizationProfile; format: ExportFormat }): Promise<void> => {
      const config = personalizationService.exportConfiguration(params.profile, params.format);
      const blob = new Blob([config.data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = config.filename;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: (_data, variables) => {
      toast.success(`Blueprint exported as ${variables.format.toUpperCase()}.`);
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Export failed. Please try again.');
    },
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { PERSONALIZATION_STAGES };

// ============================================================
// Re-exports for page compatibility
// ============================================================

export { MOCK_PROSPECTS, MOCK_AI_RECOMMENDATIONS } from '@/services/personalization/mockData';
