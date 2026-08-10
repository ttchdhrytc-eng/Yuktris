// ============================================================
// BusinessModelDetector — Detects business model from research data
// ============================================================

import type { CompanyIntelligenceRecord } from '@/types/research-intelligence';

class BusinessModelDetector {
  private modelPatterns: { model: string; patterns: string[]; weight: number }[] = [
    { model: 'SaaS/Subscription', patterns: ['subscription', 'saas', 'monthly', 'annual plan', 'per seat', 'per user'], weight: 3 },
    { model: 'Marketplace', patterns: ['marketplace', 'buyers and sellers', 'platform fee', 'commission'], weight: 2 },
    { model: 'Enterprise License', patterns: ['enterprise', 'license', 'on-premise', 'self-hosted'], weight: 2 },
    { model: 'Freemium', patterns: ['freemium', 'free tier', 'free plan', 'free version'], weight: 2 },
    { model: 'Transaction-based', patterns: ['transaction', 'payment processing', 'per transaction'], weight: 2 },
    { model: 'Services/Consulting', patterns: ['consulting', 'agency', 'professional services', 'custom development'], weight: 2 },
    { model: 'Usage-based', patterns: ['usage-based', 'pay as you go', 'per api call', 'per event'], weight: 2 },
    { model: 'Advertising', patterns: ['ad-supported', 'advertising', 'ad revenue', 'display ads'], weight: 1 },
    { model: 'Affiliate', patterns: ['affiliate', 'referral fee', 'partner program'], weight: 1 },
  ];

  detect(data: Record<string, unknown>): string | null {
    if (data.business_model) return data.business_model as string;

    const text = this.combineText(data).toLowerCase();
    const scores = new Map<string, number>();

    for (const { model, patterns, weight } of this.modelPatterns) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          scores.set(model, (scores.get(model) ?? 0) + weight);
        }
      }
    }

    if (scores.size === 0) return null;

    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    return sorted[0][0];
  }

  detectWithConfidence(data: Record<string, unknown>): { model: string; confidence: number } | null {
    if (data.business_model) {
      return { model: data.business_model as string, confidence: 1.0 };
    }

    const text = this.combineText(data).toLowerCase();
    const scores = new Map<string, number>();

    for (const { model, patterns, weight } of this.modelPatterns) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          scores.set(model, (scores.get(model) ?? 0) + weight);
        }
      }
    }

    if (scores.size === 0) return null;

    const sorted = Array.from(scores.entries()).sort((a, b) => b[1] - a[1]);
    const total = Array.from(scores.values()).reduce((a, b) => a + b, 0);
    return { model: sorted[0][0], confidence: sorted[0][1] / total };
  }

  detectICP(data: Record<string, unknown>): CompanyIntelligenceRecord['target_market'] {
    const text = this.combineText(data).toLowerCase();
    const segments: CompanyIntelligenceRecord['target_market'] = [];

    if (text.includes('enterprise')) segments.push({ segment: 'Enterprise', description: 'Large organizations 1000+ employees' });
    if (text.includes('smb') || text.includes('small business') || text.includes('medium business')) segments.push({ segment: 'SMB', description: 'Small and medium businesses' });
    if (text.includes('startup')) segments.push({ segment: 'Startups', description: 'Early-stage companies' });
    if (text.includes('developer') || text.includes('engineering team')) segments.push({ segment: 'Developers', description: 'Technical practitioners and engineering teams' });
    if (text.includes('b2b')) segments.push({ segment: 'B2B', description: 'Business-to-business' });
    if (text.includes('b2c')) segments.push({ segment: 'B2C', description: 'Business-to-consumer' });
    if (text.includes('fortune 500')) segments.push({ segment: 'Fortune 500', description: 'Top enterprise companies' });

    return segments;
  }

  private combineText(data: Record<string, unknown>): string {
    const parts: string[] = [];
    for (const value of Object.values(data)) {
      if (typeof value === 'string') parts.push(value);
      else if (Array.isArray(value)) parts.push(value.filter((v) => typeof v === 'string').join(' '));
      else if (typeof value === 'object' && value !== null) parts.push(JSON.stringify(value));
    }
    return parts.join(' ');
  }
}

export const businessModelDetector = new BusinessModelDetector();
