// ============================================================
// KnowledgeGraphService — Central facade for all graph operations
// ============================================================

import { supabase } from '@/lib/supabase';
import { nodeService } from './NodeService';
import { edgeService } from './EdgeService';
import { graphQueryService } from './GraphQueryService';
import { graphSearchService } from './GraphSearchService';
import { graphAnalyticsService } from './GraphAnalyticsService';
import { graphBuilder } from './GraphBuilder';
import { graphUpdater } from './GraphUpdater';
import { relationshipResolver } from './RelationshipResolver';
import { entityMerger } from './EntityMerger';
import { deduplicationService } from './DeduplicationService';
import type {
  GraphNodeRecord,
  GraphEdgeRecord,
  GraphSnapshotRecord,
  GraphQuery,
  GraphQueryResult,
  GraphStatistics,
  GraphAnalytics,
  GraphHealth,
  NeighborhoodResult,
  ShortestPathResult,
  NodeType,
  RelationshipType,
  IngestBatch,
  MergeCandidate,
  MergeResult,
  SearchResult,
} from '@/types/knowledge-graph';

class KnowledgeGraphService {
  // ----------------------------------------------------------
  // Node Operations
  // ----------------------------------------------------------

  async createNode(params: {
    workspaceId?: string | null;
    nodeType: NodeType;
    externalId?: string | null;
    displayName: string;
    properties?: Record<string, unknown>;
    confidenceScore?: number;
  }): Promise<GraphNodeRecord> {
    return nodeService.create(params);
  }

  async getNode(id: string): Promise<GraphNodeRecord | null> {
    return nodeService.getById(id);
  }

  async updateNode(id: string, updates: Partial<GraphNodeRecord>): Promise<GraphNodeRecord> {
    return nodeService.update(id, updates);
  }

  async deleteNode(id: string): Promise<void> {
    return nodeService.softDelete(id);
  }

  async getNodesByType(nodeType: NodeType, limit?: number): Promise<GraphNodeRecord[]> {
    return nodeService.findByType(nodeType, limit);
  }

  // ----------------------------------------------------------
  // Edge Operations
  // ----------------------------------------------------------

  async createEdge(params: {
    workspaceId?: string | null;
    sourceNodeId: string;
    targetNodeId: string;
    relationshipType: RelationshipType;
    properties?: Record<string, unknown>;
    confidenceScore?: number;
  }): Promise<GraphEdgeRecord> {
    return edgeService.create(params);
  }

  async getEdge(id: string): Promise<GraphEdgeRecord | null> {
    return edgeService.getById(id);
  }

  async updateEdge(id: string, updates: Partial<GraphEdgeRecord>): Promise<GraphEdgeRecord> {
    return edgeService.update(id, updates);
  }

  async deleteEdge(id: string): Promise<void> {
    return edgeService.softDelete(id);
  }

  async getRelationships(nodeId: string, direction?: 'outgoing' | 'incoming' | 'both'): Promise<{ edges: GraphEdgeRecord[]; nodes: GraphNodeRecord[] }> {
    return edgeService.getRelationships(nodeId, direction);
  }

  // ----------------------------------------------------------
  // Query Operations
  // ----------------------------------------------------------

  async query(params: GraphQuery): Promise<GraphQueryResult> {
    return graphQueryService.query(params);
  }

  async getNeighborhood(nodeId: string, maxDepth?: number, workspaceId?: string | null): Promise<NeighborhoodResult[]> {
    return graphQueryService.getNeighborhood(nodeId, maxDepth, workspaceId);
  }

  async getShortestPath(sourceNodeId: string, targetNodeId: string, maxDepth?: number, workspaceId?: string | null): Promise<ShortestPathResult[]> {
    return graphQueryService.getShortestPath(sourceNodeId, targetNodeId, maxDepth, workspaceId);
  }

  async getConnectedComponents(nodeId: string, maxDepth?: number): Promise<GraphNodeRecord[]> {
    return graphQueryService.getConnectedComponents(nodeId, maxDepth);
  }

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  async search(params: { query: string; nodeType?: NodeType; limit?: number }): Promise<SearchResult> {
    return graphSearchService.search(params);
  }

  async searchByProperties(params: { properties: Record<string, unknown>; nodeType?: NodeType; limit?: number }): Promise<GraphNodeRecord[]> {
    return graphSearchService.searchByProperties(params);
  }

  // ----------------------------------------------------------
  // Analytics & Statistics
  // ----------------------------------------------------------

  async getStatistics(workspaceId?: string | null): Promise<GraphStatistics> {
    return graphAnalyticsService.getStatistics(workspaceId);
  }

  async getAnalytics(workspaceId?: string | null): Promise<GraphAnalytics> {
    return graphAnalyticsService.getAnalytics(workspaceId);
  }

  // ----------------------------------------------------------
  // Ingestion
  // ----------------------------------------------------------

  async ingestBatch(batch: IngestBatch): Promise<{ nodesCreated: number; nodesUpdated: number; edgesCreated: number; edgesFailed: number }> {
    return graphBuilder.ingestBatch(batch);
  }

  async ingestFromResearchIntelligence(params: {
    companyName: string;
    website?: string | null;
    industry?: string | null;
    businessModel?: string | null;
    technologyStack?: string[];
    workspaceId?: string | null;
  }): Promise<{ nodesCreated: number; edgesCreated: number }> {
    return graphBuilder.ingestFromResearchIntelligence(params);
  }

  // ----------------------------------------------------------
  // Merge & Deduplication
  // ----------------------------------------------------------

  async findDuplicates(params: { nodeType?: NodeType; workspaceId?: string | null; threshold?: number }): Promise<MergeCandidate[]> {
    return deduplicationService.findDuplicates(params);
  }

  async mergeNodes(params: { primaryNodeId: string; duplicateNodeIds: string[]; workspaceId?: string | null }): Promise<MergeResult> {
    return entityMerger.merge(params);
  }

  // ----------------------------------------------------------
  // Snapshots
  // ----------------------------------------------------------

  async createSnapshot(params: {
    workspaceId?: string | null;
    snapshotName: string;
    description?: string;
  }): Promise<GraphSnapshotRecord> {
    const [nodeCount, edgeCount] = await Promise.all([
      nodeService.count(params.workspaceId),
      edgeService.count(params.workspaceId),
    ]);

    const { data, error } = await supabase
      .from('graph_snapshots')
      .insert({
        workspace_id: params.workspaceId ?? null,
        snapshot_name: params.snapshotName,
        description: params.description ?? null,
        node_count: nodeCount,
        edge_count: edgeCount,
      })
      .select('*')
      .maybeSingle();

    if (error) throw new Error(`Failed to create snapshot: ${error.message}`);
    return data as GraphSnapshotRecord;
  }

  async getSnapshots(workspaceId?: string | null): Promise<GraphSnapshotRecord[]> {
    let query = supabase
      .from('graph_snapshots')
      .select('*')
      .order('created_at', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load snapshots: ${error.message}`);
    return (data ?? []) as GraphSnapshotRecord[];
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealth(workspaceId?: string | null): Promise<GraphHealth> {
    const stats = await this.getStatistics(workspaceId);
    const errors: string[] = [];

    if (stats.total_nodes === 0) errors.push('No nodes in graph');
    if (stats.deleted_nodes > stats.total_nodes) errors.push('More deleted nodes than active nodes');

    const orphanedNodes = await this.countOrphanedNodes(workspaceId);
    const lowConfidenceEdges = await this.countLowConfidenceEdges(workspaceId);
    const lastRebuild = await this.getLastRebuildTimestamp(workspaceId);

    return {
      healthy: errors.length === 0 && stats.total_nodes > 0,
      total_nodes: stats.total_nodes,
      total_edges: stats.total_edges,
      orphaned_nodes: orphanedNodes,
      duplicate_nodes: stats.duplicate_count,
      low_confidence_edges: lowConfidenceEdges,
      last_rebuild: lastRebuild,
      errors,
    };
  }

  // ----------------------------------------------------------
  // Relationship Validation
  // ----------------------------------------------------------

  validateRelationship(sourceNodeType: NodeType, targetNodeType: NodeType, relationshipType: RelationshipType): { valid: boolean; error?: string } {
    return relationshipResolver.validate(sourceNodeType, targetNodeType, relationshipType);
  }

  getValidRelationships(nodeType: NodeType): RelationshipType[] {
    return relationshipResolver.getValidRelationships(nodeType);
  }

  private async countOrphanedNodes(workspaceId?: string | null): Promise<number> {
    const { data: edgeNodes } = await supabase
      .from('graph_edges')
      .select('source_node_id, target_node_id')
      .eq('is_deleted', false);
    const connected = new Set<string>();
    for (const e of (edgeNodes ?? []) as { source_node_id: string; target_node_id: string }[]) {
      connected.add(e.source_node_id);
      connected.add(e.target_node_id);
    }
    let q = supabase.from('graph_nodes').select('id').eq('is_deleted', false);
    if (workspaceId) q = q.eq('workspace_id', workspaceId);
    const { data: allNodes } = await q;
    let orphaned = 0;
    for (const n of (allNodes ?? []) as { id: string }[]) {
      if (!connected.has(n.id)) orphaned++;
    }
    return orphaned;
  }

  private async countLowConfidenceEdges(workspaceId?: string | null): Promise<number> {
    let q = supabase
      .from('graph_edges')
      .select('confidence_score', { count: 'exact', head: true })
      .eq('is_deleted', false)
      .lt('confidence_score', 0.5);
    if (workspaceId) q = q.eq('workspace_id', workspaceId);
    const { count } = await q;
    return count ?? 0;
  }

  private async getLastRebuildTimestamp(workspaceId?: string | null): Promise<string | null> {
    let q = supabase
      .from('graph_snapshots')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (workspaceId) q = q.eq('workspace_id', workspaceId);
    const { data } = await q;
    return (data as { created_at: string } | null)?.created_at ?? null;
  }
}

export const knowledgeGraphService = new KnowledgeGraphService();
