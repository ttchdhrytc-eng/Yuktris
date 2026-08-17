// ============================================================
// MarketOpportunityService — Market Intelligence & Discovery Engine
// ============================================================
//
// Uses the AI Gateway to generate a comprehensive market profile,
// discover opportunities, score companies, create target account
// lists, and track market trends. Stores results in the database
// and populates the Knowledge Graph and AI Memory.

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type {
  MarketProfile, MarketSegment, MarketOpportunity, MarketScore,
  TargetAccountList, TargetAccountMember, MarketTrend,
  FullMarketIntelligence, TargetListWithMembers,
  MarketIntelligenceInput, MarketIntelligenceGenerationResult,
} from '@/types/market-opportunity';

class MarketOpportunityService {
  async generateMarketIntelligence(input: MarketIntelligenceInput): Promise<string> {
    const { workspaceId } = input;

    const { data: existing } = await supabase
      .from('market_profiles')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let profileId: string;

    if (existing) {
      profileId = existing.id;
      await supabase.from('market_profiles').update({ status: 'processing', error_message: null }).eq('id', profileId);
    } else {
      const { data: newProfile, error } = await supabase
        .from('market_profiles')
        .insert({ workspace_id: workspaceId, status: 'processing' })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      profileId = newProfile.id;
    }

    try {
      const generation = await this.callAIGeneration(input);
      await this.persistMarketIntelligence(profileId, workspaceId, generation);
      await this.populateKnowledgeGraph(workspaceId, generation);
      await this.storeInMemory(workspaceId, generation);
      return profileId;
    } catch (err) {
      await supabase.from('market_profiles')
        .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Generation failed' })
        .eq('id', profileId);
      throw err;
    }
  }

  private async callAIGeneration(input: MarketIntelligenceInput): Promise<MarketIntelligenceGenerationResult> {
    const ba = input.businessAnalysis ?? {};
    const dna = input.revenueDNA ?? {};
    const products = Array.isArray(ba.products) ? ba.products : ba.products ? [ba.products] : [];
    const services = Array.isArray(ba.services) ? ba.services : ba.services ? [ba.services] : [];

    const contextBlock = [
      `Website: ${input.website ?? 'N/A'}`,
      input.companyName ? `Company: ${input.companyName}` : '',
      ba.industry ? `Industry: ${ba.industry}` : '',
      ba.description ? `Description: ${ba.description}` : '',
      ba.business_model ? `Business Model: ${ba.business_model}` : '',
      products.length ? `Products: ${products.join(', ')}` : '',
      services.length ? `Services: ${services.join(', ')}` : '',
      ba.target_audience ? `Target Audience: ${ba.target_audience}` : '',
      ba.usp ? `USP: ${ba.usp}` : '',
      ba.competitive_position ? `Competitive Position: ${ba.competitive_position}` : '',
      dna.target_industries?.length ? `DNA Target Industries: ${dna.target_industries.join(', ')}` : '',
      dna.differentiators?.length ? `DNA Differentiators: ${dna.differentiators.join(', ')}` : '',
      dna.sales_motion ? `DNA Sales Motion: ${dna.sales_motion}` : '',
      dna.geographies?.length ? `DNA Geographies: ${dna.geographies.join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are an expert market intelligence analyst. You analyze markets, discover opportunities, score companies, and generate target account recommendations. You always respond with valid JSON.`;

    const userPrompt = `Analyze the market for the following company and generate comprehensive market intelligence.

COMPANY CONTEXT:
${contextBlock}

Generate a complete market intelligence report. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "profile": {
    "total_addressable_market": "estimated TAM",
    "serviceable_addressable_market": "estimated SAM",
    "ideal_market": "ideal market description",
    "emerging_markets": ["market1", "market2"],
    "growing_industries": ["industry1", "industry2"],
    "declining_industries": ["industry1"],
    "market_saturation": "low|medium|high|very_high",
    "competitive_density": "low|medium|high|very_high",
    "average_sales_cycle": "3-6 months",
    "average_deal_size": "$10K-$50K ARR",
    "buying_committee_complexity": "low|medium|high|very_high",
    "technology_adoption": "description of tech adoption",
    "digital_maturity": "low|medium|high|very_high",
    "growth_potential": 85,
    "risk_level": "low|medium|high|very_high",
    "confidence_score": 82,
    "completion_percentage": 100
  },
  "segments": [
    {
      "segment_name": "B2B SaaS",
      "segment_type": "industry",
      "description": "Software companies selling to other businesses",
      "market_size": "$150B",
      "growth_rate": "15% YoY",
      "opportunity_score": 88,
      "competition_level": "high",
      "recommended": true,
      "reason": "High growth, strong fit with our offering",
      "confidence_score": 0.85
    }
  ],
  "opportunities": [
    {
      "company_name": "Acme Corp",
      "website": "https://acme.com",
      "industry": "SaaS",
      "reason": "Recently raised Series B and hiring 5 SDRs",
      "signal_type": "funding",
      "priority": "high",
      "confidence": 0.85,
      "recommended_action": "Reach out to VP Sales with growth-focused messaging",
      "urgency": "high",
      "expected_conversion_probability": 0.35,
      "opportunity_score": 82,
      "signal_metadata": {}
    }
  ],
  "scores": [
    {
      "company_name": "Acme Corp",
      "revenue_dna_fit": 85,
      "icp_fit": 90,
      "buying_signals_score": 80,
      "technology_fit": 75,
      "industry_fit": 88,
      "growth_stage_fit": 82,
      "competition_score": 60,
      "risk_score": 25,
      "geography_fit": 85,
      "market_momentum": 78,
      "decision_maker_accessibility": 70,
      "expected_reply_rate": 0.18,
      "expected_meeting_rate": 0.08,
      "expected_deal_quality": 85,
      "expected_sales_cycle": "2-4 months",
      "overall_score": 81,
      "overall_confidence": 0.82,
      "scoring_factors": {}
    }
  ],
  "targetLists": [
    {
      "list_name": "High Growth SaaS",
      "description": "SaaS companies with recent funding and hiring signals",
      "selection_reason": "These companies have the highest conversion probability due to funding and growth signals",
      "estimated_opportunities": 45,
      "average_score": 82,
      "risk_level": "low",
      "expected_roi": "3.5x",
      "recommended": true,
      "confidence_score": 0.85,
      "members": [
        {
          "company_name": "Acme Corp",
          "website": "https://acme.com",
          "industry": "SaaS",
          "company_size": "200-500",
          "opportunity_score": 82,
          "signal_summary": "Series B funding, hiring SDRs",
          "recommended_action": "Reach out to VP Sales",
          "confidence_score": 0.85
        }
      ]
    }
  ],
  "trends": [
    {
      "trend_name": "AI-First Sales Tools",
      "trend_type": "emerging",
      "description": "Companies are adopting AI-native sales tools",
      "affected_industries": ["SaaS", "Technology", "Financial Services"],
      "impact_level": "transformative",
      "opportunity": "Position as AI-native alternative",
      "time_horizon": "short_term",
      "momentum": 85,
      "confidence": 0.88,
      "signal_count": 12
    }
  ]
}

Return ONLY the JSON object, no other text.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 8000,
      workspaceId: input.workspaceId,
      agentName: 'market_intelligence_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as MarketIntelligenceGenerationResult;
  }

  private async persistMarketIntelligence(
    profileId: string,
    workspaceId: string,
    generation: MarketIntelligenceGenerationResult,
  ): Promise<void> {
    const { error: profileError } = await supabase
      .from('market_profiles')
      .update({
        ...generation.profile,
        status: 'completed',
        error_message: null,
        last_refreshed_at: new Date().toISOString(),
      })
      .eq('id', profileId);
    if (profileError) throw new Error(profileError.message);

    await supabase.from('market_segments').delete().eq('market_profile_id', profileId);
    await supabase.from('market_opportunities').delete().eq('market_profile_id', profileId);
    await supabase.from('market_trends').delete().eq('market_profile_id', profileId);
    await supabase.from('target_account_lists').delete().eq('market_profile_id', profileId);

    if (generation.segments?.length) {
      await supabase.from('market_segments').insert(
        generation.segments.map((s) => ({ ...s, workspace_id: workspaceId, market_profile_id: profileId })),
      );
    }

    const opportunityIds: Record<string, string> = {};
    if (generation.opportunities?.length) {
      const oppRows = generation.opportunities.map((o) => ({
        ...o,
        workspace_id: workspaceId,
        market_profile_id: profileId,
      }));
      const { data: inserted } = await supabase.from('market_opportunities').insert(oppRows).select('id, company_name');
      (inserted ?? []).forEach((row, i) => {
        if (generation.opportunities[i]) {
          opportunityIds[generation.opportunities[i].company_name] = row.id;
        }
      });

      if (generation.scores?.length) {
        const scoreRows = generation.scores
          .map((s) => {
            const oppId = opportunityIds[s.company_name];
            if (!oppId) return null;
            return { ...s, workspace_id: workspaceId, market_opportunity_id: oppId };
          })
          .filter(Boolean);
        if (scoreRows.length) {
          await supabase.from('market_scores').insert(scoreRows);
        }
      }
    }

    if (generation.targetLists?.length) {
      for (const list of generation.targetLists) {
        const { data: listRow, error: listError } = await supabase
          .from('target_account_lists')
          .insert({
            list_name: list.list_name,
            description: list.description,
            selection_reason: list.selection_reason,
            estimated_opportunities: list.estimated_opportunities,
            average_score: list.average_score,
            risk_level: list.risk_level,
            expected_roi: list.expected_roi,
            recommended: list.recommended,
            confidence_score: list.confidence_score,
            workspace_id: workspaceId,
            market_profile_id: profileId,
          })
          .select('id')
          .single();
        if (listError) continue;

        if (list.members?.length) {
          await supabase.from('target_account_members').insert(
            list.members.map((m) => ({
              ...m,
              workspace_id: workspaceId,
              target_account_list_id: listRow.id,
            })),
          );
        }
      }
    }

    if (generation.trends?.length) {
      await supabase.from('market_trends').insert(
        generation.trends.map((t) => ({ ...t, workspace_id: workspaceId, market_profile_id: profileId })),
      );
    }
  }

  private async populateKnowledgeGraph(workspaceId: string, generation: MarketIntelligenceGenerationResult): Promise<void> {
    try {
      const entities: Array<{ nodeType: string; externalId?: string; displayName: string; properties?: Record<string, unknown> }> = [];
      const relationships: Array<{ sourceExternalId: string; sourceNodeType: string; targetExternalId: string; targetNodeType: string; relationshipType: string }> = [];

      const marketExtId = `market_${workspaceId}`;
      entities.push({ nodeType: 'market', externalId: marketExtId, displayName: 'Market', properties: { tam: generation.profile.total_addressable_market, sam: generation.profile.serviceable_addressable_market } });

      for (const seg of generation.segments ?? []) {
        const segId = `segment_${seg.segment_name.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        entities.push({ nodeType: 'market_segment', externalId: segId, displayName: seg.segment_name, properties: { type: seg.segment_type, score: seg.opportunity_score, recommended: seg.recommended } });
        relationships.push({ sourceExternalId: marketExtId, sourceNodeType: 'market', targetExternalId: segId, targetNodeType: 'market_segment', relationshipType: 'CONTAINS_SEGMENT' });
      }

      for (const opp of generation.opportunities ?? []) {
        const oppId = `opp_${opp.company_name.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        entities.push({ nodeType: 'opportunity', externalId: oppId, displayName: opp.company_name, properties: { signal_type: opp.signal_type, priority: opp.priority, score: opp.opportunity_score } });
        relationships.push({ sourceExternalId: marketExtId, sourceNodeType: 'market', targetExternalId: oppId, targetNodeType: 'opportunity', relationshipType: 'HAS_OPPORTUNITY' });
      }

      for (const trend of generation.trends ?? []) {
        const trendId = `trend_${trend.trend_name.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        entities.push({ nodeType: 'market_trend', externalId: trendId, displayName: trend.trend_name, properties: { type: trend.trend_type, impact: trend.impact_level, momentum: trend.momentum } });
        relationships.push({ sourceExternalId: marketExtId, sourceNodeType: 'market', targetExternalId: trendId, targetNodeType: 'market_trend', relationshipType: 'INFLUENCED_BY' });
      }

      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: entities.map((e) => ({
          nodeType: e.nodeType as any,
          externalId: e.externalId,
          displayName: e.displayName,
          properties: e.properties ?? {},
          confidenceScore: 0.8,
        })),
        relationships: relationships.map((r) => ({
          sourceExternalId: r.sourceExternalId,
          sourceNodeType: r.sourceNodeType as any,
          targetExternalId: r.targetExternalId,
          targetNodeType: r.targetNodeType as any,
          relationshipType: r.relationshipType as any,
          confidenceScore: 0.8,
        })),
      });
    } catch {
      // Best-effort
    }
  }

  private async storeInMemory(workspaceId: string, generation: MarketIntelligenceGenerationResult): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'market',
        entityId: `market_${workspaceId}`,
        memoryType: 'market_intelligence',
        title: 'Market Intelligence Profile',
        summary: generation.profile.ideal_market ?? '',
        content: {
          tam: generation.profile.total_addressable_market,
          sam: generation.profile.serviceable_addressable_market,
          growing_industries: generation.profile.growing_industries,
          declining_industries: generation.profile.declining_industries,
          market_saturation: generation.profile.market_saturation,
          competitive_density: generation.profile.competitive_density,
          average_sales_cycle: generation.profile.average_sales_cycle,
          average_deal_size: generation.profile.average_deal_size,
          growth_potential: generation.profile.growth_potential,
          risk_level: generation.profile.risk_level,
          segments: generation.segments?.map((s) => ({ name: s.segment_name, score: s.opportunity_score, recommended: s.recommended })),
          opportunities: generation.opportunities?.map((o) => ({ company: o.company_name, signal: o.signal_type, priority: o.priority, score: o.opportunity_score })),
          trends: generation.trends?.map((t) => ({ name: t.trend_name, type: t.trend_type, impact: t.impact_level })),
          target_lists: generation.targetLists?.map((l) => ({ name: l.list_name, count: l.estimated_opportunities, roi: l.expected_roi })),
        },
        confidenceScore: (generation.profile.confidence_score ?? 80) / 100,
        importanceScore: 0.9,
        workspaceId,
      });
    } catch {
      // Best-effort
    }
  }

  async loadMarketIntelligence(workspaceId: string): Promise<FullMarketIntelligence | null> {
    const { data: profile } = await supabase
      .from('market_profiles')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!profile) return null;

    const [segments, opportunities, scores, targetLists, trends] = await Promise.all([
      supabase.from('market_segments').select('*').eq('market_profile_id', profile.id).order('opportunity_score', { ascending: false }),
      supabase.from('market_opportunities').select('*').eq('market_profile_id', profile.id).order('opportunity_score', { ascending: false }),
      supabase.from('market_scores').select('*').eq('workspace_id', workspaceId).order('overall_score', { ascending: false }),
      supabase.from('target_account_lists').select('*').eq('market_profile_id', profile.id).order('average_score', { ascending: false }),
      supabase.from('market_trends').select('*').eq('market_profile_id', profile.id).order('momentum', { ascending: false }),
    ]);

    return {
      profile: profile as MarketProfile,
      segments: (segments.data ?? []) as MarketSegment[],
      opportunities: (opportunities.data ?? []) as MarketOpportunity[],
      scores: (scores.data ?? []) as MarketScore[],
      targetLists: (targetLists.data ?? []) as TargetAccountList[],
      trends: (trends.data ?? []) as MarketTrend[],
    };
  }

  async loadTargetListWithMembers(listId: string): Promise<TargetListWithMembers | null> {
    const { data: list } = await supabase
      .from('target_account_lists')
      .select('*')
      .eq('id', listId)
      .maybeSingle();
    if (!list) return null;

    const { data: members } = await supabase
      .from('target_account_members')
      .select('*')
      .eq('target_account_list_id', listId)
      .order('opportunity_score', { ascending: false });

    return {
      ...(list as TargetAccountList),
      members: (members ?? []) as TargetAccountMember[],
    };
  }

  async updateProfile(profileId: string, updates: Partial<MarketProfile>): Promise<void> {
    const { error } = await supabase.from('market_profiles').update(updates).eq('id', profileId);
    if (error) throw new Error(error.message);
  }

  async updateSegment(segmentId: string, updates: Partial<MarketSegment>): Promise<void> {
    const { error } = await supabase.from('market_segments').update(updates).eq('id', segmentId);
    if (error) throw new Error(error.message);
  }

  async updateOpportunity(oppId: string, updates: Partial<MarketOpportunity>): Promise<void> {
    const { error } = await supabase.from('market_opportunities').update(updates).eq('id', oppId);
    if (error) throw new Error(error.message);
  }
}

export const marketOpportunityService = new MarketOpportunityService();
