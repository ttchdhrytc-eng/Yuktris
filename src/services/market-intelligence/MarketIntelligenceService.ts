// ============================================================
// MarketIntelligenceService — Architecture
// ============================================================
//
// Main orchestrator for the Market Intelligence Agent.
// Runs after the Business Intelligence Agent completes.
// Coordinates industry research (Tavily), competitor analysis
// (Firecrawl), and strategy generation (OpenAI).
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - market_analysis
//   - industry_analysis
//   - country_analysis
//   - competitor_analysis
//   - trend_analysis
//   - buying_signals

import { supabase } from '@/lib/supabase';
import type {
  MarketAnalysis,
  FullMarketAnalysis,
  MarketStage,
  MarketStageInfo,
  MarketTimelineEvent,
  IndustryAnalysis,
  CountryAnalysis,
  CompetitorAnalysis,
  TrendAnalysis,
  BuyingSignal,
} from '@/types/market-intelligence';
import { MOCK_MARKET_ANALYSIS, MOCK_INDUSTRIES, MOCK_COUNTRIES, MOCK_COMPETITORS, MOCK_TRENDS, MOCK_SIGNALS, MOCK_STRATEGY } from './mockData';

// ============================================================
// Analysis Stages
// ============================================================

export const MARKET_STAGES: MarketStageInfo[] = [
  { stage: 'industry_research', label: 'Researching Industries', description: 'Analyzing industry opportunities and growth rates' },
  { stage: 'country_research', label: 'Researching Countries', description: 'Evaluating geographic markets and buying power' },
  { stage: 'competitor_research', label: 'Finding Competitors', description: 'Identifying and analyzing direct competitors' },
  { stage: 'trend_research', label: 'Analyzing Trends', description: 'Detecting market trends and their impact' },
  { stage: 'signal_research', label: 'Scoring Buying Signals', description: 'Identifying high-intent buying signals' },
  { stage: 'opportunity_scoring', label: 'Scoring Opportunities', description: 'Ranking opportunities by score and priority' },
  { stage: 'strategy_generation', label: 'Generating Strategy', description: 'Creating GTM recommendations' },
  { stage: 'finalizing', label: 'Finalizing Report', description: 'Persisting analysis to the database' },
];

// ============================================================
// Service Definition
// ============================================================

export class MarketIntelligenceService {
  /**
   * Start a new market analysis for a workspace.
   * Optionally links to a completed business analysis.
   */
  async startMarketAnalysis(workspaceId: string, businessAnalysisId?: string | null, companyName?: string | null): Promise<MarketAnalysis> {
    const { data, error } = await supabase
      .from('market_analysis')
      .insert({
        workspace_id: workspaceId,
        business_analysis_id: businessAnalysisId ?? null,
        company_name: companyName ?? null,
        market_status: 'queued',
        growth_score: 0,
        competition_score: 0,
        opportunity_score: 0,
        confidence_score: 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as MarketAnalysis;
  }

  /**
   * Analyze industries for market opportunities.
   * Placeholder — will use TavilyService.researchIndustry() when implemented.
   */
  async analyzeIndustry(_industry: string): Promise<Omit<IndustryAnalysis, 'id' | 'market_analysis_id'>[]> {
    return MOCK_INDUSTRIES;
  }

  /**
   * Analyze countries for geographic expansion opportunities.
   * Placeholder — will use TavilyService.researchCountry() when implemented.
   */
  async analyzeCountries(_industry: string): Promise<Omit<CountryAnalysis, 'id' | 'market_analysis_id'>[]> {
    return MOCK_COUNTRIES;
  }

  /**
   * Analyze competitors in the market.
   * Placeholder — will use TavilyService.researchCompetitors() + FirecrawlService when implemented.
   */
  async analyzeCompetitors(_companyName: string, _industry: string): Promise<Omit<CompetitorAnalysis, 'id' | 'market_analysis_id'>[]> {
    return MOCK_COMPETITORS;
  }

  /**
   * Analyze overall market size.
   * Placeholder — will use TavilyService.researchIndustry() when implemented.
   */
  async analyzeMarketSize(_industry: string): Promise<string> {
    return MOCK_MARKET_ANALYSIS.market_size ?? '';
  }

  /**
   * Analyze market growth signals.
   * Placeholder — will use TavilyService.researchMarketTrends() when implemented.
   */
  async analyzeGrowth(_industry: string): Promise<Omit<TrendAnalysis, 'id' | 'market_analysis_id'>[]> {
    return MOCK_TRENDS;
  }

  /**
   * Analyze buying signals indicating high purchase intent.
   * Placeholder — will use TavilyService.researchBuyingSignals() when implemented.
   */
  async analyzeBuyingSignals(_companyName: string, _industry: string): Promise<Omit<BuyingSignal, 'id' | 'market_analysis_id'>[]> {
    return MOCK_SIGNALS;
  }

  /**
   * Identify and score market opportunities.
   * Placeholder — will use OpenAIService.scoreOpportunities() when implemented.
   */
  async identifyOpportunities(): Promise<{
    growthScore: number;
    competitionScore: number;
    opportunityScore: number;
  }> {
    return {
      growthScore: MOCK_MARKET_ANALYSIS.growth_score,
      competitionScore: MOCK_MARKET_ANALYSIS.competition_score,
      opportunityScore: MOCK_MARKET_ANALYSIS.opportunity_score,
    };
  }

  /**
   * Generate GTM recommendations.
   * Placeholder — will use OpenAIService.generateStrategy() when implemented.
   */
  async generateRecommendations(): Promise<typeof MOCK_STRATEGY> {
    return MOCK_STRATEGY;
  }

  /**
   * Generate an executive summary of the market analysis.
   * Placeholder — will use OpenAIService.generateExecutiveSummary() when implemented.
   */
  async generateExecutiveSummary(): Promise<string> {
    return MOCK_MARKET_ANALYSIS.executive_summary ?? '';
  }

  /**
   * Save the complete market analysis to the database.
   */
  async saveMarketAnalysis(
    analysisId: string,
    scores: { growthScore: number; competitionScore: number; opportunityScore: number; confidenceScore: number },
    strategy: typeof MOCK_STRATEGY,
    industries: Omit<IndustryAnalysis, 'id' | 'market_analysis_id'>[],
    countries: Omit<CountryAnalysis, 'id' | 'market_analysis_id'>[],
    competitors: Omit<CompetitorAnalysis, 'id' | 'market_analysis_id'>[],
    trends: Omit<TrendAnalysis, 'id' | 'market_analysis_id'>[],
    signals: Omit<BuyingSignal, 'id' | 'market_analysis_id'>[],
  ): Promise<void> {
    const { error: updateError } = await supabase
      .from('market_analysis')
      .update({
        market_status: 'completed',
        market_size: MOCK_MARKET_ANALYSIS.market_size,
        growth_score: scores.growthScore,
        competition_score: scores.competitionScore,
        opportunity_score: scores.opportunityScore,
        confidence_score: scores.confidenceScore,
        recommended_strategy: strategy.recommendedStrategy,
        executive_summary: strategy.executiveSummary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId);

    if (updateError) throw new Error(updateError.message);

    // Insert industries
    if (industries.length > 0) {
      const { error } = await supabase.from('industry_analysis').insert(
        industries.map((i) => ({ ...i, market_analysis_id: analysisId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert countries
    if (countries.length > 0) {
      const { error } = await supabase.from('country_analysis').insert(
        countries.map((c) => ({ ...c, market_analysis_id: analysisId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert competitors
    if (competitors.length > 0) {
      const { error } = await supabase.from('competitor_analysis').insert(
        competitors.map((c) => ({ ...c, market_analysis_id: analysisId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert trends
    if (trends.length > 0) {
      const { error } = await supabase.from('trend_analysis').insert(
        trends.map((t) => ({ ...t, market_analysis_id: analysisId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert buying signals
    if (signals.length > 0) {
      const { error } = await supabase.from('buying_signals').insert(
        signals.map((s) => ({ ...s, market_analysis_id: analysisId })),
      );
      if (error) throw new Error(error.message);
    }
  }

  /**
   * Load a complete market analysis from the database.
   */
  async loadAnalysis(analysisId: string): Promise<FullMarketAnalysis | null> {
    const { data: analysis, error } = await supabase
      .from('market_analysis')
      .select('*')
      .eq('id', analysisId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!analysis) return null;

    const [industries, countries, competitors, trends, signals] = await Promise.all([
      supabase.from('industry_analysis').select('*').eq('market_analysis_id', analysisId).order('opportunity_score', { ascending: false }),
      supabase.from('country_analysis').select('*').eq('market_analysis_id', analysisId).order('opportunity_score', { ascending: false }),
      supabase.from('competitor_analysis').select('*').eq('market_analysis_id', analysisId),
      supabase.from('trend_analysis').select('*').eq('market_analysis_id', analysisId).order('confidence', { ascending: false }),
      supabase.from('buying_signals').select('*').eq('market_analysis_id', analysisId).order('priority', { ascending: false }),
    ]);

    return {
      ...(analysis as MarketAnalysis),
      industries: (industries.data ?? []) as IndustryAnalysis[],
      countries: (countries.data ?? []) as CountryAnalysis[],
      competitors: (competitors.data ?? []) as CompetitorAnalysis[],
      trends: (trends.data ?? []) as TrendAnalysis[],
      signals: (signals.data ?? []) as BuyingSignal[],
    };
  }

  /**
   * Load the latest market analysis for a workspace.
   */
  async loadLatestAnalysis(workspaceId: string, companyName?: string | null): Promise<FullMarketAnalysis | null> {
    let query = supabase
      .from('market_analysis')
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
   * Refresh an existing market analysis.
   */
  async refreshAnalysis(analysisId: string): Promise<MarketAnalysis> {
    const { data, error } = await supabase
      .from('market_analysis')
      .update({
        market_status: 'processing',
        growth_score: 0,
        competition_score: 0,
        opportunity_score: 0,
        confidence_score: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', analysisId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as MarketAnalysis;
  }

  /**
   * Update a market analysis record.
   */
  async updateAnalysis(analysisId: string, updates: Partial<MarketAnalysis>): Promise<MarketAnalysis> {
    const { data, error } = await supabase
      .from('market_analysis')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', analysisId)
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as MarketAnalysis;
  }

  /**
   * Delete a market analysis (cascades to all child tables).
   */
  async deleteAnalysis(analysisId: string): Promise<void> {
    const { error } = await supabase
      .from('market_analysis')
      .delete()
      .eq('id', analysisId);

    if (error) throw new Error(error.message);
  }

  /**
   * Generate timeline events for the market analysis workflow.
   */
  getTimelineEvents(analysis: MarketAnalysis): MarketTimelineEvent[] {
    const events: MarketTimelineEvent[] = [
      { id: 'business_completed', label: 'Business Analysis Completed', description: 'BI agent finished website analysis', timestamp: analysis.created_at, completed: true },
      { id: 'market_started', label: 'Market Research Started', description: 'Market intelligence pipeline initiated', timestamp: analysis.created_at, completed: analysis.market_status !== 'queued' },
      { id: 'competitor_research', label: 'Competitor Research', description: 'Identifying and analyzing competitors', timestamp: analysis.market_status !== 'queued' ? analysis.updated_at : null, completed: analysis.market_status === 'completed' || analysis.market_status === 'processing' },
      { id: 'trend_analysis', label: 'Trend Analysis', description: 'Detecting market trends and signals', timestamp: analysis.market_status === 'completed' ? analysis.updated_at : null, completed: analysis.market_status === 'completed' || analysis.market_status === 'processing' },
      { id: 'opportunity_scoring', label: 'Opportunity Scoring', description: 'Ranking opportunities by score', timestamp: analysis.market_status === 'completed' ? analysis.updated_at : null, completed: analysis.market_status === 'completed' },
      { id: 'recommendations', label: 'Recommendations Generated', description: 'GTM strategy and recommendations created', timestamp: analysis.market_status === 'completed' ? analysis.updated_at : null, completed: analysis.market_status === 'completed' },
      { id: 'completed', label: 'Completed', description: 'Market analysis ready for review', timestamp: analysis.market_status === 'completed' ? analysis.updated_at : null, completed: analysis.market_status === 'completed' },
    ];
    return events;
  }

  /**
   * Get the current analysis stage based on completion.
   */
  getCurrentStage(): MarketStage {
    return 'industry_research';
  }
}

// Singleton instance
export const miService = new MarketIntelligenceService();
