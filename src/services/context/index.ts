// ============================================================
// Enterprise Context Engine — Service Index
// ============================================================

export { contextEngine } from './ContextEngine';
export { contextBuilder } from './ContextBuilder';
export { contextCollector } from './ContextCollector';
export { contextRanker } from './ContextRanker';
export { contextCompressor } from './ContextCompressor';
export { contextSummarizer } from './ContextSummarizer';
export { contextValidator } from './ContextValidator';
export { contextCache } from './ContextCache';
export { contextResolver } from './ContextResolver';
export { contextVersionManager } from './ContextVersionManager';
export { contextAssembler } from './ContextAssembler';
export { promptContextBuilder } from './PromptContextBuilder';

export type {
  ContextSourceId,
  ContextSourceType,
  ContextType,
  ContextStatus,
  ContextFragment,
  ContextPriority,
  ContextRequest,
  AssembledContext,
  SystemContext,
  BusinessContext,
  CompanyContext,
  ProspectContext,
  RelationshipContext,
  ResearchContext,
  RevenueContext,
  TaskContext,
  UserContext,
  ConversationContext,
  ExecutionContext,
  ContextMetadata,
  ContextProfileRecord,
  ContextSnapshotRecord,
  ContextCacheRecord,
  SourceContribution,
  ContextHealth,
  ContextMonitorSummary,
  TokenBudget,
} from '@/types/context-engine';
