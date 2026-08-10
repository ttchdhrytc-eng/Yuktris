// ============================================================
// Enterprise Memory & Learning Engine — Service Index
// ============================================================

export { memoryEngine } from './MemoryEngine';
export { memoryRepository } from './MemoryRepository';
export { memorySearchService } from './MemorySearchService';
export { memoryRankingService } from './MemoryRankingService';
export { memoryMergeService } from './MemoryMergeService';
export { memoryLearningService } from './MemoryLearningService';
export { memoryVersionService } from './MemoryVersionService';
export { memoryFreshnessService } from './MemoryFreshnessService';
export { memoryRelationshipService } from './MemoryRelationshipService';
export { memoryCompressionService } from './MemoryCompressionService';

export type {
  MemoryType,
  EntityType,
  LearningEventType,
  MemoryRelationshipType,
  MemoryEntityRecord,
  MemoryRecordRecord,
  MemoryRelationshipRecord,
  LearningEventRecord,
  MemoryStoreRequest,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryMergeRequest,
  MemoryMergeResult,
  MemoryHealth,
  MemoryMonitorSummary,
  DuplicateCandidate,
} from '@/types/memory-engine';
