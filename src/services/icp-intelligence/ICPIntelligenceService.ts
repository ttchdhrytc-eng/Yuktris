// ============================================================
// ICPIntelligenceService — Architecture
// ============================================================
//
// Main orchestrator for the ICP Intelligence Agent.
// Generates ICPs from the workspace's persisted business and
// market research (business_analysis / business_insights /
// market_analysis) via icp_generation_agent (real AI Gateway
// call, structured + validated), then persists the result.
//
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
import { agentOrchestrator } from '@/services/agents';
import { biService } from '@/services/business-intelligence';
import { miService } from '@/services/market-intelligence';
import { validateGeneratedICPs, type GeneratedICP } from './icpValidation';
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
import { ICP_STAGES } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class ICPIntelligenceService {
  /**
   * Load the workspace's persisted business + market research and build the
   * context objects the ICP generation agent needs. Throws if business
   * research has not completed yet — there is no mock substitute for it.
   */
  private async loadResearchContext(
    workspaceId: string,
    companyName?: string | null,
  ): Promise<{ businessSummary: Record<string, unknown>; marketSummary: Record<string, unknown>; businessAnalysisId: string | null; marketAnalysisId: string | null }> {
    const businessAnalysis = await biService.loadLatestAnalysis(workspaceId, companyName);
    if (!businessAnalysis || businessAnalysis.analysis_status !== 'completed') {
      throw new Error('Business analysis must complete before ICPs can be generated.');
    }

    const marketAnalysis = await miService.loadLatestAnalysis(workspaceId, companyName).catch(() => null);

    const businessSummary: Record<string, unknown> = {
      company_name: businessAnalysis.company_name,
      industry: businessAnalysis.industry,
      country: businessAnalysis.country,
      description: businessAnalysis.description,
      business_model: businessAnalysis.business_model,
      products: businessAnalysis.products,
      services: businessAnalysis.services,
      pricing_model: businessAnalysis.pricing_model,
      target_audience: businessAnalysis.target_audience,
      usp: businessAnalysis.usp,
      customer_problems: businessAnalysis.customer_problems,
      business_goals: businessAnalysis.business_goals,
      revenue_model: businessAnalysis.revenue_model,
      competitive_position: businessAnalysis.competitive_position,
      insights: businessAnalysis.insights
        ? {
            strengths: businessAnalysis.insights.strengths,
            weaknesses: businessAnalysis.insights.weaknesses,
            opportunities: businessAnalysis.insights.opportunities,
            risks: businessAnalysis.insights.risks,
            executive_summary: businessAnalysis.insights.executive_summary,
          }
        : null,
    };

    const marketSummary: Record<string, unknown> = marketAnalysis
      ? {
          market_size: marketAnalysis.market_size,
          growth_score: marketAnalysis.growth_score,
          competition_score: marketAnalysis.competition_score,
          opportunity_score: marketAnalysis.opportunity_score,
          recommended_strategy: marketAnalysis.recommended_strategy,
          executive_summary: marketAnalysis.executive_summary,
        }
      : {};

    return {
      businessSummary,
      marketSummary,
      businessAnalysisId: businessAnalysis.id,
      marketAnalysisId: marketAnalysis?.id ?? null,
    };
  }

  /**
   * Generate 1-3 ICPs from business/market research context via the real
   * icp_generation_agent (AI Gateway). Throws a retryable error on failure
   * or invalid model output \u2014 never falls back to mock data.
   */
  async generateICPs(params: {
    workspaceId: string;
    businessSummary: Record<string, unknown>;
    marketSummary?: Record<string, unknown>;
    companyName?: string | null;
  }): Promise<GeneratedICP[]> {
    const result = await agentOrchestrator.executeAgent({
      agentName: 'icp_generation_agent',
      input: {
        business_summary: params.businessSummary,
        market_summary: params.marketSummary ?? {},
        company_name: params.companyName ?? '',
      },
      workspaceId: params.workspaceId,
      timeoutMs: 60_000,
    });

    if (result.status !== 'completed') {
      throw new Error(result.error ?? 'ICP generation failed');
    }

    // Defense in depth: re-validate even though the agent already validates
    // its own output before returning `completed`.
    const validation = validateGeneratedICPs(result.output as Record<string, unknown>);
    if (!validation.valid) {
      throw new Error(`ICP generation returned invalid data: ${validation.errors.join('; ')}`);
    }
    return validation.icps;
  }


  /**
   * Persist a single AI-generated ICP (with all child records) to the database.
   */
  async persistGeneratedICP(
    workspaceId: string,
    businessAnalysisId: string | null,
    marketAnalysisId: string | null,
    generated: GeneratedICP,
    companyName?: string | null,
  ): Promise<string> {
    // Insert ICP record
    const { data: icpRow, error: icpError } = await supabase
      .from('icps')
      .insert({
        workspace_id: workspaceId,
        business_analysis_id: businessAnalysisId,
        market_analysis_id: marketAnalysisId,
        company_name: companyName ?? null,
        name: generated.name,
        description: generated.description,
        priority: generated.priority,
        confidence: generated.confidence,
        opportunity_score: generated.opportunity_score,
        competition_score: generated.competition_score,
        revenue_score: generated.revenue_score,
        conversion_rate: generated.conversion_rate,
        estimated_deal_size: generated.estimated_deal_size,
        status: 'completed',
      })
      .select('*')
      .single();

    if (icpError) throw new Error(icpError.message);
    const icpId = (icpRow as ICP).id;

    // Insert company profile
    const { error: profileError } = await supabase.from('icp_company_profile').insert({
      ...generated.company_profile,
      icp_id: icpId,
    });
    if (profileError) throw new Error(profileError.message);

    // Insert decision makers
    const dms = generated.decision_makers;
    if (dms.length > 0) {
      const { error } = await supabase.from('icp_decision_makers').insert(
        dms.map((dm) => ({ ...dm, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert pain points
    const pains = generated.pain_points;
    if (pains.length > 0) {
      const { error } = await supabase.from('icp_pain_points').insert(
        pains.map((p) => ({ ...p, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert goals
    const goals = generated.goals;
    if (goals.length > 0) {
      const { error } = await supabase.from('icp_goals').insert(
        goals.map((g) => ({ ...g, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert buying triggers
    const triggers = generated.buying_triggers;
    if (triggers.length > 0) {
      const { error } = await supabase.from('icp_buying_triggers').insert(
        triggers.map((t) => ({ ...t, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert negative filters
    const negatives = generated.negative_filters;
    if (negatives.length > 0) {
      const { error } = await supabase.from('icp_negative_filters').insert(
        negatives.map((n) => ({ ...n, icp_id: icpId })),
      );
      if (error) throw new Error(error.message);
    }

    // Insert sales navigator filters
    const { error: salesNavError } = await supabase.from('sales_navigator_filters').insert({
      ...generated.sales_navigator_filters,
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
   * Run the full ICP generation pipeline: load persisted business/market
   * research as primary context, generate ICPs via icp_generation_agent,
   * validate, and persist. Throws a retryable error on any failure —
   * never falls back to mock data.
   */
  async generateFullPipeline(workspaceId: string, companyName?: string | null): Promise<ICPGenerationResult> {
    const { businessSummary, marketSummary, businessAnalysisId, marketAnalysisId } =
      await this.loadResearchContext(workspaceId, companyName);

    const generatedICPs = await this.generateICPs({
      workspaceId,
      businessSummary,
      marketSummary,
      companyName,
    });

    const icpIds: string[] = [];
    for (const generated of generatedICPs) {
      const icpId = await this.persistGeneratedICP(workspaceId, businessAnalysisId, marketAnalysisId, generated, companyName);
      icpIds.push(icpId);
    }

    const fullICPs = (await Promise.all(icpIds.map((id) => this.loadICP(id))))
      .filter((icp): icp is FullICP => icp !== null);

    return {
      icps: fullICPs,
      recommendations: buildRecommendations(fullICPs),
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

/**
 * Derives a recommendations summary directly from the generated (real) ICPs
 * — no separate AI call, no mock constant.
 */
function buildRecommendations(icps: FullICP[]): ICPRecommendations {
  if (icps.length === 0) {
    return {
      executive_summary: 'No ICPs were generated.',
      primary_icp: '',
      secondary_icps: [],
      priority_order: [],
      sales_strategy: '',
      recommended_messaging: '',
      estimated_pipeline: '',
    };
  }

  const ranked = [...icps].sort((a, b) => {
    const scoreA = a.opportunity_score * 0.4 + a.revenue_score * 0.3 + a.confidence * 0.3;
    const scoreB = b.opportunity_score * 0.4 + b.revenue_score * 0.3 + b.confidence * 0.3;
    return scoreB - scoreA;
  });

  const primary = ranked[0];
  const secondary = ranked.slice(1);
  const topPainPoint = primary.pain_points[0]?.pain_point;
  const topTrigger = primary.buying_triggers[0]?.trigger;

  return {
    executive_summary: `${primary.name} is the highest-scoring ICP (opportunity ${primary.opportunity_score}, revenue ${primary.revenue_score}, confidence ${primary.confidence}) out of ${icps.length} generated profile(s).`,
    primary_icp: primary.name,
    secondary_icps: secondary.map((icp) => icp.name),
    priority_order: ranked.map((icp) => icp.name),
    sales_strategy: topTrigger
      ? `Prioritize outreach when "${topTrigger}" is observed; lead with the pain point "${topPainPoint ?? 'identified in research'}".`
      : `Lead with the pain point "${topPainPoint ?? 'identified in research'}".`,
    recommended_messaging: primary.description ?? primary.name,
    estimated_pipeline: primary.estimated_deal_size ?? 'Not estimated',
  };
}
