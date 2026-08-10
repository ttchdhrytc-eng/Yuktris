// ============================================================
// OpenAIService — Interface Placeholder
// ============================================================
//
// This service defines the contract for AI-powered text generation
// using OpenAI. The actual API integration is not implemented yet —
// these method signatures serve as the architecture for future
// implementation.
//
// When implementing, inject an API key via environment variables and
// proxy requests through a Supabase Edge Function.

import type { BusinessSummary, InsightResult } from '@/types/business-intelligence';

export interface IOpenAIService {
  /** Generate an executive summary from crawled website content. */
  generateSummary(content: string): Promise<string>;

  /** Generate the unique value proposition from content. */
  generateUSP(content: string): Promise<string>;

  /** Generate the business model description from content. */
  generateBusinessModel(content: string): Promise<string>;

  /** Generate the target audience description from content. */
  generateTargetAudience(content: string): Promise<string>;

  /** Generate a list of products from content. */
  generateProducts(content: string): Promise<string[]>;

  /** Generate a list of services from content. */
  generateServices(content: string): Promise<string[]>;

  /** Generate the pricing model description from content. */
  generatePricing(content: string): Promise<string>;

  /** Generate customer problems from content. */
  generateProblems(content: string): Promise<string[]>;

  /** Generate business goals from content. */
  generateGoals(content: string): Promise<string[]>;

  /** Generate strategic insights (strengths, weaknesses, opportunities, risks). */
  generateInsights(content: string): Promise<InsightResult>;

  /** Generate the full business summary in a single structured call. */
  generateFullSummary(content: string): Promise<BusinessSummary>;
}

export class OpenAIService implements IOpenAIService {
  private apiKey: string | null;
  private model: string;

  constructor(apiKey?: string, model = 'gpt-4o') {
    this.apiKey = apiKey ?? null;
    this.model = model;
  }

  async generateSummary(_content: string): Promise<string> {
    throw new Error('OpenAIService.generateSummary() not implemented — configure API key and implement in an Edge Function.');
  }

  async generateUSP(_content: string): Promise<string> {
    throw new Error('OpenAIService.generateUSP() not implemented.');
  }

  async generateBusinessModel(_content: string): Promise<string> {
    throw new Error('OpenAIService.generateBusinessModel() not implemented.');
  }

  async generateTargetAudience(_content: string): Promise<string> {
    throw new Error('OpenAIService.generateTargetAudience() not implemented.');
  }

  async generateProducts(_content: string): Promise<string[]> {
    throw new Error('OpenAIService.generateProducts() not implemented.');
  }

  async generateServices(_content: string): Promise<string[]> {
    throw new Error('OpenAIService.generateServices() not implemented.');
  }

  async generatePricing(_content: string): Promise<string> {
    throw new Error('OpenAIService.generatePricing() not implemented.');
  }

  async generateProblems(_content: string): Promise<string[]> {
    throw new Error('OpenAIService.generateProblems() not implemented.');
  }

  async generateGoals(_content: string): Promise<string[]> {
    throw new Error('OpenAIService.generateGoals() not implemented.');
  }

  async generateInsights(_content: string): Promise<InsightResult> {
    throw new Error('OpenAIService.generateInsights() not implemented.');
  }

  async generateFullSummary(_content: string): Promise<BusinessSummary> {
    throw new Error('OpenAIService.generateFullSummary() not implemented.');
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }
}
