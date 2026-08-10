// ============================================================
// LinkedInProvider — LinkedIn company research (interface only)
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

export class LinkedInProvider implements IResearchProvider {
  readonly id: ResearchProviderId = 'linkedin';
  readonly name = 'LinkedIn';
  readonly capabilities: ResearchCapability[] = [
    'company_research',
    'decision_maker_discovery',
    'social_presence_detection',
    'growth_signal_detection',
    'hiring_signal_detection',
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
      error: 'LinkedIn provider not yet implemented. Requires LinkedIn API access.',
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
