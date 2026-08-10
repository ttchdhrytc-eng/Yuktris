// ============================================================
// RevenueIntelligenceEngine — Central facade for all revenue intelligence
// ============================================================
//
// This is the single entry point for all AI agents requiring revenue
// intelligence. No agent should compute scores independently — they
// all route through this engine.
//
// Pipeline: Research Analysis → Knowledge Graph Analysis → Signal Extraction →
//           Score Calculation → Recommendation Generation → Validation →
//           Persistence → Versioning

import { supabase } from '@/lib/supabase';
import { icpScoringService } from './ICPScoringService';
import { buyingSignalEngine } from './BuyingSignalEngine';
import { growthSignalEngine } from './GrowthSignalEngine';
import { technologyFitEngine } from './TechnologyFitEngine';
import { serviceFitEngine } from './ServiceFitEngine';
import { opportunityScoringEngine } from './OpportunityScoringEngine';
import { riskAnalysisEngine } from './RiskAnalysisEngine';
import { recommendationEngine } from './RecommendationEngine';
import { accountPrioritizationEngine } from './AccountPrioritizationEngine';
import { nextBestActionEngine } from './NextBestActionEngine';
import type {
  CompanyIntelligenceInput,
  AnalysisContext,
  AnalysisResult,
  RevenueScores,
  RevenueProfileRecord,
  RevenueRecommendationRecord,
  IntelligenceSignal,
  RevenueMonitorSummary,
  RevenueHealth,
  Priority,
  ICPDefinition,
  SignalType,
  RecommendationType,
} from '@/types/revenue-intelligence';

class RevenueIntelligenceEngine {
  // ----------------------------------------------------------
  // Analyze — Main pipeline
  // ----------------------------------------------------------

  async analyze(params: {
    company: CompanyIntelligenceInput;
    icp?: ICPDefinition | null;
    graphRelationships?: { relationship_type: string; target_name: string; target_type: string }[];
    workspaceId?: string | null;
  }): Promise<AnalysisResult> {
    const start = Date.now();

    const context: AnalysisContext = {
      company: params.company,
      icp: params.icp ?? null,
      graphRelationships: params.graphRelationships ?? [],
      existingSignals: [],
      workspaceId: params.workspaceId ?? null,
    };

    // 1. Score calculation
    const icpResult = icpScoringService.score(context.company, context.icp);
    const buyingIntentResult = buyingSignalEngine.score(context.company);
    const growthResult = growthSignalEngine.score(context.company);
    const technologyFitResult = technologyFitEngine.score(context.company);
    const serviceFitResult = serviceFitEngine.score(context.company);
    const riskResult = riskAnalysisEngine.score(context.company);

    // Relationship score from graph
    const relationshipScore = this.calculateRelationshipScore(context);

    // Urgency score
    const urgencyScore = this.calculateUrgencyScore(context.company, buyingIntentResult.score);

    // 2. Combine scores
    const scores: RevenueScores = opportunityScoringEngine.combine({
      icpResult,
      buyingIntentResult,
      growthResult,
      technologyFitResult,
      serviceFitResult,
      riskResult,
      relationshipScore,
      urgencyScore,
    });

    // 3. Extract signals
    const signals = this.extractAllSignals(context.company);

    // 4. Generate recommendations
    const recommendations = recommendationEngine.generate({
      scores,
      companyName: context.company.company_name,
      industry: context.company.industry,
      decisionMakerCount: context.company.decision_makers?.length ?? 0,
      buyingSignalCount: context.company.buying_signals?.length ?? 0,
      growthSignalCount: context.company.growth_signals?.length ?? 0,
      competitorCount: context.company.competitive_positioning?.competitors?.length ?? 0,
    });

    // 5. Determine priority and next best action
    const priority = accountPrioritizationEngine.prioritize(scores);
    const nextAction = nextBestActionEngine.determine({
      scores,
      decisionMakerCount: context.company.decision_makers?.length ?? 0,
      buyingSignalCount: context.company.buying_signals?.length ?? 0,
      growthSignalCount: context.company.growth_signals?.length ?? 0,
      hasExistingRelationship: relationshipScore > 0.3,
    });

    const durationMs = Date.now() - start;

    return {
      profile: scores,
      signals: signals.map((s) => ({
        signal_type: s.signal_type,
        signal_strength: s.signal_strength,
        confidence_score: s.confidence_score,
        source: s.source as 'research_intelligence' | 'knowledge_graph' | 'ai_agent' | 'manual' | 'external_provider',
        description: s.description,
        detected_at: new Date().toISOString(),
      })),
      recommendations: recommendations.map((r) => ({
        recommendation_type: r.recommendation_type,
        title: r.title,
        description: r.description,
        priority: r.priority,
        status: r.status,
      })),
      priority,
      recommendedAction: nextAction.action,
      durationMs,
    };
  }

  // ----------------------------------------------------------
  // Persist — Save analysis results to database
  // ----------------------------------------------------------

  async persist(params: {
    companyId: string;
    result: AnalysisResult;
    workspaceId?: string | null;
  }): Promise<{ profileId: string }> {
    const { companyId, result, workspaceId } = params;

    // Upsert revenue profile
    const { data: profileData, error: profileError } = await supabase
      .from('revenue_profiles')
      .upsert({
        workspace_id: workspaceId ?? null,
        company_id: companyId,
        overall_score: result.profile.overall_score,
        icp_score: result.profile.icp_score,
        opportunity_score: result.profile.opportunity_score,
        buying_intent_score: result.profile.buying_intent_score,
        growth_score: result.profile.growth_score,
        technology_fit_score: result.profile.technology_fit_score,
        service_fit_score: result.profile.service_fit_score,
        risk_score: result.profile.risk_score,
        urgency_score: result.profile.urgency_score,
        relationship_score: result.profile.relationship_score,
        confidence_score: result.profile.confidence_score,
        priority: result.priority,
        recommended_action: result.recommendedAction,
        analysis_duration_ms: result.durationMs,
        version: 1,
      }, { onConflict: 'company_id' })
      .select('*')
      .maybeSingle();

    if (profileError) throw new Error(`Failed to persist profile: ${profileError.message}`);
    if (!profileData) throw new Error('Profile was not created');

    const profileId = profileData.id;

    // Delete old signals and insert new ones
    await supabase
      .from('intelligence_signals')
      .delete()
      .eq('company_id', companyId);

    if (result.signals.length > 0) {
      await supabase
        .from('intelligence_signals')
        .insert(
          result.signals.map((s) => ({
            workspace_id: workspaceId ?? null,
            company_id: companyId,
            signal_type: s.signal_type,
            signal_strength: s.signal_strength,
            confidence_score: s.confidence_score,
            source: s.source,
            description: s.description,
            detected_at: s.detected_at,
          }))
        );
    }

    // Delete old recommendations and insert new ones
    await supabase
      .from('revenue_recommendations')
      .delete()
      .eq('company_id', companyId)
      .eq('status', 'pending');

    if (result.recommendations.length > 0) {
      await supabase
        .from('revenue_recommendations')
        .insert(
          result.recommendations.map((r) => ({
            workspace_id: workspaceId ?? null,
            company_id: companyId,
            recommendation_type: r.recommendation_type,
            title: r.title,
            description: r.description,
            priority: r.priority,
            status: r.status,
          }))
        );
    }

    return { profileId };
  }

  // ----------------------------------------------------------
  // Analyze and Persist — Full pipeline
  // ----------------------------------------------------------

  async analyzeAndPersist(params: {
    company: CompanyIntelligenceInput;
    icp?: ICPDefinition | null;
    graphRelationships?: { relationship_type: string; target_name: string; target_type: string }[];
    workspaceId?: string | null;
  }): Promise<{ profileId: string; result: AnalysisResult }> {
    const result = await this.analyze(params);
    const { profileId } = await this.persist({
      companyId: params.company.company_id,
      result,
      workspaceId: params.workspaceId,
    });
    return { profileId, result };
  }

  // ----------------------------------------------------------
  // Recalculate — Re-run analysis for an existing company
  // ----------------------------------------------------------

  async recalculate(params: {
    companyId: string;
    workspaceId?: string | null;
  }): Promise<{ profileId: string; result: AnalysisResult }> {
    // Load company intelligence
    const { data: companyData, error } = await supabase
      .from('company_intelligence')
      .select('*')
      .eq('id', params.companyId)
      .maybeSingle();

    if (error || !companyData) throw new Error(`Company not found: ${params.companyId}`);

    const company = companyData as unknown as CompanyIntelligenceInput;
    company.company_id = params.companyId;

    return this.analyzeAndPersist({
      company,
      workspaceId: params.workspaceId,
    });
  }

  // ----------------------------------------------------------
  // Retrieval
  // ----------------------------------------------------------

  async getProfile(companyId: string): Promise<RevenueProfileRecord | null> {
    const { data, error } = await supabase
      .from('revenue_profiles')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load profile: ${error.message}`);
    return data as RevenueProfileRecord | null;
  }

  async getSignals(companyId: string): Promise<IntelligenceSignal[]> {
    const { data, error } = await supabase
      .from('intelligence_signals')
      .select('*')
      .eq('company_id', companyId)
      .order('detected_at', { ascending: false });

    if (error) throw new Error(`Failed to load signals: ${error.message}`);
    return (data ?? []) as IntelligenceSignal[];
  }

  async getRecommendations(companyId: string): Promise<RevenueRecommendationRecord[]> {
    const { data, error } = await supabase
      .from('revenue_recommendations')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to load recommendations: ${error.message}`);
    return (data ?? []) as RevenueRecommendationRecord[];
  }

  async getAllProfiles(workspaceId?: string | null, limit?: number): Promise<(RevenueProfileRecord & { company_name: string })[]> {
    let query = supabase
      .from('revenue_profiles')
      .select('*, company_intelligence!inner(company_name)')
      .order('overall_score', { ascending: false });

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    if (limit) query = query.limit(limit);

    const { data, error } = await query;
    if (error) throw new Error(`Failed to load profiles: ${error.message}`);

    return (data ?? []).map((row) => {
      const { company_intelligence, ...profile } = row as Record<string, unknown>;
      return {
        ...(profile as Record<string, unknown>),
        company_name: (company_intelligence as { company_name: string })?.company_name ?? 'Unknown',
      } as RevenueProfileRecord & { company_name: string };
    });
  }

  async updateRecommendationStatus(recommendationId: string, status: string): Promise<void> {
    const { error } = await supabase
      .from('revenue_recommendations')
      .update({ status })
      .eq('id', recommendationId);

    if (error) throw new Error(`Failed to update recommendation: ${error.message}`);
  }

  // ----------------------------------------------------------
  // Monitoring
  // ----------------------------------------------------------

  async getSummary(workspaceId?: string | null): Promise<RevenueMonitorSummary> {
    let profileQuery = supabase.from('revenue_profiles').select('*');
    if (workspaceId) profileQuery = profileQuery.eq('workspace_id', workspaceId);
    const { data: profiles } = await profileQuery;

    const profileList = (profiles ?? []) as RevenueProfileRecord[];

    const avgScore = profileList.length > 0
      ? profileList.reduce((sum, p) => sum + p.overall_score, 0) / profileList.length
      : 0;

    const avgIcp = profileList.length > 0
      ? profileList.reduce((sum, p) => sum + p.icp_score, 0) / profileList.length
      : 0;

    const avgBuyingIntent = profileList.length > 0
      ? profileList.reduce((sum, p) => sum + p.buying_intent_score, 0) / profileList.length
      : 0;

    const avgGrowth = profileList.length > 0
      ? profileList.reduce((sum, p) => sum + p.growth_score, 0) / profileList.length
      : 0;

    const avgConfidence = profileList.length > 0
      ? profileList.reduce((sum, p) => sum + p.confidence_score, 0) / profileList.length
      : 0;

    const avgDuration = profileList.length > 0
      ? profileList.reduce((sum, p) => sum + (p.analysis_duration_ms ?? 0), 0) / profileList.length
      : 0;

    const priorityDist: Record<string, number> = {};
    for (const p of profileList) {
      priorityDist[p.priority] = (priorityDist[p.priority] ?? 0) + 1;
    }

    // Signal and recommendation counts
    let signalQuery = supabase.from('intelligence_signals').select('*', { count: 'exact', head: true });
    if (workspaceId) signalQuery = signalQuery.eq('workspace_id', workspaceId);
    const { count: signalCount } = await signalQuery;

    let recQuery = supabase.from('revenue_recommendations').select('status', { count: 'exact' });
    if (workspaceId) recQuery = recQuery.eq('workspace_id', workspaceId);
    const { data: recData } = await recQuery;

    const recList = (recData ?? []) as { status: string }[];
    const pendingCount = recList.filter((r) => r.status === 'pending').length;
    const acceptedCount = recList.filter((r) => r.status === 'accepted').length;

    // ICP distribution
    const icpDistribution = {
      high: profileList.filter((p) => p.icp_score >= 0.7).length,
      medium: profileList.filter((p) => p.icp_score >= 0.4 && p.icp_score < 0.7).length,
      low: profileList.filter((p) => p.icp_score < 0.4).length,
    };

    // Buying signal trends
    let signalTypeQuery = supabase.from('intelligence_signals').select('signal_type');
    if (workspaceId) signalTypeQuery = signalTypeQuery.eq('workspace_id', workspaceId);
    const { data: signalTypeData } = await signalTypeQuery;

    const buyingSignalTrends: Record<string, number> = {};
    for (const s of (signalTypeData ?? []) as { signal_type: string }[]) {
      buyingSignalTrends[s.signal_type] = (buyingSignalTrends[s.signal_type] ?? 0) + 1;
    }

    return {
      total_profiles: profileList.length,
      average_overall_score: Math.round(avgScore * 100) / 100,
      average_icp_score: Math.round(avgIcp * 100) / 100,
      average_buying_intent_score: Math.round(avgBuyingIntent * 100) / 100,
      average_growth_score: Math.round(avgGrowth * 100) / 100,
      average_confidence: Math.round(avgConfidence * 100) / 100,
      priority_distribution: priorityDist,
      total_signals: signalCount ?? 0,
      total_recommendations: recList.length,
      pending_recommendations: pendingCount,
      accepted_recommendations: acceptedCount,
      average_analysis_duration_ms: Math.round(avgDuration),
      icp_distribution: icpDistribution,
      buying_signal_trends: buyingSignalTrends,
    };
  }

  // ----------------------------------------------------------
  // Health
  // ----------------------------------------------------------

  async getHealth(workspaceId?: string | null): Promise<RevenueHealth> {
    const summary = await this.getSummary(workspaceId);
    const errors: string[] = [];

    if (summary.total_profiles === 0) errors.push('No revenue profiles generated');
    if (summary.average_confidence < 0.4) errors.push('Low average confidence across profiles');

    const staleProfiles = await this.countStaleProfiles(workspaceId);
    if (staleProfiles > 0) errors.push(`${staleProfiles} profiles are stale (not updated in 7+ days)`);

    const lowConfidenceProfiles = await this.countLowConfidenceProfiles(workspaceId);
    if (lowConfidenceProfiles > summary.total_profiles * 0.5) errors.push('More than 50% of profiles have low confidence');

    return {
      healthy: errors.length === 0,
      total_profiles: summary.total_profiles,
      total_signals: summary.total_signals,
      total_recommendations: summary.total_recommendations,
      stale_profiles: staleProfiles,
      low_confidence_profiles: lowConfidenceProfiles,
      errors,
    };
  }

  private async countStaleProfiles(workspaceId?: string | null): Promise<number> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let query = supabase
      .from('revenue_profiles')
      .select('*', { count: 'exact', head: true })
      .lt('updated_at', sevenDaysAgo);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { count } = await query;
    return count ?? 0;
  }

  private async countLowConfidenceProfiles(workspaceId?: string | null): Promise<number> {
    let query = supabase
      .from('revenue_profiles')
      .select('*', { count: 'exact', head: true })
      .lt('confidence_score', 0.4);

    if (workspaceId) query = query.eq('workspace_id', workspaceId);
    const { count } = await query;
    return count ?? 0;
  }

  // ----------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------

  private calculateRelationshipScore(context: AnalysisContext): number {
    const relationships = context.graphRelationships ?? [];
    if (relationships.length === 0) return 0.2;

    const strongRelationships = relationships.filter((r) =>
      ['CUSTOMER_OF', 'PARTNER_OF', 'WORKS_FOR', 'HAS_MEETING'].includes(r.relationship_type)
    );

    return Math.min(0.3 + strongRelationships.length * 0.15, 1.0);
  }

  private calculateUrgencyScore(company: CompanyIntelligenceInput, buyingIntentScore: number): number {
    let urgency = 0;

    // Funding signals increase urgency
    const summary = company.summary?.toLowerCase() ?? '';
    if (summary.includes('funding') || summary.includes('raised') || summary.includes('series')) {
      urgency += 0.3;
    }

    // Hiring signals increase urgency
    if (summary.includes('hiring') || summary.includes('expanding')) {
      urgency += 0.2;
    }

    // High buying intent increases urgency
    urgency += buyingIntentScore * 0.3;

    // Recent buying signals
    const recentSignals = company.buying_signals?.length ?? 0;
    urgency += Math.min(recentSignals * 0.05, 0.2);

    return Math.min(urgency, 1.0);
  }

  private extractAllSignals(company: CompanyIntelligenceInput): { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] {
    const signals: { signal_type: SignalType; signal_strength: number; confidence_score: number; description: string; source: string }[] = [];

    signals.push(...buyingSignalEngine.extractSignals(company));
    signals.push(...growthSignalEngine.extractSignals(company));
    signals.push(...technologyFitEngine.extractSignals(company));
    signals.push(...serviceFitEngine.extractSignals(company));
    signals.push(...riskAnalysisEngine.extractSignals(company));

    return signals;
  }
}

export const revenueIntelligenceEngine = new RevenueIntelligenceEngine();
