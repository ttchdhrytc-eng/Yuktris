// ============================================================
// FirecrawlProvider — Website crawling & content extraction
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

export class FirecrawlProvider implements IResearchProvider {
  readonly id: ResearchProviderId = 'firecrawl';
  readonly name = 'Firecrawl';
  readonly capabilities: ResearchCapability[] = [
    'website_crawling',
    'company_research',
    'business_model_detection',
    'technology_stack_detection',
    'service_extraction',
    'content_analysis',
    'brand_messaging_analysis',
    'industry_classification',
  ];

  private apiKey: string | null = null;
  private baseUrl = 'https://api.firecrawl.dev/v1';

  async initialize(): Promise<void> {
    this.apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY ?? null;
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
          error: 'Firecrawl API key not configured',
          source_url: null,
        };
      }

      const targetUrl = context.website ?? `https://${context.companyName.toLowerCase().replace(/\s+/g, '')}.com`;

      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: true,
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        return {
          provider: this.id,
          success: false,
          data: {},
          confidence: 0,
          latency_ms: Date.now() - start,
          error: `Firecrawl API error (${response.status}): ${errorBody}`,
          source_url: targetUrl,
        };
      }

      const json = await response.json();
      const data = json.data ?? json;

      return {
        provider: this.id,
        success: true,
        data: {
          markdown: data.markdown ?? '',
          html: data.html ?? '',
          metadata: data.metadata ?? {},
          links: data.links ?? [],
          title: data.metadata?.title ?? '',
          description: data.metadata?.description ?? '',
        },
        confidence: 0.85,
        latency_ms: Date.now() - start,
        error: null,
        source_url: targetUrl,
      };
    } catch (err) {
      return {
        provider: this.id,
        success: false,
        data: {},
        confidence: 0,
        latency_ms: Date.now() - start,
        error: err instanceof Error ? err.message : 'Unknown Firecrawl error',
        source_url: null,
      };
    }
  }

  normalize(rawData: Record<string, unknown>): Partial<CompanyIntelligenceRecord> {
    const markdown = (rawData.markdown as string) ?? '';
    const metadata = (rawData.metadata as Record<string, unknown>) ?? {};

    return {
      summary: (rawData.description as string) ?? (metadata.description as string) ?? '',
      website: (metadata.url as string) ?? (rawData.source_url as string) ?? null,
      brand_positioning: this.extractBrandPositioning(markdown),
      services: this.extractServices(markdown),
      products: this.extractProducts(markdown),
    };
  }

  private extractBrandPositioning(markdown: string): string {
    const match = markdown.match(/(?:about|mission|vision)[:\s]+([^\n]{50,300})/i);
    return match ? match[1].trim() : '';
  }

  private extractServices(markdown: string): CompanyIntelligenceRecord['services'] {
    const services: CompanyIntelligenceRecord['services'] = [];
    const serviceSection = markdown.match(/(?:services|solutions|what we do)[:\s]+([\s\S]*?)(?:\n#{1,3}|\n##|\n---|$)/i);
    if (serviceSection) {
      const lines = serviceSection[1].split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'));
      for (const line of lines.slice(0, 10)) {
        const text = line.replace(/^[-*]\s*/, '').trim();
        if (text.length > 3) {
          services.push({ name: text, description: '', category: 'service' });
        }
      }
    }
    return services;
  }

  private extractProducts(markdown: string): CompanyIntelligenceRecord['products'] {
    const products: CompanyIntelligenceRecord['products'] = [];
    const productSection = markdown.match(/(?:products|platform|features)[:\s]+([\s\S]*?)(?:\n#{1,3}|\n##|\n---|$)/i);
    if (productSection) {
      const lines = productSection[1].split('\n').filter((l) => l.trim().startsWith('-') || l.trim().startsWith('*'));
      for (const line of lines.slice(0, 10)) {
        const text = line.replace(/^[-*]\s*/, '').trim();
        if (text.length > 3) {
          products.push({ name: text, description: '', category: 'product' });
        }
      }
    }
    return products;
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
      const response = await fetch(`${this.baseUrl}/scrape`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: 'https://example.com', formats: ['markdown'], limit: 1 }),
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
