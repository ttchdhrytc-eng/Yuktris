// ============================================================
// BuiltWithService — Company Research Agent
// ============================================================
//
// Interface placeholder for future BuiltWith integration.
// No implementation — architecture only.

import type { TechnologyDetectionResult } from '@/types/company-research';

export interface IBuiltWithService {
  detectTechnologyStack(url: string): Promise<TechnologyDetectionResult[]>;
}

export class BuiltWithService implements IBuiltWithService {
  async detectTechnologyStack(_url: string): Promise<TechnologyDetectionResult[]> {
    throw new Error('BuiltWithService.detectTechnologyStack() not implemented');
  }
}
