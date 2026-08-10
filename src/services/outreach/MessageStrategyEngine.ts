// ============================================================
// MessageStrategyEngine — Determines message strategy
// ============================================================

import type { CampaignType, ChannelType } from '@/types/outreach';

export type MessageStrategy = {
  approach: string;
  message_tone: string;
  personalization_level: string;
  follow_up_cadence: string;
  key_messages: string[];
  objection_predictions: { objection: string; response_strategy: string }[];
  cta_strategy: string;
};

type StrategyInput = {
  campaignType: CampaignType;
  primaryChannel: ChannelType;
  industry: string | null;
  buyingIntentScore: number;
  icpScore: number;
  growthScore: number;
  riskScore: number;
  competitors: string[];
  decisionMakers: { title: string; department: string }[];
  customInstructions?: string;
};

class MessageStrategyEngine {
  generate(input: StrategyInput): MessageStrategy {
    return {
      approach: this.determineApproach(input),
      message_tone: this.determineTone(input),
      personalization_level: this.determinePersonalizationLevel(input),
      follow_up_cadence: this.determineFollowUpCadence(input),
      key_messages: this.determineKeyMessages(input),
      objection_predictions: this.predictObjections(input),
      cta_strategy: this.determineCTAStrategy(input),
    };
  }

  private determineApproach(input: StrategyInput): string {
    const approaches: Record<CampaignType, string> = {
      cold_outreach: 'Value-first cold outreach with personalized icebreaker and clear value proposition.',
      warm_outreach: 'Relationship-building approach referencing prior context or shared connections.',
      inbound_followup: 'Rapid response approach capitalizing on expressed interest with relevant information.',
      proposal_followup: 'Value-reinforcement approach highlighting ROI and addressing any open questions.',
      meeting_followup: 'Action-oriented approach with clear next steps and meeting recap.',
      re_engagement: 'Reconnection approach with new value proposition and updated offerings.',
      nurture: 'Educational approach providing valuable insights without hard selling.',
      customer_expansion: 'Expansion approach highlighting new capabilities and growth opportunities.',
      renewal: 'Value-reminder approach showcasing results achieved and renewal benefits.',
      referral: 'Relationship-leverage approach asking for introductions based on delivered value.',
      custom: 'Tailored approach based on specific campaign requirements.',
    };
    return approaches[input.campaignType] ?? approaches.custom;
  }

  private determineTone(input: StrategyInput): string {
    if (input.buyingIntentScore >= 0.7) return 'Direct and action-oriented';
    if (input.icpScore >= 0.7) return 'Consultative and professional';
    if (input.competitors.length > 5) return 'Confident and differentiating';
    return 'Friendly and informative';
  }

  private determinePersonalizationLevel(input: StrategyInput): string {
    if (input.icpScore >= 0.8 && input.decisionMakers.length > 0) return 'Highly personalized with industry and role references';
    if (input.icpScore >= 0.6) return 'Personalized with industry references';
    return 'Lightly personalized with company name';
  }

  private determineFollowUpCadence(input: StrategyInput): string {
    if (input.buyingIntentScore >= 0.7) return 'Aggressive: Day 1, Day 3, Day 7, Day 14';
    if (input.icpScore >= 0.6) return 'Moderate: Day 1, Day 5, Day 10, Day 20';
    return 'Gentle: Day 1, Day 7, Day 14, Day 30';
  }

  private determineKeyMessages(input: StrategyInput): string[] {
    const messages: string[] = [];
    if (input.growthScore >= 0.7) messages.push('Capitalize on growth momentum with scalable solutions');
    if (input.competitors.length > 5) messages.push('Differentiate from competitors through superior approach');
    if (input.buyingIntentScore >= 0.7) messages.push('Address urgent need with rapid deployment capability');
    messages.push('Demonstrate clear ROI and measurable business outcomes');
    if (input.customInstructions) messages.push(`Address: ${input.customInstructions}`);
    return messages;
  }

  private predictObjections(input: StrategyInput): { objection: string; response_strategy: string }[] {
    const objections: { objection: string; response_strategy: string }[] = [];
    objections.push({ objection: 'No budget / not in budget cycle', response_strategy: 'Highlight ROI timeline and offer phased investment options' });
    if (input.competitors.length > 5) {
      objections.push({ objection: 'Already using a competitor', response_strategy: 'Emphasize unique differentiators and offer comparison analysis' });
    }
    objections.push({ objection: 'No time to evaluate', response_strategy: 'Offer a low-commitment next step (15-min call or demo)' });
    if (input.riskScore >= 0.6) {
      objections.push({ objection: 'Concerned about switching costs', response_strategy: 'Address with migration support and phased onboarding plan' });
    }
    return objections;
  }

  private determineCTAStrategy(input: StrategyInput): string {
    if (input.buyingIntentScore >= 0.8) return 'Direct: Request a 15-minute discovery call';
    if (input.icpScore >= 0.7) return 'Soft: Offer to share a relevant case study or insights';
    return 'Educational: Invite to download a resource or attend a webinar';
  }
}

export type { StrategyInput as MessageStrategyInput };
export const messageStrategyEngine = new MessageStrategyEngine();
