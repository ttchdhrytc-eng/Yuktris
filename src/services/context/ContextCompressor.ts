// ============================================================
// ContextCompressor — Compresses context to fit token budget
// ============================================================

import type { ContextFragment } from '@/types/context-engine';

class ContextCompressor {
  compress(fragments: ContextFragment[], targetTokens: number): {
    compressed: ContextFragment[];
    originalTokens: number;
    compressedTokens: number;
    ratio: number;
  } {
    const originalTokens = fragments.reduce((sum, f) => sum + f.token_estimate, 0);

    if (originalTokens <= targetTokens) {
      return { compressed: fragments, originalTokens, compressedTokens: originalTokens, ratio: 1.0 };
    }

    const compressed = fragments.map((f) => this.compressFragment(f, targetTokens / originalTokens));

    const compressedTokens = compressed.reduce((sum, f) => sum + f.token_estimate, 0);
    const ratio = compressedTokens / originalTokens;

    return { compressed, originalTokens, compressedTokens, ratio };
  }

  private compressFragment(fragment: ContextFragment, ratio: number): ContextFragment {
    const content = fragment.content;
    const compressedContent = this.compressContent(content, ratio);

    return {
      ...fragment,
      content: compressedContent,
      token_estimate: Math.ceil(fragment.token_estimate * ratio),
    };
  }

  private compressContent(content: Record<string, unknown>, ratio: number): Record<string, unknown> {
    const compressed: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(content)) {
      compressed[key] = this.compressValue(value, ratio);
    }

    return compressed;
  }

  private compressValue(value: unknown, ratio: number): unknown {
    if (typeof value === 'string') {
      const maxLen = Math.ceil(value.length * ratio);
      if (value.length > maxLen) {
        return value.slice(0, maxLen) + '...';
      }
      return value;
    }

    if (Array.isArray(value)) {
      const maxItems = Math.ceil(value.length * ratio);
      return value.slice(0, Math.max(maxItems, 1)).map((v) => this.compressValue(v, ratio));
    }

    if (typeof value === 'object' && value !== null) {
      return this.compressContent(value as Record<string, unknown>, ratio);
    }

    return value;
  }

  truncate(fragments: ContextFragment[], maxTokens: number): {
    truncated: ContextFragment[];
    dropped: ContextFragment[];
    usedTokens: number;
  } {
    let usedTokens = 0;
    const truncated: ContextFragment[] = [];
    const dropped: ContextFragment[] = [];

    for (const fragment of fragments) {
      if (usedTokens + fragment.token_estimate <= maxTokens) {
        truncated.push(fragment);
        usedTokens += fragment.token_estimate;
      } else {
        // Try to fit a truncated version
        const remaining = maxTokens - usedTokens;
        if (remaining > 50) {
          truncated.push({
            ...fragment,
            content: this.compressContent(fragment.content, remaining / fragment.token_estimate),
            token_estimate: remaining,
          });
          usedTokens += remaining;
        } else {
          dropped.push(fragment);
        }
      }
    }

    return { truncated, dropped, usedTokens };
  }
}

export const contextCompressor = new ContextCompressor();
