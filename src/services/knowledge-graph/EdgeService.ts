// ============================================================
// EdgeService — CRUD operations for graph edges
// ============================================================

import { supabase } from '@/lib/supabase';
import type { GraphEdgeRecord, GraphNodeRecord, RelationshipType, IEdgeService } from '@/types/knowledge-graph';

class EdgeService implements IEdgeService {
  async create(params: {
    workspaceId?: string | null;
    sourceNodeId: string;
    targetNodeId: string;
    relationshipType: RelationshipType;
    properties?: Record<string, unknown>;
    confidenceScore?: number;
  }): Promise<GraphEdgeRecord> {
    const { data, error } = await supabase
      .from('graph_edges')
      .insert({
        workspace_id: params.workspaceId ?? null,
        source_node_id: params.sourceNodeId,
        target_node_id: params.targetNodeId,
        relationship_type: params.relationshipType,
        properties: params.properties ?? {},
        confidence_score: params.confidenceScore ?? 1.0,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create edge: ${error.message}`);
    return data as GraphEdgeRecord;
  }

  async getById(id: string): Promise<GraphEdgeRecord | null> {
    const { data, error } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get edge: ${error.message}`);
    return data as GraphEdgeRecord | null;
  }

  async getBySource(sourceNodeId: string): Promise<GraphEdgeRecord[]> {
    const { data, error } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('source_node_id', sourceNodeId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get edges by source: ${error.message}`);
    return (data ?? []) as GraphEdgeRecord[];
  }

  async getByTarget(targetNodeId: string): Promise<GraphEdgeRecord[]> {
    const { data, error } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('target_node_id', targetNodeId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get edges by target: ${error.message}`);
    return (data ?? []) as GraphEdgeRecord[];
  }

  async getByRelationship(relationshipType: RelationshipType): Promise<GraphEdgeRecord[]> {
    const { data, error } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('relationship_type', relationshipType)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get edges by relationship: ${error.message}`);
    return (data ?? []) as GraphEdgeRecord[];
  }

  async update(id: string, updates: Partial<GraphEdgeRecord>): Promise<GraphEdgeRecord> {
    const updateFields: Record<string, unknown> = {};
    if (updates.properties !== undefined) updateFields.properties = updates.properties;
    if (updates.confidence_score !== undefined) updateFields.confidence_score = updates.confidence_score;
    updateFields.version = (updates.version ?? 0) + 1;

    const { data, error } = await supabase
      .from('graph_edges')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to update edge: ${error.message}`);
    return data as GraphEdgeRecord;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('graph_edges')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`Failed to delete edge: ${error.message}`);
  }

  async getRelationships(nodeId: string, direction: 'outgoing' | 'incoming' | 'both' = 'both'): Promise<{ edges: GraphEdgeRecord[]; nodes: GraphNodeRecord[] }> {
    let edges: GraphEdgeRecord[] = [];

    if (direction === 'outgoing' || direction === 'both') {
      const outgoing = await this.getBySource(nodeId);
      edges = [...edges, ...outgoing];
    }

    if (direction === 'incoming' || direction === 'both') {
      const incoming = await this.getByTarget(nodeId);
      edges = [...edges, ...incoming];
    }

    const nodeIds = new Set<string>();
    for (const edge of edges) {
      nodeIds.add(edge.source_node_id);
      nodeIds.add(edge.target_node_id);
    }
    nodeIds.delete(nodeId);

    let nodes: GraphNodeRecord[] = [];
    if (nodeIds.size > 0) {
      const { data, error } = await supabase
        .from('graph_nodes')
        .select('*')
        .in('id', Array.from(nodeIds))
        .eq('is_deleted', false);

      if (error) throw new Error(`Failed to get related nodes: ${error.message}`);
      nodes = (data ?? []) as GraphNodeRecord[];
    }

    return { edges, nodes };
  }

  async count(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_edges')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { count, error } = await query;
    if (error) throw new Error(`Failed to count edges: ${error.message}`);
    return count ?? 0;
  }
}

export const edgeService = new EdgeService();
