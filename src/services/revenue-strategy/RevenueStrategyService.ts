// ============================================================
// RevenueStrategyService — Revenue Strategy & Campaign Intelligence
// ============================================================
//
// Uses the AI Gateway to generate a complete revenue strategy,
// including campaign strategies, sequences, messaging libraries,
// channel recommendations, and campaign goals. Stores results
// in the database and populates the Knowledge Graph and AI Memory.

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type {
  RevenueStrategy, CampaignStrategy, CampaignSequence,
  MessageLibraryAsset, MessagingTemplate, ChannelRecommendation,
  CampaignGoal, StrategyApproval, CampaignStrategyVersion,
  FullRevenueStrategy, RevenueStrategyInput, RevenueStrategyGenerationResult,
} from '@/types/revenue-strategy';

class RevenueStrategyService {
  // ----------------------------------------------------------
  // Generate full revenue strategy
  // ----------------------------------------------------------

  async generateRevenueStrategy(input: RevenueStrategyInput): Promise<string> {
    const { workspaceId } = input;

    const { data: existing } = await supabase
      .from('revenue_strategies')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let strategyId: string;

    if (existing) {
      strategyId = existing.id;
      await supabase.from('revenue_strategies').update({ status: 'processing', error_message: null }).eq('id', strategyId);
    } else {
      const { data: newStrategy, error } = await supabase
        .from('revenue_strategies')
        .insert({ workspace_id: workspaceId, status: 'processing' })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      strategyId = newStrategy.id;
    }

    try {
      const generation = await this.callAIGeneration(input);
      await this.persistRevenueStrategy(strategyId, workspaceId, generation);
      await this.populateKnowledgeGraph(workspaceId, generation);
      await this.storeInMemory(workspaceId, generation);

      return strategyId;
    } catch (err) {
      await supabase.from('revenue_strategies')
        .update({ status: 'failed', error_message: err instanceof Error ? err.message : 'Generation failed' })
        .eq('id', strategyId);
      throw err;
    }
  }

  // ----------------------------------------------------------
  // AI Generation
  // ----------------------------------------------------------

  private async callAIGeneration(input: RevenueStrategyInput): Promise<RevenueStrategyGenerationResult> {
    const dna = input.revenueDNA ?? {};
    const market = input.marketIntel ?? {};
    const mp = market.profile ?? {};

    const contextBlock = [
      dna.target_industries?.length ? `DNA Target Industries: ${dna.target_industries.join(', ')}` : '',
      dna.differentiators?.length ? `DNA Differentiators: ${dna.differentiators.join(', ')}` : '',
      dna.sales_motion ? `DNA Sales Motion: ${dna.sales_motion}` : '',
      dna.geographies?.length ? `DNA Geographies: ${dna.geographies.join(', ')}` : '',
      dna.buyer_personas?.length ? `DNA Buyer Personas: ${dna.buyer_personas.map((p) => `${p.role} (goals: ${p.goals?.join('; ')})`).join(', ')}` : '',
      dna.buying_signals?.length ? `DNA Buying Signals: ${dna.buying_signals.join(', ')}` : '',
      dna.typical_objections?.length ? `DNA Typical Objections: ${dna.typical_objections.join(', ')}` : '',
      mp.total_addressable_market ? `Market TAM: ${mp.total_addressable_market}` : '',
      mp.growing_industries?.length ? `Growing Industries: ${mp.growing_industries.join(', ')}` : '',
      mp.market_saturation ? `Market Saturation: ${mp.market_saturation}` : '',
      mp.average_sales_cycle ? `Avg Sales Cycle: ${mp.average_sales_cycle}` : '',
      mp.average_deal_size ? `Avg Deal Size: ${mp.average_deal_size}` : '',
      mp.growth_potential ? `Growth Potential: ${mp.growth_potential}/100` : '',
      market.segments?.length ? `Top Segments: ${market.segments.filter((s) => s.recommended).map((s) => `${s.segment_name} (${s.opportunity_score})`).join(', ')}` : '',
      market.opportunities?.length ? `Top Opportunities: ${market.opportunities.slice(0, 5).map((o) => `${o.company_name} (${o.signal_type}, ${o.priority})`).join(', ')}` : '',
      market.trends?.length ? `Market Trends: ${market.trends.map((t) => `${t.trend_name} (${t.impact_level})`).join(', ')}` : '',
    ].filter(Boolean).join('\n');

    const systemPrompt = `You are a VP of Sales and revenue strategist. You design complete revenue strategies, campaign strategies, messaging libraries, sequences, and channel recommendations. You always respond with valid JSON.`;

    const userPrompt = `Design a complete revenue strategy based on the following intelligence.

INTELLIGENCE CONTEXT:
${contextBlock}

Generate a complete revenue strategy. Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "strategy": {
    "best_icp": {"industry": "SaaS", "company_size": "50-500", "revenue": "$5M-$50M"},
    "best_market": "B2B SaaS companies in North America",
    "best_industry": "SaaS",
    "best_geography": "North America",
    "best_company_size": "50-500 employees",
    "best_decision_makers": ["VP Sales", "CTO", "Head of Growth"],
    "best_messaging_angle": "AI-powered revenue acceleration",
    "best_outreach_channel": "linkedin_email",
    "best_campaign_sequence": "linkedin_email",
    "best_follow_up_timing": "3-5 business days between touches",
    "expected_reply_rate": 18,
    "expected_meeting_rate": 8,
    "expected_revenue": "$500K ARR in 6 months",
    "estimated_campaign_duration": "8-12 weeks per cohort",
    "confidence_score": 85,
    "completion_percentage": 100,
    "ai_reasoning": "Based on the Revenue DNA and market intelligence, the best opportunity lies in..."
  },
  "campaigns": [
    {
      "strategy_name": "High Growth SaaS Outreach",
      "objective": "Book meetings with VP Sales at funded SaaS companies",
      "recommended_icp": {"industry": "SaaS", "company_size": "50-500"},
      "target_industry": "SaaS",
      "target_geography": "North America",
      "target_company_size": "50-500",
      "target_revenue_range": "$5M-$50M ARR",
      "decision_maker_personas": ["VP Sales", "Head of Growth"],
      "pain_points": ["Long sales cycles", "Low conversion rates"],
      "buying_triggers": ["Recent funding", "Hiring SDRs"],
      "business_outcomes": ["30% faster sales cycle", "2x reply rates"],
      "unique_messaging_angle": "AI-native approach to sales acceleration",
      "competitive_positioning": "Only AI-native platform with predictive scoring",
      "primary_cta": "Book a 15-min discovery call",
      "secondary_cta": "Download our ROI calculator",
      "risk_level": "low",
      "expected_roi": "3.5x",
      "expected_meetings": 25,
      "estimated_pipeline": "$750K",
      "confidence_score": 0.85,
      "ai_recommendation": "Start with this campaign — highest ROI and lowest risk",
      "status": "draft",
      "sequences": [
        {
          "sequence_name": "LinkedIn + Email Sequence",
          "sequence_type": "linkedin_email",
          "touch_order": 1,
          "delay_between_touches": "3 days",
          "purpose": "Initial LinkedIn connection with personalized note",
          "success_criteria": "Connection accepted within 7 days",
          "escalation_rules": ["If no response after touch 3, switch to email"],
          "exit_rules": ["If meeting booked", "If prospect opts out"],
          "confidence_score": 0.85
        }
      ]
    }
  ],
  "messageLibrary": [
    {
      "asset_type": "linkedin_connection_hook",
      "content": "Saw your post about scaling sales — we help companies like yours do exactly that with AI",
      "target_persona": "VP Sales",
      "target_industry": "SaaS",
      "context": "Use when prospect has posted about sales growth",
      "confidence_score": 0.85
    }
  ],
  "channels": [
    {
      "channel": "linkedin_email",
      "recommendation": "Use LinkedIn + Email combined approach",
      "reasoning": "LinkedIn has 3x higher reply rate for SaaS buyers, email provides follow-up persistence",
      "estimated_performance": {"reply_rate": 18, "meeting_rate": 8},
      "estimated_reply_rate": 18,
      "estimated_meeting_rate": 8,
      "is_primary": true,
      "confidence_score": 0.85
    }
  ],
  "goals": [
    {
      "goal_type": "book_meetings",
      "goal_description": "Book 25 qualified meetings in 90 days",
      "messaging_adaptation": "Focus on pain points and ROI in opening messages",
      "target_metric": "meetings_booked",
      "target_value": "25",
      "confidence_score": 0.85
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
      agentName: 'revenue_strategy_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as RevenueStrategyGenerationResult;
  }

  // ----------------------------------------------------------
  // Persist to database
  // ----------------------------------------------------------

  private async persistRevenueStrategy(
    strategyId: string,
    workspaceId: string,
    generation: RevenueStrategyGenerationResult,
  ): Promise<void> {
    const { error: strategyError } = await supabase
      .from('revenue_strategies')
      .update({
        ...generation.strategy,
        status: 'completed',
        error_message: null,
      })
      .eq('id', strategyId);
    if (strategyError) throw new Error(strategyError.message);

    // Delete existing child records
    await supabase.from('channel_recommendations').delete().eq('revenue_strategy_id', strategyId);
    await supabase.from('message_libraries').delete().eq('revenue_strategy_id', strategyId);
    const { data: oldCampaigns } = await supabase.from('campaign_strategies').delete().eq('revenue_strategy_id', strategyId).select('id');
    if (oldCampaigns && oldCampaigns.length) {
      await supabase.from('campaign_sequences').delete().in('campaign_strategy_id', oldCampaigns.map((c) => c.id));
      await supabase.from('campaign_goals').delete().in('campaign_strategy_id', oldCampaigns.map((c) => c.id));
      await supabase.from('messaging_templates').delete().in('campaign_strategy_id', oldCampaigns.map((c) => c.id));
    }

    // Insert channel recommendations
    if (generation.channels?.length) {
      await supabase.from('channel_recommendations').insert(
        generation.channels.map((c) => ({ ...c, workspace_id: workspaceId, revenue_strategy_id: strategyId })),
      );
    }

    // Insert message library
    if (generation.messageLibrary?.length) {
      await supabase.from('message_libraries').insert(
        generation.messageLibrary.map((m) => ({ ...m, workspace_id: workspaceId, revenue_strategy_id: strategyId })),
      );
    }

    // Insert campaigns with sequences
    for (const campaign of generation.campaigns ?? []) {
      const { sequences, ...campaignFields } = campaign;
      const { data: campaignRow, error: campaignError } = await supabase
        .from('campaign_strategies')
        .insert({
          ...campaignFields,
          workspace_id: workspaceId,
          revenue_strategy_id: strategyId,
        })
        .select('id')
        .single();
      if (campaignError) continue;

      if (sequences?.length) {
        await supabase.from('campaign_sequences').insert(
          sequences.map((s) => ({
            ...s,
            workspace_id: workspaceId,
            campaign_strategy_id: campaignRow.id,
          })),
        );
      }
    }

    // Insert goals
    if (generation.goals?.length) {
      await supabase.from('campaign_goals').insert(
        generation.goals.map((g) => ({ ...g, workspace_id: workspaceId })),
      );
    }
  }

  // ----------------------------------------------------------
  // Populate Knowledge Graph
  // ----------------------------------------------------------

  private async populateKnowledgeGraph(workspaceId: string, generation: RevenueStrategyGenerationResult): Promise<void> {
    try {
      const entities: Array<{ nodeType: string; externalId?: string; displayName: string; properties?: Record<string, unknown> }> = [];
      const relationships: Array<{ sourceExternalId: string; sourceNodeType: string; targetExternalId: string; targetNodeType: string; relationshipType: string }> = [];

      const stratExtId = `revenue_strategy_${workspaceId}`;
      entities.push({ nodeType: 'revenue_strategy', externalId: stratExtId, displayName: 'Revenue Strategy', properties: { best_icp: generation.strategy.best_icp, best_market: generation.strategy.best_market } });

      for (const campaign of generation.campaigns ?? []) {
        const campExtId = `campaign_${campaign.strategy_name.toLowerCase().replace(/\s+/g, '_').slice(0, 50)}`;
        entities.push({ nodeType: 'campaign_strategy', externalId: campExtId, displayName: campaign.strategy_name, properties: { objective: campaign.objective, icp: campaign.recommended_icp, roi: campaign.expected_roi } });
        relationships.push({ sourceExternalId: stratExtId, sourceNodeType: 'revenue_strategy', targetExternalId: campExtId, targetNodeType: 'campaign_strategy', relationshipType: 'INCLUDES_CAMPAIGN' });
      }

      for (const channel of generation.channels ?? []) {
        const chExtId = `channel_rec_${channel.channel}`;
        entities.push({ nodeType: 'channel_recommendation', externalId: chExtId, displayName: channel.channel, properties: { reply_rate: channel.estimated_reply_rate, is_primary: channel.is_primary } });
        relationships.push({ sourceExternalId: stratExtId, sourceNodeType: 'revenue_strategy', targetExternalId: chExtId, targetNodeType: 'channel_recommendation', relationshipType: 'RECOMMENDS_CHANNEL' });
      }

      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: entities.map((e) => ({
          nodeType: e.nodeType as any,
          externalId: e.externalId,
          displayName: e.displayName,
          properties: e.properties ?? {},
          confidenceScore: 0.85,
        })),
        relationships: relationships.map((r) => ({
          sourceExternalId: r.sourceExternalId,
          sourceNodeType: r.sourceNodeType as any,
          targetExternalId: r.targetExternalId,
          targetNodeType: r.targetNodeType as any,
          relationshipType: r.relationshipType as any,
          confidenceScore: 0.85,
        })),
      });
    } catch {
      // Best-effort
    }
  }

  // ----------------------------------------------------------
  // Store in AI Memory
  // ----------------------------------------------------------

  private async storeInMemory(workspaceId: string, generation: RevenueStrategyGenerationResult): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'revenue_strategy',
        entityId: `revenue_strategy_${workspaceId}`,
        memoryType: 'revenue_strategy',
        title: 'Revenue Strategy',
        summary: generation.strategy.best_market ?? '',
        content: {
          best_icp: generation.strategy.best_icp,
          best_messaging_angle: generation.strategy.best_messaging_angle,
          best_outreach_channel: generation.strategy.best_outreach_channel,
          expected_reply_rate: generation.strategy.expected_reply_rate,
          expected_meeting_rate: generation.strategy.expected_meeting_rate,
          expected_revenue: generation.strategy.expected_revenue,
          campaigns: generation.campaigns?.map((c) => ({ name: c.strategy_name, objective: c.objective, roi: c.expected_roi })),
          channels: generation.channels?.map((ch) => ({ channel: ch.channel, is_primary: ch.is_primary })),
          goals: generation.goals?.map((g) => ({ type: g.goal_type, target: g.target_value })),
        },
        confidenceScore: (generation.strategy.confidence_score ?? 80) / 100,
        importanceScore: 0.95,
        workspaceId,
      });
    } catch {
      // Best-effort
    }
  }

  // ----------------------------------------------------------
  // Load revenue strategy
  // ----------------------------------------------------------

  async loadRevenueStrategy(workspaceId: string): Promise<FullRevenueStrategy | null> {
    const { data: strategy } = await supabase
      .from('revenue_strategies')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!strategy) return null;

    const [campaigns, channels, messageLibrary, goals, approvals] = await Promise.all([
      supabase.from('campaign_strategies').select('*').eq('revenue_strategy_id', strategy.id).order('created_at', { ascending: false }),
      supabase.from('channel_recommendations').select('*').eq('revenue_strategy_id', strategy.id).order('is_primary', { ascending: false }),
      supabase.from('message_libraries').select('*').eq('revenue_strategy_id', strategy.id).order('created_at', { ascending: false }),
      supabase.from('campaign_goals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
      supabase.from('strategy_approvals').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
    ]);

    // Load sequences for each campaign
    const sequences: Record<string, CampaignSequence[]> = {};
    for (const campaign of (campaigns.data ?? [])) {
      const { data: seqs } = await supabase
        .from('campaign_sequences')
        .select('*')
        .eq('campaign_strategy_id', campaign.id)
        .order('touch_order', { ascending: true });
      sequences[campaign.id] = (seqs ?? []) as CampaignSequence[];
    }

    // Load templates for each campaign
    const { data: templates } = await supabase
      .from('messaging_templates')
      .select('*')
      .in('campaign_strategy_id', (campaigns.data ?? []).map((c) => c.id));

    return {
      strategy: strategy as RevenueStrategy,
      campaigns: (campaigns.data ?? []) as CampaignStrategy[],
      sequences,
      messageLibrary: (messageLibrary.data ?? []) as MessageLibraryAsset[],
      templates: (templates ?? []) as MessagingTemplate[],
      channels: (channels.data ?? []) as ChannelRecommendation[],
      goals: (goals.data ?? []) as CampaignGoal[],
      approvals: (approvals.data ?? []) as StrategyApproval[],
    };
  }

  // ----------------------------------------------------------
  // Approve / Duplicate / Save Template
  // ----------------------------------------------------------

  async approveCampaign(campaignId: string, workspaceId: string, feedback?: string): Promise<void> {
    const { error } = await supabase.from('campaign_strategies')
      .update({ status: 'approved' })
      .eq('id', campaignId);
    if (error) throw new Error(error.message);

    await supabase.from('strategy_approvals').insert({
      workspace_id: workspaceId,
      campaign_strategy_id: campaignId,
      action: 'approve',
      status: 'approved',
      feedback: feedback ?? null,
      approved_by: (await supabase.auth.getUser()).data.user?.id ?? null,
      approved_at: new Date().toISOString(),
    });
  }

  async duplicateCampaign(campaignId: string, workspaceId: string, revenueStrategyId: string): Promise<string | null> {
    const { data: original } = await supabase.from('campaign_strategies')
      .select('*').eq('id', campaignId).maybeSingle();
    if (!original) return null;

    const { id, created_at, updated_at, ...fields } = original;
    const { data: copy, error } = await supabase.from('campaign_strategies')
      .insert({
        ...fields,
        strategy_name: `${original.strategy_name} (Copy)`,
        status: 'draft',
        workspace_id: workspaceId,
        revenue_strategy_id: revenueStrategyId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);

    await supabase.from('strategy_approvals').insert({
      workspace_id: workspaceId,
      campaign_strategy_id: campaignId,
      action: 'duplicate',
      status: 'completed',
    });

    // Copy sequences
    const { data: seqs } = await supabase.from('campaign_sequences').select('*').eq('campaign_strategy_id', campaignId);
    if (seqs?.length) {
      await supabase.from('campaign_sequences').insert(
        seqs.map((s) => {
          const { id: _sid, created_at: _ca, updated_at: _ua, ...sf } = s;
          return { ...sf, campaign_strategy_id: copy.id, workspace_id: workspaceId };
        }),
      );
    }

    return copy.id;
  }

  async saveAsTemplate(campaignId: string, workspaceId: string): Promise<void> {
    await supabase.from('strategy_approvals').insert({
      workspace_id: workspaceId,
      campaign_strategy_id: campaignId,
      action: 'save_template',
      status: 'completed',
    });
  }

  // ----------------------------------------------------------
  // Create version snapshot
  // ----------------------------------------------------------

  async createVersion(campaignId: string, workspaceId: string, changeDescription?: string): Promise<void> {
    const { data: campaign } = await supabase.from('campaign_strategies')
      .select('*').eq('id', campaignId).maybeSingle();
    if (!campaign) return;

    const { count } = await supabase.from('campaign_strategy_versions')
      .select('*', { count: 'exact', head: true })
      .eq('campaign_strategy_id', campaignId);

    await supabase.from('campaign_strategy_versions').insert({
      workspace_id: workspaceId,
      campaign_strategy_id: campaignId,
      version_number: (count ?? 0) + 1,
      snapshot: campaign,
      change_description: changeDescription ?? 'Strategy updated',
      created_by: (await supabase.auth.getUser()).data.user?.id ?? null,
    });
  }

  // ----------------------------------------------------------
  // Update methods
  // ----------------------------------------------------------

  async updateStrategy(strategyId: string, updates: Partial<RevenueStrategy>): Promise<void> {
    const { error } = await supabase.from('revenue_strategies').update(updates).eq('id', strategyId);
    if (error) throw new Error(error.message);
  }

  async updateCampaign(campaignId: string, updates: Partial<CampaignStrategy>): Promise<void> {
    const { error } = await supabase.from('campaign_strategies').update(updates).eq('id', campaignId);
    if (error) throw new Error(error.message);
  }
}

export const revenueStrategyService = new RevenueStrategyService();
