// ============================================================
// MemoryLearningService — Automatic learning from interactions
// ============================================================

import { memoryRepository } from './MemoryRepository';
import type { MemoryEntityRecord, LearningEventRecord, EntityType, MemoryType } from '@/types/memory-engine';

class MemoryLearningService {
  async learn(params: {
    entityType: EntityType;
    entityId: string;
    memoryType: MemoryType;
    title: string;
    summary?: string;
    content?: Record<string, unknown>;
    confidence?: number;
    importance?: number;
    source?: string;
    workspaceId?: string | null;
  }): Promise<{ memory: MemoryEntityRecord; created: boolean; learningEvent: LearningEventRecord }> {
    // Check for existing memory
    const existing = await memoryRepository.getEntityByRef(
      params.entityType,
      params.entityId,
      params.memoryType,
      params.workspaceId,
    );

    let memory: MemoryEntityRecord;
    let created: boolean;
    let eventType: 'memory_created' | 'memory_updated';

    if (existing) {
      // Update existing — merge content, boost confidence
      const mergedContent = {
        ...existing.content,
        ...params.content,
      };

      const newConfidence = Math.min(
        (existing.confidence_score + (params.confidence ?? 0.5)) / 2 + 0.05,
        1.0,
      );

      memory = await memoryRepository.updateEntity(existing.id, {
        ...existing,
        title: params.title !== existing.title ? params.title : existing.title,
        summary: params.summary ?? existing.summary,
        content: mergedContent,
        confidence_score: newConfidence,
        importance_score: Math.max(existing.importance_score, params.importance ?? 0.5),
        freshness_score: 1.0,
        version: existing.version,
      });

      created = false;
      eventType = 'memory_updated';
    } else {
      // Create new memory
      memory = await memoryRepository.createEntity({
        workspaceId: params.workspaceId,
        entityType: params.entityType,
        entityId: params.entityId,
        memoryType: params.memoryType,
        title: params.title,
        summary: params.summary,
        content: params.content,
        confidenceScore: params.confidence ?? 0.5,
        importanceScore: params.importance ?? 0.5,
      });
      created = true;
      eventType = 'memory_created';
    }

    // Create a memory record for version history
    await memoryRepository.createRecord({
      workspaceId: params.workspaceId,
      memoryEntityId: memory.id,
      source: params.source ?? 'system',
      content: params.content ?? {},
    });

    // Record learning event
    const learningEvent = await memoryRepository.createLearningEvent({
      workspaceId: params.workspaceId,
      eventType,
      entityType: params.entityType,
      entityId: params.entityId,
      triggeredBy: params.source ?? 'memory_learning_service',
      learningSummary: created
        ? `New memory created: ${params.title}`
        : `Memory updated: ${params.title} (confidence boosted)`,
      confidence: memory.confidence_score,
    });

    return { memory, created, learningEvent };
  }

  async recordDecision(params: {
    entityType: EntityType;
    entityId: string;
    decision: string;
    rationale: string;
    confidence: number;
    source?: string;
    workspaceId?: string | null;
  }): Promise<LearningEventRecord> {
    return memoryRepository.createLearningEvent({
      workspaceId: params.workspaceId,
      eventType: 'learning_recorded',
      entityType: params.entityType,
      entityId: params.entityId,
      triggeredBy: params.source ?? 'decision',
      learningSummary: `Decision: ${params.decision} — Rationale: ${params.rationale}`,
      confidence: params.confidence,
    });
  }

  async getLearningHistory(entityType?: string, entityId?: string, workspaceId?: string | null, limit?: number): Promise<LearningEventRecord[]> {
    if (entityType && entityId) {
      const allEvents = await memoryRepository.getLearningEvents(limit ? limit * 2 : 100, workspaceId);
      return allEvents.filter((e) => e.entity_type === entityType && e.entity_id === entityId).slice(0, limit ?? 50);
    }
    return memoryRepository.getLearningEvents(limit ?? 50, workspaceId);
  }
}

export const memoryLearningService = new MemoryLearningService();
