// ============================================================
// TavilyService — ICP Intelligence Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type {
  IndustryResearchResult,
  BuyerRoleResearchResult,
  BuyingTriggerResearchResult,
  TechnologyUsageResult,
} from '@/types/icp-intelligence';

export interface IICPTavilyService {
  researchIndustries(market: string): Promise<IndustryResearchResult[]>;
  researchBuyerRoles(industry: string): Promise<BuyerRoleResearchResult[]>;
  researchBuyingTriggers(industry: string): Promise<BuyingTriggerResearchResult[]>;
  researchTechnologyUsage(industry: string): Promise<TechnologyUsageResult[]>;
}

export class ICPTavilyService implements IICPTavilyService {
  async researchIndustries(_market: string): Promise<IndustryResearchResult[]> {
    throw new Error('ICPTavilyService.researchIndustries() not implemented');
  }
  async researchBuyerRoles(_industry: string): Promise<BuyerRoleResearchResult[]> {
    throw new Error('ICPTavilyService.researchBuyerRoles() not implemented');
  }
  async researchBuyingTriggers(_industry: string): Promise<BuyingTriggerResearchResult[]> {
    throw new Error('ICPTavilyService.researchBuyingTriggers() not implemented');
  }
  async researchTechnologyUsage(_industry: string): Promise<TechnologyUsageResult[]> {
    throw new Error('ICPTavilyService.researchTechnologyUsage() not implemented');
  }
}
