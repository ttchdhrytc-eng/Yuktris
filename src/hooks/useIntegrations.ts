// ============================================================
// Integration Hub — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { integrationHubService } from '@/services/integrations';
import type { ProviderId, LogEvent, LogStatus } from '@/types/integrations';

// ============================================================
// Query Keys
// ============================================================

export const integrationKeys = {
  all: ['integrations'] as const,
  list: (wsId: string) => [...integrationKeys.all, 'list', wsId] as const,
  detail: (wsId: string, provider: ProviderId) => [...integrationKeys.all, 'detail', wsId, provider] as const,
  health: (wsId: string) => [...integrationKeys.all, 'health', wsId] as const,
  healthSingle: (integrationId: string) => [...integrationKeys.all, 'health', integrationId] as const,
  logs: (wsId: string) => [...integrationKeys.all, 'logs', wsId] as const,
  logsSingle: (integrationId: string) => [...integrationKeys.all, 'logs', integrationId] as const,
  summary: (wsId: string) => [...integrationKeys.all, 'summary', wsId] as const,
};

// ============================================================
// useIntegrations — All integrations for the active workspace
// ============================================================

export function useIntegrations() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: integrationKeys.list(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return integrationHubService.listIntegrations(workspace.id);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useIntegration — Single integration by provider
// ============================================================

export function useIntegration(provider: ProviderId) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: integrationKeys.detail(workspace?.id ?? '', provider),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return integrationHubService.getIntegration(workspace.id, provider);
    },
  });
}

// ============================================================
// useIntegrationHealth — Health check for a single integration
// ============================================================

export function useIntegrationHealth(integrationId: string | undefined) {
  return useQuery({
    queryKey: integrationKeys.healthSingle(integrationId ?? ''),
    enabled: !!integrationId,
    queryFn: async () => {
      if (!integrationId) throw new Error('No integration ID');
      return integrationHubService.healthCheck(integrationId);
    },
    refetchInterval: 120_000,
  });
}

// ============================================================
// useIntegrationLogs — Logs for a single integration
// ============================================================

export function useIntegrationLogs(integrationId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: integrationKeys.logsSingle(integrationId ?? ''),
    enabled: !!integrationId,
    queryFn: async () => {
      if (!integrationId) throw new Error('No integration ID');
      return integrationHubService.getLogs(integrationId, limit);
    },
  });
}

// ============================================================
// useWorkspaceIntegrationLogs — All logs for the workspace
// ============================================================

export function useWorkspaceIntegrationLogs(limit = 100, filters?: { event?: LogEvent; status?: LogStatus }) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...integrationKeys.logs(workspace?.id ?? ''), limit, filters ?? {}],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return integrationHubService.getWorkspaceLogs(workspace.id, limit, filters);
    },
  });
}

// ============================================================
// useHealthSummary — Aggregate health counts for the workspace
// ============================================================

export function useHealthSummary() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: integrationKeys.summary(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return integrationHubService.getHealthSummary(workspace.id);
    },
  });
}

// ============================================================
// useConnectIntegration — Connect a provider
// ============================================================

export function useConnectIntegration() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { provider: ProviderId; redirectUri?: string; scopes?: string[] }) => {
      if (!workspace) throw new Error('No workspace');
      return integrationHubService.connect({
        workspaceId: workspace.id,
        ...params,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
      if (data.authUrl) {
        window.open(data.authUrl, '_blank', 'width=500,height=600');
      } else if (data.connected) {
        toast.success('Integration connected.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to connect integration.');
    },
  });
}

// ============================================================
// useDisconnectIntegration — Disconnect an integration
// ============================================================

export function useDisconnectIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      return integrationHubService.disconnect(integrationId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
      toast.success('Integration disconnected.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to disconnect integration.');
    },
  });
}

// ============================================================
// useRefreshIntegration — Refresh tokens for an integration
// ============================================================

export function useRefreshIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      return integrationHubService.refresh(integrationId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
      if (data.refreshed) {
        toast.success('Integration refreshed.');
      } else {
        toast.error(data.error ?? 'Refresh failed.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to refresh integration.');
    },
  });
}

// ============================================================
// useSyncIntegration — Trigger sync for an integration
// ============================================================

export function useSyncIntegration() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (integrationId: string) => {
      return integrationHubService.sync(integrationId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: integrationKeys.all });
      if (data.synced) {
        toast.success('Sync completed.');
      } else {
        toast.error(data.error ?? 'Sync failed.');
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to sync integration.');
    },
  });
}
