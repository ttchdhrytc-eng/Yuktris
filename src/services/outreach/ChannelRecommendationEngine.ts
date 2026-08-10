// ============================================================
// ChannelRecommendationEngine — Recommends best channels
// ============================================================

import type { ChannelRecommendation, ChannelType, CampaignType } from '@/types/outreach';

type ChannelInput = {
  campaignType: CampaignType;
  buyingIntentScore: number;
  icpScore: number;
  decisionMakers: { title: string; department: string }[];
  industry: string | null;
  availableChannels: ChannelType[];
};

class ChannelRecommendationEngine {
  recommend(input: ChannelInput): ChannelRecommendation[] {
    const recommendations: ChannelRecommendation[] = [];
    const channels = input.availableChannels.length > 0
      ? input.availableChannels
      : (['email', 'linkedin', 'phone'] as ChannelType[]);

    for (const channel of channels) {
      const score = this.scoreChannel(channel, input);
      if (score.score > 0.3) recommendations.push(score);
    }

    return recommendations.sort((a, b) => b.score - a.score);
  }

  private scoreChannel(channel: ChannelType, input: ChannelInput): ChannelRecommendation {
    let score = 0.3;
    let reason = '';

    switch (channel) {
      case 'email':
        score += 0.4;
        reason = 'Email is universally accessible and allows detailed messaging';
        if (input.buyingIntentScore >= 0.7) { score += 0.1; reason += ' with high intent for quick response'; }
        break;
      case 'linkedin':
        score += 0.3;
        reason = 'LinkedIn enables professional connection and relationship building';
        if (input.decisionMakers.some((dm) => /vp|chief|director/i.test(dm.title))) { score += 0.15; reason += ' targeting senior decision-makers'; }
        if (input.industry && /saas|tech/i.test(input.industry)) score += 0.05;
        break;
      case 'phone':
        score += 0.2;
        reason = 'Phone calls enable direct conversation and objection handling';
        if (input.buyingIntentScore >= 0.8) { score += 0.15; reason = ' — high intent warrants direct contact'; }
        break;
      case 'sms':
        score += 0.1;
        reason = 'SMS has high open rates but limited message length';
        if (input.buyingIntentScore >= 0.9) score += 0.1;
        break;
      case 'whatsapp':
        score += 0.15;
        reason = 'WhatsApp enables informal, immediate communication';
        break;
      case 'slack':
        score += 0.1;
        reason = 'Slack works for shared workspace outreach';
        break;
      case 'teams':
        score += 0.1;
        reason = 'Microsoft Teams for enterprise internal outreach';
        break;
      default:
        score = 0.1;
        reason = 'Future channel — not yet fully scored';
    }

    if (input.icpScore >= 0.7) score += 0.05;

    return { channel, score: Math.min(score, 1.0), reason };
  }
}

export const channelRecommendationEngine = new ChannelRecommendationEngine();
