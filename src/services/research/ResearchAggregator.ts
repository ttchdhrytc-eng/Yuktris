// ============================================================
// ResearchAggregator — Aggregates and deduplicates provider results
// ============================================================

import type {
  ProviderResult,
  AggregatedResult,
  CompanyIntelligenceRecord,
} from '@/types/research-intelligence';

class ResearchAggregator {
  aggregate(results: ProviderResult[]): AggregatedResult {
    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    const merged = this.mergeResults(successful);
    const totalConfidence = this.calculateConfidence(successful);

    return {
      results,
      successful: successful.length,
      failed: failed.length,
      totalConfidence,
      merged,
    };
  }

  private mergeResults(results: ProviderResult[]): Record<string, unknown> {
    const merged: Record<string, unknown> = {};

    for (const result of results) {
      for (const [key, value] of Object.entries(result.data)) {
        if (value === null || value === undefined) continue;

        if (key in merged) {
          merged[key] = this.mergeField(key, merged[key], value);
        } else {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  private mergeField(key: string, existing: unknown, incoming: unknown): unknown {
    if (Array.isArray(existing) && Array.isArray(incoming)) {
      return this.deduplicateArrays([...existing, ...incoming]);
    }
    if (typeof existing === 'string' && typeof incoming === 'string') {
      return existing.length >= incoming.length ? existing : incoming;
    }
    if (typeof existing === 'object' && typeof incoming === 'object' && existing !== null && incoming !== null) {
      return { ...(existing as Record<string, unknown>), ...(incoming as Record<string, unknown>) };
    }
    return incoming;
  }

  private deduplicateArrays(arr: unknown[]): unknown[] {
    const seen = new Set<string>();
    const result: unknown[] = [];

    for (const item of arr) {
      if (typeof item === 'string') {
        const normalized = item.toLowerCase().trim();
        if (!seen.has(normalized)) {
          seen.add(normalized);
          result.push(item);
        }
      } else if (typeof item === 'object' && item !== null) {
        const key = JSON.stringify(item);
        if (!seen.has(key)) {
          seen.add(key);
          result.push(item);
        }
      } else {
        result.push(item);
      }
    }

    return result;
  }

  private calculateConfidence(results: ProviderResult[]): number {
    if (results.length === 0) return 0;

    const totalConfidence = results.reduce((sum, r) => sum + r.confidence, 0);
    const avgConfidence = totalConfidence / results.length;

    const providerBonus = Math.min(results.length * 0.05, 0.15);
    return Math.min(avgConfidence + providerBonus, 1.0);
  }

  extractSources(results: ProviderResult[]): { provider: string; source_url: string | null; confidence_score: number }[] {
    return results
      .filter((r) => r.success)
      .map((r) => ({
        provider: r.provider,
        source_url: r.source_url,
        confidence_score: r.confidence,
      }));
  }
}

export const researchAggregator = new ResearchAggregator();
