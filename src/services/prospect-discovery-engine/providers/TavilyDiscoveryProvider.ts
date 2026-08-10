// ============================================================
// TavilyDiscoveryProvider — Uses Tavily search for discovery
// ============================================================

import { BaseDiscoveryProvider } from './BaseDiscoveryProvider';
import type {
  DiscoveryProviderDefinition,
  CompanySearchParams, CompanySearchResult,
  ContactSearchParams, ContactSearchResult,
  SignalType,
} from '@/types/prospect-discovery-engine';

export class TavilyDiscoveryProvider extends BaseDiscoveryProvider {
  definition: DiscoveryProviderDefinition = {
    id: 'tavily',
    name: 'Tavily Search',
    capabilities: [
      { type: 'company_search', supported: true },
      { type: 'company_enrich', supported: false },
      { type: 'contact_search', supported: false },
      { type: 'contact_enrich', supported: false },
      { type: 'signal_detection', supported: true },
    ],
    rateLimitPerHour: 200,
    requiresApiKey: true,
  };

  async searchCompanies(params: CompanySearchParams): Promise<CompanySearchResult[]> {
    const query = [
      params.industry ? `${params.industry} companies` : 'B2B companies',
      params.companySize ? `${params.companySize} employees` : '',
      params.geography ? `in ${params.geography}` : '',
      params.fundingStage ? `recently raised ${params.fundingStage}` : '',
      params.hiringActivity ? 'actively hiring' : '',
    ].filter(Boolean).join(' ');

    const apiKey = import.meta.env.VITE_TAVILY_API_KEY;
    if (!apiKey) throw new Error('Tavily API key not configured');

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: params.limit ?? 20,
        search_depth: 'advanced',
      }),
    });
    if (!res.ok) throw new Error(`Tavily search failed: ${res.statusText}`);
    const data = await res.json();

    return (data.results ?? []).map((r: { title: string; url: string; content: string }) => ({
      name: r.title.split('|')[0].split('-')[0].trim(),
      website: r.url,
      description: r.content?.slice(0, 500),
      confidence: 0.6,
      source: 'tavily' as const,
    })) as CompanySearchResult[];
  }

  async detectSignals(companyName: string, _website?: string): Promise<{ type: SignalType; data: Record<string, unknown>; strength: number }[]> {
    const apiKey = import.meta.env.VITE_TAVILY_API_KEY;
    if (!apiKey) throw new Error('Tavily API key not configured');

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: `${companyName} funding hiring growth expansion 2024 2025`,
        max_results: 10,
        search_depth: 'advanced',
      }),
    });
    if (!res.ok) throw new Error(`Tavily signal search failed: ${res.statusText}`);
    const data = await res.json();

    const signals: { type: SignalType; data: Record<string, unknown>; strength: number }[] = [];
    for (const r of (data.results ?? [])) {
      const content = (r.content ?? '').toLowerCase();
      if (content.includes('funding') || content.includes('raised') || content.includes('series')) {
        signals.push({ type: 'funding', data: { source: r.url, snippet: r.content?.slice(0, 200) }, strength: 0.7 });
      }
      if (content.includes('hiring') || content.includes('recruit')) {
        signals.push({ type: 'hiring', data: { source: r.url, snippet: r.content?.slice(0, 200) }, strength: 0.6 });
      }
      if (content.includes('expansion') || content.includes('new office')) {
        signals.push({ type: 'expansion', data: { source: r.url, snippet: r.content?.slice(0, 200) }, strength: 0.6 });
      }
    }
    return signals;
  }
}
