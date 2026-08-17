// ============================================================
// OutreachIntelligenceService — Main orchestrator for Phase 7
// ============================================================
//
// Generates a complete outreach intelligence profile for a prospect:
// decision, score, timing, channel, message strategy, personalization,
// and reasoning — all via a single AI Gateway call.
//
// Pipeline:
//   Prospect Discovery → Load Context → AI Generation →
//   Persist (6 tables) → Knowledge Graph → Memory

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import type {
  OutreachIntelligenceInput, OutreachIntelligenceResult,
  OutreachDecision, OutreachScore, TimingRecommendation,
  ChannelStrategy, MessageStrategy, PersonalizationProfile,
  OutreachReasoning, ProspectOutreachIntelligence, OutreachDashboard,
} from '@/types/outreach-intelligence';

class OutreachIntelligenceService {
  // ----------------------------------------------------------
  // Generate full outreach intelligence for a prospect
  // ----------------------------------------------------------

  async generateOutreachIntelligence(input: OutreachIntelligenceInput): Promise<void> {
    const { workspaceId, companyId, contactId } = input;

    // Load context from previous phases
    const context = await this.loadContext(workspaceId, companyId, contactId);

    // Generate via AI
    const result = await this.callAIGeneration(input, context);

    // Persist all results
    await this.persistResults(workspaceId, companyId, contactId, result);

    // Populate knowledge graph
    await this.populateKnowledgeGraph(workspaceId, companyId, contactId, result);

    // Store in memory
    await this.storeInMemory(workspaceId, companyId, contactId, result);
  }

  // ----------------------------------------------------------
  // Batch generate for multiple prospects
  // ----------------------------------------------------------

  async generateBatch(workspaceId: string, prospectIds: Array<{ companyId: string; contactId?: string }>): Promise<void> {
    for (const { companyId, contactId } of prospectIds) {
      try {
        const company = await this.loadCompany(companyId);
        if (!company) continue;
        const contact = contactId ? await this.loadContact(contactId) : null;
        const signals = await this.loadSignals(companyId);
        const prospectScore = await this.loadProspectScore(workspaceId, companyId);

        await this.generateOutreachIntelligence({
          workspaceId,
          companyId,
          contactId: contactId ?? undefined,
          company: { name: company.name, industry: company.industry ?? undefined, website: company.website ?? undefined, size: company.employee_count ?? company.size ?? undefined, description: company.description ?? undefined },
          contact: contact ? { full_name: contact.full_name ?? `${contact.first_name} ${contact.last_name}`, job_title: contact.job_title ?? undefined, department: contact.department ?? undefined, seniority: contact.seniority ?? undefined, linkedin_url: contact.linkedin_url ?? undefined } : undefined,
          signals,
          prospectScore: prospectScore ? { overall_prospect_score: prospectScore.overall_prospect_score, reply_probability: prospectScore.reply_probability, meeting_probability: prospectScore.meeting_probability } : undefined,
        });
      } catch (err) {
        console.error(`[OutreachIntelligence] Failed for company ${companyId}:`, err);
      }
    }
  }

  // ----------------------------------------------------------
  // AI Generation — single comprehensive call
  // ----------------------------------------------------------

  private async callAIGeneration(input: OutreachIntelligenceInput, context: Record<string, unknown>): Promise<OutreachIntelligenceResult> {
    const systemPrompt = 'You are an elite SDR Manager and outreach strategist. You determine HOW to approach each prospect — the decision, channel, timing, personalization, message strategy, and scoring. You always respond with valid JSON.';

    const userPrompt = `Generate complete outreach intelligence for this prospect.

COMPANY:
${JSON.stringify(input.company, null, 2)}

CONTACT:
${input.contact ? JSON.stringify(input.contact, null, 2) : 'N/A'}

BUYING SIGNALS:
${JSON.stringify(input.signals, null, 2)}

PROSPECT SCORE:
${input.prospectScore ? JSON.stringify(input.prospectScore, null, 2) : 'N/A'}

REVENUE STRATEGY:
${input.revenueStrategy ? JSON.stringify(input.revenueStrategy, null, 2) : 'N/A'}

ADDITIONAL CONTEXT:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "decision": {
    "type": "contact_immediately|wait_3_days|wait_7_days|engage_content_first|connect_first|email_first|linkedin_first|multi_channel|skip_prospect|revisit_later",
    "reason": "Explain why this decision was made based on signals and fit",
    "confidence": 0.85
  },
  "score": {
    "connection_probability": 0.65,
    "reply_probability": 0.18,
    "meeting_probability": 0.08,
    "revenue_probability": 0.04,
    "relationship_difficulty": 0.3,
    "channel_effectiveness": {"linkedin": 0.8, "email": 0.6, "voice_note": 0.5, "video": 0.4},
    "timing_score": 82,
    "personalization_score": 88,
    "overall_outreach_score": 78,
    "scoring_explanation": {
      "connection_probability": "High because...",
      "reply_probability": "Moderate because...",
      "meeting_probability": "Lower because...",
      "overall": "This prospect scores high because..."
    },
    "confidence": 0.82
  },
  "timing": {
    "best_day": "tuesday",
    "best_hour": 10,
    "best_sequence_timing": {"touch1": "day_0", "touch2": "day_3", "touch3": "day_7", "touch4": "day_14"},
    "follow_up_delay_days": 3,
    "maximum_attempts": 5,
    "cooling_period_days": 30,
    "retry_window_days": 90,
    "timezone": "America/Los_Angeles",
    "timing_reason": "Tuesday morning has the highest reply rate for SaaS VP Sales...",
    "confidence": 0.78
  },
  "channel": {
    "recommended_channel": "linkedin_email|linkedin|email|voice_note|video|multi_channel",
    "channel_reason": "LinkedIn first because the prospect is active on LinkedIn and has a public profile...",
    "channel_priority": [{"channel": "linkedin", "priority": 1}, {"channel": "email", "priority": 2}],
    "expected_performance": {"expected_reply_rate": 0.18, "expected_meeting_rate": 0.08, "expected_response_time": "2-3 days"},
    "linkedin_feasibility": "High — prospect has 500+ connections and posts regularly",
    "email_feasibility": "Medium — email found via Apollo but deliverability uncertain",
    "confidence": 0.8
  },
  "message": {
    "connection_request_strategy": "Reference their recent Series B announcement and congratulate them on the growth milestone",
    "first_message_strategy": "Lead with the pain point of scaling sales teams efficiently, reference their hiring of 5 SDRs, offer a framework",
    "second_message_strategy": "Share a relevant case study of a similar SaaS company that scaled revenue 3x using our platform",
    "follow_up_strategy": "Soft value-add follow-up with a different angle — share an industry report relevant to their space",
    "re_engagement_strategy": "Breakup email with a final value proposition and a soft CTA to reconnect when timing is right",
    "email_strategy": "Subject line referencing their recent funding. Body: 3 short paragraphs. Pain point → Solution → CTA",
    "voice_note_strategy": "30-second voice note referencing their recent LinkedIn post about sales team scaling challenges",
    "video_strategy": "Personalized Loom video showing how our platform solves their specific SDR onboarding challenge",
    "cta_strategy": "Soft CTA: 'Worth a 15-min chat?' — low friction, high relevance",
    "objection_prevention_strategy": "Address budget concerns by framing as ROI-positive within 90 days. Address timing by referencing their growth signals",
    "strategy_reasoning": "The messaging strategy is designed to warm up the prospect through value-first outreach, leveraging their recent funding and hiring signals as conversation starters",
    "confidence": 0.82
  },
  "personalization": {
    "personalization_summary": "Jane Doe is the VP of Sales at Acme Corp, a Series B SaaS company actively scaling their sales team. She recently posted about SDR onboarding challenges...",
    "communication_style": "Direct, data-driven, values efficiency",
    "tone": "Professional but warm, peer-to-peer",
    "value_proposition": "Help Acme scale their sales team's productivity by 3x without adding headcount",
    "cta_strategy": "Soft meeting CTA focused on sharing a framework, not selling",
    "website_references": [{"url": "https://acme.com/careers", "note": "5 open SDR roles posted"}],
    "news_references": [{"title": "Acme Corp raises $25M Series B", "url": "https://techcrunch.com/...", "date": "2025-01-15"}],
    "linkedin_references": [{"url": "https://linkedin.com/in/janedoe", "note": "Recent post about SDR onboarding challenges"}],
    "technology_references": [{"technology": "Salesforce", "note": "Using Salesforce — likely has integration needs"}],
    "industry_references": [{"industry": "SaaS", "note": "High-growth SaaS companies are our ideal fit"}],
    "pain_point_references": [{"pain_point": "Scaling sales team efficiently", "evidence": "Hiring 5 SDRs but no scalable onboarding process"}],
    "competitor_references": [{"competitor": "Gong", "note": "Already using Gong — understands conversation intelligence"}],
    "case_study_recommendations": [{"title": "How SimilarCorp scaled revenue 3x", "relevance": "Same industry, same size, same challenge"}],
    "trust_signals": [{"type": "case_study", "text": "We helped SimilarCorp reduce SDR ramp time by 60%"}],
    "conversation_angle": "Focus on the challenge of scaling a sales team post-Series B — they have budget but need efficiency",
    "icebreakers": [
      {"type": "funding", "text": "Congrats on the Series B! Scaling the sales team must be top of mind right now."},
      {"type": "hiring", "text": "Saw you're hiring 5 SDRs — what's your onboarding process looking like these days?"},
      {"type": "content", "text": "Loved your post about SDR onboarding challenges — we're seeing the same pattern across 50+ SaaS companies."}
    ],
    "confidence": 0.85
  },
  "reasoning": [
    {"type": "decision", "text": "We recommend contacting immediately because the prospect has 3 active buying signals (funding, hiring, technology adoption) and a high ICP fit score of 85", "factors": {"signal_count": 3, "icp_fit": 85, "signal_strength": 0.8}, "confidence": 0.85},
    {"type": "channel", "text": "LinkedIn first because the prospect is active on LinkedIn with 500+ connections and posts regularly about sales topics", "factors": {"linkedin_activity": "high", "email_availability": "medium"}, "confidence": 0.8},
    {"type": "timing", "text": "Tuesday 10am is optimal because SaaS VP Sales are most responsive mid-morning on weekdays", "factors": {"industry": "SaaS", "role": "VP Sales"}, "confidence": 0.78},
    {"type": "personalization", "text": "The personalization strategy leverages their recent funding and hiring signals as conversation starters, which has a 3x higher reply rate than generic outreach", "factors": {"signal_count": 3, "personalization_score": 88}, "confidence": 0.85}
  ]
}

Return ONLY the JSON object.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.4,
      maxTokens: 8000,
      workspaceId: input.workspaceId,
      agentName: 'outreach_intelligence_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as OutreachIntelligenceResult;
  }

  // ----------------------------------------------------------
  // Persist all results to database
  // ----------------------------------------------------------

  private async persistResults(workspaceId: string, companyId: string, contactId: string | null, result: OutreachIntelligenceResult): Promise<void> {
    // Supersede previous active decision
    await supabase.from('outreach_decisions').update({ status: 'superseded' }).eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).eq('status', 'active');

    // Insert decision
    await supabase.from('outreach_decisions').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contactId ?? null,
      decision: result.decision.type,
      decision_reason: result.decision.reason,
      confidence_score: result.decision.confidence,
    });

    // Insert score
    await supabase.from('outreach_scores').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contactId ?? null,
      connection_probability: result.score.connection_probability,
      reply_probability: result.score.reply_probability,
      meeting_probability: result.score.meeting_probability,
      revenue_probability: result.score.revenue_probability,
      relationship_difficulty: result.score.relationship_difficulty,
      channel_effectiveness: result.score.channel_effectiveness,
      timing_score: result.score.timing_score,
      personalization_score: result.score.personalization_score,
      overall_outreach_score: result.score.overall_outreach_score,
      scoring_explanation: result.score.scoring_explanation,
      confidence_score: result.score.confidence,
    });

    // Insert timing
    await supabase.from('timing_recommendations').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contactId ?? null,
      best_day: result.timing.best_day,
      best_hour: result.timing.best_hour,
      best_sequence_timing: result.timing.best_sequence_timing,
      follow_up_delay_days: result.timing.follow_up_delay_days,
      maximum_attempts: result.timing.maximum_attempts,
      cooling_period_days: result.timing.cooling_period_days,
      retry_window_days: result.timing.retry_window_days,
      timezone: result.timing.timezone,
      timezone_aware: true,
      timing_reason: result.timing.timing_reason,
      confidence_score: result.timing.confidence,
    });

    // Insert channel strategy
    await supabase.from('channel_strategies').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contactId ?? null,
      recommended_channel: result.channel.recommended_channel,
      channel_reason: result.channel.channel_reason,
      channel_priority: result.channel.channel_priority,
      expected_performance: result.channel.expected_performance,
      linkedin_feasibility: result.channel.linkedin_feasibility,
      email_feasibility: result.channel.email_feasibility,
      confidence_score: result.channel.confidence,
    });

    // Insert message strategy
    await supabase.from('message_strategies').insert({
      workspace_id: workspaceId,
      company_id: companyId,
      contact_id: contactId ?? null,
      connection_request_strategy: result.message.connection_request_strategy,
      first_message_strategy: result.message.first_message_strategy,
      second_message_strategy: result.message.second_message_strategy,
      follow_up_strategy: result.message.follow_up_strategy,
      re_engagement_strategy: result.message.re_engagement_strategy,
      email_strategy: result.message.email_strategy,
      voice_note_strategy: result.message.voice_note_strategy,
      video_strategy: result.message.video_strategy,
      cta_strategy: result.message.cta_strategy,
      objection_prevention_strategy: result.message.objection_prevention_strategy,
      strategy_reasoning: result.message.strategy_reasoning,
      confidence_score: result.message.confidence,
    });

    // Upsert personalization profile
    await this.upsertPersonalizationProfile(workspaceId, companyId, contactId, result.personalization);

    // Insert reasoning
    if (result.reasoning?.length) {
      await supabase.from('outreach_reasoning').insert(
        result.reasoning.map((r) => ({
          workspace_id: workspaceId,
          company_id: companyId,
          contact_id: contactId ?? null,
          reasoning_type: r.type,
          reasoning_text: r.text,
          reasoning_factors: r.factors,
          confidence_score: r.confidence,
        })),
      );
    }
  }

  private async upsertPersonalizationProfile(workspaceId: string, companyId: string, contactId: string | null, p: OutreachIntelligenceResult['personalization']): Promise<void> {
    const { data: existing } = await supabase
      .from('personalization_profiles')
      .select('id, version')
      .eq('workspace_id', workspaceId)
      .eq('company_id', companyId)
      .eq('contact_id', contactId ?? null)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Create new version
      await supabase.from('personalization_profiles').insert({
        workspace_id: workspaceId,
        company_id: companyId,
        contact_id: contactId ?? null,
        personalization_summary: p.personalization_summary,
        personalization_score: p.confidence * 100,
        communication_style: p.communication_style,
        tone: p.tone,
        value_proposition: p.value_proposition,
        cta_strategy: p.cta_strategy,
        website_references: p.website_references,
        news_references: p.news_references,
        linkedin_references: p.linkedin_references,
        technology_references: p.technology_references,
        industry_references: p.industry_references,
        pain_point_references: p.pain_point_references,
        competitor_references: p.competitor_references,
        case_study_recommendations: p.case_study_recommendations,
        trust_signals: p.trust_signals,
        conversation_angle: p.conversation_angle,
        icebreakers: p.icebreakers,
        status: 'active',
        version: (existing.version ?? 1) + 1,
      });
    } else {
      await supabase.from('personalization_profiles').insert({
        workspace_id: workspaceId,
        company_id: companyId,
        contact_id: contactId ?? null,
        personalization_summary: p.personalization_summary,
        personalization_score: p.confidence * 100,
        communication_style: p.communication_style,
        tone: p.tone,
        value_proposition: p.value_proposition,
        cta_strategy: p.cta_strategy,
        website_references: p.website_references,
        news_references: p.news_references,
        linkedin_references: p.linkedin_references,
        technology_references: p.technology_references,
        industry_references: p.industry_references,
        pain_point_references: p.pain_point_references,
        competitor_references: p.competitor_references,
        case_study_recommendations: p.case_study_recommendations,
        trust_signals: p.trust_signals,
        conversation_angle: p.conversation_angle,
        icebreakers: p.icebreakers,
        status: 'active',
        version: 1,
      });
    }
  }

  // ----------------------------------------------------------
  // Knowledge Graph + Memory
  // ----------------------------------------------------------

  private async populateKnowledgeGraph(workspaceId: string, companyId: string, contactId: string | null, result: OutreachIntelligenceResult): Promise<void> {
    try {
      const entities: Array<{ nodeType: string; externalId: string; displayName: string; properties: Record<string, unknown> }> = [];
      const relationships: Array<{ sourceExternalId: string; sourceNodeType: string; targetExternalId: string; targetNodeType: string; relationshipType: string }> = [];

      const companyExtId = `company_${companyId}`;
      entities.push({
        nodeType: 'outreach_decision',
        externalId: `outreach_decision_${companyId}_${contactId ?? 'company'}`,
        displayName: `Outreach Decision: ${result.decision.type}`,
        properties: { decision: result.decision.type, reason: result.decision.reason, confidence: result.decision.confidence },
      });
      relationships.push({
        sourceExternalId: companyExtId,
        sourceNodeType: 'company',
        targetExternalId: `outreach_decision_${companyId}_${contactId ?? 'company'}`,
        targetNodeType: 'outreach_decision',
        relationshipType: 'HAS_OUTREACH_DECISION',
      });

      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: entities.map((e) => ({
          nodeType: e.nodeType as any,
          externalId: e.externalId,
          displayName: e.displayName,
          properties: e.properties,
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
    } catch { /* best-effort */ }
  }

  private async storeInMemory(workspaceId: string, companyId: string, contactId: string | null, result: OutreachIntelligenceResult): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'outreach_intelligence',
        entityId: `outreach_${companyId}_${contactId ?? 'company'}`,
        memoryType: 'outreach_intelligence',
        title: `Outreach Intelligence: ${result.decision.type}`,
        summary: result.decision.reason,
        content: {
          decision: result.decision.type,
          channel: result.channel.recommended_channel,
          overall_score: result.score.overall_outreach_score,
          reply_probability: result.score.reply_probability,
          meeting_probability: result.score.meeting_probability,
          best_day: result.timing.best_day,
          best_hour: result.timing.best_hour,
          cta: result.message.cta_strategy,
          personalization_summary: result.personalization.personalization_summary,
        },
        confidenceScore: result.decision.confidence,
        importanceScore: 0.85,
        workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // Context loading from previous phases
  // ----------------------------------------------------------

  private async loadContext(workspaceId: string, companyId: string, contactId: string | null): Promise<Record<string, unknown>> {
    const [company, signals, prospectScore, revenueStrategy] = await Promise.all([
      this.loadCompany(companyId),
      this.loadSignals(companyId),
      this.loadProspectScore(workspaceId, companyId),
      this.loadRevenueStrategy(workspaceId),
    ]);

    const contact = contactId ? await this.loadContact(contactId) : null;

    return {
      company: company ? { name: company.name, industry: company.industry, website: company.website, size: company.employee_count, description: company.description } : null,
      contact: contact ? { full_name: contact.full_name, job_title: contact.job_title, department: contact.department, seniority: contact.seniority } : null,
      signals: signals.map((s) => ({ type: s.signal_type, strength: s.signal_strength, data: s.signal_data })),
      prospectScore: prospectScore ? { overall: prospectScore.overall_prospect_score, reply: prospectScore.reply_probability, meeting: prospectScore.meeting_probability } : null,
      revenueStrategy: revenueStrategy ? { best_messaging_angle: revenueStrategy.best_messaging_angle, best_outreach_channel: revenueStrategy.best_outreach_channel } : null,
    };
  }

  private async loadCompany(companyId: string): Promise<{ name: string; industry: string | null; website: string | null; employee_count: string | null; size: string | null; description: string | null } | null> {
    const { data } = await supabase.from('companies').select('*').eq('id', companyId).maybeSingle();
    return data as any;
  }

  private async loadContact(contactId: string): Promise<{ first_name: string; last_name: string; full_name: string | null; job_title: string | null; department: string | null; seniority: string | null; linkedin_url: string | null } | null> {
    const { data } = await supabase.from('contacts').select('*').eq('id', contactId).maybeSingle();
    return data as any;
  }

  private async loadSignals(companyId: string): Promise<Array<{ signal_type: string; signal_strength: number; signal_data: Record<string, unknown> }>> {
    const { data } = await supabase.from('company_signals').select('signal_type, signal_strength, signal_data').eq('company_id', companyId);
    return (data ?? []) as any;
  }

  private async loadProspectScore(workspaceId: string, companyId: string): Promise<{ overall_prospect_score: number; reply_probability: number; meeting_probability: number } | null> {
    const { data } = await supabase.from('prospect_scores').select('overall_prospect_score, reply_probability, meeting_probability').eq('workspace_id', workspaceId).eq('company_id', companyId).order('scored_at', { ascending: false }).limit(1).maybeSingle();
    return data as any;
  }

  private async loadRevenueStrategy(workspaceId: string): Promise<{ best_messaging_angle: string | null; best_outreach_channel: string | null } | null> {
    const { data } = await supabase.from('revenue_strategies').select('best_messaging_angle, best_outreach_channel').eq('workspace_id', workspaceId).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return data as any;
  }

  // ----------------------------------------------------------
  // Load dashboard data
  // ----------------------------------------------------------

  async loadDashboard(workspaceId: string): Promise<OutreachDashboard> {
    const [decisions, scores] = await Promise.all([
      supabase.from('outreach_decisions').select('*').eq('workspace_id', workspaceId).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('outreach_scores').select('*').eq('workspace_id', workspaceId).order('overall_outreach_score', { ascending: false }),
    ]);

    const decisionList = (decisions.data ?? []) as OutreachDecision[];
    const scoreList = (scores.data ?? []) as OutreachScore[];

    const contactImmediately = decisionList.filter((d) => d.decision === 'contact_immediately').length;
    const waitOrNurture = decisionList.filter((d) => ['wait_3_days', 'wait_7_days', 'engage_content_first', 'connect_first'].includes(d.decision)).length;
    const skipOrRevisit = decisionList.filter((d) => ['skip_prospect', 'revisit_later'].includes(d.decision)).length;

    const avgOutreachScore = scoreList.length > 0 ? Math.round(scoreList.reduce((s, sc) => s + sc.overall_outreach_score, 0) / scoreList.length) : 0;
    const avgReply = scoreList.length > 0 ? scoreList.reduce((s, sc) => s + sc.reply_probability, 0) / scoreList.length : 0;
    const avgMeeting = scoreList.length > 0 ? scoreList.reduce((s, sc) => s + sc.meeting_probability, 0) / scoreList.length : 0;

    // Load top prospects with full intelligence
    const topDecisionIds = decisionList.slice(0, 10);
    const topProspects: ProspectOutlookIntelligence[] = [];
    for (const dec of topDecisionIds) {
      const intel = await this.loadProspectIntelligence(workspaceId, dec.company_id, dec.contact_id);
      if (intel) topProspects.push(intel);
    }

    // Load recent reasoning
    const { data: recentReasoning } = await supabase.from('outreach_reasoning').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(10);
    const reasoning = (recentReasoning ?? []) as OutreachReasoning[];

    return {
      totalProspects: decisionList.length,
      totalDecided: decisionList.length,
      contactImmediately,
      waitOrNurture,
      skipOrRevisit,
      avgOutreachScore,
      avgReplyProbability: avgReply,
      avgMeetingProbability: avgMeeting,
      topProspects,
      recentReasoning: reasoning,
    };
  }

  // ----------------------------------------------------------
  // Load full intelligence for a single prospect
  // ----------------------------------------------------------

  async loadProspectIntelligence(workspaceId: string, companyId: string | null, contactId: string | null): Promise<ProspectOutreachIntelligence | null> {
    if (!companyId && !contactId) return null;

    const company = companyId ? await this.loadCompany(companyId) : null;
    const contact = contactId ? await this.loadContact(contactId) : null;

    const [decision, score, timing, channel, message, personalization, reasoning] = await Promise.all([
      companyId ? supabase.from('outreach_decisions').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).eq('status', 'active').order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      companyId ? supabase.from('outreach_scores').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).order('scored_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      companyId ? supabase.from('timing_recommendations').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      companyId ? supabase.from('channel_strategies').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      companyId ? supabase.from('message_strategies').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).order('created_at', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      companyId ? supabase.from('personalization_profiles').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).order('version', { ascending: false }).limit(1).maybeSingle() : Promise.resolve({ data: null }),
      companyId ? supabase.from('outreach_reasoning').select('*').eq('workspace_id', workspaceId).eq('company_id', companyId).eq('contact_id', contactId ?? null).order('created_at', { ascending: false }).limit(5) : Promise.resolve({ data: null }),
    ]);

    return {
      company: company ? { id: companyId!, name: company.name, industry: company.industry, website: company.website } : { id: companyId ?? '', name: 'Unknown', industry: null, website: null },
      contact: contact ? { id: contactId!, full_name: contact.full_name ?? `${contact.first_name} ${contact.last_name}`, job_title: contact.job_title, department: contact.department, linkedin_url: contact.linkedin_url } : null,
      decision: (decision.data ?? null) as OutreachDecision | null,
      score: (score.data ?? null) as OutreachScore | null,
      timing: (timing.data ?? null) as TimingRecommendation | null,
      channel: (channel.data ?? null) as ChannelStrategy | null,
      message: (message.data ?? null) as MessageStrategy | null,
      personalization: (personalization.data ?? null) as PersonalizationProfile | null,
      reasoning: (reasoning.data ?? []) as OutreachReasoning[],
    };
  }

  // ----------------------------------------------------------
  // Load all prospects with intelligence
  // ----------------------------------------------------------

  async loadAllProspects(workspaceId: string): Promise<ProspectOutreachIntelligence[]> {
    const { data: decisions } = await supabase
      .from('outreach_decisions')
      .select('company_id, contact_id')
      .eq('workspace_id', workspaceId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(50);

    const prospects: ProspectOutreachIntelligence[] = [];
    for (const d of (decisions ?? [])) {
      const intel = await this.loadProspectIntelligence(workspaceId, d.company_id, d.contact_id);
      if (intel) prospects.push(intel);
    }
    return prospects;
  }

  // ----------------------------------------------------------
  // Load libraries
  // ----------------------------------------------------------

  async loadCTALibrary(workspaceId: string) {
    const { data } = await supabase.from('cta_library').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('effectiveness_score', { ascending: false });
    return data ?? [];
  }

  async loadIcebreakerLibrary(workspaceId: string) {
    const { data } = await supabase.from('icebreaker_library').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('effectiveness_score', { ascending: false });
    return data ?? [];
  }

  async loadTrustSignalLibrary(workspaceId: string) {
    const { data } = await supabase.from('trust_signal_library').select('*').eq('workspace_id', workspaceId).eq('is_active', true).order('effectiveness_score', { ascending: false });
    return data ?? [];
  }

  async loadReasoning(workspaceId: string) {
    const { data } = await supabase.from('outreach_reasoning').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50);
    return data ?? [];
  }
}

export const outreachIntelligenceService = new OutreachIntelligenceService();
