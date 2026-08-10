// ============================================================
// Enterprise Knowledge Graph — Type Definitions
// ============================================================

// ============================================================
// Core Entity Types
// ============================================================

export type NodeType =
  | 'company'
  | 'contact'
  | 'person'
  | 'lead'
  | 'account'
  | 'user'
  | 'organization'
  | 'product'
  | 'service'
  | 'technology'
  | 'industry'
  | 'location'
  | 'website'
  | 'domain'
  | 'email'
  | 'meeting'
  | 'document'
  | 'proposal'
  | 'task'
  | 'note'
  | 'research_report'
  | 'buying_signal'
  | 'growth_signal'
  | 'funding_event'
  | 'hiring_event'
  | 'competitor'
  | 'crm_record'
  | 'calendar_event'
  | 'ai_insight';

export type RelationshipType =
  | 'WORKS_FOR'
  | 'OWNS'
  | 'BELONGS_TO'
  | 'USES_TECHNOLOGY'
  | 'COMPETES_WITH'
  | 'SERVES'
  | 'TARGETS'
  | 'LOCATED_IN'
  | 'PARTNER_OF'
  | 'CUSTOMER_OF'
  | 'PROSPECT_OF'
  | 'ATTENDED'
  | 'SENT_EMAIL'
  | 'RECEIVED_EMAIL'
  | 'HAS_MEETING'
  | 'RELATED_TO'
  | 'GENERATED_BY'
  | 'MENTIONS'
  | 'HAS_BUYING_SIGNAL'
  | 'HAS_GROWTH_SIGNAL'
  | 'HAS_DOCUMENT'
  | 'HAS_PROPOSAL'
  | 'REFERENCES'
  | 'SIMILAR_TO'
  | 'PARENT_OF'
  | 'CHILD_OF';

// ============================================================
// Database Records
// ============================================================

export type GraphNodeRecord = {
  id: string;
  workspace_id: string | null;
  node_type: NodeType;
  external_id: string | null;
  display_name: string;
  properties: Record<string, unknown>;
  confidence_score: number;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type GraphEdgeRecord = {
  id: string;
  workspace_id: string | null;
  source_node_id: string;
  target_node_id: string;
  relationship_type: RelationshipType;
  properties: Record<string, unknown>;
  confidence_score: number;
  is_deleted: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type GraphSnapshotRecord = {
  id: string;
  workspace_id: string | null;
  snapshot_name: string;
  description: string | null;
  node_count: number;
  edge_count: number;
  snapshot_data: Record<string, unknown> | null;
  created_at: string;
};

// ============================================================
// Query Types
// ============================================================

export type GraphQuery = {
  startNodeId?: string;
  nodeType?: NodeType;
  relationshipType?: RelationshipType;
  maxDepth?: number;
  minConfidence?: number;
  limit?: number;
  properties?: Record<string, unknown>;
};

export type GraphQueryResult = {
  nodes: GraphNodeRecord[];
  edges: GraphEdgeRecord[];
  depth?: number;
};

export type NeighborhoodResult = {
  node_id: string;
  node_type: NodeType;
  display_name: string;
  depth: number;
  edge_id: string;
  edge_type: RelationshipType;
  source_node_id: string;
  confidence_score: number;
};

export type ShortestPathResult = {
  node_id: string;
  node_type: NodeType;
  display_name: string;
  step: number;
  edge_type: string;
};

export type SearchResult = {
  nodes: GraphNodeRecord[];
  total: number;
};

// ============================================================
// Analytics & Statistics
// ============================================================

export type GraphStatistics = {
  total_nodes: number;
  total_edges: number;
  nodes_by_type: Record<string, number>;
  edges_by_type: Record<string, number>;
  graph_density: number;
  average_confidence: number;
  duplicate_count: number;
  merge_operations: number;
  deleted_nodes: number;
  deleted_edges: number;
  most_connected_nodes: { node_id: string; display_name: string; degree: number }[];
};

export type GraphAnalytics = {
  nodeCount: number;
  edgeCount: number;
  density: number;
  averageDegree: number;
  maxDegree: number;
  connectedComponents: number;
  topNodesByDegree: { nodeId: string; displayName: string; degree: number }[];
  relationshipDistribution: Record<string, number>;
  confidenceDistribution: { high: number; medium: number; low: number };
};

// ============================================================
// Ingestion Types
// ============================================================

export type IngestionSource =
  | 'research_intelligence'
  | 'google_workspace'
  | 'crm'
  | 'linkedin'
  | 'firecrawl'
  | 'tavily'
  | 'ai_agent'
  | 'manual'
  | 'future_provider';

export type IngestEntity = {
  nodeType: NodeType;
  externalId?: string;
  displayName: string;
  properties?: Record<string, unknown>;
  confidenceScore?: number;
  source: IngestionSource;
};

export type IngestRelationship = {
  sourceExternalId: string;
  sourceNodeType: NodeType;
  targetExternalId: string;
  targetNodeType: NodeType;
  relationshipType: RelationshipType;
  properties?: Record<string, unknown>;
  confidenceScore?: number;
  source: IngestionSource;
};

export type IngestBatch = {
  workspaceId?: string | null;
  entities: IngestEntity[];
  relationships: IngestRelationship[];
};

// ============================================================
// Merge & Deduplication
// ============================================================

export type MergeCandidate = {
  primaryNode: GraphNodeRecord;
  duplicateNode: GraphNodeRecord;
  similarityScore: number;
  matchReasons: string[];
};

export type MergeResult = {
  mergedNodeId: string;
  absorbedNodeIds: string[];
  edgesRelocated: number;
  edgesMerged: number;
};

// ============================================================
// Health
// ============================================================

export type GraphHealth = {
  healthy: boolean;
  total_nodes: number;
  total_edges: number;
  orphaned_nodes: number;
  duplicate_nodes: number;
  low_confidence_edges: number;
  last_rebuild: string | null;
  errors: string[];
};

// ============================================================
// Service Interfaces
// ============================================================

export interface INodeService {
  create(params: {
    workspaceId?: string | null;
    nodeType: NodeType;
    externalId?: string | null;
    displayName: string;
    properties?: Record<string, unknown>;
    confidenceScore?: number;
  }): Promise<GraphNodeRecord>;

  getById(id: string): Promise<GraphNodeRecord | null>;
  getByExternalId(externalId: string, nodeType: NodeType, workspaceId?: string | null): Promise<GraphNodeRecord | null>;
  update(id: string, updates: Partial<GraphNodeRecord>): Promise<GraphNodeRecord>;
  softDelete(id: string): Promise<void>;
  search(params: { query: string; nodeType?: NodeType; limit?: number }): Promise<SearchResult>;
  findByType(nodeType: NodeType, limit?: number): Promise<GraphNodeRecord[]>;
}

export interface IEdgeService {
  create(params: {
    workspaceId?: string | null;
    sourceNodeId: string;
    targetNodeId: string;
    relationshipType: RelationshipType;
    properties?: Record<string, unknown>;
    confidenceScore?: number;
  }): Promise<GraphEdgeRecord>;

  getById(id: string): Promise<GraphEdgeRecord | null>;
  getBySource(sourceNodeId: string): Promise<GraphEdgeRecord[]>;
  getByTarget(targetNodeId: string): Promise<GraphEdgeRecord[]>;
  getByRelationship(relationshipType: RelationshipType): Promise<GraphEdgeRecord[]>;
  update(id: string, updates: Partial<GraphEdgeRecord>): Promise<GraphEdgeRecord>;
  softDelete(id: string): Promise<void>;
  getRelationships(nodeId: string, direction?: 'outgoing' | 'incoming' | 'both'): Promise<{ edges: GraphEdgeRecord[]; nodes: GraphNodeRecord[] }>;
}
