// ============================================================
// TavilyService — Prospect Discovery Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type {
  CompanySearchResult,
  SearchParams,
} from '@/types/prospect-discovery';

export interface IPDTavilyService {
  searchCompanies(params: SearchParams): Promise<CompanySearchResult[]>;
  searchIndustry(industry: string): Promise<CompanySearchResult[]>;
  searchGrowthSignals(companyName: string): Promise<string[]>;
  searchTechnology(companyName: string): Promise<string[]>;
}

export class PDTavilyService implements IPDTavilyService {
  async searchCompanies(_params: SearchParams): Promise<CompanySearchResult[]> {
    throw new Error('PDTavilyService.searchCompanies() not implemented');
  }
  async searchIndustry(_industry: string): Promise<CompanySearchResult[]> {
    throw new Error('PDTavilyService.searchIndustry() not implemented');
  }
  async searchGrowthSignals(_companyName: string): Promise<string[]> {
    throw new Error('PDTavilyService.searchGrowthSignals() not implemented');
  }
  async searchTechnology(_companyName: string): Promise<string[]> {
    throw new Error('PDTavilyService.searchTechnology() not implemented');
  }
}
