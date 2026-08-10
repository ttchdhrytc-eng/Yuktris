// ============================================================
// NextBestActionEngine — Determines the single best next action
// ============================================================

import type { RevenueScores, Priority } from '@/types/revenue-intelligence';

class NextBestActionEngine {
  determine(params: {
    scores: RevenueScores;
    decisionMakerCount: number;
    buyingSignalCount: number;
    growthSignalCount: number;
    hasExistingRelationship: boolean;
  }): { action: string; priority: Priority; reasoning: string } {
    const { scores, decisionMakerCount, buyingSignalCount, hasExistingRelationship } = params;

    // Decision tree for next best action
    if (scores.overall_score >= 0.8 && decisionMakerCount > 0 && buyingSignalCount >= 2) {
      return {
        action: 'Direct Outreach — Schedule Meeting',
        priority: 'critical',
        reasoning: 'High overall score, decision makers identified, and multiple buying signals. This account is ready for direct engagement.',
      };
    }

    if (scores.buying_intent_score >= 0.7 && buyingSignalCount >= 3) {
      return {
        action: 'Urgent Outreach — Capitalize on Buying Window',
        priority: 'critical',
        reasoning: 'Strong buying intent with multiple signals. The buying window may be time-sensitive.',
      };
    }

    if (scores.icp_score >= 0.7 && decisionMakerCount === 0) {
      return {
        action: 'Research Decision Makers',
        priority: 'high',
        reasoning: 'Excellent ICP match but no decision makers identified. Research key stakeholders before engaging.',
      };
    }

    if (hasExistingRelationship && scores.relationship_score < 0.5) {
      return {
        action: 'Follow Up — Warm the Relationship',
        priority: 'high',
        reasoning: 'Existing relationship is weak. Re-engage with personalized follow-up to strengthen the connection.',
      };
    }

    if (scores.growth_score >= 0.7 && scores.technology_fit_score >= 0.5) {
      return {
        action: 'Growth-Focused Outreach',
        priority: 'high',
        reasoning: 'Company is growing and has compatible technology. Position your solution as a growth enabler.',
      };
    }

    if (scores.risk_score >= 0.6) {
      return {
        action: 'Additional Research Needed',
        priority: 'medium',
        reasoning: 'High risk score due to incomplete or low-confidence data. Gather more intelligence before engaging.',
      };
    }

    if (scores.overall_score >= 0.4) {
      return {
        action: 'Add to Nurture Sequence',
        priority: 'medium',
        reasoning: 'Moderate scores across the board. Not ready for direct outreach but worth nurturing.',
      };
    }

    return {
      action: 'Monitor for Changes',
      priority: 'low',
      reasoning: 'Low scores across all dimensions. Monitor this account for signal changes before taking action.',
    };
  }
}

export const nextBestActionEngine = new NextBestActionEngine();
