// ============================================================
// ApolloService — Buying Intent Agent
// ============================================================
//
// Interface placeholder for future Apollo integration.
// No implementation — architecture only.

import type { ApolloContactSignalResult } from '@/types/buying-intent';

export interface IIntentApolloService {
  collectContactSignals(contactName: string, company: string): Promise<ApolloContactSignalResult>;
}

export class IntentApolloService implements IIntentApolloService {
  async collectContactSignals(_contactName: string, _company: string): Promise<ApolloContactSignalResult> {
    throw new Error('IntentApolloService.collectContactSignals() not implemented');
  }
}
