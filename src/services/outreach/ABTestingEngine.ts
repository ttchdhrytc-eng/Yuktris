// ============================================================
// ABTestingEngine — A/B testing for messages and variants
// ============================================================

import type { VariantType } from '@/types/outreach';

type Variant = {
  id: string;
  variant_type: VariantType;
  variant_content: string;
  variant_label: string;
  score: number;
  sent: number;
  opened: number;
  replied: number;
};

type ABTestResult = {
  winner_id: string | null;
  confidence: number;
  variants: { id: string; label: string; open_rate: number; reply_rate: number; score: number }[];
  recommendation: string;
};

class ABTestingEngine {
  evaluate(variants: Variant[]): ABTestResult {
    if (variants.length < 2) {
      return {
        winner_id: variants[0]?.id ?? null,
        confidence: 0,
        variants: variants.map((v) => ({ id: v.id, label: v.variant_label, open_rate: 0, reply_rate: 0, score: v.score })),
        recommendation: 'Need at least 2 variants for A/B testing.',
      };
    }

    const results = variants.map((v) => {
      const openRate = v.sent > 0 ? v.opened / v.sent : 0;
      const replyRate = v.sent > 0 ? v.replied / v.sent : 0;
      const performanceScore = openRate * 0.4 + replyRate * 0.6;
      return { id: v.id, label: v.variant_label, open_rate: Math.round(openRate * 100) / 100, reply_rate: Math.round(replyRate * 100) / 100, score: performanceScore };
    });

    results.sort((a, b) => b.score - a.score);

    const winner = results[0];
    const runner = results[1];
    const confidence = this.calculateConfidence(winner.score, runner.score, variants[0].sent);

    return {
      winner_id: winner.id,
      confidence,
      variants: results,
      recommendation: confidence >= 0.8
        ? `Variant ${winner.label} is the clear winner with ${Math.round(winner.score * 100)}% performance. Promote to primary.`
        : confidence >= 0.5
        ? `Variant ${winner.label} is performing better, but more data needed for statistical significance.`
        : `Results are inconclusive. Continue testing with larger sample size.`,
    };
  }

  generateTestPlan(variants: { type: VariantType; content: string; label: string }[], sampleSize: number): {
    variant_allocations: { label: string; allocation: number; send_count: number }[];
    total_sends: number;
    test_duration_days: number;
  } {
    const perVariant = Math.floor(sampleSize / variants.length);
    return {
      variant_allocations: variants.map((v) => ({ label: v.label, allocation: Math.round(100 / variants.length), send_count: perVariant })),
      total_sends: perVariant * variants.length,
      test_duration_days: 7,
    };
  }

  private calculateConfidence(winnerScore: number, runnerScore: number, sampleSize: number): number {
    const diff = winnerScore - runnerScore;
    const sampleFactor = Math.min(sampleSize / 100, 1);
    return Math.min(diff * 2 * sampleFactor, 1.0);
  }
}

export const abTestingEngine = new ABTestingEngine();
