// ============================================================
// BuyingSignalDetector — Detects buying and growth signals
// ============================================================

import type {
  CompanyIntelligenceRecord,
  BuyingSignal,
  GrowthSignal,
} from '@/types/research-intelligence';

class BuyingSignalDetector {
  private buyingSignalPatterns: { type: string; patterns: string[] }[] = [
    { type: 'hiring_expansion', patterns: ['we\'re hiring', 'now hiring', 'job opening', 'careers', 'join our team', 'open positions'] },
    { type: 'funding_round', patterns: ['series a', 'series b', 'series c', 'funding round', 'raised', 'investment', 'venture capital', 'seed round'] },
    { type: 'product_launch', patterns: ['new product', 'launching', 'announcing', 'now available', 'just released', 'new feature'] },
    { type: 'market_expansion', patterns: ['expanding to', 'new market', 'new office', 'global expansion', 'entering market'] },
    { type: 'technology_change', patterns: ['migrating to', 'adopting', 'implementing', 'new platform', 'digital transformation'] },
    { type: 'leadership_change', patterns: ['new ceo', 'new cto', 'appointed', 'joins as', 'named chief'] },
    { type: 'acquisition', patterns: ['acquired', 'acquisition', 'merger', 'merging with', 'buying'] },
    { type: 'compliance_need', patterns: ['gdpr', 'hipaa', 'soc 2', 'compliance', 'security audit', 'certification'] },
  ];

  private growthSignalPatterns: { type: string; patterns: string[] }[] = [
    { type: 'team_growth', patterns: ['growing team', 'expanding team', 'team grew', 'headcount', 'doubling team'] },
    { type: 'revenue_growth', patterns: ['revenue growth', 'growing revenue', 'arr', 'mrr', 'revenue increased'] },
    { type: 'user_growth', patterns: ['user growth', 'customer growth', 'growing user base', 'million users'] },
    { type: 'office_expansion', patterns: ['new office', 'second location', 'new headquarters', 'opening office'] },
    { type: 'product_expansion', patterns: ['new product line', 'expanding platform', 'adding features', 'product roadmap'] },
    { type: 'partnership', patterns: ['partnership', 'partnered with', 'strategic alliance', 'integration with'] },
  ];

  detectBuyingSignals(data: Record<string, unknown>): BuyingSignal[] {
    const text = this.combineText(data).toLowerCase();
    const signals: BuyingSignal[] = [];
    const now = new Date().toISOString();

    for (const { type, patterns } of this.buyingSignalPatterns) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          signals.push({
            signal_type: type,
            description: this.extractContext(text, pattern),
            confidence: 0.75,
            source: 'research_intelligence',
            detected_at: now,
          });
          break;
        }
      }
    }

    return signals;
  }

  detectGrowthSignals(data: Record<string, unknown>): GrowthSignal[] {
    const text = this.combineText(data).toLowerCase();
    const signals: GrowthSignal[] = [];
    const now = new Date().toISOString();

    for (const { type, patterns } of this.growthSignalPatterns) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          signals.push({
            signal_type: type,
            description: this.extractContext(text, pattern),
            confidence: 0.7,
            source: 'research_intelligence',
            detected_at: now,
          });
          break;
        }
      }
    }

    return signals;
  }

  private extractContext(text: string, pattern: string): string {
    const index = text.indexOf(pattern);
    if (index === -1) return pattern;

    const start = Math.max(0, index - 50);
    const end = Math.min(text.length, index + pattern.length + 100);
    return text.slice(start, end).trim();
  }

  private combineText(data: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const value of Object.values(data)) {
      if (typeof value === 'string') parts.push(value);
      else if (Array.isArray(value)) {
        for (const v of value) {
          if (typeof v === 'string') parts.push(v);
          else if (typeof v === 'object' && v !== null) parts.push(JSON.stringify(v));
        }
      }
      else if (typeof value === 'object' && value !== null) parts.push(JSON.stringify(value));
    }
    return parts.join(' ');
  }
}

export const buyingSignalDetector = new BuyingSignalDetector();
