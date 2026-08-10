// ============================================================
// MemoryCompressionService — Compresses and summarizes memories
// ============================================================

import type { MemoryEntityRecord } from '@/types/memory-engine';

class MemoryCompressionService {
  compress(entity: MemoryEntityRecord): { content: Record<string, unknown>; summary: string; ratio: number } {
    const originalSize = JSON.stringify(entity.content).length;
    const compressedContent = this.compressContent(entity.content);
    const compressedSize = JSON.stringify(compressedContent).length;
    const ratio = originalSize > 0 ? compressedSize / originalSize : 1.0;

    const summary = this.generateSummary(entity);

    return { content: compressedContent, summary, ratio };
  }

  compressBatch(entities: MemoryEntityRecord[]): { compressed: MemoryEntityRecord[]; avgRatio: number } {
    let totalRatio = 0;
    const compressed = entities.map((e) => {
      const result = this.compress(e);
      totalRatio += result.ratio;
      return {
        ...e,
        content: result.content,
        summary: result.summary,
      };
    });

    return { compressed, avgRatio: entities.length > 0 ? totalRatio / entities.length : 1.0 };
  }

  private compressContent(content: Record<string, unknown>): Record<string, unknown> {
    const compressed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(content)) {
      compressed[key] = this.compressValue(value);
    }

    return compressed;
  }

  private compressValue(value: unknown): unknown {
    if (typeof value === 'string') {
      // Truncate long strings
      if (value.length > 200) {
        return value.slice(0, 200) + '...';
      }
      return value;
    }

    if (Array.isArray(value)) {
      // Limit array size
      const maxItems = Math.min(value.length, 5);
      return value.slice(0, maxItems).map((v) => this.compressValue(v));
    }

    if (typeof value === 'object' && value !== null) {
      return this.compressContent(value as Record<string, unknown>);
    }

    return value;
  }

  generateSummary(entity: MemoryEntityRecord): string {
    const parts: string[] = [];

    parts.push(entity.title);

    if (entity.summary) {
      parts.push(entity.summary);
    } else {
      // Generate from content
      const contentKeys = Object.keys(entity.content);
      if (contentKeys.length > 0) {
        const keyFindings = contentKeys.slice(0, 3).map((k) => {
          const val = entity.content[k];
          if (typeof val === 'string') return `${k}: ${val.slice(0, 50)}`;
          if (Array.isArray(val)) return `${k}: ${val.length} items`;
          return k;
        });
        parts.push(keyFindings.join(', '));
      }
    }

    parts.push(`Confidence: ${Math.round(entity.confidence_score * 100)}%`);
    parts.push(`Importance: ${Math.round(entity.importance_score * 100)}%`);

    return parts.join(' | ');
  }
}

export const memoryCompressionService = new MemoryCompressionService();
