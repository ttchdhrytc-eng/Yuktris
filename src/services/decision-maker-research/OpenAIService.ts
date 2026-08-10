// ============================================================
// OpenAIService — Decision Maker Research Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type { OpenAIAnalysisResult, DMRecommendations, BuyingRole } from '@/types/decision-maker-research';

export interface IDMOpenAIService {
  analyzeProfiles(profiles: unknown[]): Promise<OpenAIAnalysisResult[]>;
  scoreContacts(contacts: unknown[]): Promise<{ influence_score: number; outreach_readiness: number }[]>;
  identifyBuyingCommittee(contacts: unknown[]): Promise<{ contact_id: string; buying_role: BuyingRole }[]>;
  generateRecommendations(researchData: unknown): Promise<DMRecommendations>;
}

export class DMOpenAIService implements IDMOpenAIService {
  async analyzeProfiles(_profiles: unknown[]): Promise<OpenAIAnalysisResult[]> {
    throw new Error('DMOpenAIService.analyzeProfiles() not implemented');
  }
  async scoreContacts(_contacts: unknown[]): Promise<{ influence_score: number; outreach_readiness: number }[]> {
    throw new Error('DMOpenAIService.scoreContacts() not implemented');
  }
  async identifyBuyingCommittee(_contacts: unknown[]): Promise<{ contact_id: string; buying_role: BuyingRole }[]> {
    throw new Error('DMOpenAIService.identifyBuyingCommittee() not implemented');
  }
  async generateRecommendations(_researchData: unknown): Promise<DMRecommendations> {
    throw new Error('DMOpenAIService.generateRecommendations() not implemented');
  }
}
