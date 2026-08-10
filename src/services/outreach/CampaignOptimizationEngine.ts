// ============================================================
// CampaignOptimizationEngine — Optimizes campaign performance
// ============================================================

import type { CampaignType } from '@/types/outreach';

type OptimizationInput = {
  campaignType: CampaignType;
  totalSent: number;
  totalOpened: number;
  totalReplied: number;
  totalPositiveReplies: number;
  totalMeetings: number;
  totalBounced: number;
  channelPerformance: Record<string, { sent: number; opened: number; replied: number }>;
  subjectLinePerformance: { subject: string; sent: number; opened: number }[];
};

type OptimizationResult = {
  recommendations: { area: string; current: string; recommendation: string; impact: string }[];
  best_channel: string | null;
  best_subject_line: string | null;
  projected_improvement: number;
};

class CampaignOptimizationEngine {
  optimize(input: OptimizationInput): OptimizationResult {
    const recommendations: { area: string; current: string; recommendation: string; impact: string }[] = [];

    const openRate = input.totalSent > 0 ? input.totalOpened / input.totalSent : 0;
    if (openRate < 0.3) {
      recommendations.push({ area: 'Subject Lines', current: `Open rate: ${Math.round(openRate * 100)}%`, recommendation: 'Test shorter, more personalized subject lines. Aim for 3-5 words with the company name.', impact: 'Could increase open rate by 15-25%' });
    }

    const replyRate = input.totalOpened > 0 ? input.totalReplied / input.totalOpened : 0;
    if (replyRate < 0.1) {
      recommendations.push({ area: 'Message Body', current: `Reply rate: ${Math.round(replyRate * 100)}%`, recommendation: 'Shorten message body. Add a clear, single CTA. Include more personalization.', impact: 'Could increase reply rate by 5-10%' });
    }

    const bounceRate = input.totalSent > 0 ? input.totalBounced / input.totalSent : 0;
    if (bounceRate > 0.05) {
      recommendations.push({ area: 'Email Quality', current: `Bounce rate: ${Math.round(bounceRate * 100)}%`, recommendation: 'Verify email addresses before sending. Consider using an email verification service.', impact: 'Could reduce bounce rate to under 2%' });
    }

    const positiveRate = input.totalReplied > 0 ? input.totalPositiveReplies / input.totalReplied : 0;
    if (positiveRate < 0.3 && input.totalReplied > 5) {
      recommendations.push({ area: 'Targeting', current: `Positive reply rate: ${Math.round(positiveRate * 100)}%`, recommendation: 'Refine audience targeting. Focus on higher ICP-score prospects.', impact: 'Could increase positive reply rate to 40%+' });
    }

    let bestChannel: string | null = null;
    let bestChannelReplyRate = 0;
    for (const [channel, perf] of Object.entries(input.channelPerformance)) {
      const chReplyRate = perf.sent > 0 ? perf.replied / perf.sent : 0;
      if (chReplyRate > bestChannelReplyRate) { bestChannelReplyRate = chReplyRate; bestChannel = channel; }
    }
    if (bestChannel) {
      recommendations.push({ area: 'Channel Mix', current: `Best channel: ${bestChannel} (${Math.round(bestChannelReplyRate * 100)}% reply rate)`, recommendation: `Increase allocation to ${bestChannel} and reduce underperforming channels.`, impact: 'Could improve overall reply rate by 10-15%' });
    }

    let bestSubject: string | null = null;
    let bestSubjectOpenRate = 0;
    for (const sl of input.subjectLinePerformance) {
      const slOpenRate = sl.sent > 0 ? sl.opened / sl.sent : 0;
      if (slOpenRate > bestSubjectOpenRate) { bestSubjectOpenRate = slOpenRate; bestSubject = sl.subject; }
    }

    let projected = 0;
    if (openRate < 0.3) projected += 0.2;
    if (replyRate < 0.1) projected += 0.1;
    if (bounceRate > 0.05) projected += 0.05;

    return { recommendations, best_channel: bestChannel, best_subject_line: bestSubject, projected_improvement: Math.min(projected, 0.5) };
  }
}

export const campaignOptimizationEngine = new CampaignOptimizationEngine();
