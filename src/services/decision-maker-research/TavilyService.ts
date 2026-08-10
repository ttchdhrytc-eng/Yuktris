// ============================================================
// TavilyService — Decision Maker Research Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type { TavilyPersonResult } from '@/types/decision-maker-research';

export interface IDMTavilyService {
  researchPerson(personName: string): Promise<TavilyPersonResult[]>;
  researchLeadership(companyName: string): Promise<TavilyPersonResult[]>;
  researchPublicMentions(personName: string): Promise<TavilyPersonResult[]>;
}

export class DMTavilyService implements IDMTavilyService {
  async researchPerson(_personName: string): Promise<TavilyPersonResult[]> {
    throw new Error('DMTavilyService.researchPerson() not implemented');
  }
  async researchLeadership(_companyName: string): Promise<TavilyPersonResult[]> {
    throw new Error('DMTavilyService.researchLeadership() not implemented');
  }
  async researchPublicMentions(_personName: string): Promise<TavilyPersonResult[]> {
    throw new Error('DMTavilyService.researchPublicMentions() not implemented');
  }
}
