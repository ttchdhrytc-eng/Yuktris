// ============================================================
// ResearchEngine — Central facade for all research intelligence operations
// ============================================================
//
// This is the single entry point for all AI agents requiring company
// or prospect intelligence. No agent should call Firecrawl, Tavily,
// or any external provider directly — they all route through here.
//
// Pipeline: Validate → Plan → Route → Parallel Research → Aggregate →
//            Normalize → Cache → Validate → Persist

import { supabase } from '@/lib/supabase';
import { providerRouter } from './ProviderRouter';
import { researchPlanner } from './ResearchPlanner';
import { researchAggregator } from './ResearchAggregator';
import { researchNormalizer } from './ResearchNormalizer';
import { researchCache } from './ResearchCache';
import { researchValidator } from './ResearchValidator';
import { companyProfiler } from './CompanyProfiler';
import { technologyAnalyzer } from './TechnologyAnalyzer';
import { seoAnalyzer } from './SEOAnalyzer';
import { businessModelDetector } from './BusinessModelDetector';
import { buyingSignalDetector } from './BuyingSignalDetector';
import type {
  ResearchPlan,
  ResearchContext,
  ProviderResult,
  AggregatedResult,
  NormalizedIntelligence,
  CompanyIntelligenceRecord,
  ResearchRequestRecord,
  ResearchRequestType,
  ResearchMonitorSummary,
  ProviderHealth,
  ResearchProviderId,
} from '@/types/research-intelligence';

class ResearchEngine {
  private initialized = false;

  // ----------------------------------------------------------
  // Initialization
  // ----------------------------------------------------------

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await providerRouter.initialize();
    this.initialized = true;
  }

  // ----------------------------------------------------------
  // Research — Main pipeline
  // ----------------------------------------------------------

  async research(params: {
    companyName: string;
    website?: string | null;
    requestType?: ResearchRequestType;
    workspaceId?: string | null;
    useCache?: boolean;
  }): Promise<{
    requestId: string;
    intelligence: CompanyIntelligenceRecord | null;
    confidence: number;
    providersUsed: string[];
    sources: { provider: string; source_url: string | null; confidence_score: number }[];
  }> {
    await this.initialize();

    const companyName = params.companyName.trim();
    const website = params.website ?? null;
    const requestType = params.requestType ?? 'full_intelligence';
    const workspaceId = params.workspaceId ?? null;
    const useCache = params.useCache ?? true;

    // 1. Validate input
    const nameCheck = researchValidator.validateCompanyName(companyName);
    if (!nameCheck.valid) throw new Error(nameCheck.error);

    const websiteCheck = researchValidator.validateWebsite(website);
    const sanitizedWebsite = websiteCheck.valid ? websiteCheck.sanitized : null;

    // 2. Check cache
    if (useCache) {
      const cached = await researchCache.get<CompanyIntelligenceRecord>(companyName, requestType);
      if (cached) {
        return {
          requestId: 'cached',
          intelligence: cached,
          confidence: cached.confidence_score ?? 0.8,
          providersUsed: ['cache'],
          sources: [],
        };
      }
    }

    // 3. Create research request record
    const { data: requestRecord, error: reqError } = await supabase
      .from('research_requests')
      .insert({
        workspace_id: workspaceId,
        company_name: companyName,
        website: sanitizedWebsite,
        request_type: requestType,
        status: 'planning',
      })
      .select('*')
      .maybeSingle();

    if (reqError || !requestRecord) {
      throw new Error(`Failed to create research request: ${reqError?.message ?? 'unknown'}`);
    }

    const requestId = requestRecord.id;

    try {
      // 4. Plan
      const plan = researchPlanner.plan({
        companyName,
        website: sanitizedWebsite,
        requestType,
      });

      await supabase
        .from('research_requests')
        .update({ status: 'in_progress', providers_used: plan.providers })
        .eq('id', requestId);

      // 5. Route to providers (parallel)
      const context = researchPlanner.getContext(plan);
      const providers = providerRouter.getActiveProviders().filter((p) =>
        plan.providers.includes(p.id)
      );

      const results: ProviderResult[] = await providerRouter.routeParallel(providers, context);

      // 6. Aggregate
      await supabase
        .from('research_requests')
        .update({ status: 'aggregating' })
        .eq('id', requestId);

      const aggregated: AggregatedResult = researchAggregator.aggregate(results);

      if (aggregated.successful === 0) {
        throw new Error('All providers failed to return results');
      }

      // 7. Normalize
      await supabase
        .from('research_requests')
        .update({ status: 'normalizing' })
        .eq('id', requestId);

      const normalized: NormalizedIntelligence = researchNormalizer.normalize(aggregated);

      // 8. Enrich with analyzers
      const enriched = this.enrichIntelligence(normalized.companyIntelligence, aggregated.merged);

      // 9. Persist
      const { data: intelligenceRecord, error: intelError } = await supabase
        .from('company_intelligence')
        .upsert({
          workspace_id: workspaceId,
          company_name: companyName,
          website: sanitizedWebsite,
          ...enriched,
          confidence_score: normalized.confidenceScore,
          last_updated: new Date().toISOString(),
        }, { onConflict: 'company_name' })
        .select('*')
        .maybeSingle();

      if (intelError || !intelligenceRecord) {
        throw new Error(`Failed to persist intelligence: ${intelError?.message ?? 'unknown'}`);
      }

      // 10. Persist sources
      const sources = researchAggregator.extractSources(results);
      if (sources.length > 0) {
        await supabase
          .from('research_sources')
          .insert(
            sources.map((s) => ({
              company_intelligence_id: intelligenceRecord.id,
              provider: s.provider,
              source_url: s.source_url,
              confidence_score: s.confidence_score,
            }))
          );
      }

      // 11. Update request status
      await supabase
        .from('research_requests')
        .update({
          status: 'completed',
          confidence_score: normalized.confidenceScore,
          completed_at: new Date().toISOString(),
          result_summary: { intelligence_id: intelligenceRecord.id },
        })
        .eq('id', requestId);

      return {
        requestId,
        intelligence: intelligenceRecord as CompanyIntelligenceRecord,
        confidence: normalized.confidenceScore,
        providersUsed: plan.providers,
        sources,
      };
    } catch (err) {
      await supabase
        .from('research_requests')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      throw err;
    }
  }

  // ----------------------------------------------------------
  // Enrich — Apply analyzers to normalized data
  // ----------------------------------------------------------

  private enrichIntelligence(
    base: Partial<CompanyIntelligenceRecord>,
    rawData: Record<string, unknown>
  ): Partial<CompanyIntelligenceRecord> {
    const enriched = { ...base };

    // Company profiling
    const profile = companyProfiler.extractProfile(rawData);
    if (!enriched.industry && profile.industry) enriched.industry = profile.industry;
    if (!enriched.business_model && profile.business_model) enriched.business_model = profile.business_model;
    if (!enriched.company_size && profile.company_size) enriched.company_size = profile.company_size;
    if (!enriched.locations || enriched.locations.length === 0) enriched.locations = profile.locations;
    if (!enriched.target_market || enriched.target_market.length === 0) enriched.target_market = profile.target_market;

    // Business model detection
    if (!enriched.business_model) {
      const model = businessModelDetector.detect(rawData);
      if (model) enriched.business_model = model;
    }

    // Technology detection
    const content = (rawData.markdown as string) ?? (rawData.html as string) ?? '';
    if (content) {
      const techStack = technologyAnalyzer.analyze(content, (rawData.metadata as Record<string, unknown>) ?? {});
      if (techStack.length > 0) enriched.technology_stack = techStack;
    }

    // SEO analysis
    const seo = seoAnalyzer.analyze(rawData);
    if (seo.top_keywords.length > 0 || seo.domain_authority !== null) {
      enriched.seo_summary = seo;
    }

    // Buying signals
    const buyingSignals = buyingSignalDetector.detectBuyingSignals(rawData);
    if (buyingSignals.length > 0) enriched.buying_signals = buyingSignals;

    // Growth signals
    const growthSignals = buyingSignalDetector.detectGrowthSignals(rawData);
    if (growthSignals.length > 0) enriched.growth_signals = growthSignals;

    return enriched;
  }

  // ----------------------------------------------------------
  // Refresh — Re-run research for an existing company
  // ----------------------------------------------------------

  async refresh(params: {
    companyName: string;
    workspaceId?: string | null;
  }): ReturnType<ResearchEngine['research']> {
    await researchCache.invalidate(params.companyName);
    return this.research({
      companyName: params.companyName,
      requestType: 'refresh',
      workspaceId: params.workspaceId,
      useCache: false,
    });
  }

  // ----------------------------------------------------------
  // Retrieval — Get existing intelligence
  // ----------------------------------------------------------

  async getIntelligence(companyName: string): Promise<CompanyIntelligenceRecord | null> {
    const { data, error } = await supabase
      .from('company_intelligence')
      .select('*')
      .ilike('company_name', companyName)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`Failed to load intelligence: ${error.message}`);
    return data as CompanyIntelligenceRecord | null;
  }

  async getIntelligenceById(id: string): Promise<CompanyIntelligenceRecord | null> {
    const { data, error } = await supabase
      .from('company_intelligence')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw new Error(`Failed to load intelligence: ${error.message}`);
    return data as CompanyIntelligenceRecord | null;
  }

  async getSources(intelligenceId: string): Promise<{ provider: string; source_url: string | null; confidence_score: number; retrieved_at: string }[]> {
    const { data, error } = await supabase
      .from('research_sources')
      .select('provider, source_url, confidence_score, retrieved_at')
      .eq('company_intelligence_id', intelligenceId)
      .order('retrieved_at', { ascending: false });

    if (error) throw new Error(`Failed to load sources: ${error.message}`);
    return (data ?? []) as { provider: string; source_url: string | null; confidence_score: number; retrieved_at: string }[];
  }

  // ----------------------------------------------------------
  // History — Research request history
  // ----------------------------------------------------------

  async getHistory(params: {
    workspaceId?: string | null;
    limit?: number;
  }): Promise<ResearchRequestRecord[]> {
    let query = supabase
      .from('research_requests')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(params.limit ?? 50);

    if (params.workspaceId) {
      query = query.eq('workspace_id', params.workspaceId);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load history: ${error.message}`);
    return (data ?? []) as ResearchRequestRecord[];
  }

  // ----------------------------------------------------------
  // Status — Get a single research request
  // ----------------------------------------------------------

  async getStatus(requestId: string): Promise<ResearchRequestRecord | null> {
    const { data, error } = await supabase
      .from('research_requests')
      .select('*')
      .eq('id', requestId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load status: ${error.message}`);
    return data as ResearchRequestRecord | null;
  }

  // ----------------------------------------------------------
  // Providers — Get provider info and health
  // ----------------------------------------------------------

  async getProviders(): Promise<{ id: ResearchProviderId; name: string; capabilities: string[]; status: string }[]> {
    await this.initialize();
    return providerRouter.getAllProviders().map((p) => ({
      id: p.id,
      name: p.name,
      capabilities: p.capabilities,
      status: p.id === 'firecrawl' || p.id === 'tavily' ? 'active' : 'inactive',
    }));
  }

  async getProviderHealth(): Promise<ProviderHealth[]> {
    await this.initialize();
    return providerRouter.checkAllHealth();
  }

  // ----------------------------------------------------------
  // Monitoring — Summary metrics
  // ----------------------------------------------------------

  async getSummary(params: { workspaceId?: string | null }): Promise<ResearchMonitorSummary> {
    let baseQuery = supabase.from('research_requests').select('*', { count: 'exact' });
    if (params.workspaceId) baseQuery = baseQuery.eq('workspace_id', params.workspaceId);
    const { count: totalRequests } = await baseQuery;

    let pendingQuery = supabase.from('research_requests').select('*', { count: 'exact', head: true }).in('status', ['pending', 'planning', 'in_progress', 'aggregating', 'normalizing']);
    if (params.workspaceId) pendingQuery = pendingQuery.eq('workspace_id', params.workspaceId);
    const { count: pendingCount } = await pendingQuery;

    let completedQuery = supabase.from('research_requests').select('*', { count: 'exact', head: true }).eq('status', 'completed');
    if (params.workspaceId) completedQuery = completedQuery.eq('workspace_id', params.workspaceId);
    const { count: completedCount } = await completedQuery;

    let failedQuery = supabase.from('research_requests').select('*', { count: 'exact', head: true }).eq('status', 'failed');
    if (params.workspaceId) failedQuery = failedQuery.eq('workspace_id', params.workspaceId);
    const { count: failedCount } = await failedQuery;

    let intelQuery = supabase.from('company_intelligence').select('confidence_score', { count: 'exact' });
    if (params.workspaceId) intelQuery = intelQuery.eq('workspace_id', params.workspaceId);
    const { data: intelData, count: intelCount } = await intelQuery;

    const avgConfidence = intelData && intelData.length > 0
      ? intelData.reduce((sum, r) => sum + (r.confidence_score ?? 0), 0) / intelData.length
      : 0;

    const cacheStats = await researchCache.getStats();
    const providerHealth = await this.getProviderHealth();

    const providerUsage: Record<string, number> = {};
    const { data: recentReqs } = await supabase
      .from('research_requests')
      .select('providers_used')
      .order('created_at', { ascending: false })
      .limit(100);

    if (recentReqs) {
      for (const req of recentReqs) {
        const providers = (req as { providers_used: string[] }).providers_used ?? [];
        for (const p of providers) {
          providerUsage[p] = (providerUsage[p] ?? 0) + 1;
        }
      }
    }

    return {
      total_requests: totalRequests ?? 0,
      pending_requests: pendingCount ?? 0,
      in_progress_requests: pendingCount ?? 0,
      completed_requests: completedCount ?? 0,
      failed_requests: failedCount ?? 0,
      total_intelligence_records: intelCount ?? 0,
      average_confidence_score: avgConfidence,
      average_duration_ms: 0,
      cache_hit_rate: cacheStats.hit_rate,
      failed_requests_count: failedCount ?? 0,
      provider_usage: providerUsage,
      provider_health: providerHealth,
    };
  }
}

export const researchEngine = new ResearchEngine();
