// ============================================================
// NodeService — CRUD operations for graph nodes
// ============================================================

import { supabase } from '@/lib/supabase';
import type { GraphNodeRecord, NodeType, SearchResult, INodeService } from '@/types/knowledge-graph';

class NodeService implements INodeService {
  async create(params: {
    workspaceId?: string | null;
    nodeType: NodeType;
    externalId?: string | null;
    displayName: string;
    properties?: Record<string, unknown>;
    confidenceScore?: number;
  }): Promise<GraphNodeRecord> {
    const { data, error } = await supabase
      .from('graph_nodes')
      .insert({
        workspace_id: params.workspaceId ?? null,
        node_type: params.nodeType,
        external_id: params.externalId ?? null,
        display_name: params.displayName,
        properties: params.properties ?? {},
        confidence_score: params.confidenceScore ?? 1.0,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create node: ${error.message}`);
    return data as GraphNodeRecord;
  }

  async getById(id: string): Promise<GraphNodeRecord | null> {
    const { data, error } = await supabase
      .from('graph_nodes')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to get node: ${error.message}`);
    return data as GraphNodeRecord | null;
  }

  async getByExternalId(externalId: string, nodeType: NodeType, workspaceId?: string | null): Promise<GraphNodeRecord | null> {
    let query = supabase
      .from('graph_nodes')
      .select('*')
      .eq('external_id', externalId)
      .eq('node_type', nodeType)
      .eq('is_deleted', false);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Failed to get node by external_id: ${error.message}`);
    return data as GraphNodeRecord | null;
  }

  async update(id: string, updates: Partial<GraphNodeRecord>): Promise<GraphNodeRecord> {
    const updateFields: Record<string, unknown> = {};
    if (updates.display_name !== undefined) updateFields.display_name = updates.display_name;
    if (updates.properties !== undefined) updateFields.properties = updates.properties;
    if (updates.confidence_score !== undefined) updateFields.confidence_score = updates.confidence_score;
    if (updates.external_id !== undefined) updateFields.external_id = updates.external_id;
    updateFields.version = (updates.version ?? 0) + 1;

    const { data, error } = await supabase
      .from('graph_nodes')
      .update(updateFields)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to update node: ${error.message}`);
    return data as GraphNodeRecord;
  }

  async softDelete(id: string): Promise<void> {
    const { error } = await supabase
      .from('graph_nodes')
      .update({ is_deleted: true, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw new Error(`Failed to delete node: ${error.message}`);
  }

  async search(params: { query: string; nodeType?: NodeType; limit?: number }): Promise<SearchResult> {
    let query_builder = supabase
      .from('graph_nodes')
      .select('*', { count: 'exact' })
      .eq('is_deleted', false)
      .ilike('display_name', `%${params.query}%`)
      .limit(params.limit ?? 50);

    if (params.nodeType) query_builder = query_builder.eq('node_type', params.nodeType);

    const { data, error, count } = await query_builder;

    if (error) throw new Error(`Failed to search nodes: ${error.message}`);
    return { nodes: (data ?? []) as GraphNodeRecord[], total: count ?? 0 };
  }

  async findByType(nodeType: NodeType, limit: number = 100): Promise<GraphNodeRecord[]> {
    const { data, error } = await supabase
      .from('graph_nodes')
      .select('*')
      .eq('node_type', nodeType)
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Failed to find nodes by type: ${error.message}`);
    return (data ?? []) as GraphNodeRecord[];
  }

  async count(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('graph_nodes')
      .select('*', { count: 'exact', head: true })
      .eq('is_deleted', false);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { count, error } = await query;
    if (error) throw new Error(`Failed to count nodes: ${error.message}`);
    return count ?? 0;
  }
}

export const nodeService = new NodeService();
