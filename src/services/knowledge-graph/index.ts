// ============================================================
// Knowledge Graph — Service Index
// ============================================================

export { knowledgeGraphService } from './KnowledgeGraphService';
export { nodeService } from './NodeService';
export { edgeService } from './EdgeService';
export { graphQueryService } from './GraphQueryService';
export { graphSearchService } from './GraphSearchService';
export { graphAnalyticsService } from './GraphAnalyticsService';
export { graphBuilder } from './GraphBuilder';
export { graphUpdater } from './GraphUpdater';
export { relationshipResolver } from './RelationshipResolver';
export { entityMerger } from './EntityMerger';
export { deduplicationService } from './DeduplicationService';

export type {
  NodeType,
  RelationshipType,
  GraphNodeRecord,
  GraphEdgeRecord,
  GraphSnapshotRecord,
  GraphQuery,
  GraphQueryResult,
  NeighborhoodResult,
  ShortestPathResult,
  SearchResult,
  GraphStatistics,
  GraphAnalytics,
  GraphHealth,
  IngestionSource,
  IngestEntity,
  IngestRelationship,
  IngestBatch,
  MergeCandidate,
  MergeResult,
  INodeService,
  IEdgeService,
} from '@/types/knowledge-graph';
