// ============================================================
// ConversationEngine — AI-powered conversation pipeline
// ============================================================
//
// Pipeline: Read LinkedIn Message → Intent Detection → Buying
// Intent → Sentiment → Conversation Stage → Memory Lookup →
// Generate Reply → Confidence → Approval Engine → Browser Queue
// → Playwright → LinkedIn → Memory Engine → Knowledge Graph

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  LinkedInConversation, LinkedInMessage, ConversationStage,
  IntentCategory, ObjectionType,
} from '@/types/linkedin-browser-automation';

export interface ConversationAnalysis {
  intent: string;
  intentCategory: IntentCategory;
  buyingSignals: string[];
  sentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  stage: ConversationStage;
  confidence: number;
  suggestedReply: string;
  replyStrategy: string;
  suggestedAction: string;
  objections: Array<{ type: ObjectionType; text: string }>;
  memoryContext: Record<string, unknown>;
}

export class ConversationEngine {
  private client: SupabaseClient;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }

  // ── Main Pipeline ──────────────────────────────────────────

  async analyzeMessage(conversationId: string, message: string, direction: 'inbound' | 'outbound'): Promise<ConversationAnalysis> {
    const intent = this.detectIntent(message);
    const buyingSignals = this.detectBuyingSignals(message);
    const sentiment = this.analyzeSentiment(message);
    const stage = this.assessStage(message, conversationId);
    const objections = this.detectObjections(message);
    const memoryContext = await this.lookupMemory(conversationId);
    const reply = this.generateReply(message, intent, sentiment, stage, memoryContext);
    const confidence = this.calculateConfidence(intent, buyingSignals, sentiment, stage);
    const suggestedAction = this.suggestAction(intent, sentiment, stage, buyingSignals);

    const analysis: ConversationAnalysis = {
      intent: intent.intent,
      intentCategory: intent.category,
      buyingSignals,
      sentiment,
      stage,
      confidence: confidence.overall,
      suggestedReply: reply.text,
      replyStrategy: reply.strategy,
      suggestedAction,
      objections,
      memoryContext,
    };

    await this.storeAnalysis(conversationId, message, analysis);
    return analysis;
  }

  // ── Intent Detection ────────────────────────────────────────

  private detectIntent(message: string): { intent: string; category: IntentCategory } {
    const lower = message.toLowerCase();

    const buyingPatterns = [
      { pattern: /budget|pricing|cost|quote/, intent: 'budget_inquiry', category: 'buying' as IntentCategory },
      { pattern: /demo|presentation|walkthrough/, intent: 'demo_request', category: 'meeting_request' as IntentCategory },
      { pattern: /call|meeting|schedule/, intent: 'meeting_request', category: 'meeting_request' as IntentCategory },
      { pattern: /implement|deployment|onboard/, intent: 'implementation_inquiry', category: 'buying' as IntentCategory },
      { pattern: /decision|decide|choose/, intent: 'decision_making', category: 'buying' as IntentCategory },
    ];

    const objectionPatterns = [
      { pattern: /expensive|too costly|can't afford/, intent: 'price_objection', category: 'objection' as IntentCategory },
      { pattern: /not right now|maybe later|bad time/, intent: 'timing_objection', category: 'objection' as IntentCategory },
      { pattern: /need to check with|my boss|team has to/, intent: 'authority_objection', category: 'objection' as IntentCategory },
      { pattern: /already use|current provider/, intent: 'competitor_objection', category: 'objection' as IntentCategory },
      { pattern: /not sure we need|don't see the value/, intent: 'need_objection', category: 'objection' as IntentCategory },
    ];

    const infoPatterns = [
      { pattern: /what do you do|tell me more|more info/, intent: 'information_request', category: 'informational' as IntentCategory },
      { pattern: /how does it work|features/, intent: 'feature_inquiry', category: 'informational' as IntentCategory },
      { pattern: /case study|examples|proof/, intent: 'proof_request', category: 'informational' as IntentCategory },
    ];

    const allPatterns = [...buyingPatterns, ...objectionPatterns, ...infoPatterns];
    for (const p of allPatterns) {
      if (p.pattern.test(lower)) return { intent: p.intent, category: p.category };
    }

    if (/yes|interested|sounds good|love it|great/.test(lower)) {
      return { intent: 'positive_response', category: 'positive' as IntentCategory };
    }
    if (/no|not interested|stop|unsubscribe/.test(lower)) {
      return { intent: 'negative_response', category: 'negative' as IntentCategory };
    }

    return { intent: 'general_message', category: 'neutral' as IntentCategory };
  }

  // ── Buying Signal Detection ──────────────────────────────────

  private detectBuyingSignals(message: string): string[] {
    const lower = message.toLowerCase();
    const signals = [
      'budget', 'timeline', 'decision', 'implement', 'solution',
      'problem', 'challenge', 'looking for', 'interested in',
      'pricing', 'cost', 'demo', 'call', 'meeting', 'proposal',
      'roi', 'evaluate', 'compare', 'vendor', 'purchase',
    ];
    return signals.filter((s) => lower.includes(s));
  }

  // ── Sentiment Analysis ──────────────────────────────────────

  private analyzeSentiment(message: string): 'positive' | 'neutral' | 'negative' | 'mixed' {
    const lower = message.toLowerCase();
    const positive = ['great', 'love', 'excellent', 'perfect', 'amazing', 'yes', 'interested', 'sounds good', 'let\'s do it'];
    const negative = ['no', 'not interested', 'stop', 'bad', 'terrible', 'waste', 'unsubscribe', 'don\'t want'];

    const hasPos = positive.some((p) => lower.includes(p));
    const hasNeg = negative.some((n) => lower.includes(n));

    if (hasPos && hasNeg) return 'mixed';
    if (hasPos) return 'positive';
    if (hasNeg) return 'negative';
    return 'neutral';
  }

  // ── Stage Assessment ────────────────────────────────────────

  private assessStage(message: string, conversationId: string): ConversationStage {
    const lower = message.toLowerCase();

    if (/meeting|call|schedule|demo/.test(lower)) return 'meeting_scheduled';
    if (/objection|expensive|not now|already have/.test(lower)) return 'objection';
    if (/proposal|quote|pricing|contract/.test(lower)) return 'negotiation';
    if (/qualified|requirements|use case|team size/.test(lower)) return 'qualified';
    if (/yes|interested|tell me more/.test(lower)) return 'engaged';
    if (/no|not interested|unsubscribe/.test(lower)) return 'closed_lost';

    return 'initial';
  }

  // ── Objection Detection ────────────────────────────────────

  private detectObjections(message: string): Array<{ type: ObjectionType; text: string }> {
    const lower = message.toLowerCase();
    const objections: Array<{ type: ObjectionType; text: string }> = [];

    const checks: Array<{ type: ObjectionType; pattern: RegExp }> = [
      { type: 'price', pattern: /expensive|cost|afford|budget/ },
      { type: 'timing', pattern: /not now|bad time|later|postpone/ },
      { type: 'authority', pattern: /boss|team|decision maker|above me/ },
      { type: 'need', pattern: /don't need|not sure|don't see/ },
      { type: 'trust', pattern: /trust|reputation|proven|track record/ },
      { type: 'competitor', pattern: /already use|current provider|competitor/ },
      { type: 'process', pattern: /process|procurement|rfp|approval/ },
    ];

    for (const check of checks) {
      if (check.pattern.test(lower)) {
        objections.push({ type: check.type, text: message });
      }
    }

    return objections;
  }

  // ── Memory Lookup ──────────────────────────────────────────

  private async lookupMemory(conversationId: string): Promise<Record<string, unknown>> {
    const { data, error } = await this.client
      .from('linkedin_conversation_memory')
      .select('memory_type, memory_key, memory_value')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (error || !data) return {};

    const memory: Record<string, unknown> = {};
    for (const m of data) {
      memory[(m as Record<string, string>).memory_key] = (m as Record<string, string>).memory_value;
    }
    return memory;
  }

  // ── Reply Generation ────────────────────────────────────────

  private generateReply(
    _message: string,
    intent: { intent: string; category: IntentCategory },
    sentiment: string,
    stage: ConversationStage,
    _memoryContext: Record<string, unknown>
  ): { text: string; strategy: string } {
    if (intent.category === 'meeting_request') {
      return {
        text: 'I'd be happy to schedule a call. What day and time works best for you? I can also send over a calendar link with available slots.',
        strategy: 'meeting_booking',
      };
    }

    if (intent.category === 'objection') {
      return {
        text: 'I understand your concern. Many of our clients initially felt the same way, but found that the ROI justified the investment. Would it help if I shared a case study from a similar company?',
        strategy: 'objection_handling',
      };
    }

    if (intent.category === 'buying') {
      return {
        text: 'Great questions! Based on what you've shared, I think our platform would be a strong fit. Would you like me to put together a brief proposal with pricing tailored to your team size?',
        strategy: 'qualification_and_proposal',
      };
    }

    if (intent.category === 'informational') {
      return {
        text: 'Happy to share more details! Our platform helps teams automate their outreach while maintaining a personal touch. What specific aspect would you like to dive deeper into?',
        strategy: 'information_provision',
      };
    }

    if (sentiment === 'positive') {
      return {
        text: 'Thanks for the positive feedback! Would you be open to a quick 15-minute call this week to explore how we can take this forward?',
        strategy: 'positive_engagement',
      };
    }

    if (sentiment === 'negative') {
      return {
        text: 'I appreciate you letting me know. I won't take up more of your time, but if anything changes, feel free to reach out. Wishing you all the best!',
        strategy: 'graceful_exit',
      };
    }

    return {
      text: 'Thanks for getting back to me! Is there anything specific I can help you with? I'm happy to share more about how we've helped similar companies.',
      strategy: 'gentle_nudge',
    };
  }

  // ── Confidence Calculation ──────────────────────────────────

  private calculateConfidence(
    intent: { intent: string; category: IntentCategory },
    buyingSignals: string[],
    sentiment: string,
    stage: ConversationStage
  ): { overall: number; factors: Record<string, number> } {
    let base = 0.5;

    if (intent.category === 'buying') base += 0.2;
    if (intent.category === 'meeting_request') base += 0.25;
    if (intent.category === 'objection') base += 0.1;
    if (intent.category === 'informational') base += 0.05;

    base += Math.min(buyingSignals.length * 0.05, 0.2);

    if (sentiment === 'positive') base += 0.1;
    if (sentiment === 'negative') base -= 0.15;

    if (stage === 'meeting_scheduled') base += 0.15;
    if (stage === 'qualified') base += 0.1;
    if (stage === 'closed_lost') base -= 0.2;

    const overall = Math.max(0.1, Math.min(0.99, base));
    return {
      overall,
      factors: {
        intent: intent.category === 'buying' ? 0.8 : 0.5,
        signals: Math.min(buyingSignals.length / 5, 1),
        sentiment: sentiment === 'positive' ? 0.8 : 0.4,
        stage: stage === 'meeting_scheduled' ? 0.9 : 0.5,
      },
    };
  }

  // ── Action Suggestion ────────────────────────────────────────

  private suggestAction(
    intentCategory: IntentCategory,
    _sentiment: string,
    stage: ConversationStage,
    buyingSignals: string[]
  ): string {
    if (stage === 'meeting_scheduled') return 'detect_meeting';
    if (intentCategory === 'objection') return 'handle_objection';
    if (intentCategory === 'buying' && buyingSignals.length >= 3) return 'mark_hot';
    if (intentCategory === 'meeting_request') return 'send_reply';
    if (stage === 'closed_lost') return 'disqualify';
    if (stage === 'qualified') return 'qualify';
    return 'schedule_followup';
  }

  // ── Storage ────────────────────────────────────────────────

  private async storeAnalysis(conversationId: string, _message: string, analysis: ConversationAnalysis): Promise<void> {
    await this.client.from('linkedin_conversation_intents').insert({
      workspace_id: this.workspaceId,
      conversation_id: conversationId,
      detected_intent: analysis.intent,
      intent_category: analysis.intentCategory,
      confidence: analysis.confidence,
      buying_signals: analysis.buyingSignals,
    });

    await this.client.from('linkedin_conversation_ai_reasoning').insert({
      workspace_id: this.workspaceId,
      conversation_id: conversationId,
      reasoning_chain: [
        { step: 'intent_detection', result: analysis.intent },
        { step: 'sentiment_analysis', result: analysis.sentiment },
        { step: 'stage_assessment', result: analysis.stage },
        { step: 'reply_generation', result: analysis.suggestedReply },
      ],
      intent_analysis: analysis.intent,
      sentiment_analysis: analysis.sentiment,
      stage_assessment: analysis.stage,
      memory_context: analysis.memoryContext,
      generated_reply: analysis.suggestedReply,
      reply_strategy: analysis.replyStrategy,
    });

    await this.client.from('linkedin_conversation_confidence').insert({
      workspace_id: this.workspaceId,
      conversation_id: conversationId,
      intent_confidence: analysis.confidence,
      overall_confidence: analysis.confidence,
      factors: { objections: analysis.objections.length, buyingSignals: analysis.buyingSignals.length },
    });

    await this.client.from('linkedin_conversation_actions').insert({
      workspace_id: this.workspaceId,
      conversation_id: conversationId,
      action_type: analysis.suggestedAction,
      action_params: { reply: analysis.suggestedReply, strategy: analysis.replyStrategy },
      status: 'pending',
    });
  }

  // ── Conversation CRUD ────────────────────────────────────────

  async listConversations(): Promise<LinkedInConversation[]> {
    const { data, error } = await this.client
      .from('linkedin_conversations')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) return [];
    return (data ?? []) as LinkedInConversation[];
  }

  async getMessages(conversationId: string): Promise<LinkedInMessage[]> {
    const { data, error } = await this.client
      .from('linkedin_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? []) as LinkedInMessage[];
  }

  async storeMessage(conversationId: string, accountId: string, params: {
    direction: 'inbound' | 'outbound';
    body: string;
    senderName?: string;
    aiGenerated?: boolean;
    aiConfidence?: number;
    approved?: boolean;
  }): Promise<LinkedInMessage | null> {
    const { data, error } = await this.client
      .from('linkedin_messages')
      .insert({
        workspace_id: this.workspaceId,
        conversation_id: conversationId,
        account_id: accountId,
        direction: params.direction,
        body: params.body,
        sender_name: params.senderName ?? null,
        ai_generated: params.aiGenerated ?? false,
        ai_confidence: params.aiConfidence ?? null,
        approved: params.approved ?? false,
        sent_at: params.direction === 'outbound' ? new Date().toISOString() : null,
      })
      .select('*')
      .maybeSingle();
    if (error) { console.error('Store message failed:', error.message); return null; }

    await this.client.from('linkedin_conversations').update({
      last_message_at: new Date().toISOString(),
      last_message_preview: params.body.slice(0, 200),
      last_message_direction: params.direction,
      total_messages: ((await this.client.from('linkedin_conversations').select('total_messages').eq('id', conversationId).maybeSingle()).data as Record<string, number> | null)?.total_messages ?? 0) + 1,
      unread_count: params.direction === 'inbound' ? ((await this.client.from('linkedin_conversations').select('unread_count').eq('id', conversationId).maybeSingle().then((r) => r.data as Record<string, number> | null))?.data?.unread_count ?? 0) + 1 : 0,
    }).eq('id', conversationId);

    return data as LinkedInMessage;
  }

  async approveMessage(messageId: string, userId: string): Promise<void> {
    await this.client.from('linkedin_messages').update({
      approved: true,
      approved_by: userId,
      approved_at: new Date().toISOString(),
    }).eq('id', messageId);
  }

  async scheduleFollowup(conversationId: string, scheduledFor: string, messageDraft: string, followupType: string): Promise<void> {
    await this.client.from('linkedin_conversation_followups').insert({
      workspace_id: this.workspaceId,
      conversation_id: conversationId,
      scheduled_for: scheduledFor,
      followup_type: followupType,
      message_draft: messageDraft,
      status: 'scheduled',
    });
  }
}
