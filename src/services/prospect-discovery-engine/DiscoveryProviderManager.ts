// ============================================================
// DiscoveryProviderManager — Manages provider selection and routing
// ============================================================
//
// Selects the best provider for each operation based on
// availability, capabilities, and rate limits. Falls back to
// the AI Gateway provider when no external providers are configured.

import { supabase } from '@/lib/supabase';
import { discoveryProviderRegistry } from './providers/DiscoveryProviderRegistry';
import { AIGatewayDiscoveryProvider } from './providers/AIGatewayDiscoveryProvider';
import type {
  IDiscoveryProvider, ProviderType, ProviderSource,
  CompanySearchParams, CompanySearchResult,
  ContactSearchParams, ContactSearchResult,
  EnrichmentResult, SignalType, SyncOperation, SyncLogStatus,
} from '@/types/prospect-discovery-engine';

class DiscoveryProviderManager {
  private workspaceProviders = new Map<string, IDiscoveryProvider[]>();

  // ----------------------------------------------------------
  // Initialize providers for a workspace
  // ----------------------------------------------------------

  getProviders(workspaceId: string): IDiscoveryProvider[] {
    if (!this.workspaceProviders.has(workspaceId)) {
      const providers: IDiscoveryProvider[] = [];

      // Always register the AI Gateway provider as fallback
      providers.push(new AIGatewayDiscoveryProvider(workspaceId));

      // Register external providers (they self-check API keys)
      try {
        const { ApolloDiscoveryProvider } = require('./providers/ApolloDiscoveryProvider');
        const apollo = new ApolloDiscoveryProvider();
        if (apollo.definition.requiresApiKey && import.meta.env.VITE_APOLLO_API_KEY) {
          providers.push(apollo);
        }
      } catch { /* not available */ }

      try {
        const { TavilyDiscoveryProvider } = require('./providers/TavilyDiscoveryProvider');
        const tavily = new TavilyDiscoveryProvider();
        if (import.meta.env.VITE_TAVILY_API_KEY) {
          providers.push(tavily);
        }
      } catch { /* not available */ }

      try {
        const { FirecrawlDiscoveryProvider } = require('./providers/FirecrawlDiscoveryProvider');
        const firecrawl = new FirecrawlDiscoveryProvider();
        if (import.meta.env.VITE_FIRECRAWL_API_KEY) {
          providers.push(firecrawl);
        }
      } catch { /* not available */ }

      this.workspaceProviders.set(workspaceId, providers);
    }
    return this.workspaceProviders.get(workspaceId)!;
  }

  // ----------------------------------------------------------
  // Select best provider for a capability
  // ----------------------------------------------------------

  selectProvider(
    workspaceId: string,
    capability: 'company_search' | 'company_enrich' | 'contact_search' | 'contact_enrich' | 'signal_detection',
  ): IDiscoveryProvider {
    const providers = this.getProviders(workspaceId);
    const capable = providers.filter((p) =>
      p.definition.capabilities.some((c) => c.type === capability && c.supported),
    );

    // Prefer external providers, fall back to AI Gateway
    const external = capable.filter((p) => p.definition.id !== 'ai_gateway');
    if (external.length > 0) return external[0];

    const aiGateway = capable.find((p) => p.definition.id === 'ai_gateway');
    if (aiGateway) return aiGateway;

    throw new Error(`No provider available for ${capability}`);
  }

  // ----------------------------------------------------------
  // Company Search — with provider fallback
  // ----------------------------------------------------------

  async searchCompanies(workspaceId: string, params: CompanySearchParams): Promise<{ results: CompanySearchResult[]; providerUsed: string }> {
    const provider = this.selectProvider(workspaceId, 'company_search');
    const startTime = Date.now();
    try {
      const results = await provider.searchCompanies(params);
      await this.logSync(workspaceId, provider.definition.id, 'company_search', 'success', { params }, { count: results.length }, results.length, Date.now() - startTime);
      await this.touchProviderSource(workspaceId, provider.definition.id, true);
      return { results, providerUsed: provider.definition.id };
    } catch (err) {
      await this.logSync(workspaceId, provider.definition.id, 'company_search', 'failed', { params }, {}, 0, Date.now() - startTime, err instanceof Error ? err.message : 'Unknown error');
      // Fallback to AI Gateway
      if (provider.definition.id !== 'ai_gateway') {
        const aiProvider = this.getProviders(workspaceId).find((p) => p.definition.id === 'ai_gateway');
        if (aiProvider) {
          const results = await aiProvider.searchCompanies(params);
          return { results, providerUsed: 'ai_gateway' };
        }
      }
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Contact Search — with provider fallback
  // ----------------------------------------------------------

  async searchContacts(workspaceId: string, params: ContactSearchParams): Promise<{ results: ContactSearchResult[]; providerUsed: string }> {
    const provider = this.selectProvider(workspaceId, 'contact_search');
    const startTime = Date.now();
    try {
      const results = await provider.searchContacts(params);
      await this.logSync(workspaceId, provider.definition.id, 'contact_search', 'success', { params }, { count: results.length }, results.length, Date.now() - startTime);
      await this.touchProviderSource(workspaceId, provider.definition.id, true);
      return { results, providerUsed: provider.definition.id };
    } catch (err) {
      await this.logSync(workspaceId, provider.definition.id, 'contact_search', 'failed', { params }, {}, 0, Date.now() - startTime, err instanceof Error ? err.message : 'Unknown error');
      if (provider.definition.id !== 'ai_gateway') {
        const aiProvider = this.getProviders(workspaceId).find((p) => p.definition.id === 'ai_gateway');
        if (aiProvider) {
          const results = await aiProvider.searchContacts(params);
          return { results, providerUsed: 'ai_gateway' };
        }
      }
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Enrichment
  // ----------------------------------------------------------

  async enrichCompany(workspaceId: string, domain: string): Promise<{ result: Partial<CompanySearchResult>; providerUsed: string }> {
    const provider = this.selectProvider(workspaceId, 'company_enrich');
    try {
      const result = await provider.enrichCompany(domain);
      await this.touchProviderSource(workspaceId, provider.definition.id, true);
      return { result, providerUsed: provider.definition.id };
    } catch (err) {
      if (provider.definition.id !== 'ai_gateway') {
        const aiProvider = this.getProviders(workspaceId).find((p) => p.definition.id === 'ai_gateway');
        if (aiProvider) {
          const result = await aiProvider.enrichCompany(domain);
          return { result, providerUsed: 'ai_gateway' };
        }
      }
      throw err;
    }
  }

  async enrichContact(workspaceId: string, contactId: string): Promise<{ result: EnrichmentResult; providerUsed: string }> {
    const provider = this.selectProvider(workspaceId, 'contact_enrich');
    try {
      const result = await provider.enrichContact(contactId);
      await this.touchProviderSource(workspaceId, provider.definition.id, true);
      return { result, providerUsed: provider.definition.id };
    } catch (err) {
      if (provider.definition.id !== 'ai_gateway') {
        const aiProvider = this.getProviders(workspaceId).find((p) => p.definition.id === 'ai_gateway');
        if (aiProvider) {
          const result = await aiProvider.enrichContact(contactId);
          return { result, providerUsed: 'ai_gateway' };
        }
      }
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Signal Detection
  // ----------------------------------------------------------

  async detectSignals(workspaceId: string, companyName: string, website?: string): Promise<{ signals: { type: SignalType; data: Record<string, unknown>; strength: number }[]; providerUsed: string }> {
    const provider = this.selectProvider(workspaceId, 'signal_detection');
    try {
      const signals = await provider.detectSignals(companyName, website);
      await this.touchProviderSource(workspaceId, provider.definition.id, true);
      return { signals, providerUsed: provider.definition.id };
    } catch (err) {
      if (provider.definition.id !== 'ai_gateway') {
        const aiProvider = this.getProviders(workspaceId).find((p) => p.definition.id === 'ai_gateway');
        if (aiProvider) {
          const signals = await aiProvider.detectSignals(companyName, website);
          return { signals, providerUsed: 'ai_gateway' };
        }
      }
      throw err;
    }
  }

  // ----------------------------------------------------------
  // Provider Status
  // ----------------------------------------------------------

  async getProviderSources(workspaceId: string): Promise<ProviderSource[]> {
    const { data } = await supabase
      .from('provider_sources')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true });
    return (data ?? []) as ProviderSource[];
  }

  async ensureProviderSources(workspaceId: string): Promise<void> {
    const providers = this.getProviders(workspaceId);
    for (const provider of providers) {
      const { data: existing } = await supabase
        .from('provider_sources')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('provider_type', provider.definition.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('provider_sources').insert({
          workspace_id: workspaceId,
          provider_name: provider.definition.name,
          provider_type: provider.definition.id,
          is_active: true,
          api_key_configured: !provider.definition.requiresApiKey || this.hasApiKey(provider.definition.id),
          capabilities: provider.definition.capabilities.map((c) => c.type),
        });
      }
    }
  }

  private hasApiKey(providerId: string): boolean {
    const keys: Record<string, string | undefined> = {
      apollo: import.meta.env.VITE_APOLLO_API_KEY,
      tavily: import.meta.env.VITE_TAVILY_API_KEY,
      firecrawl: import.meta.env.VITE_FIRECRAWL_API_KEY,
    };
    return !!keys[providerId];
  }

  // ----------------------------------------------------------
  // Sync Logging
  // ----------------------------------------------------------

  private async logSync(
    workspaceId: string,
    providerName: string,
    operation: SyncOperation,
    status: SyncLogStatus,
    requestParams: Record<string, unknown>,
    responseSummary: Record<string, unknown>,
    recordsReturned: number,
    latencyMs: number,
    errorMessage?: string,
  ): Promise<void> {
    await supabase.from('provider_sync_logs').insert({
      workspace_id: workspaceId,
      provider_name: providerName,
      operation,
      status,
      request_params: requestParams,
      response_summary: responseSummary,
      records_returned: recordsReturned,
      error_message: errorMessage ?? null,
      latency_ms: latencyMs,
    });
  }

  private async touchProviderSource(workspaceId: string, providerType: string, success: boolean): Promise<void> {
    const { data: existing } = await supabase
      .from('provider_sources')
      .select('id, total_requests, successful_requests, failed_requests')
      .eq('workspace_id', workspaceId)
      .eq('provider_type', providerType)
      .maybeSingle();

    if (existing) {
      await supabase.from('provider_sources').update({
        last_used_at: new Date().toISOString(),
        total_requests: (existing.total_requests ?? 0) + 1,
        successful_requests: success ? (existing.successful_requests ?? 0) + 1 : existing.successful_requests,
        failed_requests: success ? existing.failed_requests : (existing.failed_requests ?? 0) + 1,
      }).eq('id', existing.id);
    }
  }
}

export const discoveryProviderManager = new DiscoveryProviderManager();
