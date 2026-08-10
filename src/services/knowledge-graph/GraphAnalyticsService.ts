// ============================================================
// GraphAnalyticsService — Graph statistics and analytics
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import type { GraphStatistics, GraphAnalytics } from '@/types/knowledge-graph';

class GraphAnalyticsService {
  async getStatistics(workspaceId?: string | null): Promise<GraphStatistics> {
    const [totalNodes, totalEdges, deletedNodes, deletedEdges] = await Promise.all([
      nodeService.count(workspaceId),
      edgeService.count(workspaceId),
      this.countDeletedNodes(workspaceId),
      this.countDeletedEdges(workspaceId),
    ]);

    const nodesByType = await this.countNodesByType(workspaceId);
    const edgesByType = await this.countEdgesByType(workspaceId);
    const avgConfidence = await this.getAverageConfidence(workspaceId);
    const mostConnected = await this.getMostConnectedNodes(workspaceId, 10);

    const maxPossibleEdges = totalNodes > 1 ? (totalNodes * (totalNodes - 1)) : 1;
    const graphDensity = totalEdges > 0 ? totalEdges / maxPossibleEdges : 0;

    return {
      total_nodes: totalNodes,
      total_edges: totalEdges,
      nodes_by_type: nodesByType,
      edges_by_type: edgesByType,
      graph_density: Math.round(graphDensity * 10000) / 10000,
      average_confidence: avgConfidence,
      duplicate_count: await this.countDuplicateNodes(workspaceId),
      merge_operations: await this.countMergeOperations(workspaceId),
      deleted_nodes: deletedNodes,
      deleted_edges: deletedEdges,
      most_connected_nodes: mostConnected,
    };
  }

  async getAnalytics(workspaceId?: string | null): Promise<GraphAnalytics> {
    const stats = await this.getStatistics(workspaceId);

    const confidenceDistribution = await this.getConfidenceDistribution(workspaceId);
    const avgDegree = stats.total_nodes > 0 ? (stats.total_edges * 2) / stats.total_nodes : 0;

    return {
      nodeCount: stats.total_nodes,
      edgeCount: stats.total_edges,
      density: stats.graph_density,
      averageDegree: Math.round(avgDegree * 100) / 100,
      maxDegree: stats.most_connected_nodes[0]?.degree ?? 0,
      connectedComponents: await this.countConnectedComponents(workspaceId),
      topNodesByDegree: stats.most_connected_nodes.map((n) => ({
        nodeId: n.node_id,
        displayName: n.display_name,
        degree: n.degree,
      })),
      relationshipDistribution: stats.edges_by_type,
      confidenceDistribution,
    };
  }

  private async countDeletedNodes(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { count } = await query;
    return count ?? 0;
  }

  private async countDeletedEdges(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_edges')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { count } = await query;
    return count ?? 0;
  }

  private async countNodesByType(workspaceId?: string | null): Promise<Record<string, number>> {
    let query = supabase
      .from('graph_nodes')
      .select('node_type')
      .eq('is_deleted', false);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const row of data) {
      const nt = (row as { node_type: string }).node_type;
      counts[nt] = (counts[nt] ?? 0) + 1;
    }
    return counts;
  }

  private async countEdgesByType(workspaceId?: string | null): Promise<Record<string, number>> {
    let query = supabase
      .from('graph_edges')
      .select('relationship_type')
      .eq('is_deleted', false);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error || !data) return {};

    const counts: Record<string, number> = {};
    for (const row of data) {
      const rt = (row as { relationship_type: string }).relationship_type;
      counts[rt] = (counts[rt] ?? 0) + 1;
    }
    return counts;
  }

  private async getAverageConfidence(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_edges')
      .select('confidence_score')
      .eq('is_deleted', false);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return 0;

    const sum = data.reduce((acc, row) => acc + ((row as { confidence_score: number }).confidence_score ?? 0), 0);
    return Math.round((sum / data.length) * 10000) / 10000;
  }

  private async getMostConnectedNodes(workspaceId?: string | null, limit: number = 10): Promise<{ node_id: string; display_name: string; degree: number }[]> {
    const { data, error } = await supabase
      .rpc('graph_most_connected', { p_workspace_id: workspaceId ?? null, p_limit: limit })
      .catch(() => ({ data: null, error: null as null }));

    if (error || !data) {
      // Fallback: compute in JS
      let query = supabase
        .from('graph_edges')
        .select('source_node_id, target_node_id')
        .eq('is_deleted', false);

      if (workspaceId) query = query.eq('workspace_id', workspaceId);

      const { data: edgesData } = await query;
      if (!edgesData || edgesData.length === 0) return [];

      const degreeMap = new Map<string, number>();
      for (const edge of edgesData) {
        const src = (edge as { source_node_id: string }).source_node_id;
        const tgt = (edge as { target_node_id: string }).target_node_id;
        degreeMap.set(src, (degreeMap.get(src) ?? 0) + 1);
        degreeMap.set(tgt, (degreeMap.get(tgt) ?? 0) + 1);
      }

      const sorted = Array.from(degreeMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit);

      if (sorted.length === 0) return [];

      const { data: nodesData } = await supabase
        .from('graph_nodes')
        .select('id, display_name')
        .in('id', sorted.map((s) => s[0]));

      const nodeMap = new Map<string, string>();
      for (const n of (nodesData ?? [])) {
        nodeMap.set((n as { id: string }).id, (n as { display_name: string }).display_name);
      }

      return sorted.map(([nodeId, degree]) => ({
        node_id: nodeId,
        display_name: nodeMap.get(nodeId) ?? 'Unknown',
        degree,
      }));
    }

    return data as { node_id: string; display_name: string; degree: number }[];
  }

  private async countDuplicateNodes(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_nodes')
      .select('external_id, node_type')
      .eq('is_deleted', false);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { data } = await query;
    if (!data) return 0;
    const seen = new Set<string>();
    let dupes = 0;
    for (const row of data as { external_id: string; node_type: string }[]) {
      const key = `${row.node_type}:${row.external_id}`;
      if (seen.has(key)) dupes++;
      else seen.add(key);
    }
    return dupes;
  }

  private async countMergeOperations(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', true)
      .not('merged_into', 'is', null);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { count } = await query;
    return count ?? 0;
  }

  private async countConnectedComponents(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_edges')
      .select('source_node_id, target_node_id')
      .eq('is_deleted', false);
    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { data: edges } = await query;
    if (!edges || edges.length === 0) return 0;

    const parent = new Map<string, string>();
    const find = (x: string): string => {
      if (!parent.has(x)) parent.set(x, x);
      let root = x;
      while (parent.get(root) !== root) root = parent.get(root)!;
      let cur = x;
      while (parent.get(cur) !== root) {
        const next = parent.get(cur)!;
        parent.set(cur, root);
        cur = next;
      }
      return root;
    };
    const union = (a: string, b: string) => {
      parent.set(find(a), find(b));
    };
    for (const e of edges as { source_node_id: string; target_node_id: string }[]) {
      union(e.source_node_id, e.target_node_id);
    }
    const roots = new Set<string>();
    for (const key of parent.keys()) roots.add(find(key));
    return roots.size;
  }
}

export const graphAnalyticsService = new GraphAnalyticsService();
