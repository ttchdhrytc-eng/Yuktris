// ============================================================
// AIGatewayDiscoveryProvider — Uses AI Gateway for discovery
// ============================================================
//
// This provider uses the AI Gateway (which routes to LLMs like
// GPT-4, Claude, etc.) to discover companies and contacts by
// generating them from the Revenue Strategy context. It's the
// fallback provider that works without external API keys.

import { aiGateway } from '@/services/ai';
import { BaseDiscoveryProvider } from './BaseDiscoveryProvider';
import type {
  DiscoveryProviderDefinition,
  CompanySearchParams, CompanySearchResult,
  ContactSearchParams, ContactSearchResult,
  EnrichmentResult, SignalType,
} from '@/types/prospect-discovery-engine';

export class AIGatewayDiscoveryProvider extends BaseDiscoveryProvider {
  definition: DiscoveryProviderDefinition = {
    id: 'ai_gateway',
    name: 'AI Gateway',
    capabilities: [
      { type: 'company_search', supported: true },
      { type: 'company_enrich', supported: true },
      { type: 'contact_search', supported: true },
      { type: 'contact_enrich', supported: true },
      { type: 'signal_detection', supported: true },
    ],
    rateLimitPerHour: 100,
    requiresApiKey: false,
  };

  private workspaceId: string;

  constructor(workspaceId: string) {
    super();
    this.workspaceId = workspaceId;
  }

  async searchCompanies(params: CompanySearchParams): Promise<CompanySearchResult[]> {
    const systemPrompt = 'You are a B2B prospect discovery expert. You find real companies matching specific criteria. Always respond with valid JSON.';
    const userPrompt = `Find companies matching these criteria:
${JSON.stringify(params, null, 2)}

Return ONLY a JSON array of up to ${params.limit ?? 20} companies with this structure:
[{"name":"Company Inc","website":"https://example.com","industry":"SaaS","employee_count":"200-500","estimated_revenue":"$10M-$50M","headquarters":"San Francisco, CA","country":"USA","description":"AI-powered sales platform","funding_stage":"Series B","growth_stage":"Growth","technologies":["React","AWS","Salesforce"],"confidence":0.85}]

Return ONLY the JSON array.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 6000,
      workspaceId: this.workspaceId,
      agentName: 'prospect_discovery_agent',
      schema: { type: 'array' },
    });

    const data = response.structuredData ?? JSON.parse(response.content);
    return (Array.isArray(data) ? data : []) as CompanySearchResult[];
  }

  async enrichCompany(domain: string): Promise<Partial<CompanySearchResult>> {
    const systemPrompt = 'You are a company enrichment expert. You provide detailed company information. Always respond with valid JSON.';
    const userPrompt = `Enrich company information for domain: ${domain}
Return ONLY JSON: {"name":"Company","website":"${domain}","industry":"...","employee_count":"...","estimated_revenue":"...","headquarters":"...","description":"...","funding_stage":"...","growth_stage":"...","technologies":["..."],"confidence":0.8}`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 2000,
      workspaceId: this.workspaceId,
      agentName: 'prospect_discovery_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as Partial<CompanySearchResult>;
  }

  async searchContacts(params: ContactSearchParams): Promise<ContactSearchResult[]> {
    const systemPrompt = 'You are a B2B contact discovery expert. You find decision makers at companies. Always respond with valid JSON.';
    const userPrompt = `Find decision makers matching:
${JSON.stringify(params, null, 2)}

Return ONLY a JSON array of up to ${params.limit ?? 10} contacts:
[{"first_name":"Jane","last_name":"Doe","full_name":"Jane Doe","job_title":"VP Sales","department":"Sales","seniority":"VP","linkedin_url":"https://linkedin.com/in/janedoe","public_email":"jane@example.com","confidence":0.85}]

Return ONLY the JSON array.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 4000,
      workspaceId: this.workspaceId,
      agentName: 'prospect_discovery_agent',
      schema: { type: 'array' },
    });

    const data = response.structuredData ?? JSON.parse(response.content);
    return (Array.isArray(data) ? data : []) as ContactSearchResult[];
  }

  async enrichContact(_contactId: string): Promise<EnrichmentResult> {
    const systemPrompt = 'You are a contact enrichment expert. Provide professional profiles. Always respond with valid JSON.';
    const userPrompt = `Enrich contact profile. Return ONLY JSON:
{"personal_summary":"Experienced VP of Sales with 15 years...","years_at_company":"3 years","previous_companies":["Salesforce","Oracle"],"education":["MBA Harvard","BS Stanford"],"skills":["Enterprise Sales","SaaS","Leadership"],"technologies":["Salesforce","HubSpot"],"recent_posts":[],"recent_news":[],"website_signals":[],"buying_signals":[{"type":"hiring","strength":0.8}],"confidence":0.8}`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 2000,
      workspaceId: this.workspaceId,
      agentName: 'prospect_discovery_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as EnrichmentResult;
  }

  async detectSignals(companyName: string, website?: string): Promise<{ type: SignalType; data: Record<string, unknown>; strength: number }[]> {
    const systemPrompt = 'You are a buying signal detection expert. You identify growth, hiring, funding, and technology signals. Always respond with valid JSON.';
    const userPrompt = `Detect buying signals for company: ${companyName}${website ? ` (${website})` : ''}
Return ONLY a JSON array:
[{"type":"hiring","data":{"roles":["SDR","AE"],"count":5},"strength":0.8},{"type":"funding","data":{"round":"Series B","amount":"$25M"},"strength":0.9}]

Valid types: buying_intent, growth, technology, hiring, market, executive, funding, expansion, product_launch, leadership_change, vendor_change, compliance_change, merger_acquisition

Return ONLY the JSON array.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 2000,
      workspaceId: this.workspaceId,
      agentName: 'prospect_discovery_agent',
      schema: { type: 'array' },
    });

    const data = response.structuredData ?? JSON.parse(response.content);
    return (Array.isArray(data) ? data : []) as { type: SignalType; data: Record<string, unknown>; strength: number }[];
  }
}
