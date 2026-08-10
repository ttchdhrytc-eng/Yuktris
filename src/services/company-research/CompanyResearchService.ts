// ============================================================
// CompanyResearchService — Architecture
// ============================================================
//
// Main orchestrator for the Company Research Agent.
// Runs after the Prospect Discovery Agent completes.
//
// Performs deep intelligence gathering for every discovered company:
//   - Website crawling and content extraction
//   - Technology stack detection
//   - Business model and products/services analysis
//   - Growth signal detection
//   - Digital presence mapping
//   - SWOT generation
//   - Executive summary and scoring
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - company_research
//   - company_profiles
//   - products_services
//   - technology_profiles
//   - growth_signals
//   - digital_presence
//   - company_business_analysis

import { supabase } from '@/lib/supabase';
import type {
  CompanyResearch,
  CompanyProfile,
  ProductService,
  TechnologyProfile,
  GrowthSignal,
  DigitalPresence,
  CompanyBusinessAnalysis,
  FullCompanyResearch,
  ResearchStage,
  ResearchTimelineEvent,
  ResearchRecommendations,
  ExportConfig,
  ExportFormat,
} from '@/types/company-research';
import { RESEARCH_STAGES, MOCK_COMPANIES, type MockCompanyResearch } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class CompanyResearchService {
  /**
   * Start the full research pipeline for a company.
   * Placeholder — will orchestrate all sub-services when implemented.
   */
  async startResearch(): Promise<unknown> {
    throw new Error('CompanyResearchService.startResearch() not implemented — use saveResearch()');
  }

  /**
   * Load a company from the Prospect Discovery Agent.
   * Placeholder — will query prospect_discovery_companies when implemented.
   */
  async loadCompany(_companyId: string): Promise<unknown> {
    throw new Error('CompanyResearchService.loadCompany() not implemented');
  }

  /**
   * Crawl the company website.
   * Placeholder — will use FirecrawlService.crawlWebsite() when implemented.
   */
  async crawlWebsite(_url: string): Promise<unknown> {
    throw new Error('CompanyResearchService.crawlWebsite() not implemented');
  }

  /**
   * Extract business overview from crawled pages.
   * Placeholder — will use FirecrawlService.extractCompanyInformation() when implemented.
   */
  async extractBusinessOverview(_url: string): Promise<unknown> {
    throw new Error('CompanyResearchService.extractBusinessOverview() not implemented');
  }

  /**
   * Extract products from crawled pages.
   * Placeholder — will use FirecrawlService.extractProducts() when implemented.
   */
  async extractProducts(_url: string): Promise<unknown> {
    throw new Error('CompanyResearchService.extractProducts() not implemented');
  }

  /**
   * Extract services from crawled pages.
   * Placeholder — will use FirecrawlService.extractServices() when implemented.
   */
  async extractServices(_url: string): Promise<unknown> {
    throw new Error('CompanyResearchService.extractServices() not implemented');
  }

  /**
   * Detect the technology stack.
   * Placeholder — will use BuiltWithService + WappalyzerService when implemented.
   */
  async detectTechnologyStack(_url: string): Promise<unknown> {
    throw new Error('CompanyResearchService.detectTechnologyStack() not implemented');
  }

  /**
   * Analyze the business model.
   * Placeholder — will use OpenAIService.analyzeBusiness() when implemented.
   */
  async analyzeBusinessModel(_companyData: unknown): Promise<unknown> {
    throw new Error('CompanyResearchService.analyzeBusinessModel() not implemented');
  }

  /**
   * Analyze market position.
   * Placeholder — will use OpenAIService.analyzeBusiness() when implemented.
   */
  async analyzeMarketPosition(_companyData: unknown): Promise<unknown> {
    throw new Error('CompanyResearchService.analyzeMarketPosition() not implemented');
  }

  /**
   * Analyze growth signals.
   * Placeholder — will use TavilyService.researchGrowthSignals() + CrunchbaseService.fundingHistory() when implemented.
   */
  async analyzeGrowthSignals(_companyName: string): Promise<unknown> {
    throw new Error('CompanyResearchService.analyzeGrowthSignals() not implemented');
  }

  /**
   * Analyze digital presence.
   * Placeholder — will aggregate social platform data when implemented.
   */
  async analyzeDigitalPresence(_companyName: string): Promise<unknown> {
    throw new Error('CompanyResearchService.analyzeDigitalPresence() not implemented');
  }

  /**
   * Generate a SWOT analysis.
   * Placeholder — will use OpenAIService.generateSWOT() when implemented.
   */
  async generateSWOT(_companyData: unknown): Promise<unknown> {
    throw new Error('CompanyResearchService.generateSWOT() not implemented');
  }

  /**
   * Generate an executive summary.
   * Placeholder — will use OpenAIService.generateExecutiveSummary() when implemented.
   */
  async generateExecutiveSummary(_companyData: unknown): Promise<unknown> {
    throw new Error('CompanyResearchService.generateExecutiveSummary() not implemented');
  }

  /**
   * Score the company based on research findings.
   * Placeholder — will use OpenAIService.scoreCompany() when implemented.
   */
  async scoreCompany(_companyData: unknown): Promise<unknown> {
    throw new Error('CompanyResearchService.scoreCompany() not implemented');
  }

  /**
   * Save a complete research record (with all child records) to the database.
   */
  async saveResearch(workspaceId: string, companyIndex: number): Promise<string> {
    const mock = MOCK_COMPANIES[companyIndex] ?? MOCK_COMPANIES[0];

    const { data: researchRow, error: researchError } = await supabase
      .from('company_research')
      .insert({
        workspace_id: workspaceId,
        research_status: 'completed',
        research_score: mock.research.research_score,
        confidence_score: mock.research.confidence_score,
        executive_summary: mock.research.executive_summary,
      })
      .select('*')
      .single();

    if (researchError) throw new Error(researchError.message);
    const researchId = (researchRow as CompanyResearch).id;

    // Insert profile
    const { error: profileError } = await supabase.from('company_profiles').insert({
      ...mock.profile,
      research_id: researchId,
    });
    if (profileError) throw new Error(profileError.message);

    // Insert products & services
    if (mock.products_services.length > 0) {
      const { error: psError } = await supabase.from('products_services').insert(
        mock.products_services.map((ps) => ({ ...ps, research_id: researchId })),
      );
      if (psError) throw new Error(psError.message);
    }

    // Insert technology profiles
    if (mock.technology_profiles.length > 0) {
      const { error: tpError } = await supabase.from('technology_profiles').insert(
        mock.technology_profiles.map((tp) => ({ ...tp, research_id: researchId })),
      );
      if (tpError) throw new Error(tpError.message);
    }

    // Insert growth signals
    if (mock.growth_signals.length > 0) {
      const { error: gsError } = await supabase.from('growth_signals').insert(
        mock.growth_signals.map((gs) => ({ ...gs, research_id: researchId })),
      );
      if (gsError) throw new Error(gsError.message);
    }

    // Insert digital presence
    if (mock.digital_presence.length > 0) {
      const { error: dpError } = await supabase.from('digital_presence').insert(
        mock.digital_presence.map((dp) => ({ ...dp, research_id: researchId })),
      );
      if (dpError) throw new Error(dpError.message);
    }

    // Insert business analysis
    const { error: baError } = await supabase.from('company_business_analysis').insert({
      ...mock.business_analysis,
      research_id: researchId,
    });
    if (baError) throw new Error(baError.message);

    return researchId;
  }

  /**
   * Refresh an existing research record.
   */
  async refreshResearch(researchId: string): Promise<void> {
    const { error } = await supabase
      .from('company_research')
      .update({ research_status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', researchId);

    if (error) throw new Error(error.message);
  }

  /**
   * Load a complete research record from the database.
   */
  async loadResearch(researchId: string): Promise<FullCompanyResearch | null> {
    const { data: research, error } = await supabase
      .from('company_research')
      .select('*')
      .eq('id', researchId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!research) return null;

    const [profileRes, psRes, tpRes, gsRes, dpRes, baRes] = await Promise.all([
      supabase.from('company_profiles').select('*').eq('research_id', researchId).maybeSingle(),
      supabase.from('products_services').select('*').eq('research_id', researchId),
      supabase.from('technology_profiles').select('*').eq('research_id', researchId),
      supabase.from('growth_signals').select('*').eq('research_id', researchId),
      supabase.from('digital_presence').select('*').eq('research_id', researchId),
      supabase.from('company_business_analysis').select('*').eq('research_id', researchId).maybeSingle(),
    ]);

    return {
      ...(research as CompanyResearch),
      profile: (profileRes.data as CompanyProfile | null) ?? null,
      products_services: (psRes.data as ProductService[] | null) ?? [],
      technology_profiles: (tpRes.data as TechnologyProfile[] | null) ?? [],
      growth_signals: (gsRes.data as GrowthSignal[] | null) ?? [],
      digital_presence: (dpRes.data as DigitalPresence[] | null) ?? [],
      business_analysis: (baRes.data as CompanyBusinessAnalysis | null) ?? null,
    };
  }

  /**
   * Load the latest research for a workspace.
   */
  async loadLatestResearch(workspaceId: string): Promise<FullCompanyResearch | null> {
    const { data, error } = await supabase
      .from('company_research')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadResearch((data as CompanyResearch).id);
  }

  /**
   * Load all research records for a workspace.
   */
  async loadAllResearch(workspaceId: string): Promise<FullCompanyResearch[]> {
    const { data: rows, error } = await supabase
      .from('company_research')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const allResearch = await Promise.all(
      (rows as CompanyResearch[]).map((r) => this.loadResearch(r.id)),
    );
    return allResearch.filter((r): r is FullCompanyResearch => r !== null);
  }

  /**
   * Delete a research record (cascades to all child tables).
   */
  async deleteResearch(researchId: string): Promise<void> {
    const { error } = await supabase.from('company_research').delete().eq('id', researchId);
    if (error) throw new Error(error.message);
  }

  /**
   * Generate AI-powered recommendations for next action.
   * Placeholder — will use OpenAIService.recommendNextAction() when implemented.
   */
  async generateRecommendations(companyIndex: number): Promise<ResearchRecommendations> {
    return (MOCK_COMPANIES[companyIndex] ?? MOCK_COMPANIES[0]).recommendations;
  }

  /**
   * Export research data in various formats.
   */
  exportConfiguration(research: FullCompanyResearch, format: ExportFormat): ExportConfig {
    const data = {
      company_name: research.profile?.company_name,
      website: research.profile?.website,
      industry: research.profile?.industry,
      research_score: research.research_score,
      confidence_score: research.confidence_score,
      executive_summary: research.executive_summary,
      profile: research.profile,
      products_services: research.products_services,
      technology_profiles: research.technology_profiles,
      growth_signals: research.growth_signals,
      digital_presence: research.digital_presence,
      business_analysis: research.business_analysis,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `company-research-${research.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows: string[][] = [
          ['Field', 'Value'],
          ['Company', research.profile?.company_name ?? ''],
          ['Website', research.profile?.website ?? ''],
          ['Industry', research.profile?.industry ?? ''],
          ['Employees', research.profile?.employee_count ?? ''],
          ['Revenue', research.profile?.annual_revenue ?? ''],
          ['Research Score', String(research.research_score)],
          ['Confidence Score', String(research.confidence_score)],
          ['Executive Summary', research.executive_summary ?? ''],
          ['Technologies', research.technology_profiles.map((t) => t.technology_name).join('; ')],
          ['Growth Signals', research.growth_signals.map((g) => g.description).join('; ')],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        return { format, data: csv, filename: `company-research-${research.id.slice(0, 8)}.csv` };
      }
    }
  }

  /**
   * Generate timeline events for the research workflow.
   */
  getTimelineEvents(research: CompanyResearch): ResearchTimelineEvent[] {
    const isCompleted = research.research_status === 'completed';

    return [
      { id: 'company_loaded', label: 'Company Loaded', description: 'Company loaded from Prospect Discovery Agent', timestamp: research.created_at, completed: true },
      { id: 'website_analyzed', label: 'Website Analysis', description: 'Website crawled and content extracted', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'technology_detected', label: 'Technology Analysis', description: 'Technology stack detected via BuiltWith/Wappalyzer', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'business_analyzed', label: 'Business Analysis', description: 'Business model and products analyzed', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'growth_analyzed', label: 'Growth Analysis', description: 'Growth signals and funding detected', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'market_analyzed', label: 'Market Analysis', description: 'SWOT and market position generated', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
      { id: 'completed', label: 'Completed', description: 'Research completed — ready for Decision Maker Research', timestamp: isCompleted ? research.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): ResearchStage {
    return 'loading_company';
  }

  /**
   * Get mock company data by index.
   */
  getMockCompany(index: number): MockCompanyResearch {
    return MOCK_COMPANIES[index] ?? MOCK_COMPANIES[0];
  }
}

// Singleton instance
export const companyResearchService = new CompanyResearchService();
export { RESEARCH_STAGES };
