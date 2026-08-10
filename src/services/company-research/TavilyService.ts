// ============================================================
// TavilyService — Company Research Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type { NewsResult, CompetitorResult } from '@/types/company-research';

export interface ICompanyResearchTavilyService {
  researchCompany(companyName: string): Promise<unknown>;
  researchNews(companyName: string): Promise<NewsResult[]>;
  researchGrowthSignals(companyName: string): Promise<unknown>;
  researchCompetitors(companyName: string): Promise<CompetitorResult[]>;
  researchFunding(companyName: string): Promise<unknown>;
}

export class CompanyResearchTavilyService implements ICompanyResearchTavilyService {
  async researchCompany(_companyName: string): Promise<unknown> {
    throw new Error('CompanyResearchTavilyService.researchCompany() not implemented');
  }
  async researchNews(_companyName: string): Promise<NewsResult[]> {
    throw new Error('CompanyResearchTavilyService.researchNews() not implemented');
  }
  async researchGrowthSignals(_companyName: string): Promise<unknown> {
    throw new Error('CompanyResearchTavilyService.researchGrowthSignals() not implemented');
  }
  async researchCompetitors(_companyName: string): Promise<CompetitorResult[]> {
    throw new Error('CompanyResearchTavilyService.researchCompetitors() not implemented');
  }
  async researchFunding(_companyName: string): Promise<unknown> {
    throw new Error('CompanyResearchTavilyService.researchFunding() not implemented');
  }
}
