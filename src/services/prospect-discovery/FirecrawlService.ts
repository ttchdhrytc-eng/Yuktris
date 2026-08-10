// ============================================================
// FirecrawlService — Prospect Discovery Agent
// ============================================================
//
// Interface placeholder for future Firecrawl integration.
// No implementation — architecture only.

import type {
  CompanyEnrichmentResult,
  TechnologyStackResult,
} from '@/types/prospect-discovery';

export interface IPDFirecrawlService {
  crawlCompanyWebsite(url: string): Promise<CompanyEnrichmentResult>;
  extractBusinessInformation(url: string): Promise<CompanyEnrichmentResult>;
  extractTechnologyStack(url: string): Promise<TechnologyStackResult>;
}

export class PDFirecrawlService implements IPDFirecrawlService {
  async crawlCompanyWebsite(_url: string): Promise<CompanyEnrichmentResult> {
    throw new Error('PDFirecrawlService.crawlCompanyWebsite() not implemented');
  }
  async extractBusinessInformation(_url: string): Promise<CompanyEnrichmentResult> {
    throw new Error('PDFirecrawlService.extractBusinessInformation() not implemented');
  }
  async extractTechnologyStack(_url: string): Promise<TechnologyStackResult> {
    throw new Error('PDFirecrawlService.extractTechnologyStack() not implemented');
  }
}
