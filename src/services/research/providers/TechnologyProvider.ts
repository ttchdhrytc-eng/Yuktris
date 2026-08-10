// ============================================================
// TechnologyProvider — Technology stack detection (interface only)
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

export class TechnologyProvider implements IResearchProvider {
  readonly id: ResearchProviderId = 'technology';
  readonly name = 'Technology Detection';
  readonly capabilities: ResearchCapability[] = [
    'technology_stack_detection',
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
      error: 'Technology detection provider not yet implemented. Integrates with Wappalyzer/BuiltWith APIs.',
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
