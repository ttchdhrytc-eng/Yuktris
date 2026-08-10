// ============================================================
// GraphSearchService — Full-text and property-based search
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import type { GraphNodeRecord, NodeType, SearchResult } from '@/types/knowledge-graph';

class GraphSearchService {
  async search(params: {
    query: string;
    nodeType?: NodeType;
    limit?: number;
  }): Promise<SearchResult> {
    return nodeService.search(params);
  }

  async searchByProperties(params: {
    properties: Record<string, unknown>;
    nodeType?: NodeType;
    limit?: number;
  }): Promise<GraphNodeRecord[]> {
    let query = supabase
      .from('graph_nodes')
      .select('*')
      .eq('is_deleted', false)
      .limit(params.limit ?? 50);

    if (params.nodeType) {
      query = query.eq('node_type', params.nodeType);
    }

    for (const [key, value] of Object.entries(params.properties)) {
      query = query.filter(`properties->>${key}`, 'eq', String(value));
    }

    const { data, error } = await query;

    if (error) throw new Error(`Property search failed: ${error.message}`);
    return (data ?? []) as GraphNodeRecord[];
  }

  async fuzzySearch(params: {
    query: string;
    nodeType?: NodeType;
    limit?: number;
  }): Promise<GraphNodeRecord[]> {
    let query_builder = supabase
      .from('graph_nodes')
      .select('*')
      .eq('is_deleted', false)
      .or(`display_name.ilike.%${params.query}%,external_id.ilike.%${params.query}%`)
      .limit(params.limit ?? 50);

    if (params.nodeType) {
      query_builder = query_builder.eq('node_type', params.nodeType);
    }

    const { data, error } = await query_builder;

    if (error) throw new Error(`Fuzzy search failed: ${error.message}`);
    return (data ?? []) as GraphNodeRecord[];
  }
}

export const graphSearchService = new GraphSearchService();
