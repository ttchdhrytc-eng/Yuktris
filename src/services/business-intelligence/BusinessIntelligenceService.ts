// ============================================================
// BusinessIntelligenceService — Architecture
// ============================================================
//
// This is the main orchestrator for the Business Intelligence Agent.
// It coordinates website crawling (Firecrawl), AI analysis (OpenAI),
// and external research (Tavily) to produce a complete business analysis.
//
// The actual API integrations are NOT implemented yet. This service
// defines the full method architecture and uses mock data to simulate
// the analysis workflow. When the real APIs are ready, replace the
// mock implementations with calls to the respective service interfaces.
//
// Data is persisted to Supabase tables:
//   - business_analysis
//   - website_pages
//   - business_insights

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
import { MOCK_ANALYSIS, MOCK_PAGES, MOCK_INSIGHTS } from './mockData';

// ============================================================
// Analysis Stages
// ============================================================

export const ANALYSIS_STAGES: AnalysisStageInfo[] = [
  { stage: 'connecting', label: 'Connecting', description: 'Establishing connection to the website' },
  { stage: 'crawling', label: 'Crawling Website', description: 'Discovering and mapping site pages' },
  { stage: 'reading', label: 'Reading Content', description: 'Extracting text from discovered pages' },
  { stage: 'extracting_services', label: 'Extracting Services', description: 'Identifying products, services, and pricing' },
  { stage: 'understanding', label: 'Understanding Business', description: 'AI analysis of business model and value proposition' },
  { stage: 'generating_summary', label: 'Generating Summary', description: 'Creating executive summary and insights' },
  { stage: 'saving', label: 'Saving Analysis', description: 'Persisting results to the database' },
];

// ============================================================
// Service Definition
// ============================================================

export class BusinessIntelligenceService {
  /**
   * Start a new business analysis for a website.
   * Creates a record with status 'queued', then simulates the
   * analysis pipeline by progressing through stages.
   */
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
   * Crawl the website to discover and extract pages.
   * Placeholder — will use FirecrawlService.crawlSite() when implemented.
   */
  async crawlWebsite(_url: string): Promise<WebsitePage[]> {
    // TODO: Replace with FirecrawlService.crawlSite(url)
    return MOCK_PAGES as WebsitePage[];
  }

  /**
   * Extract structured pages from crawled content.
   * Placeholder — will use FirecrawlService.detectPageType() when implemented.
   */
  async extractPages(_url: string): Promise<WebsitePage[]> {
    // TODO: Replace with FirecrawlService.crawlSite() + detectPageType()
    return MOCK_PAGES as WebsitePage[];
  }

  /**
   * Generate a complete business summary from extracted content.
   * Placeholder — will use OpenAIService.generateFullSummary() when implemented.
   */
  async generateBusinessSummary(_content: string): Promise<Partial<BusinessAnalysis>> {
    // TODO: Replace with OpenAIService.generateFullSummary(content)
    return {
      company_name: MOCK_ANALYSIS.company_name,
      industry: MOCK_ANALYSIS.industry,
      country: MOCK_ANALYSIS.country,
      language: MOCK_ANALYSIS.language,
      timezone: MOCK_ANALYSIS.timezone,
      description: MOCK_ANALYSIS.description,
      business_model: MOCK_ANALYSIS.business_model,
      products: MOCK_ANALYSIS.products,
      services: MOCK_ANALYSIS.services,
      pricing_model: MOCK_ANALYSIS.pricing_model,
      target_audience: MOCK_ANALYSIS.target_audience,
      usp: MOCK_ANALYSIS.usp,
      customer_problems: MOCK_ANALYSIS.customer_problems,
      business_goals: MOCK_ANALYSIS.business_goals,
      revenue_model: MOCK_ANALYSIS.revenue_model,
      competitive_position: MOCK_ANALYSIS.competitive_position,
      business_category: MOCK_ANALYSIS.business_category,
      primary_icp: MOCK_ANALYSIS.primary_icp,
    };
  }

  async generateUSP(_content: string): Promise<string> {
    return MOCK_ANALYSIS.usp ?? '';
  }

  async generateBusinessModel(_content: string): Promise<string> {
    return MOCK_ANALYSIS.business_model ?? '';
  }

  async generateTargetAudience(_content: string): Promise<string> {
    return MOCK_ANALYSIS.target_audience ?? '';
  }

  async generateProducts(_content: string): Promise<string[]> {
    return MOCK_ANALYSIS.products ?? [];
  }

  async generateServices(_content: string): Promise<string[]> {
    return MOCK_ANALYSIS.services ?? [];
  }

  async generatePricing(_content: string): Promise<string> {
    return MOCK_ANALYSIS.pricing_model ?? '';
  }

  async generateProblems(_content: string): Promise<string[]> {
    return MOCK_ANALYSIS.customer_problems ?? [];
  }

  async generateGoals(_content: string): Promise<string[]> {
    return MOCK_ANALYSIS.business_goals ?? [];
  }

  /**
   * Generate strategic insights (strengths, weaknesses, opportunities, risks).
   * Placeholder — will use OpenAIService.generateInsights() when implemented.
   */
  async generateInsights(_content: string): Promise<Omit<BusinessInsights, 'id' | 'analysis_id' | 'created_at'>> {
    return {
      strengths: MOCK_INSIGHTS.strengths,
      weaknesses: MOCK_INSIGHTS.weaknesses,
      opportunities: MOCK_INSIGHTS.opportunities,
      risks: MOCK_INSIGHTS.risks,
      executive_summary: MOCK_INSIGHTS.executive_summary,
      raw_json: MOCK_INSIGHTS.raw_json,
    };
  }

  /**
   * Save the complete analysis (analysis record + pages + insights) to the database.
   */
  async saveAnalysis(analysisId: string, summary: Partial<BusinessAnalysis>, pages: WebsitePage[], insights: Omit<BusinessInsights, 'id' | 'analysis_id' | 'created_at'>): Promise<void> {
    const { error: updateError } = await supabase
      .from('business_analysis')
      .update({
        ...summary,
        analysis_status: 'completed',
        confidence_score: 92,
        completion_percentage: 100,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    if (updateError) throw new Error(updateError.message);

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

    const { error: insightsError } = await supabase.from('business_insights').insert({
      analysis_id: analysisId,
      ...insights,
    });
    if (insightsError) throw new Error(insightsError.message);
  }

  /**
   * Load a complete analysis (analysis + pages + insights) from the database.
   */
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

  /**
   * Load the latest analysis for a workspace.
   */
  async loadLatestAnalysis(workspaceId: string, companyName?: string | null): Promise<FullAnalysis | null> {
    let query = supabase
      .from('business_analysis')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (companyName) {
      query = query.eq('company_name', companyName);
    }

    const { data: analysis, error } = await query
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!analysis) return null;

    return this.loadAnalysis(analysis.id);
  }

  /**
   * Refresh an existing analysis by re-running the pipeline.
   */
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

  /**
   * Update an analysis record (e.g., editing company info).
   */
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

  /**
   * Delete an analysis and all related data (cascades to pages + insights).
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    const { error } = await supabase
      .from('business_analysis')
      .delete()
      .eq('id', analysisId);

    if (error) throw new Error(error.message);
  }

  /**
   * Generate timeline events for the analysis workflow.
   */
  getTimelineEvents(analysis: BusinessAnalysis): TimelineEvent[] {
    const events: TimelineEvent[] = [
      { id: 'submitted', label: 'Website Submitted', description: `URL: ${analysis.website}`, timestamp: analysis.created_at, completed: true },
      { id: 'crawled', label: 'Website Crawled', description: 'Pages discovered and extracted', timestamp: analysis.analysis_status === 'queued' ? null : analysis.updated_at, completed: analysis.analysis_status !== 'queued' },
      { id: 'ai_analysis', label: 'AI Analysis', description: 'Business model and value proposition extracted', timestamp: analysis.analysis_status === 'completed' ? analysis.updated_at : null, completed: analysis.analysis_status === 'completed' || analysis.analysis_status === 'processing' },
      { id: 'summary', label: 'Business Summary', description: 'Executive summary and insights generated', timestamp: analysis.analysis_status === 'completed' ? analysis.updated_at : null, completed: analysis.analysis_status === 'completed' },
      { id: 'completed', label: 'Completed', description: 'Analysis ready for review', timestamp: analysis.analysis_status === 'completed' ? analysis.updated_at : null, completed: analysis.analysis_status === 'completed' },
    ];
    return events;
  }

  /**
   * Get the current analysis stage based on completion percentage.
   */
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

// Singleton instance
export const biService = new BusinessIntelligenceService();
