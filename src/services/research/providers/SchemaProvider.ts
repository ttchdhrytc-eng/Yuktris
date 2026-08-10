// ============================================================
// SchemaProvider — Schema.org structured data extraction (interface only)
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

export class SchemaProvider implements IResearchProvider {
  readonly id: ResearchProviderId = 'schema';
  readonly name = 'Schema.org';
  readonly capabilities: ResearchCapability[] = [
    'company_research',
    'service_extraction',
    'contact_information_discovery',
    'location_detection',
    'social_presence_detection',
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
      error: 'Schema.org provider not yet implemented. Parses JSON-LD and microdata from web pages.',
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
