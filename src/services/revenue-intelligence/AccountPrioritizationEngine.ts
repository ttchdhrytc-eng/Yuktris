// ============================================================
// AccountPrioritizationEngine — Ranks and prioritizes accounts
// ============================================================

import type { RevenueScores, Priority } from '@/types/revenue-intelligence';

class AccountPrioritizationEngine {
  prioritize(scores: RevenueScores): Priority {
    // Weighted prioritization focusing on opportunity + buying intent + ICP
    const priorityScore = (
      scores.opportunity_score * 0.35 +
      scores.buying_intent_score * 0.25 +
      scores.icp_score * 0.2 +
      scores.growth_score * 0.1 +
      scores.urgency_score * 0.1
    );

    // Risk penalty
    const riskAdjusted = priorityScore * (1 - scores.risk_score * 0.3);

    if (riskAdjusted >= 0.75) return 'critical';
    if (riskAdjusted >= 0.6) return 'high';
    if (riskAdjusted >= 0.4) return 'medium';
    if (riskAdjusted >= 0.2) return 'low';
    return 'none';
  }

  rank(profiles: { company_id: string; company_name: string; scores: RevenueScores }[]): { company_id: string; company_name: string; rank: number; priority: Priority }[] {
    const ranked = profiles.map((p) => ({
      company_id: p.company_id,
      company_name: p.company_name,
      priorityScore: this.calculatePriorityScore(p.scores),
      priority: this.prioritize(p.scores),
    }));

    ranked.sort((a, b) => b.priorityScore - a.priorityScore);

    return ranked.map((r, index) => ({
      company_id: r.company_id,
      company_name: r.company_name,
      rank: index + 1,
      priority: r.priority,
    }));
  }

  private calculatePriorityScore(scores: RevenueScores): number {
    return (
      scores.opportunity_score * 0.35 +
      scores.buying_intent_score * 0.25 +
      scores.icp_score * 0.2 +
      scores.growth_score * 0.1 +
      scores.urgency_score * 0.1
    ) * (1 - scores.risk_score * 0.3);
  }
}

export const accountPrioritizationEngine = new AccountPrioritizationEngine();
