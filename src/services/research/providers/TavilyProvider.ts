// ============================================================
// TavilyProvider — AI-optimized web search for research
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

export class TavilyProvider implements IResearchProvider {
  readonly id: ResearchProviderId = 'tavily';
  readonly name = 'Tavily';
  readonly capabilities: ResearchCapability[] = [
    'company_research',
    'business_model_detection',
    'icp_identification',
    'industry_classification',
    'competitive_positioning',
    'decision_maker_discovery',
    'buying_signal_detection',
    'growth_signal_detection',
    'hiring_signal_detection',
    'funding_detection',
    'social_presence_detection',
    'contact_information_discovery',
    'brand_messaging_analysis',
  ];

  private apiKey: string | null = null;
  private baseUrl = 'https://api.tavily.com';

  async initialize(): Promise<void> {
    this.apiKey = import.meta.env.VITE_TAVILY_API_KEY ?? null;
  }

  validate(context: ResearchContext): boolean {
    if (!context.companyName || context.companyName.trim().length === 0) return false;
    return true;
  }

  async research(context: ResearchContext): Promise<ProviderResult> {
    const start = Date.now();
    try {
      if (!this.apiKey) {
        return {
          provider: this.id,
          success: false,
          data: {},
          confidence: 0,
          latency_ms: Date.now() - start,
          error: 'Tavily API key not configured',
          source_url: null,
        };
      }

      const queries = this.buildQueries(context);
      const allResults: Record<string, unknown>[] = [];

      for (const query of queries) {
        const response = await fetch(`${this.baseUrl}/search`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            api_key: this.apiKey,
            query,
            max_results: 5,
            include_answer: true,
            include_raw_content: false,
          }),
        });

        if (!response.ok) continue;

        const json = await response.json();
        if (json.answer) allResults.push({ type: 'answer', content: json.answer, query });
        if (json.results) {
          for (const r of json.results) {
            allResults.push({ type: 'result', ...r, query });
          }
        }
      }

      return {
        provider: this.id,
        success: allResults.length > 0,
        data: { results: allResults },
        confidence: 0.8,
        latency_ms: Date.now() - start,
        error: allResults.length > 0 ? null : 'No results returned',
        source_url: context.website,
      };
    } catch (err) {
      return {
        provider: this.id,
        success: false,
        data: {},
        confidence: 0,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown Tavily error',
        source_url: null,
      };
    }
  }

  normalize(rawData: Record<string, unknown>): Partial<CompanyIntelligenceRecord> {
    const results = (rawData.results as Record<string, unknown>[]) ?? [];
    const answers = results.filter((r) => r.type === 'answer');
    const searchResults = results.filter((r) => r.type === 'result');

    const summary = answers.map((a) => a.content as string).join(' ').slice(0, 2000);
    const industry = this.extractField(results, 'industry');
    const businessModel = this.extractField(results, 'business model');

    return {
      summary: summary || null,
      industry: industry ?? null,
      business_model: businessModel ?? null,
      buying_signals: this.extractSignals(results, 'buying'),
      growth_signals: this.extractSignals(results, 'growth'),
      social_profiles: this.extractSocialProfiles(searchResults),
    };
  }

  private buildQueries(context: ResearchContext): string[] {
    const base = context.companyName;
    const queries = [`${base} company overview business model`];

    if (context.capabilities.includes('buying_signal_detection')) {
      queries.push(`${base} hiring growth expansion funding`);
    }
    if (context.capabilities.includes('technology_stack_detection')) {
      queries.push(`${base} technology stack tools software`);
    }
    if (context.capabilities.includes('competitive_positioning')) {
      queries.push(`${base} competitors market position`);
    }
    if (context.capabilities.includes('decision_maker_discovery')) {
      queries.push(`${base} CEO CTO executives leadership team`);
    }
    if (context.requestType === 'full_intelligence') {
      queries.push(`${base} industry target market customers ICP`);
      queries.push(`${base} social media presence LinkedIn Twitter`);
    }
    return queries;
  }

  private extractField(results: Record<string, unknown>[], field: string): string | null {
    const lower = field.toLowerCase();
    for (const r of results) {
      const content = (r.content as string) ?? '';
      const match = content.match(new RegExp(`${lower}\\s*[:\\-]\\s*([^\\n]{10,200})`, 'i'));
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractSignals(results: Record<string, unknown>[], type: string): CompanyIntelligenceRecord['buying_signals'] {
    const signals: CompanyIntelligenceRecord['buying_signals'] = [];
    const lower = type.toLowerCase();
    for (const r of results) {
      const content = (r.content as string) ?? '';
      if (content.toLowerCase().includes(lower) || content.toLowerCase().includes('hiring') || content.toLowerCase().includes('funding') || content.toLowerCase().includes('expansion')) {
        signals.push({
          signal_type: type,
          description: content.slice(0, 300),
          confidence: 0.7,
          source: (r.url as string) ?? 'tavily',
          detected_at: new Date().toISOString(),
        });
      }
    }
    return signals.slice(0, 5);
  }

  private extractSocialProfiles(results: Record<string, unknown>[]): CompanyIntelligenceRecord['social_profiles'] {
    const profiles: CompanyIntelligenceRecord['social_profiles'] = [];
    const seen = new Set<string>();
    for (const r of results) {
      const url = (r.url as string) ?? '';
      const platform = this.detectPlatform(url);
      if (platform && !seen.has(platform)) {
        seen.add(platform);
        profiles.push({ platform, url, followers: null, verified: false });
      }
    }
    return profiles;
  }

  private detectPlatform(url: string): string | null {
    if (url.includes('linkedin.com')) return 'LinkedIn';
    if (url.includes('twitter.com') || url.includes('x.com')) return 'Twitter';
    if (url.includes('facebook.com')) return 'Facebook';
    if (url.includes('instagram.com')) return 'Instagram';
    if (url.includes('youtube.com')) return 'YouTube';
    return null;
  }

  async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    if (!this.apiKey) {
      return {
        provider: this.id,
        status: 'inactive',
        healthy: false,
        latency_ms: null,
        last_checked: new Date().toISOString(),
        error: 'API key not configured',
        capabilities: this.capabilities,
      };
    }
    try {
      const response = await fetch(`${this.baseUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: this.apiKey, query: 'test', max_results: 1 }),
      });
      return {
        provider: this.id,
        status: response.ok ? 'active' : 'degraded',
        healthy: response.ok,
        latency_ms: Date.now() - start,
        last_checked: new Date().toISOString(),
        error: response.ok ? null : `HTTP ${response.status}`,
        capabilities: this.capabilities,
      };
    } catch (err) {
      return {
        provider: this.id,
        status: 'error',
        healthy: false,
        latency_ms: Date.now() - start,
        last_checked: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Unknown error',
        capabilities: this.capabilities,
      };
    }
  }
}
