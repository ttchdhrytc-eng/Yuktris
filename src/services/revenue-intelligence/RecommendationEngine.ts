// ============================================================
// RecommendationEngine — Generates actionable recommendations
// ============================================================

import type { RevenueScores, Priority, RecommendationType } from '@/types/revenue-intelligence';

type GeneratedRecommendation = {
  recommendation_type: RecommendationType;
  title: string;
  description: string;
  priority: Priority;
  status: 'pending';
};

class RecommendationEngine {
  generate(params: {
    scores: RevenueScores;
    companyName: string;
    industry: string | null;
    decisionMakerCount: number;
    buyingSignalCount: number;
    growthSignalCount: number;
    competitorCount: number;
  }): GeneratedRecommendation[] {
    const { scores, companyName, decisionMakerCount, buyingSignalCount, competitorCount } = params;
    const recommendations: GeneratedRecommendation[] = [];

    // Next Best Action
    const nextAction = this.determineNextBestAction(scores, decisionMakerCount, buyingSignalCount);
    recommendations.push({
      recommendation_type: 'next_best_action',
      title: nextAction.title,
      description: nextAction.description,
      priority: this.scoreToPriority(scores.overall_score),
      status: 'pending',
    });

    // Outreach recommendation
    if (scores.buying_intent_score >= 0.6 && scores.icp_score >= 0.5) {
      recommendations.push({
        recommendation_type: 'outreach',
        title: `Initiate outreach to ${companyName}`,
        description: `High buying intent (${Math.round(scores.buying_intent_score * 100)}%) with good ICP match. Start personalized outreach focusing on detected buying signals.`,
        priority: 'high',
        status: 'pending',
      });
    }

    // Decision makers recommendation
    if (decisionMakerCount === 0) {
      recommendations.push({
        recommendation_type: 'decision_makers',
        title: `Identify decision makers at ${companyName}`,
        description: 'No decision makers have been identified yet. Research key stakeholders before initiating outreach.',
        priority: 'high',
        status: 'pending',
      });
    } else if (decisionMakerCount >= 3) {
      recommendations.push({
        recommendation_type: 'decision_makers',
        title: `Multi-thread outreach at ${companyName}`,
        description: `${decisionMakerCount} decision makers identified. Engage multiple stakeholders simultaneously to increase conversion probability.`,
        priority: 'medium',
        status: 'pending',
      });
    }

    // Meeting recommendation
    if (scores.overall_score >= 0.7 && scores.buying_intent_score >= 0.6) {
      recommendations.push({
        recommendation_type: 'meeting',
        title: `Request a discovery meeting with ${companyName}`,
        description: 'Strong overall score with high buying intent. This account is ready for a direct meeting request.',
        priority: 'high',
        status: 'pending',
      });
    }

    // Follow-up recommendation
    if (scores.relationship_score > 0.3 && scores.relationship_score < 0.7) {
      recommendations.push({
        recommendation_type: 'follow_up',
        title: `Follow up with ${companyName}`,
        description: 'Existing relationship detected but not yet strong. Schedule a follow-up to deepen the connection.',
        priority: 'medium',
        status: 'pending',
      });
    }

    // Case study recommendation
    if (scores.icp_score >= 0.7 && scores.technology_fit_score >= 0.5) {
      recommendations.push({
        recommendation_type: 'case_study',
        title: `Share relevant case study with ${companyName}`,
        description: 'Strong ICP match with technology fit. Share a case study from a similar company to build credibility.',
        priority: 'medium',
        status: 'pending',
      });
    }

    // Proposal recommendation
    if (scores.overall_score >= 0.8 && scores.opportunity_score >= 0.75) {
      recommendations.push({
        recommendation_type: 'proposal',
        title: `Prepare a proposal for ${companyName}`,
        description: 'Excellent opportunity score. This account is a top candidate for a tailored proposal.',
        priority: 'critical',
        status: 'pending',
      });
    }

    // Service recommendation
    if (scores.service_fit_score >= 0.6) {
      recommendations.push({
        recommendation_type: 'service',
        title: `Recommend relevant services to ${companyName}`,
        description: 'Good service fit detected. Recommend services that align with their identified needs.',
        priority: 'low',
        status: 'pending',
      });
    }

    // Competitive positioning
    if (competitorCount > 5) {
      recommendations.push({
        recommendation_type: 'next_best_action',
        title: `Differentiate from ${competitorCount} competitors`,
        description: 'Crowded competitive landscape. Emphasize unique differentiators in all outreach.',
        priority: 'medium',
        status: 'pending',
      });
    }

    return recommendations;
  }

  private determineNextBestAction(scores: RevenueScores, dmCount: number, signalCount: number): { title: string; description: string } {
    if (scores.overall_score >= 0.8 && dmCount > 0) {
      return {
        title: 'Move to direct outreach',
        description: 'High overall score with identified decision makers. Proceed with direct, personalized outreach immediately.',
      };
    }

    if (scores.buying_intent_score >= 0.7 && signalCount >= 3) {
      return {
        title: 'Capitalize on buying signals',
        description: 'Multiple strong buying signals detected. Act quickly before the buying window closes.',
      };
    }

    if (scores.icp_score >= 0.7 && dmCount === 0) {
      return {
        title: 'Research decision makers first',
        description: 'Strong ICP match but no decision makers identified. Research key stakeholders before outreach.',
      };
    }

    if (scores.growth_score >= 0.7) {
      return {
        title: 'Engage during growth phase',
        description: 'Company is in a growth phase. Position your solution as an enabler of their growth trajectory.',
      };
    }

    if (scores.risk_score >= 0.6) {
      return {
        title: 'Gather more intelligence',
        description: 'High risk score due to incomplete data. Conduct additional research before engaging.',
      };
    }

    return {
      title: 'Nurture and monitor',
      description: 'Account is not yet ready for direct outreach. Add to nurture sequence and monitor for signal changes.',
    };
  }

  private scoreToPriority(score: number): Priority {
    if (score >= 0.8) return 'critical';
    if (score >= 0.65) return 'high';
    if (score >= 0.45) return 'medium';
    if (score >= 0.25) return 'low';
    return 'none';
  }
}

export const recommendationEngine = new RecommendationEngine();
