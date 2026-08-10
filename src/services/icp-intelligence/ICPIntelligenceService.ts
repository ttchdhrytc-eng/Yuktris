// ============================================================
// ICPIntelligenceService — Architecture
// ============================================================
//
// Main orchestrator for the ICP Intelligence Agent.
// Runs after both the Business Intelligence Agent and
// Market Intelligence Agent complete.
//
// Generates multiple ICPs with company profiles, decision
// makers, pain points, goals, buying triggers, negative
// filters, and sales navigator filters.
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - icps
//   - icp_company_profile
//   - icp_decision_makers
//   - icp_pain_points
//   - icp_goals
//   - icp_buying_triggers
//   - icp_negative_filters
//   - sales_navigator_filters

import { supabase } from '@/lib/supabase';
import type {
  ICP,
  FullICP,
  ICPStage,
  ICPTimelineEvent,
  ICPCompanyProfile,
  ICPDecisionMaker,
  ICPPainPoint,
  ICPGoal,
  ICPBuyingTrigger,
  ICPNegativeFilter,
  SalesNavigatorFilters,
  ICPRecommendations,
  ICPGenerationResult,
} from '@/types/icp-intelligence';
import {
  ICP_STAGES,
  MOCK_ICPS,
  MOCK_ICP_PROFILES,
  MOCK_ICP_DECISION_MAKERS,
  MOCK_ICP_PAIN_POINTS,
  MOCK_ICP_GOALS,
  MOCK_ICP_TRIGGERS,
  MOCK_ICP_NEGATIVE_FILTERS,
  MOCK_ICP_SALES_NAV,
  MOCK_RECOMMENDATIONS,
} from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class ICPIntelligenceService {
  /**
   * Generate a single ICP (placeholder).
   * Will use OpenAIService.generateICP() when implemented.
   */
  async generateICP(_businessSummary: string, _marketSummary: string): Promise<unknown> {
    throw new Error('ICPIntelligenceService.generateICP() not implemented — use generateMultipleICPs()');
  }

  /**
   * Generate multiple ICPs from BI + MI data.
   * Returns mock ICP definitions (without DB ids).
   */
  async generateMultipleICPs(): Promise<typeof MOCK_ICPS> {
    return MOCK_ICPS;
  }

  /**
   * Score an ICP by opportunity, competition, and revenue.
   * Placeholder — will use OpenAIService.scoreICP() when implemented.
   */
  async scoreICP(icpIndex: number): Promise<{
    confidence: number;
    opportunityScore: number;
    competitionScore: number;
    revenueScore: number;
    conversionRate: number;
  }> {
    const icp = MOCK_ICPS[icpIndex] ?? MOCK_ICPS[0];
    return {
      confidence: icp.confidence,
      opportunityScore: icp.opportunity_score,
      competitionScore: icp.competition_score,
      revenueScore: icp.revenue_score,
      conversionRate: icp.conversion_rate,
    };
  }

  /**
   * Generate decision makers for an ICP.
   * Placeholder — will use OpenAIService.generateBuyerPersona() when implemented.
   */
  async generateDecisionMakers(icpIndex: number): Promise<Omit<ICPDecisionMaker, 'id' | 'icp_id' | 'created_at'>[]> {
    return MOCK_ICP_DECISION_MAKERS[icpIndex] ?? MOCK_ICP_DECISION_MAKERS[0];
  }

  /**
   * Generate pain points for an ICP.
   * Placeholder — will use OpenAIService.generatePainPoints() when implemented.
   */
  async generatePainPoints(icpIndex: number): Promise<Omit<ICPPainPoint, 'id' | 'icp_id' | 'created_at'>[]> {
    return MOCK_ICP_PAIN_POINTS[icpIndex] ?? MOCK_ICP_PAIN_POINTS[0];
  }

  /**
   * Generate goals for an ICP.
   * Placeholder — will use OpenAIService.generateGoals() when implemented.
   */
  async generateGoals(icpIndex: number): Promise<Omit<ICPGoal, 'id' | 'icp_id' | 'created_at'>[]> {
    return MOCK_ICP_GOALS[icpIndex] ?? MOCK_ICP_GOALS[0];
  }

  /**
   * Generate buying triggers for an ICP.
   * Placeholder — will use OpenAIService.generateTriggers() when implemented.
   */
  async generateBuyingTriggers(icpIndex: number): Promise<Omit<ICPBuyingTrigger, 'id' | 'icp_id' | 'created_at'>[]> {
    return MOCK_ICP_TRIGGERS[icpIndex] ?? MOCK_ICP_TRIGGERS[0];
  }

  /**
   * Generate negative ICP filters for an ICP.
   */
  async generateNegativeICP(icpIndex: number): Promise<Omit<ICPNegativeFilter, 'id' | 'icp_id' | 'created_at'>[]> {
    return MOCK_ICP_NEGATIVE_FILTERS[icpIndex] ?? MOCK_ICP_NEGATIVE_FILTERS[0];
  }

  /**
   * Generate Sales Navigator filters for an ICP.
   * Placeholder — will use OpenAIService.generateSalesNavigatorFilters() when implemented.
   */
  async generateSalesNavigatorFilters(icpIndex: number): Promise<Omit<SalesNavigatorFilters, 'id' | 'icp_id' | 'created_at'>> {
    return MOCK_ICP_SALES_NAV[icpIndex] ?? MOCK_ICP_SALES_NAV[0];
  }

  /**
   * Rank ICPs by composite score.
   */
  async rankICPs(): Promise<number[]> {
    const scored = MOCK_ICPS.map((icp, i) => ({
      index: i,
      score: icp.opportunity_score * 0.4 + icp.revenue_score * 0.3 + icp.confidence * 0.3,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((s) => s.index);
  }

  /**
   * Generate recommendations across all ICPs.
   * Placeholder — will use OpenAIService.generateRecommendations() when implemented.
   */
  async generateRecommendations(): Promise<ICPRecommendations> {
    return MOCK_RECOMMENDATIONS;
  }

  /**
   * Save a complete ICP (with all child records) to the database.
   */
  async saveICP(
    workspaceId: string,
    businessAnalysisId: string | null,
    marketAnalysisId: string | null,
    icpIndex: number,
    companyName?: string | null,
  ): Promise<string> {
    const mockICP = MOCK_ICPS[icpIndex] ?? MOCK_ICPS[0];

    // Insert ICP record
    const { data: icpRow, error: icpError } = await supabase
      .from('icps')
      .insert({
        workspace_id: workspaceId,
        business_analysis_id: businessAnalysisId,
        market_analysis_id: marketAnalysisId,
        company_name: companyName ?? null,
        name: mockICP.name,
        description: mockICP.description,
        priority: mockICP.priority,
        confidence: mockICP.confidence,
        opportunity_score: mockICP.opportunity_score,
        competition_score: mockICP.competition_score,
        revenue_score: mockICP.revenue_score,
        conversion_rate: mockICP.conversion_rate,
        estimated_deal_size: mockICP.estimated_deal_size,
        status: 'completed',
      })
      .select('*')
      .single();

    if (icpError) throw new Error(icpError.message);
    const icpId = (icpRow as ICP).id;

    // Insert company profile
    const profile = MOCK_ICP_PROFILES[icpIndex] ?? MOCK_ICP_PROFILES[0];
    const { error: profileError } = await supabase.from('icp_company_profile').insert({
      ...profile,
      icp_id: icpId,
    });
    if (profileError) throw new Error(profileError.message);

    // Insert decision makers
    const dms = MOCK_ICP_DECISION_MAKERS[icpIndex] ?? MOCK_ICP_DECISION_MAKERS[0];
    if (dms.length > 0) {
      const { error } = await supabase.from('icp_decision_makers').insert(
        dms.map((dm) => ({ ...dm, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert pain points
    const pains = MOCK_ICP_PAIN_POINTS[icpIndex] ?? MOCK_ICP_PAIN_POINTS[0];
    if (pains.length > 0) {
      const { error } = await supabase.from('icp_pain_points').insert(
        pains.map((p) => ({ ...p, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert goals
    const goals = MOCK_ICP_GOALS[icpIndex] ?? MOCK_ICP_GOALS[0];
    if (goals.length > 0) {
      const { error } = await supabase.from('icp_goals').insert(
        goals.map((g) => ({ ...g, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert buying triggers
    const triggers = MOCK_ICP_TRIGGERS[icpIndex] ?? MOCK_ICP_TRIGGERS[0];
    if (triggers.length > 0) {
      const { error } = await supabase.from('icp_buying_triggers').insert(
        triggers.map((t) => ({ ...t, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert negative filters
    const negatives = MOCK_ICP_NEGATIVE_FILTERS[icpIndex] ?? MOCK_ICP_NEGATIVE_FILTERS[0];
    if (negatives.length > 0) {
      const { error } = await supabase.from('icp_negative_filters').insert(
        negatives.map((n) => ({ ...n, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert sales navigator filters
    const salesNav = MOCK_ICP_SALES_NAV[icpIndex] ?? MOCK_ICP_SALES_NAV[0];
    const { error: salesNavError } = await supabase.from('sales_navigator_filters').insert({
      ...salesNav,
      icp_id: icpId,
    });
    if (salesNavError) throw new Error(salesNavError.message);

    return icpId;
  }

  /**
   * Load a complete ICP (with all child records) from the database.
   */
  async loadICP(icpId: string): Promise<FullICP | null> {
    const { data: icp, error } = await supabase
      .from('icps')
      .select('*')
      .eq('id', icpId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!icp) return null;

    const [profile, decisionMakers, painPoints, goals, triggers, negativeFilters, salesNav] = await Promise.all([
      supabase.from('icp_company_profile').select('*').eq('icp_id', icpId).maybeSingle(),
      supabase.from('icp_decision_makers').select('*').eq('icp_id', icpId).order('authority_score', { ascending: false }),
      supabase.from('icp_pain_points').select('*').eq('icp_id', icpId).order('severity', { ascending: false }),
      supabase.from('icp_goals').select('*').eq('icp_id', icpId).order('priority', { ascending: false }),
      supabase.from('icp_buying_triggers').select('*').eq('icp_id', icpId).order('confidence', { ascending: false }),
      supabase.from('icp_negative_filters').select('*').eq('icp_id', icpId),
      supabase.from('sales_navigator_filters').select('*').eq('icp_id', icpId).maybeSingle(),
    ]);

    return {
      ...(icp as ICP),
      company_profile: (profile.data as ICPCompanyProfile | null) ?? null,
      decision_makers: (decisionMakers.data ?? []) as ICPDecisionMaker[],
      pain_points: (painPoints.data ?? []) as ICPPainPoint[],
      goals: (goals.data ?? []) as ICPGoal[],
      buying_triggers: (triggers.data ?? []) as ICPBuyingTrigger[],
      negative_filters: (negativeFilters.data ?? []) as ICPNegativeFilter[],
      sales_navigator_filters: (salesNav.data as SalesNavigatorFilters | null) ?? null,
    };
  }

  /**
   * Load all ICPs for a workspace.
   */
  async loadAllICPs(workspaceId: string, companyName?: string | null): Promise<FullICP[]> {
    let query = supabase
      .from('icps')
      .select('*')
      .eq('workspace_id', workspaceId);

    if (companyName) {
      query = query.eq('company_name', companyName);
    }

    const { data: icpRows, error } = await query
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!icpRows || icpRows.length === 0) return [];

    const fullICPs = await Promise.all(
      (icpRows as ICP[]).map((icp) => this.loadICP(icp.id)),
    );

    return fullICPs.filter((icp): icp is FullICP => icp !== null);
  }

  /**
   * Refresh an ICP (re-run generation).
   */
  async refreshICP(icpId: string): Promise<void> {
    // Delete all child records
    await Promise.all([
      supabase.from('icp_company_profile').delete().eq('icp_id', icpId),
      supabase.from('icp_decision_makers').delete().eq('icp_id', icpId),
      supabase.from('icp_pain_points').delete().eq('icp_id', icpId),
      supabase.from('icp_goals').delete().eq('icp_id', icpId),
      supabase.from('icp_buying_triggers').delete().eq('icp_id', icpId),
      supabase.from('icp_negative_filters').delete().eq('icp_id', icpId),
      supabase.from('sales_navigator_filters').delete().eq('icp_id', icpId),
    ]);

    // Update status to processing
    const { error } = await supabase
      .from('icps')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('id', icpId);

    if (error) throw new Error(error.message);
  }

  /**
   * Delete an ICP (cascades to all child tables).
   */
  async deleteICP(icpId: string): Promise<void> {
    const { error } = await supabase.from('icps').delete().eq('id', icpId);
    if (error) throw new Error(error.message);
  }

  /**
   * Set an ICP as primary (demotes all other ICPs in the workspace).
   */
  async setPrimaryICP(icpId: string, workspaceId: string): Promise<void> {
    // Demote all other ICPs
    const { error: demoteError } = await supabase
      .from('icps')
      .update({ priority: 'secondary', updated_at: new Date().toISOString() })
      .eq('workspace_id', workspaceId)
      .neq('id', icpId);

    if (demoteError) throw new Error(demoteError.message);

    // Promote the selected ICP
    const { error: promoteError } = await supabase
      .from('icps')
      .update({ priority: 'primary', updated_at: new Date().toISOString() })
      .eq('id', icpId);

    if (promoteError) throw new Error(promoteError.message);
  }

  /**
   * Generate the full pipeline result (all ICPs + recommendations).
   */
  async generateFullPipeline(workspaceId: string, businessAnalysisId: string | null, marketAnalysisId: string | null, companyName?: string | null): Promise<ICPGenerationResult> {
    const icpIds: string[] = [];

    for (let i = 0; i < MOCK_ICPS.length; i++) {
      const icpId = await this.saveICP(workspaceId, businessAnalysisId, marketAnalysisId, i, companyName);
      icpIds.push(icpId);
    }

    const fullICPs = await Promise.all(icpIds.map((id) => this.loadICP(id)));
    const recommendations = await this.generateRecommendations();

    return {
      icps: fullICPs.filter((icp): icp is FullICP => icp !== null),
      recommendations,
    };
  }

  /**
   * Generate timeline events for the ICP generation workflow.
   */
  getTimelineEvents(icps: ICP[]): ICPTimelineEvent[] {
    const hasCompleted = icps.some((icp) => icp.status === 'completed');
    const hasProcessing = icps.some((icp) => icp.status === 'processing' || icp.status === 'queued');
    const firstCreatedAt = icps[0]?.created_at ?? null;
    const lastUpdatedAt = icps[icps.length - 1]?.updated_at ?? null;

    return [
      { id: 'business_analysis', label: 'Business Analysis', description: 'BI Agent completed website analysis', timestamp: firstCreatedAt, completed: true },
      { id: 'market_analysis', label: 'Market Analysis', description: 'MI Agent completed market research', timestamp: firstCreatedAt, completed: true },
      { id: 'icp_generation', label: 'ICP Generation', description: 'Generating multiple Ideal Customer Profiles', timestamp: firstCreatedAt, completed: !hasProcessing },
      { id: 'validation', label: 'Validation & Scoring', description: 'Scoring and ranking ICPs by opportunity', timestamp: hasProcessing ? null : lastUpdatedAt, completed: hasCompleted },
      { id: 'recommendations', label: 'Recommendations', description: 'GTM strategy and messaging generated', timestamp: hasCompleted ? lastUpdatedAt : null, completed: hasCompleted },
      { id: 'completed', label: 'Ready for Prospecting', description: 'ICPs ready for Sales Navigator and campaigns', timestamp: hasCompleted ? lastUpdatedAt : null, completed: hasCompleted },
    ];
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): ICPStage {
    return 'reading_business';
  }
}

// Singleton instance
export const icpService = new ICPIntelligenceService();
export { ICP_STAGES };
