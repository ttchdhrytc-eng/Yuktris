// ============================================================
// OpenAIService — Outreach Strategy Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type { OpenAICampaignResult } from '@/types/outreach-strategy';

export interface IOutreachOpenAIService {
  generateCampaign(prospectData: unknown): Promise<OpenAICampaignResult>;
  generateTouchpoints(campaignData: unknown): Promise<{ sequence: number; channel: string; purpose: string; timing: string; cta: string }[]>;
  recommendTiming(prospectData: unknown): Promise<{ best_day: string; best_time: string; follow_up_interval: string }>;
  recommendChannels(prospectData: unknown): Promise<{ channel: string; priority: string; confidence: number }[]>;
  recommendCTA(prospectData: unknown): Promise<{ cta_type: string; cta_text: string; priority: string }>;
}

export class OutreachOpenAIService implements IOutreachOpenAIService {
  async generateCampaign(_prospectData: unknown): Promise<OpenAICampaignResult> {
    throw new Error('OutreachOpenAIService.generateCampaign() not implemented');
  }
  async generateTouchpoints(_campaignData: unknown): Promise<{ sequence: number; channel: string; purpose: string; timing: string; cta: string }[]> {
    throw new Error('OutreachOpenAIService.generateTouchpoints() not implemented');
  }
  async recommendTiming(_prospectData: unknown): Promise<{ best_day: string; best_time: string; follow_up_interval: string }> {
    throw new Error('OutreachOpenAIService.recommendTiming() not implemented');
  }
  async recommendChannels(_prospectData: unknown): Promise<{ channel: string; priority: string; confidence: number }[]> {
    throw new Error('OutreachOpenAIService.recommendChannels() not implemented');
  }
  async recommendCTA(_prospectData: unknown): Promise<{ cta_type: string; cta_text: string; priority: string }> {
    throw new Error('OutreachOpenAIService.recommendCTA() not implemented');
  }
}
