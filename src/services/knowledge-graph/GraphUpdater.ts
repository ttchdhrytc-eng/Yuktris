// ============================================================
// GraphUpdater — Updates existing graph nodes and edges
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import type { GraphNodeRecord, GraphEdgeRecord, NodeType, RelationshipType } from '@/types/knowledge-graph';

class GraphUpdater {
  async updateNodeProperties(nodeId: string, properties: Record<string, unknown>): Promise<GraphNodeRecord> {
    const node = await nodeService.getById(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    const mergedProperties = {
      ...node.properties,
      ...properties,
    };

    return nodeService.update(nodeId, {
      ...node,
      properties: mergedProperties,
    });
  }

  async updateEdgeProperties(edgeId: string, properties: Record<string, unknown>): Promise<GraphEdgeRecord> {
    const edge = await edgeService.getById(edgeId);
    if (!edge) throw new Error(`Edge not found: ${edgeId}`);

    const mergedProperties = {
      ...edge.properties,
      ...properties,
    };

    return edgeService.update(edgeId, {
      ...edge,
      properties: mergedProperties,
    });
  }

  async updateConfidence(nodeId: string, confidenceScore: number): Promise<GraphNodeRecord> {
    const node = await nodeService.getById(nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);
    return nodeService.update(nodeId, { ...node, confidence_score: confidenceScore });
  }

  async updateEdgeConfidence(edgeId: string, confidenceScore: number): Promise<GraphEdgeRecord> {
    const edge = await edgeService.getById(edgeId);
    if (!edge) throw new Error(`Edge not found: ${edgeId}`);
    return edgeService.update(edgeId, { ...edge, confidence_score: confidenceScore });
  }

  async rebuildFromSource(params: {
    source: string;
    workspaceId?: string | null;
  }): Promise<{ nodesUpdated: number; edgesUpdated: number }> {
    // Find all nodes from a specific source
    let query = supabase
      .from('graph_nodes')
      .select('*')
      .eq('is_deleted', false)
      .filter('properties->>source', 'eq', params.source);

    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);

    const { data: nodes, error } = await query;
    if (error) throw new Error(`Failed to load nodes: ${error.message}`);

    let nodesUpdated = 0;
    let edgesUpdated = 0;
    for (const node of (nodes ?? []) as GraphNodeRecord[]) {
      await nodeService.update(node.id, { ...node, version: node.version });
      nodesUpdated++;
      const { data: edges } = await supabase
        .from('graph_edges')
        .select('*')
        .or(`source_node_id.eq.${node.id},target_node_id.eq.${node.id}`)
        .eq('is_deleted', false);
      for (const edge of (edges ?? []) as GraphEdgeRecord[]) {
        await edgeService.update(edge.id, { ...edge, version: edge.version });
        edgesUpdated++;
      }
    }

    return { nodesUpdated, edgesUpdated };
  }
}

export const graphUpdater = new GraphUpdater();
