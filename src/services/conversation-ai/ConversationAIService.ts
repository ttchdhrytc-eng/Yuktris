// ============================================================
// ConversationAIService — Architecture
// ============================================================
//
// Main orchestrator for Conversation AI.
// Runs after the LinkedIn Execution Agent produces replies.
//
// Responsibilities:
//   - Understand conversations and maintain context
//   - Qualify prospects (BANT)
//   - Detect buying intent changes
//   - Detect sentiment and objections
//   - Recommend or generate responses
//   - Determine the next best action
//   - Determine meeting readiness
//   - Hand off to Meeting Agent when ready
//
// Not implemented — uses mock data to simulate the workflow.
// Data is persisted to Supabase tables:
//   - conversations
//   - conversation_messages
//   - conversation_analysis
//   - conversation_objections
//   - conversation_ai_responses
//   - conversation_summary

import { supabase } from '@/lib/supabase';
import type {
  Conversation,
  ConversationMessage,
  ConversationAnalysis,
  ConversationObjection,
  ConversationAIResponse,
  ConversationSummary,
  FullConversation,
  ConversationStage_Process,
  ConversationTimelineEvent,
  ConversationAIRecommendations,
  BANTQualification,
  ConversationHealth,
  ExportConfig,
  ExportFormat,
} from '@/types/conversation-ai';
import { CONVERSATION_STAGES, MOCK_CONVERSATIONS, MOCK_AI_RECOMMENDATIONS, type MockConversation } from './mockData';

// ============================================================
// Service Definition
// ============================================================

export class ConversationAIService {
  /**
   * Analyze a conversation.
   * Placeholder — will orchestrate all analysis sub-services when implemented.
   */
  async analyzeConversation(): Promise<unknown> {
    throw new Error('ConversationAIService.analyzeConversation() not implemented — use saveConversation()');
  }

  /**
   * Detect buyer intent from messages.
   * Placeholder — will use OpenAIService when implemented.
   */
  async detectIntent(): Promise<unknown> {
    throw new Error('ConversationAIService.detectIntent() not implemented');
  }

  /**
   * Detect sentiment from messages.
   * Placeholder — will use OpenAIService when implemented.
   */
  async detectSentiment(): Promise<unknown> {
    throw new Error('ConversationAIService.detectSentiment() not implemented');
  }

  /**
   * Qualify a lead using BANT framework.
   * Placeholder — will use OpenAIService when implemented.
   */
  async qualifyLead(): Promise<unknown> {
    throw new Error('ConversationAIService.qualifyLead() not implemented');
  }

  /**
   * Detect objections from conversation.
   * Placeholder — will use OpenAIService when implemented.
   */
  async detectObjections(): Promise<unknown> {
    throw new Error('ConversationAIService.detectObjections() not implemented');
  }

  /**
   * Generate a response recommendation.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateResponse(): Promise<unknown> {
    throw new Error('ConversationAIService.generateResponse() not implemented');
  }

  /**
   * Recommend the next best action.
   * Placeholder — will use OpenAIService when implemented.
   */
  async recommendNextAction(): Promise<unknown> {
    throw new Error('ConversationAIService.recommendNextAction() not implemented');
  }

  /**
   * Generate a conversation summary.
   * Placeholder — will use OpenAIService when implemented.
   */
  async generateSummary(): Promise<unknown> {
    throw new Error('ConversationAIService.generateSummary() not implemented');
  }

  /**
   * Calculate conversation score.
   * Placeholder — will compute score from analysis when implemented.
   */
  async calculateConversationScore(): Promise<unknown> {
    throw new Error('ConversationAIService.calculateConversationScore() not implemented');
  }

  /**
   * Calculate trust score.
   * Placeholder — will compute score from analysis when implemented.
   */
  async calculateTrustScore(): Promise<unknown> {
    throw new Error('ConversationAIService.calculateTrustScore() not implemented');
  }

  /**
   * Calculate engagement score.
   * Placeholder — will compute score from analysis when implemented.
   */
  async calculateEngagement(): Promise<unknown> {
    throw new Error('ConversationAIService.calculateEngagement() not implemented');
  }

  /**
   * Detect meeting readiness.
   * Placeholder — will evaluate qualification + intent + sentiment when implemented.
   */
  async detectMeetingReadiness(): Promise<unknown> {
    throw new Error('ConversationAIService.detectMeetingReadiness() not implemented');
  }

  /**
   * Hand off to Meeting Agent.
   * Placeholder — will use MeetingAgentService when implemented.
   */
  async handoffToMeetingAgent(): Promise<unknown> {
    throw new Error('ConversationAIService.handoffToMeetingAgent() not implemented');
  }

  /**
   * Save a complete conversation (with all child records) to the database.
   */
  async saveConversation(workspaceId: string, prospectIndex: number): Promise<string> {
    const mock = MOCK_CONVERSATIONS[prospectIndex] ?? MOCK_CONVERSATIONS[0];

    const { data: convRow, error: convError } = await supabase
      .from('conversations')
      .insert({
        workspace_id: workspaceId,
        prospect_name: mock.prospect_name,
        prospect_title: mock.prospect_title,
        company_name: mock.company_name,
        status: mock.status,
        conversation_stage: mock.conversation_stage,
        meeting_ready: mock.meeting_ready,
      })
      .select('*')
      .single();

    if (convError) throw new Error(convError.message);
    const conversationId = (convRow as Conversation).id;

    // Insert messages
    if (mock.messages.length > 0) {
      const baseTime = Date.now() - mock.messages[mock.messages.length - 1].timestamp_offset * 1000;
      const { error: msgError } = await supabase.from('conversation_messages').insert(
        mock.messages.map((m) => ({
          conversation_id: conversationId,
          sender: m.sender,
          channel: m.channel,
          content: m.content,
          message_type: m.message_type,
          timestamp: new Date(baseTime + m.timestamp_offset * 1000).toISOString(),
        })),
      );
      if (msgError) throw new Error(msgError.message);
    }

    // Insert analysis
    const { data: analysisRow, error: aError } = await supabase
      .from('conversation_analysis')
      .insert({
        conversation_id: conversationId,
        sentiment: mock.analysis.sentiment,
        buyer_intent: mock.analysis.buyer_intent,
        qualification_score: mock.analysis.qualification_score,
        trust_score: mock.analysis.trust_score,
        engagement_score: mock.analysis.engagement_score,
        conversation_score: mock.analysis.conversation_score,
        urgency: mock.analysis.urgency,
        interest_level: mock.analysis.interest_level,
        decision_stage: mock.analysis.decision_stage,
      })
      .select('*')
      .single();

    if (aError) throw new Error(aError.message);
    const analysisId = (analysisRow as ConversationAnalysis).id;

    // Insert objections
    if (mock.objections.length > 0) {
      const { error: objError } = await supabase.from('conversation_objections').insert(
        mock.objections.map((o) => ({
          conversation_analysis_id: analysisId,
          objection_type: o.objection_type,
          severity: o.severity,
          recommended_response: o.recommended_response,
          confidence: o.confidence,
        })),
      );
      if (objError) throw new Error(objError.message);
    }

    // Insert AI responses
    if (mock.ai_responses.length > 0) {
      const { error: respError } = await supabase.from('conversation_ai_responses').insert(
        mock.ai_responses.map((r) => ({
          conversation_id: conversationId,
          response_type: r.response_type,
          response_text: r.response_text,
          confidence: r.confidence,
          status: 'pending',
        })),
      );
      if (respError) throw new Error(respError.message);
    }

    // Insert summary
    const { error: sumError } = await supabase.from('conversation_summary').insert({
      conversation_id: conversationId,
      summary: mock.summary.summary,
      next_action: mock.summary.next_action,
      meeting_readiness: mock.summary.meeting_readiness,
      executive_summary: mock.summary.executive_summary,
      recommended_followup: mock.summary.recommended_followup,
      escalation_suggestion: mock.summary.escalation_suggestion,
    });
    if (sumError) throw new Error(sumError.message);

    return conversationId;
  }

  /**
   * Load a complete conversation from the database.
   */
  async loadConversation(conversationId: string): Promise<FullConversation | null> {
    const { data: conv, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!conv) return null;

    const [msgRes, aRes, _objRes, respRes, sumRes] = await Promise.all([
      supabase.from('conversation_messages').select('*').eq('conversation_id', conversationId).order('timestamp', { ascending: true }),
      supabase.from('conversation_analysis').select('*').eq('conversation_id', conversationId).maybeSingle(),
      supabase.from('conversation_objections').select('*').eq('conversation_analysis_id', (_a: ConversationAnalysis) => _a.id),
      supabase.from('conversation_ai_responses').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: false }),
      supabase.from('conversation_summary').select('*').eq('conversation_id', conversationId).maybeSingle(),
    ]);

    // For objections, we need the analysis ID first
    let objections: ConversationObjection[] = [];
    if (aRes.data) {
      const analysisId = (aRes.data as ConversationAnalysis).id;
      const { data: objData } = await supabase
        .from('conversation_objections')
        .select('*')
        .eq('conversation_analysis_id', analysisId);
      objections = (objData as ConversationObjection[] | null) ?? [];
    }

    return {
      ...(conv as Conversation),
      messages: (msgRes.data as ConversationMessage[] | null) ?? [],
      analysis: (aRes.data as ConversationAnalysis | null) ?? null,
      objections,
      ai_responses: (respRes.data as ConversationAIResponse[] | null) ?? [],
      summary: (sumRes.data as ConversationSummary | null) ?? null,
    };
  }

  /**
   * Load the latest conversation for a workspace.
   */
  async loadLatestConversation(workspaceId: string): Promise<FullConversation | null> {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!data) return null;

    return this.loadConversation((data as Conversation).id);
  }

  /**
   * Load all conversations for a workspace.
   */
  async loadAllConversations(workspaceId: string): Promise<FullConversation[]> {
    const { data: rows, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) return [];

    const all = await Promise.all(
      (rows as Conversation[]).map((r) => this.loadConversation(r.id)),
    );
    return all.filter((r): r is FullConversation => r !== null);
  }

  /**
   * Delete a conversation (cascades to all child tables).
   */
  async deleteConversation(conversationId: string): Promise<void> {
    const { error } = await supabase.from('conversations').delete().eq('id', conversationId);
    if (error) throw new Error(error.message);
  }

  /**
   * Get AI recommendations for a conversation by prospect index.
   */
  getAIRecommendations(prospectIndex: number): ConversationAIRecommendations {
    return (MOCK_CONVERSATIONS[prospectIndex] ?? MOCK_CONVERSATIONS[0]).ai_recommendations;
  }

  /**
   * Get BANT qualification for a conversation by prospect index.
   */
  getBANTQualification(prospectIndex: number): BANTQualification {
    return (MOCK_CONVERSATIONS[prospectIndex] ?? MOCK_CONVERSATIONS[0]).bant;
  }

  /**
   * Get conversation health for a conversation by prospect index.
   */
  getConversationHealth(prospectIndex: number): ConversationHealth {
    return (MOCK_CONVERSATIONS[prospectIndex] ?? MOCK_CONVERSATIONS[0]).health;
  }

  /**
   * Generate timeline events for the conversation workflow.
   */
  getTimelineEvents(conversation: Conversation): ConversationTimelineEvent[] {
    const stages: { id: string; label: string; description: string }[] = [
      { id: 'conversation_started', label: 'Conversation Started', description: 'Initial contact and connection request sent' },
      { id: 'connection_accepted', label: 'Connection Accepted', description: 'Prospect accepted the LinkedIn connection request' },
      { id: 'first_reply', label: 'First Reply', description: 'Prospect sent their first reply' },
      { id: 'ai_analysis', label: 'AI Analysis', description: 'Conversation AI analyzed messages, intent, and sentiment' },
      { id: 'qualification_updated', label: 'Qualification Updated', description: 'BANT qualification and lead score updated' },
      { id: 'meeting_ready', label: 'Meeting Ready', description: 'Prospect qualified and ready for a meeting' },
      { id: 'handed_off', label: 'Handed to Meeting Agent', description: 'Conversation handed off to Meeting Agent' },
    ];

    const stageOrder = ['initial_contact', 'connection_accepted', 'first_reply', 'engaged', 'qualified', 'meeting_ready', 'handed_off'];
    const currentIdx = stageOrder.indexOf(conversation.conversation_stage);

    return stages.map((s, i) => ({
      ...s,
      timestamp: i <= currentIdx ? conversation.created_at : null,
      completed: i <= currentIdx,
    }));
  }

  /**
   * Get the current pipeline stage.
   */
  getCurrentStage(): ConversationStage_Process {
    return 'loading_messages';
  }

  /**
   * Get mock conversation data by index.
   */
  getMockConversation(index: number): MockConversation {
    return MOCK_CONVERSATIONS[index] ?? MOCK_CONVERSATIONS[0];
  }

  /**
   * Export conversation data in various formats.
   */
  exportConversation(conversation: FullConversation, format: ExportFormat): ExportConfig {
    const data = {
      conversation: {
        id: conversation.id,
        prospect: conversation.prospect_name,
        company: conversation.company_name,
        status: conversation.status,
        stage: conversation.conversation_stage,
        meeting_ready: conversation.meeting_ready,
      },
      messages: conversation.messages,
      analysis: conversation.analysis,
      objections: conversation.objections,
      ai_responses: conversation.ai_responses,
      summary: conversation.summary,
    };

    switch (format) {
      case 'json':
        return { format, data: JSON.stringify(data, null, 2), filename: `conversation-${conversation.id.slice(0, 8)}.json` };
      case 'csv': {
        const rows: string[][] = [
          ['Timestamp', 'Sender', 'Channel', 'Type', 'Content'],
          ...conversation.messages.map((m) => [
            m.timestamp,
            m.sender,
            m.channel,
            m.message_type,
            m.content.replace(/"/g, '""').slice(0, 200),
          ]),
        ];
        const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
        return { format, data: csv, filename: `conversation-${conversation.id.slice(0, 8)}.csv` };
      }
    }
  }
}

// Singleton instance
export const conversationAIService = new ConversationAIService();
export { CONVERSATION_STAGES, MOCK_CONVERSATIONS, MOCK_AI_RECOMMENDATIONS };
