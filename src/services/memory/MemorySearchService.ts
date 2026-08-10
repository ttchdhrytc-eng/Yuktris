// ============================================================
// MemorySearchService — Search and retrieve memories
// ============================================================

import { memoryRepository } from './MemoryRepository';
import type { MemorySearchRequest, MemorySearchResult, MemoryEntityRecord } from '@/types/memory-engine';

class MemorySearchService {
  async search(request: MemorySearchRequest): Promise<MemorySearchResult[]> {
    const entities = await memoryRepository.searchEntities({
      query: request.query,
      entityType: request.entityType,
      entityId: request.entityId,
      memoryType: request.memoryType,
      minConfidence: request.minConfidence,
      minImportance: request.minImportance,
      minFreshness: request.minFreshness,
      limit: request.limit ?? 50,
      workspaceId: request.workspaceId,
    });

    return entities.map((entity) => ({
      entity,
      score: this.calculateRelevanceScore(entity, request.query),
      matched_fields: this.getMatchedFields(entity, request.query),
    }));
  }

  async searchByEntity(entityType: string, entityId: string, workspaceId?: string | null): Promise<MemoryEntityRecord[]> {
    return memoryRepository.searchEntities({
      entityType,
      entityId,
      workspaceId,
      limit: 100,
    });
  }

  async searchByType(memoryType: string, workspaceId?: string | null, limit?: number): Promise<MemoryEntityRecord[]> {
    return memoryRepository.searchEntities({
      memoryType,
      workspaceId,
      limit: limit ?? 100,
    });
  }

  async semanticSearch(params: {
    query: string;
    memoryType?: string;
    limit?: number;
    workspaceId?: string | null;
  }): Promise<MemorySearchResult[]> {
    // Tokenize the query for keyword matching
    const tokens = params.query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

    const entities = await memoryRepository.searchEntities({
      memoryType: params.memoryType,
      limit: params.limit ? params.limit * 2 : 100,
      workspaceId: params.workspaceId,
    });

    const scored = entities.map((entity) => {
      const score = this.tokenSimilarity(entity, tokens);
      return {
        entity,
        score,
        matched_fields: this.getMatchedFields(entity, params.query),
      };
    });

    scored.sort((a, b) => b.score - a.score);

    return scored.filter((s) => s.score > 0).slice(0, params.limit ?? 50);
  }

  private calculateRelevanceScore(entity: MemoryEntityRecord, query?: string): number {
    if (!query) {
      return (entity.importance_score * 0.4 + entity.confidence_score * 0.3 + entity.freshness_score * 0.3);
    }

    const queryLower = query.toLowerCase();
    let score = 0;

    if (entity.title.toLowerCase().includes(queryLower)) score += 0.4;
    if (entity.summary?.toLowerCase().includes(queryLower)) score += 0.3;

    const tokens = queryLower.split(/\s+/);
    for (const token of tokens) {
      if (entity.title.toLowerCase().includes(token)) score += 0.1;
      if (entity.summary?.toLowerCase().includes(token)) score += 0.05;
    }

    score += entity.importance_score * 0.2;
    score += entity.confidence_score * 0.1;

    return Math.min(score, 1.0);
  }

  private tokenSimilarity(entity: MemoryEntityRecord, tokens: string[]): number {
    const text = `${entity.title} ${entity.summary ?? ''}`.toLowerCase();
    let matches = 0;
    for (const token of tokens) {
      if (text.includes(token)) matches++;
    }
    return tokens.length > 0 ? matches / tokens.length : 0;
  }

  private getMatchedFields(entity: MemoryEntityRecord, query?: string): string[] {
    if (!query) return [];
    const fields: string[] = [];
    const queryLower = query.toLowerCase();
    if (entity.title.toLowerCase().includes(queryLower)) fields.push('title');
    if (entity.summary?.toLowerCase().includes(queryLower)) fields.push('summary');
    return fields;
  }
}

export const memorySearchService = new MemorySearchService();
