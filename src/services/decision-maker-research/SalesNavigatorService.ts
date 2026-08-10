// ============================================================
// SalesNavigatorService — Decision Maker Research Agent
// ============================================================
//
// Interface placeholder for future Sales Navigator integration.
// No implementation — architecture only.

export interface ISalesNavigatorService {
  searchPeople(query: string): Promise<unknown>;
  searchCompanies(query: string): Promise<unknown>;
  saveLead(leadId: string): Promise<unknown>;
}

export class SalesNavigatorService implements ISalesNavigatorService {
  async searchPeople(_query: string): Promise<unknown> {
    throw new Error('SalesNavigatorService.searchPeople() not implemented');
  }
  async searchCompanies(_query: string): Promise<unknown> {
    throw new Error('SalesNavigatorService.searchCompanies() not implemented');
  }
  async saveLead(_leadId: string): Promise<unknown> {
    throw new Error('SalesNavigatorService.saveLead() not implemented');
  }
}
