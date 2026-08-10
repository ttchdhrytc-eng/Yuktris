// ============================================================
// FirecrawlService — ICP Intelligence Agent
// ============================================================
//
// Interface placeholder for future Firecrawl integration.
// No implementation — architecture only.

import type {
  CompanyInfoResult,
  IndustrySignalResult,
} from '@/types/icp-intelligence';

export interface IICPFirecrawlService {
  extractCompanyInformation(url: string): Promise<CompanyInfoResult>;
  extractIndustrySignals(industry: string): Promise<IndustrySignalResult[]>;
}

export class ICPFirecrawlService implements IICPFirecrawlService {
  async extractCompanyInformation(_url: string): Promise<CompanyInfoResult> {
    throw new Error('ICPFirecrawlService.extractCompanyInformation() not implemented');
  }
  async extractIndustrySignals(_industry: string): Promise<IndustrySignalResult[]> {
    throw new Error('ICPFirecrawlService.extractIndustrySignals() not implemented');
  }
}
