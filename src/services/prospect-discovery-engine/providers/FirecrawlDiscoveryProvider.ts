// ============================================================
// FirecrawlDiscoveryProvider — Uses Firecrawl for website crawling
// ============================================================

import { BaseDiscoveryProvider } from './BaseDiscoveryProvider';
import type {
  DiscoveryProviderDefinition,
  CompanySearchResult, EnrichmentResult,
} from '@/types/prospect-discovery-engine';

export class FirecrawlDiscoveryProvider extends BaseDiscoveryProvider {
  definition: DiscoveryProviderDefinition = {
    id: 'firecrawl',
    name: 'Firecrawl',
    capabilities: [
      { type: 'company_search', supported: false },
      { type: 'company_enrich', supported: true },
      { type: 'contact_search', supported: false },
      { type: 'contact_enrich', supported: false },
      { type: 'signal_detection', supported: true },
    ],
    rateLimitPerHour: 100,
    requiresApiKey: true,
  };

  async enrichCompany(domain: string): Promise<Partial<CompanySearchResult>> {
    const apiKey = import.meta.env.VITE_FIRECRAWL_API_KEY;
    if (!apiKey) throw new Error('Firecrawl API key not configured');

    const res = await fetch(`https://api.firecrawl.dev/v1/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url: domain, formats: ['markdown'] }),
    });
    if (!res.ok) throw new Error(`Firecrawl scrape failed: ${res.statusText}`);
    const data = await res.json();

    return {
      website: domain,
      description: data?.data?.markdown?.slice(0, 1000),
      confidence: 0.7,
      source: 'firecrawl' as const,
    };
  }
}
