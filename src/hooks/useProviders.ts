// ============================================================
// Communication Provider Layer — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { communicationProviderManager } from '@/services/providers';
import type { ProviderKey } from '@/types/communication-providers';

export const providerKeys = {
  all: ['providers'] as const,
  list: ['providers', 'list'] as const,
  connections: (wsId: string) => [...providerKeys.all, 'connections', wsId] as const,
  connection: (id: string) => [...providerKeys.all, 'connection', id] as const,
  health: (wsId: string) => [...providerKeys.all, 'health', wsId] as const,
  healthSingle: (connId: string) => [...providerKeys.all, 'health', connId] as const,
  capabilities: (providerId: string) => [...providerKeys.all, 'capabilities', providerId] as const,
  analytics: (wsId: string) => [...providerKeys.all, 'analytics', wsId] as const,
};

// ============================================================
// useProviders — List all available provider definitions
// ============================================================

export function useProviders() {
  return useQuery({
    queryKey: providerKeys.list,
    queryFn: () => communicationProviderManager.listProviders(),
    staleTime: 5 * 60 * 1000,
  });
}

// ============================================================
// useProviderConnections — All connections for the workspace
// ============================================================

export function useProviderConnections() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: providerKeys.connections(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: () => communicationProviderManager.listConnections(workspace!.id),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useProviderConnection — Single connection by ID
// ============================================================

export function useProviderConnection(connectionId: string | null) {
  return useQuery({
    queryKey: providerKeys.connection(connectionId ?? ''),
    enabled: !!connectionId,
    queryFn: () => communicationProviderManager.getConnection(connectionId!),
  });
}

// ============================================================
// useProviderHealth — Health summary for the workspace
// ============================================================

export function useProviderHealth() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: providerKeys.health(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: () => communicationProviderManager.getHealthSummary(workspace!.id),
    refetchInterval: 60_000,
  });
}

// ============================================================
// useProviderHealthSingle — Health check for one connection
// ============================================================

export function useProviderHealthSingle(connectionId: string | null) {
  return useQuery({
    queryKey: providerKeys.healthSingle(connectionId ?? ''),
    enabled: !!connectionId,
    queryFn: () => communicationProviderManager.checkHealth(connectionId!),
    refetchInterval: 120_000,
  });
}

// ============================================================
// useProviderCapabilities — Capabilities for a provider
// ============================================================

export function useProviderCapabilities(providerId: string | null) {
  return useQuery({
    queryKey: providerKeys.capabilities(providerId ?? ''),
    enabled: !!providerId,
    queryFn: () => communicationProviderManager.getCapabilities(providerId!),
  });
}

// ============================================================
// useProviderAnalytics — Analytics for the workspace
// ============================================================

export function useProviderAnalytics() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: providerKeys.analytics(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: () => communicationProviderManager.getAnalytics(workspace!.id),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useConnectProvider — Connect a provider
// ============================================================

export function useConnectProvider() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { providerKey: ProviderKey; redirectUri?: string; scopes?: string[] }) => {
      if (!workspace) throw new Error('No workspace');
      return communicationProviderManager.connect({
        workspaceId: workspace.id,
        providerKey: params.providerKey,
        redirectUri: params.redirectUri,
        scopes: params.scopes,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      if (data.auth_url) {
        window.open(data.auth_url, '_blank', 'width=500,height=600');
      } else if (data.connected) {
        toast.success('Provider connected successfully.');
      }
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to connect provider.'),
  });
}

// ============================================================
// useDisconnectProvider — Disconnect a provider
// ============================================================

export function useDisconnectProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      return communicationProviderManager.disconnect(connectionId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      toast.success('Provider disconnected.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to disconnect provider.'),
  });
}

// ============================================================
// useRefreshProvider — Refresh tokens for a connection
// ============================================================

export function useRefreshProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      return communicationProviderManager.refresh(connectionId);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      if (data.refreshed) toast.success('Provider tokens refreshed.');
      else toast.error(data.error ?? 'Refresh failed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to refresh provider.'),
  });
}

// ============================================================
// useSyncProvider — Trigger sync for a connection
// ============================================================

export function useSyncProvider() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (connectionId: string) => {
      if (!workspace) throw new Error('No workspace');
      return communicationProviderManager.sync({
        workspaceId: workspace.id,
        connectionId,
      });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: providerKeys.all });
      if (data.synced) toast.success('Sync completed.');
      else toast.error(data.error ?? 'Sync failed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to sync provider.'),
  });
}

// ============================================================
// useTestConnection — Test a connection
// ============================================================

export function useTestConnection() {
  return useMutation({
    mutationFn: async (connectionId: string) => {
      return communicationProviderManager.validate(connectionId);
    },
    onSuccess: (isValid) => {
      toast.success(isValid ? 'Connection is valid and active.' : 'Connection validation failed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Connection test failed.'),
  });
}
