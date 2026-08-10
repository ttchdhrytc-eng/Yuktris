// ============================================================
// MemoryEngine — Central facade for all memory operations
// ============================================================
//
// This is the single entry point for all AI agents to store and
// retrieve knowledge. Every agent must go through this engine
// instead of directly querying databases or services.

import { memoryRepository } from './MemoryRepository';
import { memorySearchService } from './MemorySearchService';
import { memoryRankingService } from './MemoryRankingService';
import { memoryMergeService } from './MemoryMergeService';
import { memoryLearningService } from './MemoryLearningService';
import { memoryVersionService } from './MemoryVersionService';
import { memoryFreshnessService } from './MemoryFreshnessService';
import { memoryRelationshipService } from './MemoryRelationshipService';
import { memoryCompressionService } from './MemoryCompressionService';
import { supabase } from '@/lib/supabase';
import type {
  MemoryStoreRequest,
  MemorySearchRequest,
  MemorySearchResult,
  MemoryEntityRecord,
  MemoryMergeRequest,
  MemoryMergeResult,
  MemoryHealth,
  MemoryMonitorSummary,
  LearningEventRecord,
  MemoryRecordRecord,
  MemoryRelationshipRecord,
  DuplicateCandidate,
} from '@/types/memory-engine';

class MemoryEngine {
  // ----------------------------------------------------------
  // Store — Main pipeline for creating/updating memories
  // ----------------------------------------------------------

  async store(request: MemoryStoreRequest): Promise<{ memory: MemoryEntityRecord; created: boolean; learningEvent: LearningEventRecord }> {
    // 1. Mask sensitive data
    const safeContent = this.maskSensitiveData(request.content ?? {});

    // 2. Learn (create or update)
    const result = await memoryLearningService.learn({
      entityType: request.entityType,
      entityId: request.entityId,
      memoryType: request.memoryType,
      title: request.title,
      summary: request.summary,
      content: safeContent,
      confidence: request.confidenceScore,
      importance: request.importanceScore,
      source: 'memory_store',
      workspaceId: request.workspaceId,
    });

    return result;
  }

  // ----------------------------------------------------------
  // Search
  // ----------------------------------------------------------

  async search(request: MemorySearchRequest): Promise<MemorySearchResult[]> {
    const results = await memorySearchService.search(request);
    return memoryRankingService.rankSearchResults(results);
  }

  async semanticSearch(params: {
    query: string;
    memoryType?: string;
    limit?: number;
    workspaceId?: string | null;
  }): Promise<MemorySearchResult[]> {
    return memorySearchService.semanticSearch(params);
  }

  // ----------------------------------------------------------
  // Retrieve
  // ----------------------------------------------------------

  async getMemory(id: string): Promise<MemoryEntityRecord | null> {
    return memoryRepository.getEntity(id);
  }

  async getMemoryByRef(entityType: string, entityId: string, memoryType: string, workspaceId?: string | null): Promise<MemoryEntityRecord | null> {
    return memoryRepository.getEntityByRef(entityType, entityId, memoryType, workspaceId);
  }

  async getMemoriesByEntity(entityType: string, entityId: string, workspaceId?: string | null): Promise<MemoryEntityRecord[]> {
    return memorySearchService.searchByEntity(entityType, entityId, workspaceId);
  }

  async getMemoriesByType(memoryType: string, workspaceId?: string | null, limit?: number): Promise<MemoryEntityRecord[]> {
    return memorySearchService.searchByType(memoryType, workspaceId, limit);
  }

  // ----------------------------------------------------------
  // Merge
  // ----------------------------------------------------------

  async merge(request: MemoryMergeRequest): Promise<MemoryMergeResult> {
    return memoryMergeService.merge(request);
  }

  async findDuplicates(params: {
    entityType?: string;
    memoryType?: string;
    workspaceId?: string | null;
    threshold?: number;
  }): Promise<DuplicateCandidate[]> {
    return memoryMergeService.findDuplicates(params);
  }

  // ----------------------------------------------------------
  // Version History
  // ----------------------------------------------------------

  async getHistory(memoryEntityId: string, limit?: number): Promise<MemoryRecordRecord[]> {
    return memoryVersionService.getVersionHistory(memoryEntityId, limit);
  }

  // ----------------------------------------------------------
  // Relationships
  // ----------------------------------------------------------

  async getRelationships(memoryId: string): Promise<MemoryRelationshipRecord[]> {
    return memoryRelationshipService.getRelationships(memoryId);
  }

  async getRelatedMemories(memoryId: string): Promise<{ relationship: MemoryRelationshipRecord; entity: MemoryEntityRecord | null }[]> {
    return memoryRelationshipService.getRelatedMemories(memoryId);
  }

  // ----------------------------------------------------------
  // Refresh
  // ----------------------------------------------------------

  async refresh(memoryEntityId: string, workspaceId?: string | null): Promise<MemoryEntityRecord> {
    return memoryFreshnessService.refresh(memoryEntityId, workspaceId);
  }

  async refreshByEntity(entityType: string, entityId: string, memoryType: string, workspaceId?: string | null): Promise<MemoryEntityRecord | null> {
    return memoryFreshnessService.refreshByEntity(entityType, entityId, memoryType, workspaceId);
  }

  async expireStale(workspaceId?: string | null): Promise<number> {
    return memoryFreshnessService.expireStale(workspaceId);
  }

  async updateFreshnessScores(workspaceId?: string | null): Promise<number> {
    return memoryFreshnessService.updateFreshnessScores(workspaceId);
  }

  // ----------------------------------------------------------
  // Compression
  // ----------------------------------------------------------

  compressMemory(entity: MemoryEntityRecord): { content: Record<string, unknown>; summary: string; ratio: number } {
    return memoryCompressionService.compress(entity);
  }

  // ----------------------------------------------------------
  // Learning Events
  // ----------------------------------------------------------

  async getLearningEvents(limit?: number, workspaceId?: string | null): Promise<LearningEventRecord[]> {
    return memoryRepository.getLearningEvents(limit, workspaceId);
  }

  // ----------------------------------------------------------
  // Delete
  // ----------------------------------------------------------

  async delete(memoryEntityId: string): Promise<void> {
    await memoryRepository.deactivateEntity(memoryEntityId);
  }

  async recordDecision(params: {
    entityType: string;
    entityId: string;
    decision: string;
    rationale: string;
    confidence: number;
    workspaceId?: string | null;
  }): Promise<LearningEventRecord> {
    return memoryLearningService.recordDecision(params);
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealth(workspaceId?: string | null): Promise<MemoryHealth> {
    const summary = await this.getSummary(workspaceId);
    const errors: string[] = [];

    if (summary.total_memories === 0) errors.push('No memories stored');
    if (summary.duplicate_count > 10) errors.push(`${summary.duplicate_count} potential duplicates detected`);
    if (summary.average_freshness < 0.3) errors.push('Average freshness is critically low');

    return {
      healthy: errors.length === 0,
      total_memories: summary.total_memories,
      active_memories: summary.active_memories,
      expired_memories: summary.expired_memories,
      total_relationships: summary.total_relationships,
      total_learning_events: summary.total_learning_events,
      duplicate_count: summary.duplicate_count,
      average_confidence: summary.average_confidence,
      average_freshness: summary.average_freshness,
      average_importance: summary.average_importance,
      errors,
    };
  }

  // ----------------------------------------------------------
  // Monitoring Summary
  // ----------------------------------------------------------

  async getSummary(workspaceId?: string | null): Promise<MemoryMonitorSummary> {
    let entityQuery = supabase.from('memory_entities').select('*');
    if (workspaceId) entityQuery = entityQuery.eq('workspace_id', workspaceId);
    const { data: entities } = await entityQuery;

    const entityList = (entities ?? []) as MemoryEntityRecord[];

    const activeCount = entityList.filter((e) => e.is_active).length;
    const expiredCount = entityList.filter((e) => !e.is_active).length;

    const avgConfidence = entityList.length > 0
      ? entityList.reduce((s, e) => s + e.confidence_score, 0) / entityList.length
      : 0;
    const avgFreshness = entityList.length > 0
      ? entityList.reduce((s, e) => s + e.freshness_score, 0) / entityList.length
      : 0;
    const avgImportance = entityList.length > 0
      ? entityList.reduce((s, e) => s + e.importance_score, 0) / entityList.length
      : 0;

    const typeDist: Record<string, number> = {};
    for (const e of entityList) {
      typeDist[e.memory_type] = (typeDist[e.memory_type] ?? 0) + 1;
    }

    const entityDist: Record<string, number> = {};
    for (const e of entityList) {
      entityDist[e.entity_type] = (entityDist[e.entity_type] ?? 0) + 1;
    }

    // Relationships count
    let relQuery = supabase.from('memory_relationships').select('*', { count: 'exact', head: true });
    if (workspaceId) relQuery = relQuery.eq('workspace_id', workspaceId);
    const { count: relCount } = await relQuery;

    // Learning events
    const learningEvents = await memoryRepository.getLearningEvents(10, workspaceId);
    const learningCount = await memoryRepository.countLearningEvents(workspaceId);

    const eventDist: Record<string, number> = {};
    let allEvents: LearningEventRecord[] = [];
    let eventQuery = supabase.from('learning_events').select('*');
    if (workspaceId) eventQuery = eventQuery.eq('workspace_id', workspaceId);
    const { data: allEventData } = await eventQuery;
    allEvents = (allEventData ?? []) as LearningEventRecord[];
    for (const e of allEvents) {
      eventDist[e.event_type] = (eventDist[e.event_type] ?? 0) + 1;
    }

    // Duplicates
    const duplicates = await memoryMergeService.findDuplicates({ workspaceId, threshold: 0.85 });

    // Top entities
    const topEntities = memoryRankingService.getTopMemories(entityList, 10).map((e) => ({
      entity_id: e.entity_id,
      title: e.title,
      importance: e.importance_score,
      confidence: e.confidence_score,
    }));

    return {
      total_memories: entityList.length,
      active_memories: activeCount,
      expired_memories: expiredCount,
      total_relationships: relCount ?? 0,
      total_learning_events: learningCount,
      duplicate_count: duplicates.length,
      average_confidence: Math.round(avgConfidence * 100) / 100,
      average_freshness: Math.round(avgFreshness * 100) / 100,
      average_importance: Math.round(avgImportance * 100) / 100,
      memory_type_distribution: typeDist,
      entity_type_distribution: entityDist,
      learning_event_distribution: eventDist,
      recent_learning_events: learningEvents,
      top_entities: topEntities,
    };
  }

  // ----------------------------------------------------------
  // Security
  // ----------------------------------------------------------

  private maskSensitiveData(content: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = ['password', 'secret', 'api_key', 'token', 'credential', 'private_key', 'ssn', 'credit_card'];
    const masked = { ...content };

    for (const key of Object.keys(masked)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        masked[key] = '[REDACTED]';
      } else if (typeof masked[key] === 'object' && masked[key] !== null) {
        masked[key] = this.maskSensitiveData(masked[key] as Record<string, unknown>);
      }
    }

    return masked;
  }
}

export const memoryEngine = new MemoryEngine();
