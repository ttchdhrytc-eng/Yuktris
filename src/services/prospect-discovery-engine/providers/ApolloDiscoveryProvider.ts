// ============================================================
// ApolloDiscoveryProvider — Uses Apollo API for company/contact search
// ============================================================

import { BaseDiscoveryProvider } from './BaseDiscoveryProvider';
import type {
  DiscoveryProviderDefinition,
  CompanySearchParams, CompanySearchResult,
  ContactSearchParams, ContactSearchResult,
} from '@/types/prospect-discovery-engine';

export class ApolloDiscoveryProvider extends BaseDiscoveryProvider {
  definition: DiscoveryProviderDefinition = {
    id: 'apollo',
    name: 'Apollo.io',
    capabilities: [
      { type: 'company_search', supported: true },
      { type: 'company_enrich', supported: true },
      { type: 'contact_search', supported: true },
      { type: 'contact_enrich', supported: true },
      { type: 'signal_detection', supported: false },
    ],
    rateLimitPerHour: 300,
    requiresApiKey: true,
  };

  private apiKey: string | null = null;

  constructor() {
    super();
    this.apiKey = import.meta.env.VITE_APOLLO_API_KEY ?? null;
  }

  async searchCompanies(params: CompanySearchParams): Promise<CompanySearchResult[]> {
    if (!this.apiKey) throw new Error('Apollo API key not configured');

    const res = await fetch('https://api.apollo.io/v1/organizations/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({
        api_key: this.apiKey,
        q_organization_industries: params.industry ? [params.industry] : undefined,
        q_organization_num_employees_ranges: params.companySize ? [params.companySize] : undefined,
        per_page: params.limit ?? 25,
      }),
    });
    if (!res.ok) throw new Error(`Apollo search failed: ${res.statusText}`);
    const data = await res.json();

    return (data.organizations ?? []).map((org: Record<string, unknown>) => ({
      name: org.name as string,
      website: org.website_url as string,
      industry: org.industry as string,
      employee_count: org.estimated_num_employees?.toString(),
      estimated_revenue: org.estimated_annual_revenue,
      headquarters: org.hq_location,
      country: org.country,
      description: org.short_description,
      confidence: 0.85,
      source: 'apollo' as const,
    })) as CompanySearchResult[];
  }

  async searchContacts(params: ContactSearchParams): Promise<ContactSearchResult[]> {
    if (!this.apiKey) throw new Error('Apollo API key not configured');

    const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify({
        api_key: this.apiKey,
        q_organization_domains: params.company_name ? [params.company_name] : undefined,
        q_titles: params.roles,
        per_page: params.limit ?? 10,
      }),
    });
    if (!res.ok) throw new Error(`Apollo contact search failed: ${res.statusText}`);
    const data = await res.json();

    return (data.people ?? []).map((p: Record<string, unknown>) => ({
      first_name: p.first_name as string,
      last_name: p.last_name as string,
      full_name: p.name as string,
      job_title: p.title as string,
      department: p.department as string,
      seniority: p.seniority as string,
      linkedin_url: p.linkedin_url as string,
      public_email: p.email as string,
      confidence: 0.85,
      source: 'apollo' as const,
    })) as ContactSearchResult[];
  }
}
