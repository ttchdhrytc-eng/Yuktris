// ============================================================
// CrunchbaseService — Company Research Agent
// ============================================================
//
// Interface placeholder for future Crunchbase integration.
// No implementation — architecture only.

import type { FundingHistoryResult, LeadershipResult } from '@/types/company-research';

export interface ICrunchbaseService {
  companyProfile(companyName: string): Promise<unknown>;
  fundingHistory(companyName: string): Promise<FundingHistoryResult[]>;
  leadership(companyName: string): Promise<LeadershipResult[]>;
}

export class CrunchbaseService implements ICrunchbaseService {
  async companyProfile(_companyName: string): Promise<unknown> {
    throw new Error('CrunchbaseService.companyProfile() not implemented');
  }
  async fundingHistory(_companyName: string): Promise<FundingHistoryResult[]> {
    throw new Error('CrunchbaseService.fundingHistory() not implemented');
  }
  async leadership(_companyName: string): Promise<LeadershipResult[]> {
    throw new Error('CrunchbaseService.leadership() not implemented');
  }
}
