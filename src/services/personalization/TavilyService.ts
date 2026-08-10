// ============================================================
// TavilyService — Personalization Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type { TavilyIndustryResult } from '@/types/personalization';

export interface IPersonalizationTavilyService {
  researchIndustry(industry: string): Promise<TavilyIndustryResult[]>;
  researchRecentNews(companyName: string): Promise<TavilyIndustryResult[]>;
}

export class PersonalizationTavilyService implements IPersonalizationTavilyService {
  async researchIndustry(_industry: string): Promise<TavilyIndustryResult[]> {
    throw new Error('PersonalizationTavilyService.researchIndustry() not implemented');
  }
  async researchRecentNews(_companyName: string): Promise<TavilyIndustryResult[]> {
    throw new Error('PersonalizationTavilyService.researchRecentNews() not implemented');
  }
}
