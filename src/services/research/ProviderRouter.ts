// ============================================================
// ProviderRouter — Routes research requests to appropriate providers
// ============================================================

import type {
  IResearchProvider,
  ResearchProviderId,
  ResearchCapability,
  ResearchContext,
  ProviderResult,
  ProviderHealth,
} from '@/types/research-intelligence';
import { FirecrawlProvider } from './providers/FirecrawlProvider';
import { TavilyProvider } from './providers/TavilyProvider';
import { GoogleProvider } from './providers/GoogleProvider';
import { LinkedInProvider } from './providers/LinkedInProvider';
import { SchemaProvider } from './providers/SchemaProvider';
import { TechnologyProvider } from './providers/TechnologyProvider';
import { WHOISProvider } from './providers/WHOISProvider';

class ProviderRouter {
  private providers: Map<ResearchProviderId, IResearchProvider> = new Map();
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const firecrawl = new FirecrawlProvider();
    const tavily = new TavilyProvider();
    const google = new GoogleProvider();
    const linkedin = new LinkedInProvider();
    const schema = new SchemaProvider();
    const technology = new TechnologyProvider();
    const whois = new WHOISProvider();

    await Promise.all([
      firecrawl.initialize(),
      tavily.initialize(),
      google.initialize(),
      linkedin.initialize(),
      schema.initialize(),
      technology.initialize(),
      whois.initialize(),
    ]);

    this.providers.set('firecrawl', firecrawl);
    this.providers.set('tavily', tavily);
    this.providers.set('google', google);
    this.providers.set('linkedin', linkedin);
    this.providers.set('schema', schema);
    this.providers.set('technology', technology);
    this.providers.set('whois', whois);

    this.initialized = true;
  }

  getProvider(id: ResearchProviderId): IResearchProvider | undefined {
    return this.providers.get(id);
  }

  getAllProviders(): IResearchProvider[] {
    return Array.from(this.providers.values());
  }

  getActiveProviders(): IResearchProvider[] {
    return Array.from(this.providers.values()).filter((p) => p.id === 'firecrawl' || p.id === 'tavily');
  }

  selectProviders(capabilities: ResearchCapability[]): IResearchProvider[] {
    const active = this.getActiveProviders();
    return active.filter((p) =>
      capabilities.some((cap) => p.capabilities.includes(cap))
    );
  }

  async routeToProvider(
    providerId: ResearchProviderId,
    context: ResearchContext
  ): Promise<ProviderResult> {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        provider: providerId,
        success: false,
        data: {},
        confidence: 0,
        latency_ms: 0,
        error: `Provider ${providerId} not found`,
        source_url: null,
      };
    }

    if (!provider.validate(context)) {
      return {
        provider: providerId,
        success: false,
        data: {},
        confidence: 0,
        latency_ms: 0,
        error: `Provider ${providerId} cannot handle this request`,
        source_url: null,
      };
    }

    return provider.research(context);
  }

  async routeParallel(
    providers: IResearchProvider[],
    context: ResearchContext
  ): Promise<ProviderResult[]> {
    const promises = providers.map((p) => this.routeToProvider(p.id, context));
    return Promise.all(promises);
  }

  async checkAllHealth(): Promise<ProviderHealth[]> {
    const providers = this.getAllProviders();
    const checks = providers.map((p) => p.healthCheck());
    return Promise.all(checks);
  }

  getCapabilitiesForRequestType(requestType: string): ResearchCapability[] {
    switch (requestType) {
      case 'company_profile':
        return ['company_research', 'business_model_detection', 'industry_classification', 'service_extraction'];
      case 'technology_stack':
        return ['technology_stack_detection'];
      case 'seo_analysis':
        return ['seo_analysis', 'content_analysis'];
      case 'business_model':
        return ['business_model_detection', 'icp_identification'];
      case 'buying_signals':
        return ['buying_signal_detection', 'hiring_signal_detection', 'funding_detection'];
      case 'growth_signals':
        return ['growth_signal_detection', 'hiring_signal_detection', 'funding_detection'];
      case 'full_intelligence':
        return [
          'company_research', 'business_model_detection', 'icp_identification',
          'technology_stack_detection', 'seo_analysis', 'content_analysis',
          'service_extraction', 'industry_classification', 'competitive_positioning',
          'location_detection', 'decision_maker_discovery', 'buying_signal_detection',
          'growth_signal_detection', 'social_presence_detection',
          'contact_information_discovery', 'brand_messaging_analysis',
        ];
      case 'refresh':
        return ['company_research'];
      default:
        return ['company_research'];
    }
  }
}

export const providerRouter = new ProviderRouter();
