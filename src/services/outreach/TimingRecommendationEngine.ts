// ============================================================
// TimingRecommendationEngine — Recommends best send times
// ============================================================

import type { TimingRecommendation, SendWindow, CampaignType } from '@/types/outreach';

type TimingInput = {
  campaignType: CampaignType;
  industry: string | null;
  timezone: string | null;
  buyingIntentScore: number;
};

class TimingRecommendationEngine {
  recommend(input: TimingInput): TimingRecommendation {
    const timezone = input.timezone ?? 'America/New_York';
    const windows = this.getSendWindows(input.campaignType, input.industry);
    const bestDay = this.getBestDay(input.campaignType);
    const window = windows.find((w) => w.day_of_week === bestDay) ?? windows[0];

    return {
      day_of_week: window.day_of_week,
      start_hour: window.start_hour,
      end_hour: window.end_hour,
      timezone,
      confidence: input.buyingIntentScore >= 0.7 ? 0.85 : 0.7,
      reason: this.generateReason(input.campaignType, bestDay, window),
    };
  }

  getSendWindows(campaignType: CampaignType, industry: string | null): SendWindow[] {
    const windows: SendWindow[] = [
      { day_of_week: 2, start_hour: 9, end_hour: 11 },
      { day_of_week: 3, start_hour: 10, end_hour: 12 },
      { day_of_week: 4, start_hour: 9, end_hour: 11 },
    ];

    if (campaignType === 'nurture' || campaignType === 're_engagement') {
      windows.push({ day_of_week: 5, start_hour: 13, end_hour: 15 });
    }

    if (industry) {
      const ind = industry.toLowerCase();
      if (ind.includes('tech') || ind.includes('saas')) {
        windows[0] = { day_of_week: 2, start_hour: 8, end_hour: 10 };
      }
      if (ind.includes('finance') || ind.includes('bank')) {
        windows[1] = { day_of_week: 3, start_hour: 10, end_hour: 12 };
      }
    }

    return windows;
  }

  private getBestDay(campaignType: CampaignType): number {
    const dayMap: Record<CampaignType, number> = {
      cold_outreach: 2, warm_outreach: 3, inbound_followup: 2, proposal_followup: 3,
      meeting_followup: 4, re_engagement: 5, nurture: 4, customer_expansion: 3,
      renewal: 2, referral: 4, custom: 3,
    };
    return dayMap[campaignType] ?? 3;
  }

  private generateReason(campaignType: CampaignType, day: number, window: SendWindow): string {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return `Best send time for ${campaignType.replace(/_/g, ' ')} is ${days[day]} between ${window.start_hour}:00 and ${window.end_hour}:00. This window historically achieves the highest open and reply rates for this campaign type.`;
  }
}

export const timingRecommendationEngine = new TimingRecommendationEngine();
