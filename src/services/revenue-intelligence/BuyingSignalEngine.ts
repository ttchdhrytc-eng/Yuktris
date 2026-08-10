// ============================================================
// BuyingSignalEngine — Detects and scores buying signals
// ============================================================

import type { CompanyIntelligenceInput, ScoreResult, ScoreFactor, SignalType } from '@/types/revenue-intelligence';

class BuyingSignalEngine {
  score(company: CompanyIntelligenceInput): ScoreResult {
    const factors: ScoreFactor[] = [];
    const signals = company.buying_signals ?? [];

    // Signal count factor
    const signalCount = signals.length;
    const countScore = Math.min(signalCount / 5, 1.0);
    factors.push({ name: 'signal_count', weight: 0.3, value: countScore, description: `${signalCount} buying signals detected` });

    // Signal strength factor
    const avgConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0;
    factors.push({ name: 'signal_strength', weight: 0.3, value: avgConfidence, description: `Average signal confidence: ${Math.round(avgConfidence * 100)}%` });

    // Signal diversity factor
    const signalTypes = new Set(signals.map((s) => s.signal_type));
    const diversityScore = Math.min(signalTypes.size / 4, 1.0);
    factors.push({ name: 'signal_diversity', weight: 0.2, value: diversityScore, description: `${signalTypes.size} unique signal types` });

    // High-priority signals
    const highPrioritySignals = signals.filter((s) => s.confidence >= 0.8);
    const highPriorityScore = Math.min(highPrioritySignals.length / 2, 1.0);
    factors.push({ name: 'high_priority_signals', weight: 0.2, value: highPriorityScore, description: `${highPrioritySignals.length} high-confidence signals` });

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.value * f.weight), 0) / totalWeight;
    const confidence = signals.length > 0 ? Math.min(0.5 + signals.length * 0.1, 1.0) : 0.3;

    return { score: Math.round(weightedScore * 100) / 100, confidence, factors };
  }

  extractSignals(company: CompanyIntelligenceInput): { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] {
    const extracted: { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] = [];

    for (const signal of company.buying_signals ?? []) {
      const signalType = this.mapSignalType(signal.signal_type);
      extracted.push({
        signal_type: signalType,
        signal_strength: signal.confidence,
        confidence_score: signal.confidence,
        description: signal.description,
        source: 'research_intelligence',
      });
    }

    // Detect hiring signals from summary
    if (company.summary) {
      const summaryLower = company.summary.toLowerCase();
      if (summaryLower.includes('hiring') || summaryLower.includes('expanding team')) {
        extracted.push({
          signal_type: 'buying_intent',
          signal_strength: 0.7,
          confidence_score: 0.7,
          description: 'Company appears to be hiring — potential growth and need for new tools',
          source: 'research_intelligence',
        });
      }
      if (summaryLower.includes('funding') || summaryLower.includes('raised') || summaryLower.includes('series')) {
        extracted.push({
          signal_type: 'urgency',
          signal_strength: 0.8,
          confidence_score: 0.8,
          description: 'Recent funding detected — budget availability signal',
          source: 'research_intelligence',
        });
      }
    }

    return extracted;
  }

  private mapSignalType(rawType: string): SignalType {
    const lower = rawType.toLowerCase();
    if (lower.includes('hiring')) return 'buying_intent';
    if (lower.includes('funding') || lower.includes('funded')) return 'urgency';
    if (lower.includes('product') || lower.includes('launch')) return 'buying_intent';
    if (lower.includes('expansion') || lower.includes('expanding')) return 'growth';
    if (lower.includes('compliance') || lower.includes('security')) return 'risk';
    return 'buying_intent';
  }
}

export const buyingSignalEngine = new BuyingSignalEngine();
