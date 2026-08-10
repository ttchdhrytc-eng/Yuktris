// ============================================================
// ApolloService — Company Research Agent
// ============================================================
//
// Interface placeholder for future Apollo integration.
// No implementation — architecture only.

import type { CompanyEnrichmentResult } from '@/types/company-research';

export interface IApolloService {
  enrichCompany(domain: string): Promise<CompanyEnrichmentResult>;
}

export class ApolloService implements IApolloService {
  async enrichCompany(_domain: string): Promise<CompanyEnrichmentResult> {
    throw new Error('ApolloService.enrichCompany() not implemented');
  }
}
