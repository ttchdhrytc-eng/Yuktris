// ============================================================
// MemoryRankingService — Ranks memories by importance, confidence, freshness
// ============================================================

import type { MemoryEntityRecord, MemorySearchResult } from '@/types/memory-engine';

class MemoryRankingService {
  rank(memories: MemoryEntityRecord[]): MemoryEntityRecord[] {
    return memories
      .map((m) => ({ entity: m, score: this.calculateCompositeScore(m) }))
      .sort((a, b) => b.score - a.score)
      .map((s) => s.entity);
  }

  rankSearchResults(results: MemorySearchResult[]): MemorySearchResult[] {
    return results
      .map((r) => ({
        ...r,
        score: r.score * 0.5 + this.calculateCompositeScore(r.entity) * 0.5,
      }))
      .sort((a, b) => b.score - a.score);
  }

  calculateCompositeScore(entity: MemoryEntityRecord): number {
    const importance = entity.importance_score * 0.4;
    const confidence = entity.confidence_score * 0.35;
    const freshness = entity.freshness_score * 0.25;
    return importance + confidence + freshness;
  }

  getTopMemories(memories: MemoryEntityRecord[], limit: number): MemoryEntityRecord[] {
    return this.rank(memories).slice(0, limit);
  }

  filterByConfidence(memories: MemoryEntityRecord[], minConfidence: number): MemoryEntityRecord[] {
    return memories.filter((m) => m.confidence_score >= minConfidence);
  }

  filterByImportance(memories: MemoryEntityRecord[], minImportance: number): MemoryEntityRecord[] {
    return memories.filter((m) => m.importance_score >= minImportance);
  }

  filterByFreshness(memories: MemoryEntityRecord[], minFreshness: number): MemoryEntityRecord[] {
    return memories.filter((m) => m.freshness_score >= minFreshness);
  }
}

export const memoryRankingService = new MemoryRankingService();
