// ============================================================
// MemoryMergeService — Merges duplicate memories
// ============================================================

import { memoryRepository } from './MemoryRepository';
import type { MemoryEntityRecord, MemoryMergeRequest, MemoryMergeResult, DuplicateCandidate } from '@/types/memory-engine';

class MemoryMergeService {
  async merge(request: MemoryMergeRequest): Promise<MemoryMergeResult> {
    const { primaryMemoryId, duplicateMemoryIds } = request;
    if (duplicateMemoryIds.length === 0) {
      return { merged_memory_id: primaryMemoryId, absorbed_memory_ids: [], relationships_relocated: 0 };
    }

    const primary = await memoryRepository.getEntity(primaryMemoryId);
    if (!primary) throw new Error(`Primary memory not found: ${primaryMemoryId}`);

    let relationshipsRelocated = 0;

    for (const dupId of duplicateMemoryIds) {
      const duplicate = await memoryRepository.getEntity(dupId);
      if (!duplicate) continue;

      // Merge content
      const mergedContent = {
        ...duplicate.content,
        ...primary.content,
      };

      // Update primary with merged content and higher confidence
      const newConfidence = Math.max(primary.confidence_score, duplicate.confidence_score);
      const newImportance = Math.max(primary.importance_score, duplicate.importance_score);

      await memoryRepository.updateEntity(primaryMemoryId, {
        ...primary,
        content: mergedContent,
        confidence_score: newConfidence,
        importance_score: newImportance,
        version: primary.version,
      });

      // Relocate relationships
      relationshipsRelocated += await memoryRepository.relocateRelationships(dupId, primaryMemoryId);

      // Deactivate duplicate
      await memoryRepository.deactivateEntity(dupId);

      // Record learning event
      await memoryRepository.createLearningEvent({
        workspaceId: request.workspaceId,
        eventType: 'memory_merged',
        entityType: primary.entity_type,
        entityId: primary.entity_id,
        triggeredBy: 'memory_merge_service',
        learningSummary: `Merged duplicate memory "${duplicate.title}" into "${primary.title}"`,
        confidence: 0.9,
      });
    }

    return {
      merged_memory_id: primaryMemoryId,
      absorbed_memory_ids: duplicateMemoryIds,
      relationships_relocated: relationshipsRelocated,
    };
  }

  async findDuplicates(params: {
    entityType?: string;
    memoryType?: string;
    workspaceId?: string | null;
    threshold?: number;
  }): Promise<DuplicateCandidate[]> {
    const threshold = params.threshold ?? 0.85;
    const entities = await memoryRepository.searchEntities({
      entityType: params.entityType,
      memoryType: params.memoryType,
      workspaceId: params.workspaceId,
      limit: 500,
    });

    const candidates: DuplicateCandidate[] = [];

    for (let i = 0; i < entities.length; i++) {
      for (let j = i + 1; j < entities.length; j++) {
        if (entities[i].entity_type !== entities[j].entity_type) continue;
        if (entities[i].entity_id !== entities[j].entity_id) continue;
        if (entities[i].memory_type !== entities[j].memory_type) continue;

        const similarity = this.calculateSimilarity(entities[i], entities[j]);
        if (similarity.score >= threshold) {
          candidates.push({
            primary: entities[i].created_at <= entities[j].created_at ? entities[i] : entities[j],
            duplicate: entities[i].created_at <= entities[j].created_at ? entities[j] : entities[i],
            similarity_score: similarity.score,
            match_reasons: similarity.reasons,
          });
        }
      }
    }

    return candidates;
  }

  private calculateSimilarity(a: MemoryEntityRecord, b: MemoryEntityRecord): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let score = 0;
    let factors = 0;

    // Title similarity
    const titleSim = this.jaccardSimilarity(
      a.title.toLowerCase().split(/\s+/),
      b.title.toLowerCase().split(/\s+/)
    );
    score += titleSim * 0.4;
    factors++;
    if (titleSim > 0.7) reasons.push(`Similar title (${Math.round(titleSim * 100)}%)`);

    // Summary similarity
    if (a.summary && b.summary) {
      const summarySim = this.jaccardSimilarity(
        a.summary.toLowerCase().split(/\s+/),
        b.summary.toLowerCase().split(/\s+/)
      );
      score += summarySim * 0.3;
      factors++;
      if (summarySim > 0.6) reasons.push(`Similar summary (${Math.round(summarySim * 100)}%)`);
    } else {
      factors++;
    }

    // Content overlap
    const contentSim = this.propertySimilarity(a.content, b.content);
    score += contentSim * 0.3;
    factors++;
    if (contentSim > 0.7) reasons.push(`Similar content (${Math.round(contentSim * 100)}%)`);

    return { score: factors > 0 ? score / factors : 0, reasons };
  }

  private jaccardSimilarity(a: string[], b: string[]): number {
    const setA = new Set(a);
    const setB = new Set(b);
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private propertySimilarity(a: Record<string, unknown>, b: Record<string, unknown>): number {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    const allKeys = new Set([...keysA, ...keysB]);
    if (allKeys.size === 0) return 0;

    let matches = 0;
    for (const key of allKeys) {
      if (key in a && key in b) {
        if (JSON.stringify(a[key]) === JSON.stringify(b[key])) matches++;
      }
    }
    return matches / allKeys.size;
  }
}

export const memoryMergeService = new MemoryMergeService();
