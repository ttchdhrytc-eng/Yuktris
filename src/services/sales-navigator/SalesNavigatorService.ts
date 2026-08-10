// ============================================================
// SalesNavigatorService — Architecture
// ============================================================
//
// Main orchestrator for the Sales Navigator Intelligence Agent.
// Runs after the Business Intelligence, Market Intelligence,
// ICP Intelligence, and Prospect Discovery agents complete.
//
// Generates Sales Navigator search strategies from ICPs and
// discovered companies. Creates company filters, lead filters,
// boolean queries, and recommendations.
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - sales_navigator_searches
//   - company_filters
//   - lead_filters
//   - search_templates

import { supabase } from '@/lib/supabase';
import type {
  SNSearch,
  CompanyFilters,
  LeadFilters,
  SearchTemplate,
  FullSNSearch,
  SNStage,
  SNTimelineEvent,
  SearchQuality,
  SNRecommendations,
  ExportConfig,
  ExportFormat,
  ValidationResult,
} from '@/types/sales-navigator';
import {
  SN_STAGES,
  MOCK_SEARCHES,
  MOCK_COMPANY_FILTERS,
  MOCK_LEAD_FILTERS,
  MOCK_QUALITY,
  MOCK_RECOMMENDATIONS,
  MOCK_TEMPLATES,
} from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class SalesNavigatorService {
  /**
   * Generate a complete Sales Navigator search strategy.
   * Placeholder — will use OpenAIService + TavilyService when implemented.
   */
  async generateSearch(): Promise<unknown> {
    throw new Error('SalesNavigatorService.generateSearch() not implemented — use saveSearch()');
  }

  /**
   * Generate company-level filters from ICP data.
   * Placeholder — will use OpenAIService.optimizeFilters() when implemented.
   */
  async generateCompanyFilters(icpIndex: number): Promise<Omit<CompanyFilters, 'id' | 'search_id' | 'created_at'>> {
    return MOCK_COMPANY_FILTERS[icpIndex] ?? MOCK_COMPANY_FILTERS[0];
  }

  /**
   * Generate lead-level filters from ICP data.
   * Placeholder — will use OpenAIService.recommendTitles() when implemented.
   */
  async generateLeadFilters(icpIndex: number): Promise<Omit<LeadFilters, 'id' | 'search_id' | 'created_at'>> {
    return MOCK_LEAD_FILTERS[icpIndex] ?? MOCK_LEAD_FILTERS[0];
  }

  /**
   * Generate a boolean search query from keywords.
   * Placeholder — will use OpenAIService.generateBoolean() when implemented.
   */
  async generateBooleanQuery(keywords: string[], negativeKeywords: string[], industry: string[], companySize: string[]): Promise<string> {
    const pos = keywords.map((k) => `keyword:"${k}"`).join(' OR ');
    const neg = negativeKeywords.map((k) => `keyword:"${k}"`).join(' OR ');
    const ind = industry.map((i) => `industry:"${i}"`).join(' OR ');
    const size = companySize.map((s) => `company_size:"${s}"`).join(' OR ');
    let query = `(${ind}) AND (${size})`;
    if (pos) query += ` AND (${pos})`;
    if (neg) query += ` NOT (${neg})`;
    return query;
  }

  /**
   * Optimize search filters for maximum coverage.
   * Placeholder — will use OpenAIService.optimizeFilters() when implemented.
   */
  async optimizeSearch(icpIndex: number): Promise<{ filters: typeof MOCK_COMPANY_FILTERS[0]; changes: string[] }> {
    return {
      filters: MOCK_COMPANY_FILTERS[icpIndex] ?? MOCK_COMPANY_FILTERS[0],
      changes: ['Added "Gong" to technology filters', 'Enabled Open Profile for lead filters'],
    };
  }

  /**
   * Validate a search strategy.
   * Placeholder — will use LinkedInSNService.validateFilters() when implemented.
   */
  async validateSearch(_companyFilters: unknown, _leadFilters: unknown): Promise<ValidationResult> {
    return {
      valid: true,
      errors: [],
      warnings: ['Consider adding more job titles for broader coverage'],
    };
  }

  /**
   * Estimate search coverage and quality.
   * Placeholder — will use OpenAIService when implemented.
   */
  async estimateSearchCoverage(icpIndex: number): Promise<SearchQuality> {
    return MOCK_QUALITY[icpIndex] ?? MOCK_QUALITY[0];
  }

  /**
   * Estimate the number of search results.
   */
  async estimateSearchResults(icpIndex: number): Promise<string> {
    return (MOCK_QUALITY[icpIndex] ?? MOCK_QUALITY[0]).estimated_result_count;
  }

  /**
   * Generate AI-powered recommendations for search improvement.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateRecommendations(): Promise<SNRecommendations> {
    return MOCK_RECOMMENDATIONS;
  }

  /**
   * Save a search template for reuse.
   */
  async saveTemplate(workspaceId: string, name: string, description: string, templateJson: Record<string, unknown>): Promise<SearchTemplate> {
    const { data, error } = await supabase
      .from('search_templates')
      .insert({
        workspace_id: workspaceId,
        template_name: name,
        description,
        template_json: templateJson,
        is_default: false,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as SearchTemplate;
  }

  /**
   * Load a template by ID.
   */
  async loadTemplate(templateId: string): Promise<SearchTemplate | null> {
    const { data, error } = await supabase
      .from('search_templates')
      .select('*')
      .eq('id', templateId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as SearchTemplate | null;
  }

  /**
   * Load all templates for a workspace.
   */
  async loadTemplates(workspaceId: string): Promise<SearchTemplate[]> {
    const { data, error } = await supabase
      .from('search_templates')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []) as SearchTemplate[];
  }

  /**
   * Delete a template.
   */
  async deleteTemplate(templateId: string): Promise<void> {
    const { error } = await supabase.from('search_templates').delete().eq('id', templateId);
    if (error) throw new Error(error.message);
  }

  /**
   * Save a complete search strategy (with company + lead filters) to the database.
   */
  async saveSearch(
    workspaceId: string,
    icpId: string | null,
    discoveryId: string | null,
    searchIndex: number,
  ): Promise<string> {
    const mockSearch = MOCK_SEARCHES[searchIndex] ?? MOCK_SEARCHES[0];

    // Insert search record
    const { data: searchRow, error: searchError } = await supabase
      .from('sales_navigator_searches')
      .insert({
        workspace_id: workspaceId,
        icp_id: icpId,
        discovery_id: discoveryId,
        name: mockSearch.name,
        description: mockSearch.description,
        status: 'completed',
        search_type: mockSearch.search_type,
        quality_score: mockSearch.quality_score,
        coverage_score: mockSearch.coverage_score,
      })
      .select('*')
      .single();

    if (searchError) throw new Error(searchError.message);
    const searchId = (searchRow as SNSearch).id;

    // Insert company filters
    const companyFilters = MOCK_COMPANY_FILTERS[searchIndex] ?? MOCK_COMPANY_FILTERS[0];
    const { error: cfError } = await supabase.from('company_filters').insert({
      ...companyFilters,
      search_id: searchId,
    });
    if (cfError) throw new Error(cfError.message);

    // Insert lead filters
    const leadFilters = MOCK_LEAD_FILTERS[searchIndex] ?? MOCK_LEAD_FILTERS[0];
    const { error: lfError } = await supabase.from('lead_filters').insert({
      ...leadFilters,
      search_id: searchId,
    });
    if (lfError) throw new Error(lfError.message);

    return searchId;
  }

  /**
   * Load a complete search strategy from the database.
   */
  async loadSearch(searchId: string): Promise<FullSNSearch | null> {
    const { data: search, error } = await supabase
      .from('sales_navigator_searches')
      .select('*')
      .eq('id', searchId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!search) return null;

    const [cfRes, lfRes] = await Promise.all([
      supabase.from('company_filters').select('*').eq('search_id', searchId).maybeSingle(),
      supabase.from('lead_filters').select('*').eq('search_id', searchId).maybeSingle(),
    ]);

    return {
      ...(search as SNSearch),
      company_filters: (cfRes.data as CompanyFilters | null) ?? null,
      lead_filters: (lfRes.data as LeadFilters | null) ?? null,
    };
  }

  /**
   * Load the latest search for a workspace.
   */
  async loadLatestSearch(workspaceId: string): Promise<FullSNSearch | null> {
    const { data, error } = await supabase
      .from('sales_navigator_searches')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadSearch((data as SNSearch).id);
  }

  /**
   * Load all searches for a workspace.
   */
  async loadAllSearches(workspaceId: string): Promise<FullSNSearch[]> {
    const { data: rows, error } = await supabase
      .from('sales_navigator_searches')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const fullSearches = await Promise.all(
      (rows as SNSearch[]).map((s) => this.loadSearch(s.id)),
    );
    return fullSearches.filter((s): s is FullSNSearch => s !== null);
  }

  /**
   * Refresh an existing search strategy.
   */
  async refreshSearch(searchId: string): Promise<void> {
    await Promise.all([
      supabase.from('company_filters').delete().eq('search_id', searchId),
      supabase.from('lead_filters').delete().eq('search_id', searchId),
    ]);

    const { error } = await supabase
      .from('sales_navigator_searches')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', searchId);

    if (error) throw new Error(error.message);
  }

  /**
   * Delete a search strategy (cascades to filters).
   */
  async deleteSearch(searchId: string): Promise<void> {
    const { error } = await supabase.from('sales_navigator_searches').delete().eq('id', searchId);
    if (error) throw new Error(error.message);
  }

  /**
   * Export search configuration in various formats.
   */
  exportConfiguration(search: FullSNSearch, format: ExportFormat): ExportConfig {
    const data = {
      name: search.name,
      description: search.description,
      search_type: search.search_type,
      quality_score: search.quality_score,
      coverage_score: search.coverage_score,
      company_filters: search.company_filters,
      lead_filters: search.lead_filters,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `sn-search-${search.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows = [
          ['Field', 'Value'],
          ['Name', search.name],
          ['Search Type', search.search_type],
          ['Quality Score', String(search.quality_score)],
          ['Coverage Score', String(search.coverage_score)],
          ['Industries', (search.company_filters?.industry ?? []).join('; ')],
          ['Company Sizes', (search.company_filters?.company_size ?? []).join('; ')],
          ['Countries', (search.company_filters?.country ?? []).join('; ')],
          ['Technologies', (search.company_filters?.technology ?? []).join('; ')],
          ['Job Titles', (search.lead_filters?.job_titles ?? []).join('; ')],
          ['Departments', (search.lead_filters?.departments ?? []).join('; ')],
          ['Boolean Query', search.company_filters?.boolean_query ?? ''],
        ];
        const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
        return { format, data: csv, filename: `sn-search-${search.id.slice(0, 8)}.csv` };
      }
      case 'config':
        return { format, data: JSON.stringify(data, null, 2), filename: `sn-config-${search.id.slice(0, 8)}.json` };
      case 'api_payload': {
        const payload = {
          search_type: search.search_type,
          company_filters: {
            industry: search.company_filters?.industry ?? [],
            company_size: search.company_filters?.company_size ?? [],
            revenue: search.company_filters?.revenue ?? [],
            geography: search.company_filters?.country ?? [],
            technology: search.company_filters?.technology ?? [],
            keywords: search.company_filters?.keywords ?? [],
            boolean_query: search.company_filters?.boolean_query ?? '',
          },
          lead_filters: {
            job_titles: search.lead_filters?.job_titles ?? [],
            departments: search.lead_filters?.departments ?? [],
            seniority: search.lead_filters?.seniority ?? [],
            geography: search.lead_filters?.location ?? [],
            years_in_role: search.lead_filters?.years_in_role ?? '',
            years_at_company: search.lead_filters?.years_at_company ?? '',
            open_profile: search.lead_filters?.open_profile ?? false,
            relationship: search.lead_filters?.relationship ?? [],
          },
        };
        return { format, data: JSON.stringify(payload, null, 2), filename: `sn-payload-${search.id.slice(0, 8)}.json` };
      }
    }
  }

  /**
   * Generate timeline events for the search generation workflow.
   */
  getTimelineEvents(search: SNSearch): SNTimelineEvent[] {
    const isCompleted = search.status === 'completed';

    return [
      { id: 'icp_loaded', label: 'ICP Loaded', description: 'Ideal Customer Profile loaded from ICP Intelligence Agent', timestamp: search.created_at, completed: true },
      { id: 'prospects_loaded', label: 'Prospects Loaded', description: 'Discovered companies loaded from Prospect Discovery Agent', timestamp: search.created_at, completed: true },
      { id: 'search_generated', label: 'Search Generated', description: 'Company and lead filters created from ICP data', timestamp: isCompleted ? search.updated_at : null, completed: isCompleted },
      { id: 'search_optimized', label: 'Search Optimized', description: 'Filters optimized for maximum coverage', timestamp: isCompleted ? search.updated_at : null, completed: isCompleted },
      { id: 'boolean_generated', label: 'Boolean Generated', description: 'Boolean search query created from keywords', timestamp: isCompleted ? search.updated_at : null, completed: isCompleted },
      { id: 'validation_completed', label: 'Validation Completed', description: 'Search strategy validated and quality scored', timestamp: isCompleted ? search.updated_at : null, completed: isCompleted },
      { id: 'ready_for_execution', label: 'Ready for Execution', description: 'Search strategy ready for LinkedIn Execution Agent', timestamp: isCompleted ? search.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): SNStage {
    return 'loading_icp';
  }

  /**
   * Seed default templates for a workspace if none exist.
   */
  async seedDefaultTemplates(workspaceId: string): Promise<void> {
    const existing = await this.loadTemplates(workspaceId);
    if (existing.length > 0) return;

    for (const tmpl of MOCK_TEMPLATES) {
      await this.saveTemplate(workspaceId, tmpl.template_name, tmpl.description ?? '', tmpl.template_json);
    }
  }
}

// Singleton instance
export const snService = new SalesNavigatorService();
export { SN_STAGES };
