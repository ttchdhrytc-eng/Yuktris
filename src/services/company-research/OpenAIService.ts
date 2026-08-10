// ============================================================
// OpenAIService — Company Research Agent
// ============================================================
//
// Interface placeholder for future OpenAI integration.
// No implementation — architecture only.

import type { ResearchRecommendations } from '@/types/company-research';

export interface ICompanyResearchOpenAIService {
  generateExecutiveSummary(companyData: unknown): Promise<string>;
  generateSWOT(companyData: unknown): Promise<{ strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }>;
  analyzeBusiness(companyData: unknown): Promise<{ market_position: string; competitive_advantages: string[] }>;
  scoreCompany(companyData: unknown): Promise<{ research_score: number; confidence_score: number }>;
  recommendNextAction(companyData: unknown): Promise<ResearchRecommendations>;
}

export class CompanyResearchOpenAIService implements ICompanyResearchOpenAIService {
  async generateExecutiveSummary(_companyData: unknown): Promise<string> {
    throw new Error('CompanyResearchOpenAIService.generateExecutiveSummary() not implemented');
  }
  async generateSWOT(_companyData: unknown): Promise<{ strengths: string[]; weaknesses: string[]; opportunities: string[]; threats: string[] }> {
    throw new Error('CompanyResearchOpenAIService.generateSWOT() not implemented');
  }
  async analyzeBusiness(_companyData: unknown): Promise<{ market_position: string; competitive_advantages: string[] }> {
    throw new Error('CompanyResearchOpenAIService.analyzeBusiness() not implemented');
  }
  async scoreCompany(_companyData: unknown): Promise<{ research_score: number; confidence_score: number }> {
    throw new Error('CompanyResearchOpenAIService.scoreCompany() not implemented');
  }
  async recommendNextAction(_companyData: unknown): Promise<ResearchRecommendations> {
    throw new Error('CompanyResearchOpenAIService.recommendNextAction() not implemented');
  }
}
