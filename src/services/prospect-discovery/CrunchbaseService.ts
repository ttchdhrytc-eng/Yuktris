// ============================================================
// CrunchbaseService — Prospect Discovery Agent
// ============================================================
//
// Interface placeholder for future Crunchbase integration.
// No implementation — architecture only.

import type { CompanyFundingResult } from '@/types/prospect-discovery';

export interface IPDCrunchbaseService {
  companyInformation(companyName: string): Promise<unknown>;
  fundingHistory(companyName: string): Promise<CompanyFundingResult>;
}

export class PDCrunchbaseService implements IPDCrunchbaseService {
  async companyInformation(_companyName: string): Promise<unknown> {
    throw new Error('PDCrunchbaseService.companyInformation() not implemented');
  }
  async fundingHistory(_companyName: string): Promise<CompanyFundingResult> {
    throw new Error('PDCrunchbaseService.fundingHistory() not implemented');
  }
}
