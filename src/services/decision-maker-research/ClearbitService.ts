// ============================================================
// ClearbitService — Decision Maker Research Agent
// ============================================================
//
// Interface placeholder for future Clearbit integration.
// No implementation — architecture only.

import type { ClearbitPersonResult } from '@/types/decision-maker-research';

export interface IClearbitService {
  enrichPerson(email: string): Promise<ClearbitPersonResult>;
}

export class ClearbitService implements IClearbitService {
  async enrichPerson(_email: string): Promise<ClearbitPersonResult> {
    throw new Error('ClearbitService.enrichPerson() not implemented');
  }
}
