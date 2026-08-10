// ============================================================
// MemoryRelationshipService — Manages relationships between memories
// ============================================================

import { memoryRepository } from './MemoryRepository';
import type { MemoryRelationshipRecord, MemoryRelationshipType, MemoryEntityRecord } from '@/types/memory-engine';

class MemoryRelationshipService {
  async createRelationship(params: {
    sourceMemoryId: string;
    targetMemoryId: string;
    relationshipType: MemoryRelationshipType;
    strength?: number;
    workspaceId?: string | null;
  }): Promise<MemoryRelationshipRecord> {
    const relationship = await memoryRepository.createRelationship({
      workspaceId: params.workspaceId,
      sourceMemoryId: params.sourceMemoryId,
      targetMemoryId: params.targetMemoryId,
      relationshipType: params.relationshipType,
      strength: params.strength ?? 0.5,
    });

    // Record learning event
    await memoryRepository.createLearningEvent({
      workspaceId: params.workspaceId,
      eventType: 'relationship_created',
      triggeredBy: 'memory_relationship_service',
      learningSummary: `Relationship ${params.relationshipType} created between memories`,
      confidence: params.strength ?? 0.5,
    });

    return relationship;
  }

  async getRelationships(memoryId: string): Promise<MemoryRelationshipRecord[]> {
    return memoryRepository.getRelationships(memoryId);
  }

  async getRelatedMemories(memoryId: string): Promise<{ relationship: MemoryRelationshipRecord; entity: MemoryEntityRecord | null }[]> {
    const relationships = await memoryRepository.getRelationships(memoryId);
    const relatedIds = new Set<string>();
    for (const rel of relationships) {
      if (rel.source_memory_id === memoryId) relatedIds.add(rel.target_memory_id);
      else relatedIds.add(rel.source_memory_id);
    }

    const entities: (MemoryEntityRecord | null)[] = [];
    for (const id of relatedIds) {
      entities.push(await memoryRepository.getEntity(id));
    }

    return relationships.map((rel) => {
      const otherId = rel.source_memory_id === memoryId ? rel.target_memory_id : rel.source_memory_id;
      const entity = entities.find((e) => e?.id === otherId) ?? null;
      return { relationship: rel, entity };
    });
  }

  async autoCreateRelationships(params: {
    memoryId: string;
    relatedEntities: { id: string; relationshipType: MemoryRelationshipType; strength?: number }[];
    workspaceId?: string | null;
  }): Promise<number> {
    let created = 0;
    for (const related of params.relatedEntities) {
      try {
        await this.createRelationship({
          sourceMemoryId: params.memoryId,
          targetMemoryId: related.id,
          relationshipType: related.relationshipType,
          strength: related.strength,
          workspaceId: params.workspaceId,
        });
        created++;
      } catch {
        // Skip if relationship already exists
      }
    }
    return created;
  }
}

export const memoryRelationshipService = new MemoryRelationshipService();
