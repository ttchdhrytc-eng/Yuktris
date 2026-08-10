// ============================================================
// ClearbitService — Prospect Discovery Agent
// ============================================================
//
// Interface placeholder for future Clearbit integration.
// No implementation — architecture only.

import type { CompanyEnrichmentResult } from '@/types/prospect-discovery';

export interface IPDClearbitService {
  enrichCompany(domain: string): Promise<CompanyEnrichmentResult>;
}

export class PDClearbitService implements IPDClearbitService {
  async enrichCompany(_domain: string): Promise<CompanyEnrichmentResult> {
    throw new Error('PDClearbitService.enrichCompany() not implemented');
  }
}
