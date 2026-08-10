// ============================================================
// WappalyzerService — Company Research Agent
// ============================================================
//
// Interface placeholder for future Wappalyzer integration.
// No implementation — architecture only.

import type { TechnologyDetectionResult } from '@/types/company-research';

export interface IWappalyzerService {
  detectFrameworks(url: string): Promise<TechnologyDetectionResult[]>;
  detectInfrastructure(url: string): Promise<TechnologyDetectionResult[]>;
}

export class WappalyzerService implements IWappalyzerService {
  async detectFrameworks(_url: string): Promise<TechnologyDetectionResult[]> {
    throw new Error('WappalyzerService.detectFrameworks() not implemented');
  }
  async detectInfrastructure(_url: string): Promise<TechnologyDetectionResult[]> {
    throw new Error('WappalyzerService.detectInfrastructure() not implemented');
  }
}
