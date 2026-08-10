// ============================================================
// React Query Hooks — Prospect Discovery Agent
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { prospectDiscoveryService, DISCOVERY_STAGES } from '@/services/prospect-discovery';
import { agentOrchestrator } from '@/services/agents';
import type { FullDiscoveryResult } from '@/types/prospect-discovery';

// ============================================================
// Query Keys
// ============================================================

export const discoveryKeys = {
  all: ['prospect-discovery'] as const,
  latest: (wsId: string) => [...discoveryKeys.all, 'latest', wsId] as const,
  detail: (id: string) => [...discoveryKeys.all, 'detail', id] as const,
};

// ============================================================
// useProspectDiscovery — Load latest discovery for workspace
// ============================================================

export function useProspectDiscovery() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: discoveryKeys.latest(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async (): Promise<FullDiscoveryResult | null> => {
      if (!workspace) return null;
      return prospectDiscoveryService.loadLatestDiscovery(workspace.id);
    },
  });
}

// ============================================================
// useDiscoverCompanies — Run full discovery pipeline
// The prospect discovery generation pipeline uses mock data internally.
// Disabled until wired to real providers.
// ============================================================

export function useDiscoverCompanies() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_params: { icpId?: string | null }): Promise<FullDiscoveryResult | null> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'icp_scoring_agent',
        input: { company: { name: workspace.name ?? '', website: workspace.website ?? '' } },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Discovery failed');
      return prospectDiscoveryService.loadLatestDiscovery(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Discovery failed. Please try again.');
    },
  });
}

// ============================================================
// useRefreshDiscovery — Refresh an existing discovery
// ============================================================

export function useRefreshDiscovery() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (_discoveryId: string): Promise<void> => {
      if (!workspace) throw new Error('No active workspace');
      const result = await agentOrchestrator.executeAgent({
        agentName: 'icp_scoring_agent',
        input: { company: { name: workspace.name ?? '', website: workspace.website ?? '' } },
        workspaceId: workspace.id,
        timeoutMs: 60_000,
      });
      if (result.status !== 'completed') throw new Error(result.error ?? 'Refresh failed');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Refresh failed. Please try again.');
    },
  });
}

// ============================================================
// useDeleteDiscovery — Delete a discovery run
// ============================================================

export function useDeleteDiscovery() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (discoveryId: string): Promise<void> => {
      await prospectDiscoveryService.deleteDiscovery(discoveryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
      toast.success('Discovery deleted successfully.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to delete discovery.');
    },
  });
}

// ============================================================
// useUpdateCompanyStatus — Update a company's status
// ============================================================

export function useUpdateCompanyStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ companyId, status }: { companyId: string; status: string }): Promise<void> => {
      await prospectDiscoveryService.updateCompanyStatus(companyId, status);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update company status.');
    },
  });
}

// ============================================================
// Convenience exports
// ============================================================

export { DISCOVERY_STAGES };
