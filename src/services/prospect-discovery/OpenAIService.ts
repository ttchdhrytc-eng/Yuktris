// ============================================================
// OpenAIService — Prospect Discovery Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type {
  ScoringResult,
  RecommendationResult,
  DiscoveryRecommendations,
} from '@/types/prospect-discovery';

export interface IPDOpenAIService {
  generateDiscoveryStrategy(icpName: string, industry: string): Promise<string>;
  scoreCompanies(companies: unknown[]): Promise<ScoringResult[]>;
  recommendCompanies(companyNames: string[]): Promise<RecommendationResult[]>;
  rankCompanies(companyNames: string[]): Promise<string[]>;
  generateExecutiveSummary(discoveryData: unknown): Promise<DiscoveryRecommendations>;
}

export class PDOpenAIService implements IPDOpenAIService {
  async generateDiscoveryStrategy(_icpName: string, _industry: string): Promise<string> {
    throw new Error('PDOpenAIService.generateDiscoveryStrategy() not implemented');
  }
  async scoreCompanies(_companies: unknown[]): Promise<ScoringResult[]> {
    throw new Error('PDOpenAIService.scoreCompanies() not implemented');
  }
  async recommendCompanies(_companyNames: string[]): Promise<RecommendationResult[]> {
    throw new Error('PDOpenAIService.recommendCompanies() not implemented');
  }
  async rankCompanies(_companyNames: string[]): Promise<string[]> {
    throw new Error('PDOpenAIService.rankCompanies() not implemented');
  }
  async generateExecutiveSummary(_discoveryData: unknown): Promise<DiscoveryRecommendations> {
    throw new Error('PDOpenAIService.generateExecutiveSummary() not implemented');
  }
}
