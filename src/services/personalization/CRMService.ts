// ============================================================
// CRMService — Personalization Agent
// ============================================================
//
// Interface placeholder for future CRM integration.
// No implementation — architecture only.

import type { CRMAssetResult } from '@/types/personalization';

export interface IPersonalizationCRMService {
  loadCaseStudies(): Promise<CRMAssetResult[]>;
  loadTestimonials(): Promise<CRMAssetResult[]>;
}

export class PersonalizationCRMService implements IPersonalizationCRMService {
  async loadCaseStudies(): Promise<CRMAssetResult[]> {
    throw new Error('PersonalizationCRMService.loadCaseStudies() not implemented');
  }
  async loadTestimonials(): Promise<CRMAssetResult[]> {
    throw new Error('PersonalizationCRMService.loadTestimonials() not implemented');
  }
}
