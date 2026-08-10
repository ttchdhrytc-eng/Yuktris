// ============================================================
// RiskAnalysisEngine — Analyzes risk factors
// ============================================================

import type { CompanyIntelligenceInput, ScoreResult, ScoreFactor, SignalType } from '@/types/revenue-intelligence';

class RiskAnalysisEngine {
  score(company: CompanyIntelligenceInput): ScoreResult {
    const factors: ScoreFactor[] = [];
    let riskAccumulator = 0;
    let riskFactors = 0;

    // Low confidence in research = higher risk
    const researchConfidence = company.confidence_score ?? 0.5;
    const confidenceRisk = 1.0 - researchConfidence;
    factors.push({ name: 'research_confidence_risk', weight: 0.2, value: confidenceRisk, description: `Research confidence: ${Math.round(researchConfidence * 100)}%` });
    riskAccumulator += confidenceRisk * 0.2;
    riskFactors++;

    // No website = higher risk
    const websiteRisk = company.website ? 0.1 : 0.7;
    factors.push({ name: 'website_risk', weight: 0.15, value: websiteRisk, description: company.website ? 'Website available' : 'No website found' });
    riskAccumulator += websiteRisk * 0.15;
    riskFactors++;

    // No decision makers = higher risk
    const dmCount = company.decision_makers?.length ?? 0;
    const dmRisk = dmCount === 0 ? 0.7 : Math.max(0.3 - dmCount * 0.1, 0);
    factors.push({ name: 'decision_maker_risk', weight: 0.2, value: dmRisk, description: `${dmCount} decision makers identified` });
    riskAccumulator += dmRisk * 0.2;
    riskFactors++;

    // Strong competition = higher risk
    const competitorCount = company.competitive_positioning?.competitors?.length ?? 0;
    const competitionRisk = Math.min(competitorCount / 10, 0.8);
    factors.push({ name: 'competition_risk', weight: 0.15, value: competitionRisk, description: `${competitorCount} competitors identified` });
    riskAccumulator += competitionRisk * 0.15;
    riskFactors++;

    // No social presence = higher risk
    const socialCount = company.social_profiles?.length ?? 0;
    const socialRisk = socialCount === 0 ? 0.5 : Math.max(0.2 - socialCount * 0.05, 0);
    factors.push({ name: 'social_presence_risk', weight: 0.15, value: socialRisk, description: `${socialCount} social profiles found` });
    riskAccumulator += socialRisk * 0.15;
    riskFactors++;

    // No summary = higher risk
    const summaryRisk = company.summary ? 0.1 : 0.6;
    factors.push({ name: 'data_completeness_risk', weight: 0.15, value: summaryRisk, description: company.summary ? 'Company summary available' : 'No company summary' });
    riskAccumulator += summaryRisk * 0.15;
    riskFactors++;

    const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
    const weightedRisk = factors.reduce((sum, f) => sum + (f.value * f.weight), 0) / totalWeight;

    return { score: Math.round(weightedRisk * 100) / 100, confidence: 0.7, factors };
  }

  extractSignals(company: CompanyIntelligenceInput): { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] {
    const signals: { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] = [];

    const dmCount = company.decision_makers?.length ?? 0;
    if (dmCount === 0) {
      signals.push({
        signal_type: 'risk',
        signal_strength: 0.7,
        confidence_score: 0.8,
        description: 'No decision makers identified — outreach may not reach the right people',
        source: 'revenue_intelligence',
      });
    }

    if (!company.website) {
      signals.push({
        signal_type: 'risk',
        signal_strength: 0.6,
        confidence_score: 0.7,
        description: 'No website found — company may be early-stage or hard to research',
        source: 'revenue_intelligence',
      });
    }

    const competitorCount = company.competitive_positioning?.competitors?.length ?? 0;
    if (competitorCount > 5) {
      signals.push({
        signal_type: 'competitive',
        signal_strength: 0.6,
        confidence_score: 0.7,
        description: `${competitorCount} competitors identified — crowded market may reduce conversion`,
        source: 'revenue_intelligence',
      });
    }

    return signals;
  }
}

export const riskAnalysisEngine = new RiskAnalysisEngine();
