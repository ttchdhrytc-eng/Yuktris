// ============================================================
// GraphQueryService — Graph traversal and query operations
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import type {
  GraphNodeRecord,
  GraphEdgeRecord,
  GraphQuery,
  GraphQueryResult,
  NeighborhoodResult,
  ShortestPathResult,
  RelationshipType,
} from '@/types/knowledge-graph';

class GraphQueryService {
  // ----------------------------------------------------------
  // Entity Lookup
  // ----------------------------------------------------------

  async getEntity(nodeId: string): Promise<GraphNodeRecord | null> {
    return nodeService.getById(nodeId);
  }

  // ----------------------------------------------------------
  // Relationship Traversal
  // ----------------------------------------------------------

  async getRelationships(nodeId: string, direction?: 'outgoing' | 'incoming' | 'both'): Promise<{ edges: GraphEdgeRecord[]; nodes: GraphNodeRecord[] }> {
    return edgeService.getRelationships(nodeId, direction);
  }

  // ----------------------------------------------------------
  // Neighborhood Search (recursive)
  // ----------------------------------------------------------

  async getNeighborhood(nodeId: string, maxDepth: number = 2, workspaceId?: string | null): Promise<NeighborhoodResult[]> {
    const { data, error } = await supabase.rpc('graph_neighborhood', {
      p_start_node_id: nodeId,
      p_max_depth: maxDepth,
      p_workspace_id: workspaceId ?? null,
    });

    if (error) throw new Error(`Neighborhood query failed: ${error.message}`);
    return (data ?? []) as NeighborhoodResult[];
  }

  // ----------------------------------------------------------
  // Shortest Path (BFS)
  // ----------------------------------------------------------

  async getShortestPath(sourceNodeId: string, targetNodeId: string, maxDepth: number = 5, workspaceId?: string | null): Promise<ShortestPathResult[]> {
    const { data, error } = await supabase.rpc('graph_shortest_path', {
      p_source_node_id: sourceNodeId,
      p_target_node_id: targetNodeId,
      p_max_depth: maxDepth,
      p_workspace_id: workspaceId ?? null,
    });

    if (error) throw new Error(`Shortest path query failed: ${error.message}`);
    return (data ?? []) as ShortestPathResult[];
  }

  // ----------------------------------------------------------
  // Multi-hop Traversal with Filters
  // ----------------------------------------------------------

  async query(params: GraphQuery): Promise<GraphQueryResult> {
    if (params.startNodeId) {
      if (params.relationshipType) {
        return this.traverseByRelationship(
          params.startNodeId,
          params.relationshipType,
          params.maxDepth ?? 2,
          params.minConfidence,
          params.limit
        );
      }
      return this.traverseNeighborhood(params.startNodeId, params.maxDepth ?? 2, params.minConfidence, params.limit);
    }

    if (params.nodeType) {
      const nodes = await nodeService.findByType(params.nodeType, params.limit ?? 100);
      return { nodes, edges: [] };
    }

    return { nodes: [], edges: [] };
  }

  private async traverseNeighborhood(
    nodeId: string,
    maxDepth: number,
    minConfidence?: number,
    limit?: number
  ): Promise<GraphQueryResult> {
    const neighborhood = await this.getNeighborhood(nodeId, maxDepth);
    let filtered = neighborhood;

    if (minConfidence !== undefined) {
      filtered = filtered.filter((n) => n.confidence_score >= minConfidence);
    }

    if (limit) {
      filtered = filtered.slice(0, limit);
    }

    const nodeIds = new Set<string>([nodeId]);
    for (const n of filtered) {
      nodeIds.add(n.node_id);
    }

    const { data: nodesData, error } = await supabase
      .from('graph_nodes')
      .select('*')
      .in('id', Array.from(nodeIds))
      .eq('is_deleted', false);

    if (error) throw new Error(`Failed to load nodes: ${error.message}`);

    const edgeIds = filtered.map((n) => n.edge_id).filter(Boolean);
    let edges: GraphEdgeRecord[] = [];
    if (edgeIds.length > 0) {
      const { data: edgesData, error: edgeError } = await supabase
        .from('graph_edges')
        .select('*')
        .in('id', edgeIds)
        .eq('is_deleted', false);

      if (edgeError) throw new Error(`Failed to load edges: ${edgeError.message}`);
      edges = (edgesData ?? []) as GraphEdgeRecord[];
    }

    return { nodes: (nodesData ?? []) as GraphNodeRecord[], edges };
  }

  private async traverseByRelationship(
    nodeId: string,
    relationshipType: RelationshipType,
    maxDepth: number,
    minConfidence?: number,
    limit?: number
  ): Promise<GraphQueryResult> {
    let edges = await edgeService.getBySource(nodeId);
    edges = edges.filter((e) => e.relationship_type === relationshipType);

    if (minConfidence !== undefined) {
      edges = edges.filter((e) => e.confidence_score >= minConfidence);
    }

    if (limit) {
      edges = edges.slice(0, limit);
    }

    const targetIds = edges.map((e) => e.target_node_id);
    let nodes: GraphNodeRecord[] = [];
    if (targetIds.length > 0) {
      const { data, error } = await supabase
        .from('graph_nodes')
        .select('*')
        .in('id', targetIds)
        .eq('is_deleted', false);

      if (error) throw new Error(`Failed to load target nodes: ${error.message}`);
      nodes = (data ?? []) as GraphNodeRecord[];
    }

    return { nodes, edges };
  }

  // ----------------------------------------------------------
  // Connected Components (approximate via neighborhood)
  // ----------------------------------------------------------

  async getConnectedComponents(nodeId: string, maxDepth: number = 3): Promise<GraphNodeRecord[]> {
    const neighborhood = await this.getNeighborhood(nodeId, maxDepth);
    const nodeIds = [nodeId, ...neighborhood.map((n) => n.node_id)];

    const { data, error } = await supabase
      .from('graph_nodes')
      .select('*')
      .in('id', nodeIds)
      .eq('is_deleted', false);

    if (error) throw new Error(`Failed to load connected components: ${error.message}`);
    return (data ?? []) as GraphNodeRecord[];
  }
}

export const graphQueryService = new GraphQueryService();
