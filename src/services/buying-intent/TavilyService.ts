// ============================================================
// TavilyService — Buying Intent Agent
// ============================================================
//
// Interface placeholder for future Tavily integration.
// No implementation — architecture only.

import type { TavilyNewsResult } from '@/types/buying-intent';

export interface IIntentTavilyService {
  collectNews(companyName: string): Promise<TavilyNewsResult[]>;
  collectGrowthSignals(companyName: string): Promise<TavilyNewsResult[]>;
  collectHiringSignals(companyName: string): Promise<TavilyNewsResult[]>;
}

export class IntentTavilyService implements IIntentTavilyService {
  async collectNews(_companyName: string): Promise<TavilyNewsResult[]> {
    throw new Error('IntentTavilyService.collectNews() not implemented');
  }
  async collectGrowthSignals(_companyName: string): Promise<TavilyNewsResult[]> {
    throw new Error('IntentTavilyService.collectGrowthSignals() not implemented');
  }
  async collectHiringSignals(_companyName: string): Promise<TavilyNewsResult[]> {
    throw new Error('IntentTavilyService.collectHiringSignals() not implemented');
  }
}
