// ============================================================
// SEOAnalyzer — Analyzes SEO metrics from research data
// ============================================================

import type { CompanyIntelligenceRecord, SEOSummary } from '@/types/research-intelligence';

class SEOAnalyzer {
  analyze(data: Record<string, unknown>): SEOSummary {
    const metadata = (data.metadata as Record<string, unknown>) ?? {};
    const content = (data.markdown as string) ?? (data.html as string) ?? '';

    return {
      domain_authority: this.extractDomainAuthority(metadata),
      organic_keywords: this.extractKeywordCount(metadata, content),
      organic_traffic: this.extractTrafficEstimate(metadata),
      top_keywords: this.extractTopKeywords(content),
      backlinks: this.extractBacklinkCount(metadata),
    };
  }

  private extractDomainAuthority(metadata: Record<string, unknown>): number | null {
    if (metadata.domain_authority) return metadata.domain_authority as number;
    return null;
  }

  private extractKeywordCount(metadata: Record<string, unknown>, content: string): number | null {
    if (metadata.organic_keywords) return metadata.organic_keywords as number;

    const keywords = this.extractTopKeywords(content);
    return keywords.length;
  }

  private extractTrafficEstimate(metadata: Record<string, unknown>): number | null {
    if (metadata.organic_traffic) return metadata.organic_traffic as number;
    return null;
  }

  private extractTopKeywords(content: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
      'should', 'may', 'might', 'must', 'can', 'this', 'that', 'these',
      'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
      'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'as',
    ]);

    const words = content
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3 && !stopWords.has(w));

    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) ?? 0) + 1);
    }

    return Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([word]) => word);
  }

  private extractBacklinkCount(metadata: Record<string, unknown>): number | null {
    if (metadata.backlinks) return metadata.backlinks as number;
    return null;
  }

  analyzeFromMetadata(metadata: Record<string, unknown>): Partial<CompanyIntelligenceRecord> {
    return {
      seo_summary: this.analyze({ metadata }),
    };
  }
}

export const seoAnalyzer = new SEOAnalyzer();
