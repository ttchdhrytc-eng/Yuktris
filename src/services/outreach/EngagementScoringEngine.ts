// ============================================================
// EngagementScoringEngine — Scores prospect engagement
// ============================================================

import type { EngagementScore } from '@/types/outreach';

type EngagementInput = {
  buyingIntentScore: number;
  icpScore: number;
  growthScore: number;
  previousOpens: number;
  previousReplies: number;
  previousClicks: number;
  daysSinceLastContact: number | null;
  meetingHistoryCount: number;
};

class EngagementScoringEngine {
  score(input: EngagementInput): EngagementScore {
    const factors: { factor: string; weight: number; value: number }[] = [];

    factors.push({ factor: 'Buying Intent', weight: 0.25, value: input.buyingIntentScore });
    factors.push({ factor: 'ICP Fit', weight: 0.2, value: input.icpScore });
    factors.push({ factor: 'Growth Signals', weight: 0.15, value: input.growthScore });

    let prevEngagement = 0;
    if (input.previousReplies > 0) prevEngagement = 1.0;
    else if (input.previousOpens > 2) prevEngagement = 0.7;
    else if (input.previousOpens > 0) prevEngagement = 0.4;
    else if (input.previousClicks > 0) prevEngagement = 0.5;
    factors.push({ factor: 'Previous Engagement', weight: 0.25, value: prevEngagement });

    let recencyVal = 0.5;
    if (input.daysSinceLastContact === null) recencyVal = 0.8;
    else if (input.daysSinceLastContact <= 7) recencyVal = 0.9;
    else if (input.daysSinceLastContact <= 30) recencyVal = 0.6;
    else if (input.daysSinceLastContact <= 90) recencyVal = 0.3;
    else recencyVal = 0.1;
    factors.push({ factor: 'Recency', weight: 0.15, value: recencyVal });

    const totalScore = factors.reduce((sum, f) => sum + f.value * f.weight, 0);
    const meetingBonus = Math.min(input.meetingHistoryCount * 0.05, 0.15);
    const finalScore = Math.min(totalScore + meetingBonus, 1.0);

    return {
      score: Math.round(finalScore * 100) / 100,
      level: finalScore >= 0.7 ? 'high' : finalScore >= 0.4 ? 'medium' : finalScore >= 0.2 ? 'low' : 'none',
      factors,
    };
  }
}

export const engagementScoringEngine = new EngagementScoringEngine();
