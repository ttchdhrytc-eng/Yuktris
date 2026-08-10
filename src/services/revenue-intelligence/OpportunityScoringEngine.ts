// ============================================================
// OpportunityScoringEngine — Combines all scores into opportunity score
// ============================================================

import type { RevenueScores, ScoreResult } from '@/types/revenue-intelligence';

class OpportunityScoringEngine {
  combine(params: {
    icpResult: ScoreResult;
    buyingIntentResult: ScoreResult;
    growthResult: ScoreResult;
    technologyFitResult: ScoreResult;
    serviceFitResult: ScoreResult;
    riskResult: ScoreResult;
    relationshipScore: number;
    urgencyScore: number;
  }): RevenueScores {
    const { icpResult, buyingIntentResult, growthResult, technologyFitResult, serviceFitResult, riskResult, relationshipScore, urgencyScore } = params;

    // Weighted overall score
    const overall = (
      icpResult.score * 0.2 +
      buyingIntentResult.score * 0.2 +
      growthResult.score * 0.15 +
      technologyFitResult.score * 0.1 +
      serviceFitResult.score * 0.1 +
      (1 - riskResult.score) * 0.1 +
      relationshipScore * 0.1 +
      urgencyScore * 0.05
    );

    // Opportunity score (focus on intent + growth + ICP)
    const opportunity = (
      icpResult.score * 0.3 +
      buyingIntentResult.score * 0.35 +
      growthResult.score * 0.2 +
      technologyFitResult.score * 0.15
    );

    // Confidence score
    const confidence = (
      icpResult.confidence * 0.25 +
      buyingIntentResult.confidence * 0.25 +
      growthResult.confidence * 0.2 +
      technologyFitResult.confidence * 0.15 +
      serviceFitResult.confidence * 0.15
    );

    return {
      overall_score: Math.round(overall * 100) / 100,
      icp_score: icpResult.score,
      opportunity_score: Math.round(opportunity * 100) / 100,
      buying_intent_score: buyingIntentResult.score,
      growth_score: growthResult.score,
      technology_fit_score: technologyFitResult.score,
      service_fit_score: serviceFitResult.score,
      risk_score: riskResult.score,
      urgency_score: urgencyScore,
      relationship_score: relationshipScore,
      confidence_score: Math.round(confidence * 100) / 100,
    };
  }
}

export const opportunityScoringEngine = new OpportunityScoringEngine();
