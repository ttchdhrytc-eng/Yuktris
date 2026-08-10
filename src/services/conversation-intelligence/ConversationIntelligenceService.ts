// ============================================================
// ConversationIntelligenceService — Main orchestrator Phase 9
// ============================================================
//
// Pipeline:
//   Incoming Message → Load Context → AI Analysis →
//   Classify Intent → Detect Objections → Determine Buying Stage →
//   Generate Response Strategy → Score → Persist → Notify
//
// This engine never sends replies. It only decides WHAT the reply
// should be and WHAT should happen next.

import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { knowledgeGraphService } from '@/services/knowledge-graph/KnowledgeGraphService';
import { memoryEngine } from '@/services/memory/MemoryEngine';
import { contextEngine } from '@/services/context/ContextEngine';
import type {
  ConversationAnalysisInput, ConversationAnalysisResult,
  ConversationWithIntelligence, ConversationIntelligenceDashboard,
  ConversationIntent, ConversationBuyingStage, ConversationRecommendation,
  ConversationReplyLibraryEntry, ConversationLabel, ConversationScore,
  ConversationContextEntry, ConversationEvent, BuyingStage,
} from '@/types/conversation-intelligence';

class ConversationIntelligenceService {
  // ----------------------------------------------------------
  // Ingest a new message (from LinkedIn, email, etc.)
  // ----------------------------------------------------------

  async ingestMessage(workspaceId: string, params: {
    conversation_id: string;
    sender: 'prospect' | 'user' | 'ai';
    channel: string;
    content: string;
    message_type?: string;
    attachments?: unknown[];
    metadata?: Record<string, unknown>;
  }): Promise<string> {
    const { data, error } = await supabase.from('conversation_messages').insert({
      conversation_id: params.conversation_id,
      workspace_id: workspaceId,
      sender: params.sender,
      channel: params.channel,
      content: params.content,
      message_type: params.message_type ?? 'text',
      attachments: params.attachments ?? [],
      metadata: params.metadata ?? {},
      timestamp: new Date().toISOString(),
    }).select('id').single();
    if (error) throw new Error(error.message);

    // Record event
    await supabase.from('conversation_events').insert({
      workspace_id: workspaceId,
      conversation_id: params.conversation_id,
      message_id: data.id,
      event_type: params.sender === 'prospect' ? 'message_received' : 'message_sent',
      event_data: { channel: params.channel, message_type: params.message_type ?? 'text' },
    });

    // Update thread
    const { data: thread } = await supabase
      .from('conversation_threads')
      .select('message_count')
      .eq('conversation_id', params.conversation_id)
      .limit(1)
      .maybeSingle();
    if (thread) {
      await supabase.from('conversation_threads').update({
        message_count: (thread.message_count ?? 0) + 1,
        last_message_at: new Date().toISOString(),
      }).eq('id', thread.id);
    }

    // Auto-analyze if it's from prospect
    if (params.sender === 'prospect') {
      await this.analyzeConversation({ workspaceId, conversationId: params.conversation_id });
    }

    return data.id;
  }

  // ----------------------------------------------------------
  // Analyze a conversation — the core AI pipeline
  // ----------------------------------------------------------

  async analyzeConversation(input: ConversationAnalysisInput): Promise<void> {
    const { workspaceId, conversationId } = input;

    // Load context from previous phases
    const context = await this.loadConversationContext(workspaceId, conversationId, input);

    // Generate via AI
    const result = await this.callAIAnalysis(input, context);

    // Persist all results
    await this.persistResults(workspaceId, conversationId, result);

    // Update conversation with buying stage, meeting readiness, risk
    await this.updateConversation(workspaceId, conversationId, result);

    // Populate knowledge graph
    await this.populateKnowledgeGraph(workspaceId, conversationId, result);

    // Store in memory
    await this.storeInMemory(workspaceId, conversationId, input, result);

    // Create notifications for high-priority events
    await this.createNotifications(workspaceId, conversationId, result);
  }

  // ----------------------------------------------------------
  // AI Analysis — single comprehensive call
  // ----------------------------------------------------------

  private async callAIAnalysis(input: ConversationAnalysisInput, context: Record<string, unknown>): Promise<ConversationAnalysisResult> {
    const systemPrompt = 'You are an elite sales conversation analyst. You analyze conversations between a sales team and prospects, determining intent, sentiment, buying stage, objections, recommended actions, and response strategies. You always respond with valid JSON.';

    const userPrompt = `Analyze this sales conversation and generate conversation intelligence.

PROSPECT: ${input.prospectName}
TITLE: ${input.prospectTitle ?? 'N/A'}
COMPANY: ${input.companyName}
PREVIOUS BUYING STAGE: ${input.previousStage ?? 'cold'}

MESSAGES:
${JSON.stringify(input.messages, null, 2)}

CONTEXT FROM PREVIOUS PHASES:
${JSON.stringify(context, null, 2)}

Return ONLY valid JSON (no markdown, no code blocks) with this exact structure:

{
  "intent": {
    "primary_intent": "positive_interest|negative_interest|question|objection|pricing_request|demo_request|meeting_request|referral|need_more_info|competitor_mention|budget_concern|authority_concern|timing_concern|security_concern|compliance_concern|no_interest|not_decision_maker|follow_up_later|spam|unknown",
    "secondary_intent": null,
    "conversation_goal": "What the prospect is trying to achieve in this conversation",
    "urgency": "low|medium|high|critical",
    "likelihood_to_buy": 0.35,
    "meeting_likelihood": 0.2,
    "revenue_opportunity": "Description of revenue opportunity or null",
    "confidence": 0.85,
    "reasoning": "Why this intent was classified"
  },
  "sentiment": {
    "sentiment": "very_positive|positive|neutral|negative|very_negative",
    "confidence": 0.8,
    "reasoning": "Why this sentiment was detected"
  },
  "buyingStage": {
    "buying_stage": "cold|aware|interested|evaluating|decision|negotiation|meeting_scheduled|proposal_sent|closed_won|closed_lost",
    "stage_reason": "Why this buying stage was assigned",
    "stage_signals": [{"signal": "Asked about pricing", "strength": 0.8}, {"signal": "Mentioned competitor", "strength": 0.6}],
    "confidence": 0.82
  },
  "objections": [
    {
      "objection_category": "too_expensive|already_using_competitor|no_budget|no_time|wrong_person|not_interested|call_later|email_me|need_approval|need_technical_info|need_case_study|need_roi|need_proposal|need_security_info|need_compliance_docs",
      "root_cause": "The underlying reason for the objection",
      "suggested_response": "How to respond to this objection",
      "supporting_material": "What material to share (case study, ROI calculator, etc.)",
      "confidence": 0.8
    }
  ],
  "recommendation": {
    "recommended_action": "reply_now|wait|book_meeting|send_proposal|send_case_study|send_roi_calculator|escalate_to_sales|escalate_to_founder|escalate_to_support|disqualify|nurture|no_action",
    "action_reason": "Why this action is recommended",
    "action_priority": "low|medium|high|critical",
    "confidence": 0.85,
    "reasoning": "Detailed reasoning for the recommendation"
  },
  "replies": [
    {"reply_type": "suggested_reply", "reply_text": "The main suggested reply", "cta": "Worth a 15-min chat?", "confidence": 0.85},
    {"reply_type": "alternative_reply", "reply_text": "An alternative approach", "cta": null, "confidence": 0.75},
    {"reply_type": "short_reply", "reply_text": "A brief version", "cta": null, "confidence": 0.7},
    {"reply_type": "professional_tone", "reply_text": "Formal professional version", "cta": "Would you be open to a brief call?", "confidence": 0.8},
    {"reply_type": "friendly_tone", "reply_text": "Casual friendly version", "cta": "Up for a quick chat?", "confidence": 0.75},
    {"reply_type": "follow_up_strategy", "reply_text": "Strategy for following up if no reply", "cta": null, "confidence": 0.7}
  ],
  "score": {
    "intent_score": 75,
    "sentiment_score": 70,
    "engagement_score": 65,
    "buying_stage_score": 60,
    "meeting_readiness_score": 40,
    "risk_score": 20,
    "overall_score": 68,
    "score_explanation": {
      "intent": "High intent because prospect asked about pricing",
      "engagement": "Moderate engagement with 3 messages exchanged",
      "overall": "This conversation shows buying signals but needs nurturing"
    },
    "confidence": 0.82
  },
  "summary": {
    "summary": "A concise summary of the conversation so far",
    "executive_summary": "One-paragraph executive summary for leadership",
    "next_action": "The immediate next action to take",
    "recommended_followup": "When and how to follow up",
    "escalation_suggestion": "Whether to escalate and to whom, or null",
    "meeting_readiness": "not_ready|warming_up|almost_ready|ready|handed_off"
  },
  "labels": ["hot_lead", "pricing_discussion"],
  "meetingReadiness": {
    "level": "not_ready|warming_up|almost_ready|ready|handed_off",
    "reason": "Why this meeting readiness level was assigned",
    "confidence": 0.8
  },
  "risk": {
    "level": "low|medium|high|critical",
    "factors": ["List of risk factors if any"],
    "confidence": 0.8
  }
}

Return ONLY the JSON object.`;

    const response = await aiGateway.generateStructured({
      systemPrompt,
      userPrompt,
      temperature: 0.3,
      maxTokens: 6000,
      workspaceId: input.workspaceId,
      agentName: 'conversation_intelligence_agent',
      schema: { type: 'object' },
    });

    return (response.structuredData ?? JSON.parse(response.content)) as ConversationAnalysisResult;
  }

  // ----------------------------------------------------------
  // Persist all analysis results
  // ----------------------------------------------------------

  private async persistResults(workspaceId: string, conversationId: string, result: ConversationAnalysisResult): Promise<void> {
    // Insert intent
    await supabase.from('conversation_intents').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      primary_intent: result.intent.primary_intent,
      secondary_intent: result.intent.secondary_intent,
      conversation_goal: result.intent.conversation_goal,
      urgency: result.intent.urgency,
      likelihood_to_buy: result.intent.likelihood_to_buy,
      meeting_likelihood: result.intent.meeting_likelihood,
      revenue_opportunity: result.intent.revenue_opportunity,
      confidence: result.intent.confidence,
      reasoning: result.intent.reasoning,
    });

    // Insert buying stage (versioned)
    const { data: prevStage } = await supabase
      .from('conversation_buying_stage')
      .select('buying_stage, version')
      .eq('conversation_id', conversationId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from('conversation_buying_stage').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      buying_stage: result.buyingStage.buying_stage,
      previous_stage: prevStage?.buying_stage ?? null,
      stage_reason: result.buyingStage.stage_reason,
      stage_signals: result.buyingStage.stage_signals,
      confidence: result.buyingStage.confidence,
      version: (prevStage?.version ?? 0) + 1,
    });

    // Insert recommendation
    await supabase.from('conversation_recommendations').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      recommended_action: result.recommendation.recommended_action,
      action_reason: result.recommendation.action_reason,
      action_priority: result.recommendation.action_priority,
      confidence: result.recommendation.confidence,
      reasoning: result.recommendation.reasoning,
    });

    // Insert replies
    if (result.replies?.length) {
      await supabase.from('conversation_reply_library').insert(
        result.replies.map((r) => ({
          workspace_id: workspaceId,
          conversation_id: conversationId,
          reply_type: r.reply_type,
          reply_text: r.reply_text,
          cta: r.cta,
          confidence: r.confidence,
          status: 'pending',
        })),
      );
    }

    // Insert/upsert score
    const { data: existingScore } = await supabase
      .from('conversation_score')
      .select('id, version')
      .eq('conversation_id', conversationId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from('conversation_score').insert({
      workspace_id: workspaceId,
      conversation_id: conversationId,
      intent_score: result.score.intent_score,
      sentiment_score: result.score.sentiment_score,
      engagement_score: result.score.engagement_score,
      buying_stage_score: result.score.buying_stage_score,
      meeting_readiness_score: result.score.meeting_readiness_score,
      risk_score: result.score.risk_score,
      overall_score: result.score.overall_score,
      score_explanation: result.score.score_explanation,
      confidence: result.score.confidence,
      version: (existingScore?.version ?? 0) + 1,
    });

    // Insert labels (upsert — delete old, insert new)
    if (result.labels?.length) {
      await supabase.from('conversation_labels').delete().eq('conversation_id', conversationId);
      await supabase.from('conversation_labels').insert(
        result.labels.map((label) => ({
          workspace_id: workspaceId,
          conversation_id: conversationId,
          label,
          label_confidence: 0.8,
        })),
      );
    }

    // Upsert summary
    const { data: existingSummary } = await supabase
      .from('conversation_summary')
      .select('id')
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (existingSummary) {
      await supabase.from('conversation_summary').update({
        summary: result.summary.summary,
        next_action: result.summary.next_action,
        meeting_readiness: result.summary.meeting_readiness,
        executive_summary: result.summary.executive_summary,
        recommended_followup: result.summary.recommended_followup,
        escalation_suggestion: result.summary.escalation_suggestion,
      }).eq('id', existingSummary.id);
    } else {
      await supabase.from('conversation_summary').insert({
        conversation_id: conversationId,
        summary: result.summary.summary,
        next_action: result.summary.next_action,
        meeting_readiness: result.summary.meeting_readiness,
        executive_summary: result.summary.executive_summary,
        recommended_followup: result.summary.recommended_followup,
        escalation_suggestion: result.summary.escalation_suggestion,
      });
    }
  }

  // ----------------------------------------------------------
  // Update conversation with intelligence
  // ----------------------------------------------------------

  private async updateConversation(workspaceId: string, conversationId: string, result: ConversationAnalysisResult): Promise<void> {
    await supabase.from('conversations').update({
      buying_stage: result.buyingStage.buying_stage,
      meeting_readiness_level: result.meetingReadiness.level,
      risk_level: result.risk.level,
      overall_confidence: result.score.confidence,
      last_analyzed_at: new Date().toISOString(),
    }).eq('id', conversationId);
  }

  // ----------------------------------------------------------
  // Load context from previous phases
  // ----------------------------------------------------------

  private async loadConversationContext(workspaceId: string, conversationId: string, input: ConversationAnalysisInput): Promise<Record<string, unknown>> {
    const [company, personalization, outreachDecision, messageStrategy] = await Promise.all([
      this.loadCompany(input.companyName),
      this.loadPersonalization(workspaceId, input.companyName),
      this.loadOutreachDecision(workspaceId, conversationId),
      this.loadMessageStrategy(workspaceId, input.companyName),
    ]);

    // Load memory for this conversation
    let memoryContext: Record<string, unknown> = {};
    try {
      const memories = await memoryEngine.getMemoriesByEntity('conversation', conversationId, workspaceId);
      memoryContext = { memoryCount: memories.length, recentMemories: memories.slice(0, 5).map((m) => ({ title: m.title, summary: m.summary })) };
    } catch { /* best-effort */ }

    // Build context via context engine
    let contextEngineData: Record<string, unknown> = {};
    try {
      const ctxResult = await contextEngine.build({
        entityType: 'conversation',
        entityId: conversationId,
        contextType: 'conversation_analysis',
        workspaceId,
      });
      contextEngineData = { contextAvailable: true, sourceCount: ctxResult.sourceContributions?.length ?? 0 };
    } catch { /* best-effort */ }

    return {
      company: company ? { name: company.name, industry: company.industry, website: company.website } : null,
      personalization: personalization ? {
        communication_style: personalization.communication_style,
        tone: personalization.tone,
        value_proposition: personalization.value_proposition,
        conversation_angle: personalization.conversation_angle,
        pain_points: personalization.pain_point_references,
        trust_signals: personalization.trust_signals,
      } : null,
      outreachDecision: outreachDecision ? {
        decision: outreachDecision.decision,
        reason: outreachDecision.decision_reason,
      } : null,
      messageStrategy: messageStrategy ? {
        connection_request: messageStrategy.connection_request_strategy,
        first_message: messageStrategy.first_message_strategy,
        follow_up: messageStrategy.follow_up_strategy,
        cta: messageStrategy.cta_strategy,
        objection_prevention: messageStrategy.objection_prevention_strategy,
      } : null,
      memory: memoryContext,
      contextEngine: contextEngineData,
    };
  }

  private async loadCompany(companyName: string): Promise<{ name: string; industry: string | null; website: string | null } | null> {
    const { data } = await supabase.from('companies').select('name, industry, website').ilike('name', companyName).limit(1).maybeSingle();
    return data as any;
  }

  private async loadPersonalization(workspaceId: string, companyName: string): Promise<{ communication_style: string | null; tone: string | null; value_proposition: string | null; conversation_angle: string | null; pain_point_references: unknown[]; trust_signals: unknown[] } | null> {
    const { data } = await supabase
      .from('personalization_profiles')
      .select('communication_style, tone, value_proposition, conversation_angle, pain_point_references, trust_signals')
      .eq('workspace_id', workspaceId)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as any;
  }

  private async loadOutreachDecision(workspaceId: string, conversationId: string): Promise<{ decision: string; decision_reason: string } | null> {
    const { data: conv } = await supabase.from('conversations').select('company_id, contact_id').eq('id', conversationId).maybeSingle();
    if (!conv?.company_id) return null;
    const { data } = await supabase.from('outreach_decisions').select('decision, decision_reason').eq('workspace_id', workspaceId).eq('company_id', conv.company_id).eq('status', 'active').maybeSingle();
    return data as any;
  }

  private async loadMessageStrategy(workspaceId: string, companyName: string): Promise<{ connection_request_strategy: string | null; first_message_strategy: string | null; follow_up_strategy: string | null; cta_strategy: string | null; objection_prevention_strategy: string | null } | null> {
    const { data } = await supabase
      .from('message_strategies')
      .select('connection_request_strategy, first_message_strategy, follow_up_strategy, cta_strategy, objection_prevention_strategy')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as any;
  }

  // ----------------------------------------------------------
  // Knowledge Graph + Memory
  // ----------------------------------------------------------

  private async populateKnowledgeGraph(workspaceId: string, conversationId: string, result: ConversationAnalysisResult): Promise<void> {
    try {
      await knowledgeGraphService.ingestBatch({
        workspaceId,
        entities: [{
          nodeType: 'conversation' as any,
          externalId: `conversation_${conversationId}`,
          displayName: `Conversation: ${result.intent.primary_intent}`,
          properties: {
            intent: result.intent.primary_intent,
            buying_stage: result.buyingStage.buying_stage,
            meeting_readiness: result.meetingReadiness.level,
            overall_score: result.score.overall_score,
          },
          confidenceScore: result.score.confidence,
        }],
        relationships: [],
      });
    } catch { /* best-effort */ }
  }

  private async storeInMemory(workspaceId: string, conversationId: string, input: ConversationAnalysisInput, result: ConversationAnalysisResult): Promise<void> {
    try {
      await memoryEngine.store({
        entityType: 'conversation',
        entityId: conversationId,
        memoryType: 'conversation_intelligence',
        title: `Conversation: ${input.prospectName} — ${result.intent.primary_intent}`,
        summary: result.summary.summary,
        content: {
          intent: result.intent.primary_intent,
          buying_stage: result.buyingStage.buying_stage,
          meeting_readiness: result.meetingReadiness.level,
          overall_score: result.score.overall_score,
          recommended_action: result.recommendation.recommended_action,
          urgency: result.intent.urgency,
          risk_level: result.risk.level,
        },
        confidenceScore: result.score.confidence,
        importanceScore: result.intent.urgency === 'critical' ? 0.95 : result.intent.urgency === 'high' ? 0.85 : 0.7,
        workspaceId,
      });
    } catch { /* best-effort */ }
  }

  // ----------------------------------------------------------
  // Notifications
  // ----------------------------------------------------------

  private async createNotifications(workspaceId: string, conversationId: string, result: ConversationAnalysisResult): Promise<void> {
    const notifs: Array<{ type: string; title: string; message: string; severity: 'info' | 'warning' | 'error' | 'success' }> = [];

    if (['positive_interest', 'pricing_request', 'demo_request', 'meeting_request'].includes(result.intent.primary_intent)) {
      notifs.push({ type: 'high_intent_lead', title: 'High Intent Lead', message: `Prospect ${result.intent.primary_intent.replace(/_/g, ' ')} — likelihood to buy: ${Math.round(result.intent.likelihood_to_buy * 100)}%`, severity: 'success' });
    }
    if (result.intent.primary_intent === 'meeting_request') {
      notifs.push({ type: 'meeting_request', title: 'Meeting Request', message: 'Prospect requested a meeting', severity: 'success' });
    }
    if (result.intent.primary_intent === 'pricing_request') {
      notifs.push({ type: 'pricing_request', title: 'Pricing Request', message: 'Prospect asked about pricing', severity: 'info' });
    }
    if (['negative_interest', 'no_interest'].includes(result.intent.primary_intent)) {
      notifs.push({ type: 'negative_sentiment', title: 'Negative Sentiment', message: 'Prospect expressed negative interest', severity: 'warning' });
    }
    if (result.intent.primary_intent === 'competitor_mention') {
      notifs.push({ type: 'competitor_mention', title: 'Competitor Mentioned', message: 'Prospect mentioned a competitor', severity: 'warning' });
    }
    if (['escalate_to_sales', 'escalate_to_founder', 'escalate_to_support'].includes(result.recommendation.recommended_action)) {
      notifs.push({ type: 'human_escalation', title: 'Human Escalation Required', message: `Recommended: ${result.recommendation.recommended_action.replace(/_/g, ' ')}`, severity: 'error' });
    }
    if (result.intent.urgency === 'critical' || result.recommendation.action_priority === 'critical') {
      notifs.push({ type: 'urgent_reply', title: 'Urgent Reply Needed', message: result.recommendation.action_reason, severity: 'error' });
    }

    for (const n of notifs) {
      await supabase.from('linkedin_notifications').insert({
        workspace_id: workspaceId,
        linkedin_account_id: null,
        notification_type: n.type,
        notification_title: n.title,
        notification_message: n.message,
        severity: n.severity,
      }).then(() => {}, () => {});
    }
  }

  // ----------------------------------------------------------
  // Load dashboard
  // ----------------------------------------------------------

  async loadDashboard(workspaceId: string): Promise<ConversationIntelligenceDashboard> {
    const { data: conversations } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('last_analyzed_at', { ascending: false })
      .limit(50);

    const conversationList = (conversations ?? []) as any[];
    const fullConversations: ConversationWithIntelligence[] = [];

    for (const conv of conversationList) {
      const intel = await this.loadConversationIntelligence(workspaceId, conv.id);
      if (intel) fullConversations.push(intel);
    }

    const { data: events } = await supabase
      .from('conversation_events')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(30);

    const active = conversationList.filter((c) => c.status === 'active').length;
    const highIntent = fullConversations.filter((c) => c.intents.some((i) => ['positive_interest', 'pricing_request', 'demo_request', 'meeting_request'].includes(i.primary_intent))).length;
    const meetingReady = fullConversations.filter((c) => c.buying_stage === 'meeting_scheduled' || c.meeting_readiness_level === 'ready' || c.meeting_readiness_level === 'almost_ready').length;
    const objections = fullConversations.reduce((s, c) => s + c.objections.length, 0);
    const avgScore = fullConversations.length > 0 ? Math.round(fullConversations.reduce((s, c) => s + (c.score?.overall_score ?? 0), 0) / fullConversations.length) : 0;
    const urgent = fullConversations.filter((c) => c.recommendations.some((r) => r.action_priority === 'critical' || r.action_priority === 'high')).length;

    return {
      totalConversations: conversationList.length,
      activeConversations: active,
      highIntentLeads: highIntent,
      meetingReadyCount: meetingReady,
      objectionCount: objections,
      avgScore,
      urgentReplies: urgent,
      conversations: fullConversations,
      recentEvents: (events ?? []) as ConversationEvent[],
      topConversations: fullConversations.sort((a, b) => (b.score?.overall_score ?? 0) - (a.score?.overall_score ?? 0)).slice(0, 10),
    };
  }

  // ----------------------------------------------------------
  // Load full intelligence for a single conversation
  // ----------------------------------------------------------

  async loadConversationIntelligence(workspaceId: string, conversationId: string): Promise<ConversationWithIntelligence | null> {
    const { data: conv } = await supabase.from('conversations').select('*').eq('id', conversationId).maybeSingle();
    if (!conv) return null;

    const [messages, intents, buyingStages, recommendations, replies, labels, score, context, objections, summary] = await Promise.all([
      supabase.from('conversation_messages').select('*').eq('conversation_id', conversationId).order('timestamp', { ascending: true }),
      supabase.from('conversation_intents').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10),
      supabase.from('conversation_buying_stage').select('*').eq('conversation_id', conversationId).order('version', { ascending: false }).limit(5),
      supabase.from('conversation_recommendations').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(5),
      supabase.from('conversation_reply_library').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10),
      supabase.from('conversation_labels').select('*').eq('conversation_id', conversationId),
      supabase.from('conversation_score').select('*').eq('conversation_id', conversationId).order('version', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('conversation_context').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }).limit(10),
      supabase.from('conversation_objections').select('*').eq('conversation_analysis_id', '00000000-0000-0000-0000-000000000000').limit(10),
      supabase.from('conversation_summary').select('*').eq('conversation_id', conversationId).maybeSingle(),
    ]);

    return {
      ...conv,
      messages: (messages.data ?? []) as ConversationWithIntelligence['messages'],
      intents: (intents.data ?? []) as ConversationIntent[],
      buyingStages: (buyingStages.data ?? []) as ConversationBuyingStage[],
      recommendations: (recommendations.data ?? []) as ConversationRecommendation[],
      replies: (replies.data ?? []) as ConversationReplyLibraryEntry[],
      labels: (labels.data ?? []) as ConversationLabel[],
      score: (score.data ?? null) as ConversationScore | null,
      context: (context.data ?? []) as ConversationContextEntry[],
      objections: (objections.data ?? []) as ConversationWithIntelligence['objections'],
      summary: (summary.data ?? null) as ConversationWithIntelligence['summary'],
    };
  }

  // ----------------------------------------------------------
  // Create a conversation from LinkedIn action history
  // ----------------------------------------------------------

  async createConversationFromHistory(workspaceId: string): Promise<void> {
    // Load LinkedIn action history for this workspace
    const { data: actions } = await supabase
      .from('linkedin_action_history')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('action_result', 'success')
      .order('created_at', { ascending: true })
      .limit(50);

    if (!actions || actions.length === 0) return;

    // Group by contact_id
    const byContact = new Map<string, any[]>();
    for (const a of actions) {
      const key = a.contact_id ?? a.company_id ?? 'unknown';
      if (!byContact.has(key)) byContact.set(key, []);
      byContact.get(key)!.push(a);
    }

    for (const [contactKey, contactActions] of byContact) {
      // Check if conversation already exists for this contact
      const { data: existing } = await supabase
        .from('conversations')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('contact_id', contactActions[0].contact_id ?? null)
        .maybeSingle();

      if (existing) continue;

      // Create conversation
      const { data: conv } = await supabase.from('conversations').insert({
        workspace_id: workspaceId,
        contact_id: contactActions[0].contact_id ?? null,
        company_id: contactActions[0].company_id ?? null,
        prospect_name: 'LinkedIn Prospect',
        company_name: 'Unknown',
        status: 'active',
        conversation_stage: 'initial_contact',
        buying_stage: 'cold',
        meeting_readiness_level: 'not_ready',
        risk_level: 'low',
      }).select('id').single();

      if (!conv) continue;

      // Create thread
      await supabase.from('conversation_threads').insert({
        workspace_id: workspaceId,
        conversation_id: conv.id,
        contact_id: contactActions[0].contact_id ?? null,
        company_id: contactActions[0].company_id ?? null,
        thread_subject: 'LinkedIn Outreach',
        message_count: contactActions.length,
        last_message_at: contactActions[contactActions.length - 1].created_at,
      });

      // Create messages from actions
      for (const action of contactActions) {
        const sender = action.action_type === 'connection_request' ? 'user' : 'user';
        const content = (action.action_payload as Record<string, unknown>)?.message as string ?? `Action: ${action.action_type}`;
        await supabase.from('conversation_messages').insert({
          conversation_id: conv.id,
          workspace_id: workspaceId,
          sender,
          channel: 'linkedin',
          content,
          message_type: action.action_type === 'connection_request' ? 'connection_request' : 'text',
          timestamp: action.created_at,
          metadata: { action_type: action.action_type, action_id: action.id },
        });
      }

      // Analyze the conversation
      await this.analyzeConversation({
        workspaceId,
        conversationId: conv.id,
        messages: contactActions.map((a) => ({
          sender: 'user',
          content: (a.action_payload as Record<string, unknown>)?.message as string ?? `Action: ${a.action_type}`,
          timestamp: a.created_at,
          message_type: a.action_type,
        })),
        prospectName: 'LinkedIn Prospect',
        companyName: 'Unknown',
      });
    }
  }
}

export const conversationIntelligenceService = new ConversationIntelligenceService();
