// ============================================================
// Enterprise Knowledge Graph — React Query Hooks
// ============================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { knowledgeGraphService } from '@/services/knowledge-graph';
import type {
  GraphNodeRecord,
  GraphEdgeRecord,
  NodeType,
  RelationshipType,
  GraphStatistics,
  GraphHealth,
  IngestBatch,
} from '@/types/knowledge-graph';

// ============================================================
// Query Keys
// ============================================================

export const graphKeys = {
  all: ['knowledge-graph'] as const,
  statistics: (wsId: string) => [...graphKeys.all, 'statistics', wsId] as const,
  health: ['knowledge-graph', 'health'] as const,
  entity: (id: string) => [...graphKeys.all, 'entity', id] as const,
  relationships: (id: string) => [...graphKeys.all, 'relationships', id] as const,
  search: (query: string, nodeType?: NodeType) => [...graphKeys.all, 'search', query, nodeType ?? 'all'] as const,
  nodesByType: (nodeType: NodeType, wsId: string) => [...graphKeys.all, 'nodes', nodeType, wsId] as const,
  neighborhood: (id: string, depth: number) => [...graphKeys.all, 'neighborhood', id, depth] as const,
};

// ============================================================
// useGraphEntity — Get a single graph node
// ============================================================

export function useGraphEntity(nodeId: string | null) {
  return useQuery<GraphNodeRecord | null>({
    queryKey: [...graphKeys.entity(nodeId ?? '')],
    enabled: !!nodeId,
    queryFn: () => {
      if (!nodeId) return null;
      return knowledgeGraphService.getNode(nodeId);
    },
  });
}

// ============================================================
// useGraphRelationships — Get relationships for a node
// ============================================================

export function useGraphRelationships(nodeId: string | null, direction?: 'outgoing' | 'incoming' | 'both') {
  return useQuery<{ edges: GraphEdgeRecord[]; nodes: GraphNodeRecord[] }>({
    queryKey: [...graphKeys.relationships(nodeId ?? ''), direction ?? 'both'],
    enabled: !!nodeId,
    queryFn: () => {
      if (!nodeId) return { edges: [], nodes: [] };
      return knowledgeGraphService.getRelationships(nodeId, direction);
    },
  });
}

// ============================================================
// useGraphSearch — Search graph nodes
// ============================================================

export function useGraphSearch(query: string, nodeType?: NodeType, enabled?: boolean) {
  return useQuery({
    queryKey: [...graphKeys.search(query, nodeType)],
    enabled: enabled ?? (query.length > 1),
    queryFn: () => knowledgeGraphService.search({ query, nodeType, limit: 50 }),
  });
}

// ============================================================
// useGraphStatistics — Graph statistics
// ============================================================

export function useGraphStatistics() {
  const { workspace } = useWorkspace();

  return useQuery<GraphStatistics>({
    queryKey: [...graphKeys.statistics(workspace?.id ?? '')],
    enabled: !!workspace?.id,
    queryFn: () => knowledgeGraphService.getStatistics(workspace?.id ?? null),
    refetchInterval: 30_000,
  });
}

// ============================================================
// useGraphHealth — Graph health check
// ============================================================

export function useGraphHealth() {
  const { workspace } = useWorkspace();

  return useQuery<GraphHealth>({
    queryKey: graphKeys.health,
    queryFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-health${workspace?.id ? `?workspace_id=${workspace.id}` : ''}`;
      const response = await fetch(apiUrl, {
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch graph health');
      return response.json();
    },
    refetchInterval: 60_000,
  });
}

// ============================================================
// useGraphNodesByType — Get all nodes of a specific type
// ============================================================

export function useGraphNodesByType(nodeType: NodeType, limit?: number) {
  const { workspace } = useWorkspace();

  return useQuery<GraphNodeRecord[]>({
    queryKey: [...graphKeys.nodesByType(nodeType, workspace?.id ?? ''), limit ?? 100],
    enabled: !!workspace?.id,
    queryFn: () => knowledgeGraphService.getNodesByType(nodeType, limit),
  });
}

// ============================================================
// useGraphNeighborhood — Get neighborhood of a node
// ============================================================

export function useGraphNeighborhood(nodeId: string | null, maxDepth?: number) {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: [...graphKeys.neighborhood(nodeId ?? '', maxDepth ?? 2)],
    enabled: !!nodeId,
    queryFn: () => knowledgeGraphService.getNeighborhood(nodeId!, maxDepth ?? 2, workspace?.id ?? null),
  });
}

// ============================================================
// Mutations
// ============================================================

export function useCreateGraphNode() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: (params: {
      nodeType: NodeType;
      externalId?: string | null;
      displayName: string;
      properties?: Record<string, unknown>;
      confidenceScore?: number;
    }) => knowledgeGraphService.createNode({
      ...params,
      workspaceId: workspace?.id ?? null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      toast.success('Entity created in knowledge graph.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create entity.'),
  });
}

export function useCreateGraphEdge() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: (params: {
      sourceNodeId: string;
      targetNodeId: string;
      relationshipType: RelationshipType;
      properties?: Record<string, unknown>;
      confidenceScore?: number;
    }) => knowledgeGraphService.createEdge({
      ...params,
      workspaceId: workspace?.id ?? null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      toast.success('Relationship created in knowledge graph.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create relationship.'),
  });
}

export function useDeleteGraphNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (nodeId: string) => knowledgeGraphService.deleteNode(nodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      toast.success('Entity removed from knowledge graph.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete entity.'),
  });
}

export function useGraphIngest() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: (batch: Omit<IngestBatch, 'workspaceId'>) =>
      knowledgeGraphService.ingestBatch({
        ...batch,
        workspaceId: workspace?.id ?? null,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      toast.success(`Synced ${result.nodesCreated} new + ${result.nodesUpdated} updated entities, ${result.edgesCreated} relationships.`);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to sync to graph.'),
  });
}

export function useGraphRebuild() {
  const queryClient = useQueryClient();
  const { workspace } = useWorkspace();

  return useMutation({
    mutationFn: async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/graph-rebuild`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          workspace_id: workspace?.id ?? null,
          snapshot_name: `Rebuild ${new Date().toISOString()}`,
        }),
      });
      if (!response.ok) throw new Error('Rebuild failed');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      toast.success('Graph rebuild completed.');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to rebuild graph.'),
  });
}
