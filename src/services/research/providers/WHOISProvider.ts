// ============================================================
// WHOISProvider — Domain WHOIS & DNS lookup (interface only)
// ============================================================

import type {
  IResearchProvider,
  ResearchProviderId,
  ResearchCapability,
  ResearchContext,
  ProviderResult,
  ProviderHealth,
  CompanyIntelligenceRecord,
} from '@/types/research-intelligence';

export class WHOISProvider implements IResearchProvider {
  readonly id: ResearchProviderId = 'whois';
  readonly name = 'WHOIS / DNS';
  readonly capabilities: ResearchCapability[] = [
    'company_research',
    'location_detection',
  ];

  async initialize(): Promise<void> {}

  validate(_context: ResearchContext): boolean {
    return false;
  }

  async research(_context: ResearchContext): Promise<ProviderResult> {
    return {
      provider: this.id,
      success: false,
      data: {},
      confidence: 0,
      latency_ms: 0,
      error: 'WHOIS provider not yet implemented. Queries domain registration data.',
      source_url: null,
    };
  }

  normalize(_rawData: Record<string, unknown>): Partial<CompanyIntelligenceRecord> {
    return {};
  }

  async healthCheck(): Promise<ProviderHealth> {
    return {
      provider: this.id,
      status: 'inactive',
      healthy: false,
      latency_ms: null,
      last_checked: new Date().toISOString(),
      error: 'Not implemented',
      capabilities: this.capabilities,
    };
  }
}
