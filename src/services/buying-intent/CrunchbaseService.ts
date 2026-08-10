// ============================================================
// CrunchbaseService — Buying Intent Agent
// ============================================================
//
// Interface placeholder for future Crunchbase integration.
// No implementation — architecture only.

import type { CrunchbaseFundingResult } from '@/types/buying-intent';

export interface IIntentCrunchbaseService {
  collectFunding(companyName: string): Promise<CrunchbaseFundingResult[]>;
  collectAcquisitions(companyName: string): Promise<CrunchbaseFundingResult[]>;
}

export class IntentCrunchbaseService implements IIntentCrunchbaseService {
  async collectFunding(_companyName: string): Promise<CrunchbaseFundingResult[]> {
    throw new Error('IntentCrunchbaseService.collectFunding() not implemented');
  }
  async collectAcquisitions(_companyName: string): Promise<CrunchbaseFundingResult[]> {
    throw new Error('IntentCrunchbaseService.collectAcquisitions() not implemented');
  }
}
