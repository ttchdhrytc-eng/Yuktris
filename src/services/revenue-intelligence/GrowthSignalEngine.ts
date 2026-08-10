// ============================================================
// GrowthSignalEngine — Detects and scores growth signals
// ============================================================

import type { CompanyIntelligenceInput, ScoreResult, ScoreFactor, SignalType } from '@/types/revenue-intelligence';

class GrowthSignalEngine {
  score(company: CompanyIntelligenceInput): ScoreResult {
    const factors: ScoreFactor[] = [];
    const signals = company.growth_signals ?? [];

    // Signal count
    const countScore = Math.min(signals.length / 4, 1.0);
    factors.push({ name: 'growth_signal_count', weight: 0.3, value: countScore, description: `${signals.length} growth signals detected` });

    // Signal strength
    const avgConfidence = signals.length > 0
      ? signals.reduce((sum, s) => sum + s.confidence, 0) / signals.length
      : 0;
    factors.push({ name: 'growth_signal_strength', weight: 0.3, value: avgConfidence, description: `Average confidence: ${Math.round(avgConfidence * 100)}%` });

    // Signal diversity
    const signalTypes = new Set(signals.map((s) => s.signal_type));
    const diversityScore = Math.min(signalTypes.size / 3, 1.0);
    factors.push({ name: 'growth_signal_diversity', weight: 0.2, value: diversityScore, description: `${signalTypes.size} unique growth types` });

    // Technology stack as growth indicator
    const techCount = company.technology_stack?.length ?? 0;
    const techScore = Math.min(techCount / 10, 1.0);
    factors.push({ name: 'technology_adoption', weight: 0.2, value: techScore, description: `${techCount} technologies in stack` });

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.value * f.weight), 0) / totalWeight;
    const confidence = signals.length > 0 ? Math.min(0.5 + signals.length * 0.1, 1.0) : 0.3;

    return { score: Math.round(weightedScore * 100) / 100, confidence, factors };
  }

  extractSignals(company: CompanyIntelligenceInput): { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] {
    const extracted: { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] = [];

    for (const signal of company.growth_signals ?? []) {
      extracted.push({
        signal_type: 'growth',
        signal_strength: signal.confidence,
        confidence_score: signal.confidence,
        description: signal.description,
        source: 'research_intelligence',
      });
    }

    // Infer growth from technology adoption
    if (company.technology_stack && company.technology_stack.length >= 5) {
      extracted.push({
        signal_type: 'growth',
        signal_strength: 0.6,
        confidence_score: 0.6,
        description: `${company.technology_stack.length} technologies detected — indicates active technology investment`,
        source: 'research_intelligence',
      });
    }

    // Infer from social presence
    if (company.social_profiles && company.social_profiles.length >= 3) {
      extracted.push({
        signal_type: 'growth',
        signal_strength: 0.5,
        confidence_score: 0.5,
        description: 'Strong social media presence across multiple platforms',
        source: 'research_intelligence',
      });
    }

    return extracted;
  }
}

export const growthSignalEngine = new GrowthSignalEngine();
