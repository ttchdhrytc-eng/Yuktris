// ============================================================
// Google Workspace — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { googleWorkspaceService } from '@/services/google-workspace';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import type {
  GoogleWorkspaceState,
  HealthCheckResult,
  ScopeCheckResult,
  GoogleWorkspaceServiceId,
} from '@/types/google-workspace';
import { WORKSPACE_SERVICES } from '@/types/google-workspace';

// ============================================================
// Query Keys
// ============================================================

export const workspaceKeys = {
  all: ['google-workspace'] as const,
  state: (wsId: string) => [...workspaceKeys.all, 'state', wsId] as const,
  health: (wsId: string) => [...workspaceKeys.all, 'health', wsId] as const,
  scopes: (wsId: string) => [...workspaceKeys.all, 'scopes', wsId] as const,
};

// ============================================================
// useGoogleWorkspace — Full workspace state (account, token, services, scopes)
// ============================================================

export function useGoogleWorkspace() {
  const { workspace } = useWorkspace();

  return useQuery<GoogleWorkspaceState>({
    queryKey: workspaceKeys.state(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return googleWorkspaceService.validateConnection(workspace.id);
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useWorkspaceHealth — Connection health check
// ============================================================

export function useWorkspaceHealth() {
  const { workspace } = useWorkspace();

  return useQuery<HealthCheckResult>({
    queryKey: workspaceKeys.health(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return googleWorkspaceService.healthCheck(workspace.id);
    },
    refetchInterval: 120_000,
  });
}

// ============================================================
// useGoogleScopes — Per-service scope validation
// ============================================================

export function useGoogleScopes() {
  const { workspace } = useWorkspace();

  return useQuery<ScopeCheckResult[]>({
    queryKey: workspaceKeys.scopes(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const state = await googleWorkspaceService.validateConnection(workspace.id);
      return googleWorkspaceService.checkScopes(state.grantedScopes);
    },
  });
}

// ============================================================
// useRefreshWorkspace — Refresh tokens + re-validate
// ============================================================

export function useRefreshWorkspace() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      return googleWorkspaceService.refreshWorkspace(workspace.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      toast.success('Google Workspace refreshed.');
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to refresh Google Workspace.');
    },
  });
}

// ============================================================
// useRequestScopes — Incremental authorization (request only missing scopes)
// ============================================================

export function useRequestScopes() {
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { scopes: string[]; redirectUri?: string }) => {
      if (!workspace || !user) throw new Error('No workspace or user');
      return googleWorkspaceService.requestAdditionalScopes({
        workspaceId: workspace.id,
        userId: user.id,
        scopes: params.scopes,
        redirectUri: params.redirectUri,
      });
    },
    onSuccess: (data) => {
      const popup = window.open(data.authUrl, '_blank', 'width=500,height=600');
      if (popup) {
        const poll = setInterval(() => {
          if (popup.closed) {
            clearInterval(poll);
            queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
          }
        }, 1000);
      } else {
        const a = document.createElement('a');
        a.href = data.authUrl;
        a.target = '_blank';
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to request additional scopes.');
    },
  });
}

// ============================================================
// useRequestServiceScopes — Request scopes for a specific service
// ============================================================

export function useRequestServiceScopes() {
  const requestScopes = useRequestScopes();

  return useMutation({
    mutationFn: async (serviceId: GoogleWorkspaceServiceId) => {
      const service = WORKSPACE_SERVICES.find((s) => s.id === serviceId);
      if (!service) throw new Error(`Unknown service: ${serviceId}`);
      return requestScopes.mutateAsync({ scopes: service.scopes });
    },
  });
}

// ============================================================
// useEnableService — Toggle a workspace service on/off
// ============================================================

export function useEnableService() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { serviceId: GoogleWorkspaceServiceId; enabled: boolean }) => {
      if (!workspace) throw new Error('No workspace');
      return googleWorkspaceService.enableService(workspace.id, params.serviceId, params.enabled);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to update service.');
    },
  });
}
