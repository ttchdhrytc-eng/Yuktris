// ============================================================
// FirecrawlService — Company Research Agent
// ============================================================
//
// Interface placeholder for future Firecrawl integration.
// No implementation — architecture only.

import type { CrawlResult, CrawledPage } from '@/types/company-research';

export interface ICompanyResearchFirecrawlService {
  crawlWebsite(url: string): Promise<CrawlResult>;
  extractPages(url: string): Promise<CrawledPage[]>;
  extractProducts(url: string): Promise<CrawledPage[]>;
  extractServices(url: string): Promise<CrawledPage[]>;
  extractPricing(url: string): Promise<CrawledPage[]>;
  extractCompanyInformation(url: string): Promise<CrawledPage[]>;
}

export class CompanyResearchFirecrawlService implements ICompanyResearchFirecrawlService {
  async crawlWebsite(_url: string): Promise<CrawlResult> {
    throw new Error('CompanyResearchFirecrawlService.crawlWebsite() not implemented');
  }
  async extractPages(_url: string): Promise<CrawledPage[]> {
    throw new Error('CompanyResearchFirecrawlService.extractPages() not implemented');
  }
  async extractProducts(_url: string): Promise<CrawledPage[]> {
    throw new Error('CompanyResearchFirecrawlService.extractProducts() not implemented');
  }
  async extractServices(_url: string): Promise<CrawledPage[]> {
    throw new Error('CompanyResearchFirecrawlService.extractServices() not implemented');
  }
  async extractPricing(_url: string): Promise<CrawledPage[]> {
    throw new Error('CompanyResearchFirecrawlService.extractPricing() not implemented');
  }
  async extractCompanyInformation(_url: string): Promise<CrawledPage[]> {
    throw new Error('CompanyResearchFirecrawlService.extractCompanyInformation() not implemented');
  }
}
