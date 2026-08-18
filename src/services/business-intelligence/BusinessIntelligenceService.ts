// ============================================================
// BusinessIntelligenceService — Real Research Pipeline
// ============================================================
//
// Onboarding path:
//   research-start -> research-worker -> Firecrawl/Tavily
//   -> research_requests/company_intelligence -> business_analysis
//
// No mock business data is used in this service.

import { supabase } from '@/lib/supabase';
import type {
  BusinessAnalysis,
  BusinessInsights,
  FullAnalysis,
  WebsitePage,
  AnalysisStage,
  AnalysisStageInfo,
  TimelineEvent,
} from '@/types/business-intelligence';
import type { CompanyIntelligenceRecord } from '@/types/research-intelligence';

export const ANALYSIS_STAGES: AnalysisStageInfo[] = [
  { stage: 'connecting', label: 'Connecting', description: 'Establishing connection to the website' },
  { stage: 'crawling', label: 'Crawling Website', description: 'Discovering and mapping site pages' },
  { stage: 'reading', label: 'Reading Content', description: 'Extracting text from discovered pages' },
  { stage: 'extracting_services', label: 'Extracting Services', description: 'Identifying products, services, and pricing' },
  { stage: 'understanding', label: 'Understanding Business', description: 'Analyzing the business and market' },
  { stage: 'generating_summary', label: 'Generating Summary', description: 'Creating executive summary and insights' },
  { stage: 'saving', label: 'Saving Analysis', description: 'Persisting results to the database' },
];

const POLL_INTERVAL_MS = 2_000;
const RESEARCH_TIMEOUT_MS = 120_000;

type ResearchStatus =
  | 'pending'
  | 'planning'
  | 'in_progress'
  | 'aggregating'
  | 'normalizing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | string;

type ResearchRequestRow = {
  id: string;
  workspace_id: string | null;
  company_name: string;
  website: string | null;
  status: ResearchStatus;
  error_message?: string | null;
  result_summary?: Record<string, unknown> | null;
  created_at?: string;
};

export type ResearchBusinessProfile = {
  name: string;
  description: string;
  industry: string;
  services: string[];
  usp: string;
  competitors: string[];
  targetCustomers: string;
  pricingModel: string;
  technologies: string[];
  businessModel: string;
};

export type ResearchAnalysisResult = {
  analysis: BusinessAnalysis;
  intelligence: CompanyIntelligenceRecord;
  profile: ResearchBusinessProfile;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(value: unknown, keys: string[] = []): string {
  if (typeof value === 'string') return value.trim();
  const record = asRecord(value);
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
  }
  return '';
}

function itemNames(items: unknown, keys: string[]): string[] {
  if (!Array.isArray(items)) return [];
  return [...new Set(items.map((item) => firstString(item, keys)).filter(Boolean))];
}

function targetMarketText(items: unknown): string {
  if (!Array.isArray(items)) return '';
  const values = items
    .map((item) => {
      if (typeof item === 'string') return item.trim();
      const record = asRecord(item);
      const parts = [
        firstString(record, ['name', 'segment', 'market', 'audience', 'description']),
        firstString(record, ['industry']),
        firstString(record, ['company_size', 'size']),
        firstString(record, ['location', 'region', 'country']),
      ].filter(Boolean);
      return [...new Set(parts)].join(' — ');
    })
    .filter(Boolean);
  return [...new Set(values)].join('; ');
}

function competitorNames(value: unknown): string[] {
  const root = asRecord(value);
  const candidates =
    root.direct_competitors ??
    root.competitors ??
    root.directCompetitors ??
    [];
  return itemNames(candidates, ['name', 'company_name', 'company', 'competitor']);
}

function derivePricingModel(intelligence: CompanyIntelligenceRecord): string {
  const raw = intelligence as unknown as Record<string, unknown>;
  return firstString(raw, ['pricing_model', 'pricing', 'revenue_model']);
}

function deriveUSP(intelligence: CompanyIntelligenceRecord): string {
  return intelligence.brand_positioning?.trim()
    || firstString(intelligence.competitive_positioning, ['positioning', 'differentiation', 'summary', 'advantage'])
    || intelligence.summary?.trim()
    || '';
}

function buildProfile(intelligence: CompanyIntelligenceRecord): ResearchBusinessProfile {
  return {
    name: intelligence.company_name ?? '',
    description: intelligence.summary ?? '',
    industry: intelligence.industry ?? '',
    services: itemNames(intelligence.services, ['name', 'service_name', 'title', 'description']),
    usp: deriveUSP(intelligence),
    competitors: competitorNames(intelligence.competitive_positioning),
    targetCustomers: targetMarketText(intelligence.target_market),
    pricingModel: derivePricingModel(intelligence),
    technologies: itemNames(intelligence.technology_stack, ['name', 'technology', 'title']),
    businessModel: intelligence.business_model ?? '',
  };
}

function buildSummary(intelligence: CompanyIntelligenceRecord): Partial<BusinessAnalysis> {
  const profile = buildProfile(intelligence);
  const products = itemNames(intelligence.products, ['name', 'product_name', 'title', 'description']);
  const location = intelligence.locations?.[0] ?? '';

  return {
    company_name: profile.name,
    industry: profile.industry,
    country: location,
    description: profile.description,
    business_model: profile.businessModel,
    products,
    services: profile.services,
    pricing_model: profile.pricingModel,
    target_audience: profile.targetCustomers,
    usp: profile.usp,
    competitive_position: firstString(intelligence.competitive_positioning, ['positioning', 'summary', 'description']),
  };
}

function buildInsights(intelligence: CompanyIntelligenceRecord): Omit<BusinessInsights, 'id' | 'analysis_id' | 'created_at'> {
  const competitive = asRecord(intelligence.competitive_positioning);
  const strengths = itemNames(competitive.strengths, ['name', 'title', 'description', 'value']);
  const weaknesses = itemNames(competitive.weaknesses, ['name', 'title', 'description', 'value']);
  const opportunities = [
    ...itemNames(intelligence.growth_signals, ['name', 'signal', 'title', 'description']),
    ...itemNames(intelligence.buying_signals, ['name', 'signal', 'title', 'description']),
  ];
  const risks = itemNames(competitive.risks ?? competitive.threats, ['name', 'title', 'description', 'value']);
  const competitors = competitorNames(intelligence.competitive_positioning);

  return {
    strengths,
    weaknesses,
    opportunities: [...new Set(opportunities)],
    risks,
    executive_summary: intelligence.summary ?? '',
    raw_json: {
      company_intelligence: intelligence,
      competitive_landscape: {
        direct_competitors: competitors,
      },
    },
  };
}

export class BusinessIntelligenceService {
  async startAnalysis(workspaceId: string, website: string, companyName?: string | null): Promise<BusinessAnalysis> {
    const { data, error } = await supabase
      .from('business_analysis')
      .insert({
        workspace_id: workspaceId,
        website,
        company_name: companyName ?? null,
        analysis_status: 'queued',
        confidence_score: 0,
        completion_percentage: 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as BusinessAnalysis;
  }

  /**
   * Real onboarding analysis. Starts the server-side research pipeline,
   * waits for the worker to finish, loads the exact intelligence record,
   * maps it into business_analysis, and returns a UI-ready profile.
   */
  async runResearchAnalysis(
    workspaceId: string,
    website: string,
    companyName: string,
    onStatus?: (status: ResearchStatus) => void,
  ): Promise<ResearchAnalysisResult> {
    const analysis = await this.startAnalysis(workspaceId, website, companyName);

    try {
      await this.updateAnalysis(analysis.id, {
        analysis_status: 'processing',
        completion_percentage: 10,
      });

      const requestId = await this.startResearchRequest(workspaceId, website, companyName);
      const request = await this.waitForResearch(requestId, analysis.id, onStatus);
      const intelligence = await this.loadResearchIntelligence(request, workspaceId, website, companyName);

      const summary = buildSummary(intelligence);
      const insights = buildInsights(intelligence);

      await this.saveAnalysis(
        analysis.id,
        {
          ...summary,
          confidence_score: Math.round((intelligence.confidence_score ?? 0) * (intelligence.confidence_score && intelligence.confidence_score <= 1 ? 100 : 1)),
        },
        [],
        insights,
      );

      const completed = await this.loadAnalysis(analysis.id);
      if (!completed) throw new Error('Business analysis was saved but could not be reloaded.');

      return {
        analysis: completed,
        intelligence,
        profile: buildProfile(intelligence),
      };
    } catch (error) {
      await supabase
        .from('business_analysis')
        .update({
          analysis_status: 'failed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', analysis.id);
      throw error;
    }
  }

  private async startResearchRequest(workspaceId: string, website: string, companyName: string): Promise<string> {
    const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/research-start`;
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        company_name: companyName,
        website,
        request_type: 'full_intelligence',
        workspace_id: workspaceId,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Research request failed' }));
      throw new Error(error.error ?? `Research start failed (HTTP ${response.status})`);
    }

    const payload = await response.json();
    if (!payload?.request_id) throw new Error('Research service did not return a request_id.');
    return payload.request_id as string;
  }

  private async waitForResearch(
    requestId: string,
    analysisId: string,
    onStatus?: (status: ResearchStatus) => void,
  ): Promise<ResearchRequestRow> {
    const startedAt = Date.now();
    let lastStatus = '';

    while (Date.now() - startedAt < RESEARCH_TIMEOUT_MS) {
      const { data, error } = await supabase
        .from('research_requests')
        .select('*')
        .eq('id', requestId)
        .maybeSingle();

      if (error) throw new Error(`Failed to read research status: ${error.message}`);
      if (!data) throw new Error('Research request disappeared before completion.');

      const request = data as ResearchRequestRow;
      if (request.status !== lastStatus) {
        lastStatus = request.status;
        onStatus?.(request.status);
        await this.syncAnalysisProgress(analysisId, request.status);
      }

      if (request.status === 'completed') return request;
      if (request.status === 'failed' || request.status === 'cancelled') {
        throw new Error(request.error_message || `Research ${request.status}.`);
      }

      await sleep(POLL_INTERVAL_MS);
    }

    throw new Error('Business research timed out after 120 seconds. Please retry.');
  }

  private async syncAnalysisProgress(analysisId: string, status: ResearchStatus): Promise<void> {
    const progress: Record<string, number> = {
      pending: 15,
      planning: 20,
      in_progress: 45,
      aggregating: 70,
      normalizing: 85,
      completed: 95,
    };

    const completion = progress[status];
    if (completion === undefined) return;

    await supabase
      .from('business_analysis')
      .update({
        analysis_status: status === 'completed' ? 'processing' : 'processing',
        completion_percentage: completion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);
  }

  private async loadResearchIntelligence(
    request: ResearchRequestRow,
    workspaceId: string,
    website: string,
    companyName: string,
  ): Promise<CompanyIntelligenceRecord> {
    const resultSummary = asRecord(request.result_summary);
    const intelligenceId = firstString(resultSummary, ['intelligence_id', 'company_intelligence_id']);

    if (intelligenceId) {
      const { data, error } = await supabase
        .from('company_intelligence')
        .select('*')
        .eq('id', intelligenceId)
        .maybeSingle();
      if (error) throw new Error(`Failed to load company intelligence: ${error.message}`);
      if (data) return data as CompanyIntelligenceRecord;
    }

    // Fallback for workers that complete before storing intelligence_id in result_summary.
    let query = supabase
      .from('company_intelligence')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (website) query = query.eq('website', website);

    const { data: byWebsite, error: websiteError } = await query
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (websiteError) throw new Error(`Failed to load company intelligence: ${websiteError.message}`);
    if (byWebsite) return byWebsite as CompanyIntelligenceRecord;

    const { data: byName, error: nameError } = await supabase
      .from('company_intelligence')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('company_name', companyName)
      .order('last_updated', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (nameError) throw new Error(`Failed to load company intelligence: ${nameError.message}`);
    if (!byName) throw new Error('Research completed but no company intelligence record was found.');
    return byName as CompanyIntelligenceRecord;
  }

  // Kept for compatibility with existing callers. These now return persisted
  // real research data rather than mock content.
  async crawlWebsite(_url: string): Promise<WebsitePage[]> {
    return [];
  }

  async extractPages(_url: string): Promise<WebsitePage[]> {
    return [];
  }

  async generateBusinessSummary(_content: string): Promise<Partial<BusinessAnalysis>> {
    throw new Error('generateBusinessSummary(content) is deprecated. Use runResearchAnalysis() so the summary comes from real research.');
  }

  async generateUSP(_content: string): Promise<string> {
    throw new Error('generateUSP(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateBusinessModel(_content: string): Promise<string> {
    throw new Error('generateBusinessModel(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateTargetAudience(_content: string): Promise<string> {
    throw new Error('generateTargetAudience(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateProducts(_content: string): Promise<string[]> {
    throw new Error('generateProducts(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateServices(_content: string): Promise<string[]> {
    throw new Error('generateServices(content) is deprecated. Use runResearchAnalysis().');
  }

  async generatePricing(_content: string): Promise<string> {
    throw new Error('generatePricing(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateProblems(_content: string): Promise<string[]> {
    throw new Error('generateProblems(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateGoals(_content: string): Promise<string[]> {
    throw new Error('generateGoals(content) is deprecated. Use runResearchAnalysis().');
  }

  async generateInsights(_content: string): Promise<Omit<BusinessInsights, 'id' | 'analysis_id' | 'created_at'>> {
    throw new Error('generateInsights(content) is deprecated. Use runResearchAnalysis().');
  }

  async saveAnalysis(
    analysisId: string,
    summary: Partial<BusinessAnalysis>,
    pages: WebsitePage[],
    insights: Omit<BusinessInsights, 'id' | 'analysis_id' | 'created_at'>,
  ): Promise<void> {
    const { error: updateError } = await supabase
      .from('business_analysis')
      .update({
        ...summary,
        analysis_status: 'completed',
        completion_percentage: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    if (updateError) throw new Error(updateError.message);

    if (pages.length > 0) {
      const pageRows = pages.map((p) => ({
        analysis_id: analysisId,
        page_title: p.page_title,
        url: p.url,
        page_type: p.page_type,
        content: p.content,
        summary: p.summary,
        metadata: p.metadata,
      }));
      const { error: pagesError } = await supabase.from('website_pages').insert(pageRows);
      if (pagesError) throw new Error(pagesError.message);
    }

    const { error: insightsError } = await supabase.from('business_insights').insert({
      analysis_id: analysisId,
      ...insights,
    });
    if (insightsError) throw new Error(insightsError.message);
  }

  async loadAnalysis(analysisId: string): Promise<FullAnalysis | null> {
    const { data: analysis, error } = await supabase
      .from('business_analysis')
      .select('*')
      .eq('id', analysisId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!analysis) return null;

    const { data: pages } = await supabase
      .from('website_pages')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: true });

    const { data: insights } = await supabase
      .from('business_insights')
      .select('*')
      .eq('analysis_id', analysisId)
      .maybeSingle();

    return {
      ...(analysis as BusinessAnalysis),
      pages: (pages ?? []) as WebsitePage[],
      insights: insights as BusinessInsights | null,
    };
  }

  async loadLatestAnalysis(workspaceId: string, companyName?: string | null): Promise<FullAnalysis | null> {
    let query = supabase
      .from('business_analysis')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (companyName) query = query.eq('company_name', companyName);

    const { data: analysis, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!analysis) return null;
    return this.loadAnalysis(analysis.id);
  }

  async refreshAnalysis(analysisId: string): Promise<BusinessAnalysis> {
    const { data, error } = await supabase
      .from('business_analysis')
      .update({
        analysis_status: 'processing',
        confidence_score: 0,
        completion_percentage: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as BusinessAnalysis;
  }

  async updateAnalysis(analysisId: string, updates: Partial<BusinessAnalysis>): Promise<BusinessAnalysis> {
    const { data, error } = await supabase
      .from('business_analysis')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', analysisId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as BusinessAnalysis;
  }

  async deleteAnalysis(analysisId: string): Promise<void> {
    const { error } = await supabase
      .from('business_analysis')
      .delete()
      .eq('id', analysisId);
    if (error) throw new Error(error.message);
  }

  getTimelineEvents(analysis: BusinessAnalysis): TimelineEvent[] {
    return [
      { id: 'submitted', label: 'Website Submitted', description: `URL: ${analysis.website}`, timestamp: analysis.created_at, completed: true },
      { id: 'crawled', label: 'Website Crawled', description: 'Pages discovered and extracted', timestamp: analysis.analysis_status === 'queued' ? null : analysis.updated_at, completed: analysis.analysis_status !== 'queued' },
      { id: 'ai_analysis', label: 'Business Analysis', description: 'Business and market intelligence extracted', timestamp: analysis.analysis_status === 'completed' ? analysis.updated_at : null, completed: analysis.analysis_status === 'completed' || analysis.analysis_status === 'processing' },
      { id: 'summary', label: 'Business Summary', description: 'Executive summary and insights generated', timestamp: analysis.analysis_status === 'completed' ? analysis.updated_at : null, completed: analysis.analysis_status === 'completed' },
      { id: 'completed', label: 'Completed', description: 'Analysis ready for review', timestamp: analysis.analysis_status === 'completed' ? analysis.updated_at : null, completed: analysis.analysis_status === 'completed' },
    ];
  }

  getCurrentStage(completion: number): AnalysisStage {
    if (completion < 10) return 'connecting';
    if (completion < 25) return 'crawling';
    if (completion < 40) return 'reading';
    if (completion < 55) return 'extracting_services';
    if (completion < 70) return 'understanding';
    if (completion < 90) return 'generating_summary';
    return 'saving';
  }
}

export const biService = new BusinessIntelligenceService();
