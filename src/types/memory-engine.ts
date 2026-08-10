// ============================================================
// Enterprise Memory & Learning Engine — Type Definitions
// ============================================================

// ============================================================
// Memory Types
// ============================================================

export type MemoryType =
  | 'company'
  | 'contact'
  | 'organization'
  | 'research'
  | 'revenue_intelligence'
  | 'meeting'
  | 'email'
  | 'proposal'
  | 'conversation'
  | 'crm'
  | 'document'
  | 'agent'
  | 'execution'
  | 'user_preference'
  | 'learning'
  | 'decision'
  | 'relationship'
  | 'historical';

export type EntityType =
  | 'company'
  | 'contact'
  | 'person'
  | 'lead'
  | 'account'
  | 'organization'
  | 'prospect'
  | 'meeting'
  | 'email'
  | 'task'
  | 'note'
  | 'document'
  | 'proposal'
  | 'campaign'
  | 'agent'
  | 'execution'
  | 'user'
  | 'workspace'
  | 'custom';

// ============================================================
// Learning Event Types
// ============================================================

export type LearningEventType =
  | 'memory_created'
  | 'memory_updated'
  | 'memory_merged'
  | 'memory_expired'
  | 'relationship_created'
  | 'confidence_adjusted'
  | 'duplicate_detected'
  | 'learning_recorded'
  | 'memory_refreshed'
  | 'memory_compressed';

// ============================================================
// Memory Relationship Types
// ============================================================

export type MemoryRelationshipType =
  | 'RELATED_TO'
  | 'DERIVED_FROM'
  | 'SUPERSEDES'
  | 'CONTRADICTS'
  | 'SUPPORTS'
  | 'REFERENCES'
  | 'EVOLVED_FROM'
  | 'MERGED_FROM';

// ============================================================
// Database Records
// ============================================================

export type MemoryEntityRecord = {
  id: string;
  workspace_id: string | null;
  entity_type: EntityType;
  entity_id: string;
  memory_type: MemoryType;
  title: string;
  summary: string | null;
  content: Record<string, unknown>;
  confidence_score: number;
  freshness_score: number;
  importance_score: number;
  is_active: boolean;
  version: number;
  created_at: string;
  updated_at: string;
};

export type MemoryRecordRecord = {
  id: string;
  workspace_id: string | null;
  memory_entity_id: string;
  source: string;
  content: Record<string, unknown>;
  embedding_reference: string | null;
  version: number;
  created_at: string;
};

export type MemoryRelationshipRecord = {
  id: string;
  workspace_id: string | null;
  source_memory_id: string;
  target_memory_id: string;
  relationship_type: MemoryRelationshipType;
  strength: number;
  created_at: string;
};

export type LearningEventRecord = {
  id: string;
  workspace_id: string | null;
  event_type: LearningEventType;
  entity_type: string | null;
  entity_id: string | null;
  triggered_by: string;
  learning_summary: string | null;
  confidence: number;
  created_at: string;
};

// ============================================================
// Memory Store Request
// ============================================================

export type MemoryStoreRequest = {
  entityType: EntityType;
  entityId: string;
  memoryType: MemoryType;
  title: string;
  summary?: string;
  content?: Record<string, unknown>;
  confidenceScore?: number;
  importanceScore?: number;
  source?: string;
  workspaceId?: string | null;
};

// ============================================================
// Memory Search Request
// ============================================================

export type MemorySearchRequest = {
  query?: string;
  entityType?: EntityType;
  entityId?: string;
  memoryType?: MemoryType;
  minConfidence?: number;
  minImportance?: number;
  minFreshness?: number;
  limit?: number;
  workspaceId?: string | null;
};

// ============================================================
// Memory Search Result
// ============================================================

export type MemorySearchResult = {
  entity: MemoryEntityRecord;
  score: number;
  matched_fields: string[];
};

// ============================================================
// Memory Merge Request
// ============================================================

export type MemoryMergeRequest = {
  primaryMemoryId: string;
  duplicateMemoryIds: string[];
  workspaceId?: string | null;
};

export type MemoryMergeResult = {
  merged_memory_id: string;
  absorbed_memory_ids: string[];
  relationships_relocated: number;
};

// ============================================================
// Memory Health & Monitoring
// ============================================================

export type MemoryHealth = {
  healthy: boolean;
  total_memories: number;
  active_memories: number;
  expired_memories: number;
  total_relationships: number;
  total_learning_events: number;
  duplicate_count: number;
  average_confidence: number;
  average_freshness: number;
  average_importance: number;
  errors: string[];
};

export type MemoryMonitorSummary = {
  total_memories: number;
  active_memories: number;
  expired_memories: number;
  total_relationships: number;
  total_learning_events: number;
  duplicate_count: number;
  average_confidence: number;
  average_freshness: number;
  average_importance: number;
  memory_type_distribution: Record<string, number>;
  entity_type_distribution: Record<string, number>;
  learning_event_distribution: Record<string, number>;
  recent_learning_events: LearningEventRecord[];
  top_entities: { entity_id: string; title: string; importance: number; confidence: number }[];
};

// ============================================================
// Duplicate Candidate
// ============================================================

export type DuplicateCandidate = {
  primary: MemoryEntityRecord;
  duplicate: MemoryEntityRecord;
  similarity_score: number;
  match_reasons: string[];
};
