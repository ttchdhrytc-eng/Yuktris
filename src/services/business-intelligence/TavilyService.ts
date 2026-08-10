// ============================================================
// TavilyService — Interface Placeholder
// ============================================================
//
// This service defines the contract for AI-powered web research
// using Tavily. The actual API integration is not implemented yet —
// these method signatures serve as the architecture for future
// implementation.
//
// When implementing, inject an API key via environment variables and
// proxy requests through a Supabase Edge Function.

import type {
  CompanyResearch,
  CompetitorResearch,
  IndustryResearch,
} from '@/types/business-intelligence';

export interface ITavilyService {
  /** Research a company by name or website. */
  researchCompany(query: string): Promise<CompanyResearch>;

  /** Research competitors for a given company. */
  researchCompetitors(companyName: string, industry: string): Promise<CompetitorResearch[]>;

  /** Research an industry for market trends and key players. */
  researchIndustry(industry: string): Promise<IndustryResearch>;

  /** General-purpose search query. */
  search(query: string, maxResults?: number): Promise<unknown[]>;
}

export class TavilyService implements ITavilyService {
  private apiKey: string | null;
  private baseUrl = 'https://api.tavily.com';

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? null;
  }

  async researchCompany(_query: string): Promise<CompanyResearch> {
    throw new Error('TavilyService.researchCompany() not implemented — configure API key and implement in an Edge Function.');
  }

  async researchCompetitors(_companyName: string, _industry: string): Promise<CompetitorResearch[]> {
    throw new Error('TavilyService.researchCompetitors() not implemented.');
  }

  async researchIndustry(_industry: string): Promise<IndustryResearch> {
    throw new Error('TavilyService.researchIndustry() not implemented.');
  }

  async search(_query: string, _maxResults?: number): Promise<unknown[]> {
    throw new Error('TavilyService.search() not implemented.');
  }

  isConfigured(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }
}
