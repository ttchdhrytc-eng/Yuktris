// ============================================================
// Enterprise Context Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { contextEngine } from '@/services/context';
import type {
  ContextRequest,
  ContextProfileRecord,
  ContextSnapshotRecord,
  ContextHealth,
  ContextMonitorSummary,
} from '@/types/context-engine';

// ============================================================
// Query Keys
// ============================================================

export const contextKeys = {
  all: ['context'] as const,
  health: ['context', 'health'] as const,
  summary: (wsId: string) => [...contextKeys.all, 'summary', wsId] as const,
  profiles: (wsId: string) => [...contextKeys.all, 'profiles', wsId] as const,
  context: (entityType: string, entityId: string, contextType: string) =>
    [...contextKeys.all, 'entity', entityType, entityId, contextType] as const,
  history: (entityType: string, entityId: string) =>
    [...contextKeys.all, 'history', entityType, entityId] as const,
  cache: ['context', 'cache'] as const,
  preview: (entityType: string, entityId: string) =>
    [...contextKeys.all, 'preview', entityType, entityId] as const,
};

// ============================================================
// useContext — Build and retrieve context for an entity
// ============================================================

export function useContext(request: ContextRequest | null) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: request
      ? [...contextKeys.context(request.entityType ?? '', request.entityId ?? '', request.contextType)]
      : ['context', 'disabled'],
    enabled: !!request && !!request.entityId,
    queryFn: async () => {
      if (!request) return null;
      return contextEngine.build({
        ...request,
        workspaceId: request.workspaceId ?? workspace?.id ?? null,
      });
    },
  });
}

// ============================================================
// useContextHistory — Get snapshot history for an entity
// ============================================================

export function useContextHistory(entityType: string | null, entityId: string | null, limit?: number) {
  return useQuery<ContextSnapshotRecord[]>({
    queryKey: [...contextKeys.history(entityType ?? '', entityId ?? '')],
    enabled: !!entityType && !!entityId,
    queryFn: () => {
      if (!entityType || !entityId) return [];
      return contextEngine.getHistory(entityType, entityId, limit);
    },
  });
}

// ============================================================
// useContextHealth — Engine health check
// ============================================================

export function useContextHealth() {
  const { workspace } = useWorkspace();

  return useQuery<ContextHealth>({
    queryKey: contextKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/context-health${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to fetch context health');
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useContextPreview — Preview context without persisting
// ============================================================

export function useContextPreview(request: ContextRequest | null) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: request
      ? [...contextKeys.preview(request.entityType ?? '', request.entityId ?? '')]
      : ['context', 'preview', 'disabled'],
    enabled: !!request && !!request.entityId,
    queryFn: async () => {
      if (!request) return null;
      return contextEngine.preview({
        ...request,
        workspaceId: request.workspaceId ?? workspace?.id ?? null,
      });
    },
  });
}

// ============================================================
// useContextCache — Cache stats and management
// ============================================================

export function useContextCache() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: contextKeys.cache,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/context-cache${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to fetch cache stats');
      return response.json();
    },
    refetchInterval: 30_000,
  });
}

// ============================================================
// useContextProfiles — List all context profiles
// ============================================================

export function useContextProfiles(limit?: number) {
  const { workspace } = useWorkspace();

  return useQuery<ContextProfileRecord[]>({
    queryKey: [...contextKeys.profiles(workspace?.id ?? ''), limit ?? 50],
    enabled: !!workspace?.id,
    queryFn: () => contextEngine.getProfiles(workspace?.id ?? null, limit),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useContextSummary — Monitoring summary
// ============================================================

export function useContextSummary() {
  const { workspace } = useWorkspace();

  return useQuery<ContextMonitorSummary>({
    queryKey: [...contextKeys.summary(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => contextEngine.getSummary(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// Mutations
// ============================================================

export function useBuildContext() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { contextType: string; entityType?: string; entityId?: string }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/context-build`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          context_type: params.contextType,
          entity_type: params.entityType,
          entity_id: params.entityId,
          workspace_id: workspace?.id ?? null,
        }),
      });
      if (!response.ok) throw new Error('Failed to build context');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextKeys.all });
      toast.success('Context built successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to build context.'),
  });
}

export function useRefreshContext() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { contextType: string; entityType: string; entityId: string }) => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/context-refresh`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          context_type: params.contextType,
          entity_type: params.entityType,
          entity_id: params.entityId,
          workspace_id: workspace?.id ?? null,
        }),
      });
      if (!response.ok) throw new Error('Failed to refresh context');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextKeys.all });
      toast.success('Context refreshed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to refresh context.'),
  });
}

export function useClearContextCache() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/context-cache?action=cleanup`;
      const response = await fetch(apiUrl, {
        headers: { 'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
      });
      if (!response.ok) throw new Error('Failed to clear cache');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: contextKeys.all });
      toast.success('Expired cache entries cleared.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to clear cache.'),
  });
}
