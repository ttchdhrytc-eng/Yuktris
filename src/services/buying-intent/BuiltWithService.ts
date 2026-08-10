// ============================================================
// BuiltWithService — Buying Intent Agent
// ============================================================
//
// Interface placeholder for future BuiltWith integration.
// No implementation — architecture only.

import type { BuiltWithTechChangeResult } from '@/types/buying-intent';

export interface IIntentBuiltWithService {
  detectTechnologyChanges(url: string): Promise<BuiltWithTechChangeResult[]>;
}

export class IntentBuiltWithService implements IIntentBuiltWithService {
  async detectTechnologyChanges(_url: string): Promise<BuiltWithTechChangeResult[]> {
    throw new Error('IntentBuiltWithService.detectTechnologyChanges() not implemented');
  }
}
