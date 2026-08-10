// ============================================================
// ClearbitService — Company Research Agent
// ============================================================
//
// Interface placeholder for future Clearbit integration.
// No implementation — architecture only.

import type { CompanyEnrichmentResult } from '@/types/company-research';

export interface IClearbitService {
  enrichCompany(domain: string): Promise<CompanyEnrichmentResult>;
}

export class ClearbitService implements IClearbitService {
  async enrichCompany(_domain: string): Promise<CompanyEnrichmentResult> {
    throw new Error('ClearbitService.enrichCompany() not implemented');
  }
}
