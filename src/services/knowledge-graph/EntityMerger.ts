// ============================================================
// EntityMerger — Merges duplicate nodes and relocates edges
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import type { GraphNodeRecord, MergeResult } from '@/types/knowledge-graph';

class EntityMerger {
  async merge(params: {
    primaryNodeId: string;
    duplicateNodeIds: string[];
    workspaceId?: string | null;
  }): Promise<MergeResult> {
    const { primaryNodeId, duplicateNodeIds } = params;
    if (duplicateNodeIds.length === 0) {
      return { mergedNodeId: primaryNodeId, absorbedNodeIds: [], edgesRelocated: 0, edgesMerged: 0 };
    }

    const primaryNode = await nodeService.getById(primaryNodeId);
    if (!primaryNode) throw new Error(`Primary node not found: ${primaryNodeId}`);

    let edgesRelocated = 0;
    let edgesMerged = 0;

    for (const dupId of duplicateNodeIds) {
      const dupNode = await nodeService.getById(dupId);
      if (!dupNode) continue;

      // Merge properties from duplicate into primary
      const mergedProperties = {
        ...dupNode.properties,
        ...primaryNode.properties,
      };

      await nodeService.update(primaryNodeId, {
        ...primaryNode,
        properties: mergedProperties,
        version: primaryNode.version,
      });

      // Relocate outgoing edges from duplicate to primary
      const outgoingEdges = await edgeService.getBySource(dupId);
      for (const edge of outgoingEdges) {
        if (edge.target_node_id === primaryNodeId) continue;

        // Check if same edge already exists from primary
        const { data: existing } = await supabase
          .from('graph_edges')
          .select('id')
          .eq('source_node_id', primaryNodeId)
          .eq('target_node_id', edge.target_node_id)
          .eq('relationship_type', edge.relationship_type)
          .eq('is_deleted', false)
          .maybeSingle();

        if (existing) {
          // Merge: update existing edge with higher confidence
          await edgeService.softDelete(edge.id);
          edgesMerged++;
        } else {
          // Relocate: update source to primary
          await supabase
            .from('graph_edges')
            .update({ source_node_id: primaryNodeId })
            .eq('id', edge.id);
          edgesRelocated++;
        }
      }

      // Relocate incoming edges to duplicate -> primary
      const incomingEdges = await edgeService.getByTarget(dupId);
      for (const edge of incomingEdges) {
        if (edge.source_node_id === primaryNodeId) continue;

        const { data: existing } = await supabase
          .from('graph_edges')
          .select('id')
          .eq('source_node_id', edge.source_node_id)
          .eq('target_node_id', primaryNodeId)
          .eq('relationship_type', edge.relationship_type)
          .eq('is_deleted', false)
          .maybeSingle();

        if (existing) {
          await edgeService.softDelete(edge.id);
          edgesMerged++;
        } else {
          await supabase
            .from('graph_edges')
            .update({ target_node_id: primaryNodeId })
            .eq('id', edge.id);
          edgesRelocated++;
        }
      }

      // Soft delete the duplicate node
      await nodeService.softDelete(dupId);
    }

    return {
      mergedNodeId: primaryNodeId,
      absorbedNodeIds: duplicateNodeIds,
      edgesRelocated,
      edgesMerged,
    };
  }

  async mergeByExternalId(params: {
    nodeType: string;
    externalId: string;
    workspaceId?: string | null;
  }): Promise<GraphNodeRecord | null> {
    // Find all nodes with the same external_id and node_type
    let query = supabase
      .from('graph_nodes')
      .select('*')
      .eq('node_type', params.nodeType)
      .eq('external_id', params.externalId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true });

    if (params.workspaceId) query = query.eq('workspace_id', params.workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to find duplicates: ${error.message}`);
    if (!data || data.length <= 1) return data?.[0] as GraphNodeRecord ?? null;

    const nodes = data as GraphNodeRecord[];
    const primary = nodes[0];
    const duplicates = nodes.slice(1).map((n) => n.id);

    await this.merge({
      primaryNodeId: primary.id,
      duplicateNodeIds: duplicates,
      workspaceId: params.workspaceId,
    });

    return primary;
  }
}

export const entityMerger = new EntityMerger();
