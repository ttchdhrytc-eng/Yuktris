// ============================================================
// OpenAIService — Personalization Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type { OpenAIBlueprintResult } from '@/types/personalization';

export interface IPersonalizationOpenAIService {
  generateBlueprint(prospectData: unknown): Promise<OpenAIBlueprintResult>;
  generateHooks(prospectData: unknown): Promise<{ hook_type: string; hook_text: string; confidence: number }[]>;
  generateCTA(prospectData: unknown): Promise<{ cta_type: string; cta_text: string; priority: string }>;
  recommendValueProposition(prospectData: unknown): Promise<{ primary: string; secondary: string; reasoning: string }>;
  recommendCaseStudies(prospectData: unknown): Promise<{ title: string; url: string; relevance: number }[]>;
}

export class PersonalizationOpenAIService implements IPersonalizationOpenAIService {
  async generateBlueprint(_prospectData: unknown): Promise<OpenAIBlueprintResult> {
    throw new Error('PersonalizationOpenAIService.generateBlueprint() not implemented');
  }
  async generateHooks(_prospectData: unknown): Promise<{ hook_type: string; hook_text: string; confidence: number }[]> {
    throw new Error('PersonalizationOpenAIService.generateHooks() not implemented');
  }
  async generateCTA(_prospectData: unknown): Promise<{ cta_type: string; cta_text: string; priority: string }> {
    throw new Error('PersonalizationOpenAIService.generateCTA() not implemented');
  }
  async recommendValueProposition(_prospectData: unknown): Promise<{ primary: string; secondary: string; reasoning: string }> {
    throw new Error('PersonalizationOpenAIService.recommendValueProposition() not implemented');
  }
  async recommendCaseStudies(_prospectData: unknown): Promise<{ title: string; url: string; relevance: number }[]> {
    throw new Error('PersonalizationOpenAIService.recommendCaseStudies() not implemented');
  }
}
