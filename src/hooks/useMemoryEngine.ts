// ============================================================
// Enterprise Memory & Learning Engine — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { memoryEngine } from '@/services/memory';
import type {
  MemoryStoreRequest,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryEntityRecord,
  MemoryHealth,
  MemoryMonitorSummary,
  LearningEventRecord,
  MemoryRecordRecord,
  MemoryRelationshipRecord,
} from '@/types/memory-engine';

// ============================================================
// Query Keys
// ============================================================

export const memoryKeys = {
  all: ['memory'] as const,
  health: ['memory', 'health'] as const,
  summary: (wsId: string) => [...memoryKeys.all, 'summary', wsId] as const,
  entity: (id: string) => [...memoryKeys.all, 'entity', id] as const,
  history: (id: string) => [...memoryKeys.all, 'history', id] as const,
  relationships: (id: string) => [...memoryKeys.all, 'relationships', id] as const,
  search: (query: string) => [...memoryKeys.all, 'search', query] as const,
  byType: (type: string, wsId: string) => [...memoryKeys.all, 'type', type, wsId] as const,
  learningEvents: (wsId: string) => [...memoryKeys.all, 'events', wsId] as const,
};

// ============================================================
// useMemory — Get a single memory entity
// ============================================================

export function useMemory(memoryId: string | null) {
  return useQuery<MemoryEntityRecord | null>({
    queryKey: [...memoryKeys.entity(memoryId ?? '')],
    enabled: !!memoryId,
    queryFn: () => {
      if (!memoryId) return null;
      return memoryEngine.getMemory(memoryId);
    },
  });
}

// ============================================================
// useMemorySearch — Search memories
// ============================================================

export function useMemorySearch(request: MemorySearchRequest | null) {
  const { workspace } = useWorkspace();

  return useQuery<MemorySearchResult[]>({
    queryKey: request ? [...memoryKeys.search(request.query ?? '')] : ['memory', 'search', 'disabled'],
    enabled: !!request,
    queryFn: () => {
      if (!request) return [];
      return memoryEngine.search({
        ...request,
        workspaceId: request.workspaceId ?? workspace?.id ?? null,
      });
    },
  });
}

// ============================================================
// useMemoryHistory — Get version history for a memory
// ============================================================

export function useMemoryHistory(memoryId: string | null, limit?: number) {
  return useQuery<MemoryRecordRecord[]>({
    queryKey: [...memoryKeys.history(memoryId ?? '')],
    enabled: !!memoryId,
    queryFn: () => {
      if (!memoryId) return [];
      return memoryEngine.getHistory(memoryId, limit);
    },
  });
}

// ============================================================
// useMemoryHealth — Engine health check
// ============================================================

export function useMemoryHealth() {
  const { workspace } = useWorkspace();

  return useQuery<MemoryHealth>({
    queryKey: memoryKeys.health,
    queryFn: () => memoryEngine.getHealth(workspace?.id ?? null),
    refetchInterval: 60_000,
  });
}

// ============================================================
// useMemorySummary — Monitoring summary
// ============================================================

export function useMemorySummary() {
  const { workspace } = useWorkspace();

  return useQuery<MemoryMonitorSummary>({
    queryKey: [...memoryKeys.summary(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => memoryEngine.getSummary(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useMemoryRelationships — Get relationships for a memory
// ============================================================

export function useMemoryRelationships(memoryId: string | null) {
  return useQuery<MemoryRelationshipRecord[]>({
    queryKey: [...memoryKeys.relationships(memoryId ?? '')],
    enabled: !!memoryId,
    queryFn: () => {
      if (!memoryId) return [];
      return memoryEngine.getRelationships(memoryId);
    },
  });
}

// ============================================================
// useLearningEvents — Get recent learning events
// ============================================================

export function useLearningEvents(limit?: number) {
  const { workspace } = useWorkspace();

  return useQuery<LearningEventRecord[]>({
    queryKey: [...memoryKeys.learningEvents(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => memoryEngine.getLearningEvents(limit ?? 20, workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useMemoriesByType — Get memories by type
// ============================================================

export function useMemoriesByType(memoryType: string, limit?: number) {
  const { workspace } = useWorkspace();

  return useQuery<MemoryEntityRecord[]>({
    queryKey: [...memoryKeys.byType(memoryType, workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => memoryEngine.getMemoriesByType(memoryType, workspace?.id ?? null, limit),
  });
}

// ============================================================
// Mutations
// ============================================================

export function useStoreMemory() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (request: Omit<MemoryStoreRequest, 'workspaceId'>) => {
      return memoryEngine.store({
        ...request,
        workspaceId: workspace?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      toast.success('Memory stored successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to store memory.'),
  });
}

export function useSearchMemory() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: Omit<MemorySearchRequest, 'workspaceId'>) => {
      return memoryEngine.search({
        ...request,
        workspaceId: workspace?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Memory search failed.');
    },
  });
}

export function useMergeMemory() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async (params: { primaryMemoryId: string; duplicateMemoryIds: string[] }) => {
      return memoryEngine.merge({
        primaryMemoryId: params.primaryMemoryId,
        duplicateMemoryIds: params.duplicateMemoryIds,
        workspaceId: workspace?.id ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      toast.success('Memories merged successfully.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to merge memories.'),
  });
}

export function useRefreshMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memoryId: string) => {
      return memoryEngine.refresh(memoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      toast.success('Memory refreshed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to refresh memory.'),
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (memoryId: string) => {
      return memoryEngine.delete(memoryId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoryKeys.all });
      toast.success('Memory deleted.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete memory.'),
  });
}
