// ============================================================
// ProspectDiscoveryService — Architecture
// ============================================================
//
// Main orchestrator for the Prospect Discovery Agent.
// Runs after the Business Intelligence, Market Intelligence,
// and ICP Intelligence agents complete.
//
// Discovers companies matching ICPs, scores them, ranks them,
// and generates recommendations.
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - prospect_discovery
//   - discovered_companies
//   - company_scores
//   - prospect_recommendations

import { supabase } from '@/lib/supabase';
import type {
  ProspectDiscovery,
  DiscoveredCompany,
  CompanyScore,
  ProspectRecommendation,
  CompanyWithScores,
  FullDiscoveryResult,
  DiscoveryRecommendations,
  DiscoveryStage,
  DiscoveryTimelineEvent,
  SearchParams,
} from '@/types/prospect-discovery';
import {
  MOCK_COMPANIES,
  MOCK_DISCOVERY_RECOMMENDATIONS,
  generateMockScores,
} from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class ProspectDiscoveryService {
  /**
   * Start a new discovery run for a workspace.
   * Links to an ICP if provided.
   */
  async startDiscovery(workspaceId: string, icpId: string | null): Promise<ProspectDiscovery> {
    const { data, error } = await supabase
      .from('prospect_discovery')
      .insert({
        workspace_id: workspaceId,
        icp_id: icpId,
        status: 'queued',
        total_found: 0,
        qualified_count: 0,
        high_priority_count: 0,
      })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return data as ProspectDiscovery;
  }

  /**
   * Load ICP data from the ICP Intelligence Agent.
   * Placeholder — will read from icps table when integrated.
   */
  async loadICP(icpId: string): Promise<unknown> {
    const { data, error } = await supabase
      .from('icps')
      .select('*')
      .eq('id', icpId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data;
  }

  /**
   * Discover companies matching ICP criteria.
   * Placeholder — will use TavilyService + ApolloService when implemented.
   */
  async discoverCompanies(_params: SearchParams): Promise<Omit<DiscoveredCompany, 'id' | 'discovery_id' | 'created_at'>[]> {
    return MOCK_COMPANIES;
  }

  /**
   * Filter companies based on ICP exclusion criteria.
   * Placeholder — applies basic filtering logic.
   */
  async filterCompanies(companies: Omit<DiscoveredCompany, 'id' | 'discovery_id' | 'created_at'>[]): Promise<Omit<DiscoveredCompany, 'id' | 'discovery_id' | 'created_at'>[]> {
    return companies.filter((c) => c.icp_match_score >= 60);
  }

  /**
   * Score companies by multiple dimensions.
   * Placeholder — will use OpenAIService.scoreCompanies() when implemented.
   */
  async scoreCompanies(companies: Omit<DiscoveredCompany, 'id' | 'discovery_id' | 'created_at'>[]): Promise<Omit<CompanyScore, 'id' | 'company_id' | 'created_at'>[]> {
    return companies.map((c) => generateMockScores(c));
  }

  /**
   * Calculate ICP match score for a company.
   * Placeholder — will use OpenAIService when implemented.
   */
  async calculateICPMatch(_company: unknown): Promise<number> {
    return Math.round(70 + Math.random() * 30);
  }

  /**
   * Calculate opportunity score for a company.
   * Placeholder — will use OpenAIService when implemented.
   */
  async calculateOpportunity(_company: unknown): Promise<number> {
    return Math.round(60 + Math.random() * 40);
  }

  /**
   * Rank companies by overall score.
   */
  async rankCompanies(companies: CompanyWithScores[]): Promise<CompanyWithScores[]> {
    return [...companies].sort((a, b) => {
      const aScore = a.scores?.overall_score ?? a.opportunity_score;
      const bScore = b.scores?.overall_score ?? b.opportunity_score;
      return bScore - aScore;
    });
  }

  /**
   * Generate recommendations for discovered companies.
   * Placeholder — will use OpenAIService.recommendCompanies() when implemented.
   */
  async generateRecommendations(): Promise<DiscoveryRecommendations> {
    return MOCK_DISCOVERY_RECOMMENDATIONS;
  }

  /**
   * Save discovered companies to the database.
   */
  async saveCompanies(
    discoveryId: string,
    companies: Omit<DiscoveredCompany, 'id' | 'discovery_id' | 'created_at'>[],
    scores: Omit<CompanyScore, 'id' | 'company_id' | 'created_at'>[],
    recommendations: Omit<ProspectRecommendation, 'id' | 'company_id' | 'created_at'>[],
  ): Promise<void> {
    // Insert companies
    const companyInserts = companies.map((c) => ({ ...c, discovery_id: discoveryId }));
    const { data: insertedCompanies, error: companyError } = await supabase
      .from('discovered_companies')
      .insert(companyInserts)
      .select('id');

    if (companyError) throw new Error(companyError.message);
    const companyIds = (insertedCompanies as { id: string }[]).map((c) => c.id);

    // Insert scores
    if (scores.length > 0 && companyIds.length === scores.length) {
      const scoreInserts = scores.map((s, i) => ({ ...s, company_id: companyIds[i] }));
      const { error: scoreError } = await supabase.from('company_scores').insert(scoreInserts);
      if (scoreError) throw new Error(scoreError.message);
    }

    // Insert recommendations
    if (recommendations.length > 0 && companyIds.length === recommendations.length) {
      const recInserts = recommendations.map((r, i) => ({ ...r, company_id: companyIds[i] }));
      const { error: recError } = await supabase.from('prospect_recommendations').insert(recInserts);
      if (recError) throw new Error(recError.message);
    }

    // Update discovery record with counts
    const qualifiedCount = companies.filter((c) => c.status === 'qualified').length;
    const highPriorityCount = companies.filter((c) => c.priority === 'high' || c.priority === 'critical').length;

    const { error: updateError } = await supabase
      .from('prospect_discovery')
      .update({
        status: 'completed',
        total_found: companies.length,
        qualified_count: qualifiedCount,
        high_priority_count: highPriorityCount,
        updated_at: new Date().toISOString(),
      })
      .eq('id', discoveryId);

    if (updateError) throw new Error(updateError.message);
  }

  /**
   * Refresh an existing discovery run.
   */
  async refreshDiscovery(discoveryId: string): Promise<void> {
    // Delete all child records
    const { data: companyIds } = await supabase
      .from('discovered_companies')
      .select('id')
      .eq('discovery_id', discoveryId);

    if (companyIds && companyIds.length > 0) {
      const ids = (companyIds as { id: string }[]).map((c) => c.id);
      await Promise.all([
        supabase.from('company_scores').delete().in('company_id', ids),
        supabase.from('prospect_recommendations').delete().in('company_id', ids),
      ]);
    }

    await supabase.from('discovered_companies').delete().eq('discovery_id', discoveryId);

    // Update status to processing
    const { error } = await supabase
      .from('prospect_discovery')
      .update({ status: 'processing', total_found: 0, qualified_count: 0, high_priority_count: 0, updated_at: new Date().toISOString() })
      .eq('id', discoveryId);

    if (error) throw new Error(error.message);
  }

  /**
   * Delete a discovery run (cascades to all child tables).
   */
  async deleteDiscovery(discoveryId: string): Promise<void> {
    const { error } = await supabase.from('prospect_discovery').delete().eq('id', discoveryId);
    if (error) throw new Error(error.message);
  }

  /**
   * Load a complete discovery result (with companies, scores, recommendations).
   */
  async loadDiscovery(discoveryId: string): Promise<FullDiscoveryResult | null> {
    const { data: discovery, error } = await supabase
      .from('prospect_discovery')
      .select('*')
      .eq('id', discoveryId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!discovery) return null;

    const { data: companies, error: companyError } = await supabase
      .from('discovered_companies')
      .select('*')
      .eq('discovery_id', discoveryId)
      .order('opportunity_score', { ascending: false });

    if (companyError) throw new Error(companyError.message);

    const companyList = (companies ?? []) as DiscoveredCompany[];
    const companyIds = companyList.map((c) => c.id);

    let scoresMap: Record<string, CompanyScore> = {};
    let recsMap: Record<string, ProspectRecommendation> = {};

    if (companyIds.length > 0) {
      const [scoresRes, recsRes] = await Promise.all([
        supabase.from('company_scores').select('*').in('company_id', companyIds),
        supabase.from('prospect_recommendations').select('*').in('company_id', companyIds),
      ]);

      if (scoresRes.data) {
        scoresMap = (scoresRes.data as CompanyScore[]).reduce((acc, s) => {
          acc[s.company_id] = s;
          return acc;
        }, {} as Record<string, CompanyScore>);
      }

      if (recsRes.data) {
        recsMap = (recsRes.data as ProspectRecommendation[]).reduce((acc, r) => {
          acc[r.company_id] = r;
          return acc;
        }, {} as Record<string, ProspectRecommendation>);
      }
    }

    const companiesWithScores: CompanyWithScores[] = companyList.map((c) => ({
      ...c,
      scores: scoresMap[c.id] ?? null,
      recommendation: recsMap[c.id] ?? null,
    }));

    return {
      ...(discovery as ProspectDiscovery),
      companies: companiesWithScores,
    };
  }

  /**
   * Load the latest discovery for a workspace.
   */
  async loadLatestDiscovery(workspaceId: string): Promise<FullDiscoveryResult | null> {
    const { data, error } = await supabase
      .from('prospect_discovery')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadDiscovery((data as ProspectDiscovery).id);
  }

  /**
   * Update a company status (e.g., save, ignore, research).
   */
  async updateCompanyStatus(companyId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('discovered_companies')
      .update({ status })
      .eq('id', companyId);

    if (error) throw new Error(error.message);
  }

  /**
   * Generate timeline events for the discovery workflow.
   */
  getTimelineEvents(discovery: ProspectDiscovery): DiscoveryTimelineEvent[] {
    const isCompleted = discovery.status === 'completed';
    const isProcessing = discovery.status === 'processing' || discovery.status === 'queued';

    return [
      { id: 'icp_loaded', label: 'ICP Loaded', description: 'Ideal Customer Profile loaded from ICP Intelligence Agent', timestamp: discovery.created_at, completed: true },
      { id: 'discovery_started', label: 'Discovery Started', description: 'Company search initiated across databases', timestamp: discovery.created_at, completed: !isProcessing || isCompleted },
      { id: 'companies_found', label: 'Companies Found', description: `${discovery.total_found} companies discovered`, timestamp: isCompleted ? discovery.updated_at : null, completed: isCompleted },
      { id: 'companies_scored', label: 'Companies Scored', description: 'Opportunity, growth, and ICP match scores calculated', timestamp: isCompleted ? discovery.updated_at : null, completed: isCompleted },
      { id: 'companies_ranked', label: 'Companies Ranked', description: 'Companies ranked by overall score and priority', timestamp: isCompleted ? discovery.updated_at : null, completed: isCompleted },
      { id: 'recommendations_generated', label: 'Recommendations Generated', description: 'AI recommendations created for top companies', timestamp: isCompleted ? discovery.updated_at : null, completed: isCompleted },
      { id: 'completed', label: 'Completed', description: 'Discovery results saved and ready for Company Research Agent', timestamp: isCompleted ? discovery.updated_at : null, completed: isCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): DiscoveryStage {
    return 'loading_icp';
  }
}

// Singleton instance
export const prospectDiscoveryService = new ProspectDiscoveryService();
