// ============================================================
// FirecrawlService — Buying Intent Agent
// ============================================================
//
// Interface placeholder for future Firecrawl integration.
// No implementation — architecture only.

import type { FirecrawlSignalResult } from '@/types/buying-intent';

export interface IIntentFirecrawlService {
  collectSignals(url: string): Promise<FirecrawlSignalResult[]>;
  detectWebsiteChanges(url: string): Promise<FirecrawlSignalResult[]>;
}

export class IntentFirecrawlService implements IIntentFirecrawlService {
  async collectSignals(_url: string): Promise<FirecrawlSignalResult[]> {
    throw new Error('IntentFirecrawlService.collectSignals() not implemented');
  }
  async detectWebsiteChanges(_url: string): Promise<FirecrawlSignalResult[]> {
    throw new Error('IntentFirecrawlService.detectWebsiteChanges() not implemented');
  }
}
