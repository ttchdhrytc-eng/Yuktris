// ============================================================
// ApolloService — Prospect Discovery Agent
// ============================================================
//
// Interface placeholder for future Apollo integration.
// No implementation — architecture only.

import type { CompanySearchResult, SearchParams } from '@/types/prospect-discovery';

export interface IPDApolloService {
  searchCompanies(params: SearchParams): Promise<CompanySearchResult[]>;
}

export class PDApolloService implements IPDApolloService {
  async searchCompanies(_params: SearchParams): Promise<CompanySearchResult[]> {
    throw new Error('PDApolloService.searchCompanies() not implemented');
  }
}
