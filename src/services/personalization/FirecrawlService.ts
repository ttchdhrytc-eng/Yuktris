// ============================================================
// FirecrawlService — Personalization Agent
// ============================================================
//
// Interface placeholder for future Firecrawl integration.
// No implementation — architecture only.

import type { FirecrawlCompanyUpdate } from '@/types/personalization';

export interface IPersonalizationFirecrawlService {
  extractCompanyUpdates(url: string): Promise<FirecrawlCompanyUpdate[]>;
}

export class PersonalizationFirecrawlService implements IPersonalizationFirecrawlService {
  async extractCompanyUpdates(_url: string): Promise<FirecrawlCompanyUpdate[]> {
    throw new Error('PersonalizationFirecrawlService.extractCompanyUpdates() not implemented');
  }
}
