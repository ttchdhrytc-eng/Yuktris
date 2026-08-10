// ============================================================
// TavilyService — Sales Navigator Intelligence Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type {
  TitleResearchResult,
  DepartmentResearchResult,
  TechnologyResearchResult,
} from '@/types/sales-navigator';

export interface ISNTavilyService {
  researchTitles(industry: string): Promise<TitleResearchResult[]>;
  researchDepartments(industry: string): Promise<DepartmentResearchResult[]>;
  researchTechnologies(industry: string): Promise<TechnologyResearchResult[]>;
}

export class SNTavilyService implements ISNTavilyService {
  async researchTitles(_industry: string): Promise<TitleResearchResult[]> {
    throw new Error('SNTavilyService.researchTitles() not implemented');
  }
  async researchDepartments(_industry: string): Promise<DepartmentResearchResult[]> {
    throw new Error('SNTavilyService.researchDepartments() not implemented');
  }
  async researchTechnologies(_industry: string): Promise<TechnologyResearchResult[]> {
    throw new Error('SNTavilyService.researchTechnologies() not implemented');
  }
}
