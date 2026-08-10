// ============================================================
// ServiceFitEngine — Scores service/product fit
// ============================================================

import type { CompanyIntelligenceInput, ScoreResult, ScoreFactor, SignalType } from '@/types/revenue-intelligence';

class ServiceFitEngine {
  score(company: CompanyIntelligenceInput): ScoreResult {
    const factors: ScoreFactor[] = [];
    const services = company.services ?? [];
    const products = company.products ?? [];

    // Service count
    const serviceScore = Math.min(services.length / 5, 1.0);
    factors.push({ name: 'service_coverage', weight: 0.25, value: serviceScore, description: `${services.length} services identified` });

    // Product count
    const productScore = Math.min(products.length / 5, 1.0);
    factors.push({ name: 'product_coverage', weight: 0.25, value: productScore, description: `${products.length} products identified` });

    // Target market alignment
    const targetMarkets = company.target_market ?? [];
    const marketScore = Math.min(targetMarkets.length / 3, 1.0);
    factors.push({ name: 'target_market_clarity', weight: 0.25, value: marketScore, description: `${targetMarkets.length} target market segments` });

    // Brand positioning clarity
    const brandScore = company.brand_positioning ? 0.8 : 0.3;
    factors.push({ name: 'brand_clarity', weight: 0.25, value: brandScore, description: company.brand_positioning ? 'Clear brand positioning' : 'No brand positioning' });

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedScore = factors.reduce((sum, f) => sum + (f.value * f.weight), 0) / totalWeight;
    const confidence = (services.length + products.length) > 0 ? 0.7 : 0.3;

    return { score: Math.round(weightedScore * 100) / 100, confidence, factors };
  }

  extractSignals(company: CompanyIntelligenceInput): { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] {
    const signals: { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] = [];

    for (const service of company.services ?? []) {
      signals.push({
        signal_type: 'service_fit',
        signal_strength: 0.6,
        confidence_score: 0.6,
        description: `Service identified: ${service.name}`,
        source: 'research_intelligence',
      });
    }

    return signals.slice(0, 5);
  }
}

export const serviceFitEngine = new ServiceFitEngine();
