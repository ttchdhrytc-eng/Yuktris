// ============================================================
// Conversation Intelligence Types — Phase 9
// ============================================================

export type PrimaryIntent =
  | 'positive_interest' | 'negative_interest' | 'question' | 'objection'
  | 'pricing_request' | 'demo_request' | 'meeting_request' | 'referral'
  | 'need_more_info' | 'competitor_mention' | 'budget_concern' | 'authority_concern'
  | 'timing_concern' | 'security_concern' | 'compliance_concern'
  | 'no_interest' | 'not_decision_maker' | 'follow_up_later' | 'spam' | 'unknown';

export type BuyingStage =
  | 'cold' | 'aware' | 'interested' | 'evaluating' | 'decision' | 'negotiation'
  | 'meeting_scheduled' | 'proposal_sent' | 'closed_won' | 'closed_lost';

export type RecommendedAction =
  | 'reply_now' | 'wait' | 'book_meeting' | 'send_proposal' | 'send_case_study'
  | 'send_roi_calculator' | 'escalate_to_sales' | 'escalate_to_founder'
  | 'escalate_to_support' | 'disqualify' | 'nurture' | 'no_action';

export type ReplyType =
  | 'suggested_reply' | 'alternative_reply' | 'short_reply' | 'long_reply'
  | 'friendly_tone' | 'professional_tone' | 'founder_tone' | 'enterprise_tone'
  | 'cta' | 'follow_up_strategy';

export type ConversationEventType =
  | 'message_received' | 'message_sent' | 'message_read' | 'message_delivered'
  | 'message_edited' | 'message_deleted' | 'reaction_added' | 'reaction_removed'
  | 'attachment_received' | 'voice_note_received' | 'image_received' | 'link_detected';

export type ConversationLabelType =
  | 'hot_lead' | 'warm_lead' | 'cold_lead' | 'objection' | 'meeting_ready'
  | 'pricing_discussion' | 'competitor_mentioned' | 'decision_maker'
  | 'champion' | 'detractor' | 'escalated' | 'nurture' | 'disqualified'
  | 'high_priority' | 'urgent_reply_needed' | 'human_escalation';

export type ContextType =
  | 'revenue_dna' | 'market_intelligence' | 'knowledge_graph' | 'memory'
  | 'campaign_strategy' | 'value_proposition' | 'case_study' | 'trust_signal'
  | 'competitor_intelligence' | 'personalization' | 'icp_intelligence';

export type ObjectionCategory =
  | 'too_expensive' | 'already_using_competitor' | 'no_budget' | 'no_time'
  | 'wrong_person' | 'not_interested' | 'call_later' | 'email_me'
  | 'need_approval' | 'need_technical_info' | 'need_case_study'
  | 'need_roi' | 'need_proposal' | 'need_security_info' | 'need_compliance_docs';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type MeetingReadiness = 'not_ready' | 'warming_up' | 'almost_ready' | 'ready' | 'handed_off';

// ============================================================
// Database Record Types
// ============================================================

export interface ConversationThread {
  id: string;
  workspace_id: string;
  conversation_id: string;
  contact_id: string | null;
  company_id: string | null;
  thread_subject: string | null;
  thread_status: 'active' | 'paused' | 'closed' | 'escalated';
  message_count: number;
  last_message_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationIntent {
  id: string;
  workspace_id: string;
  conversation_id: string;
  message_id: string | null;
  primary_intent: PrimaryIntent;
  secondary_intent: PrimaryIntent | null;
  conversation_goal: string | null;
  urgency: Urgency;
  likelihood_to_buy: number;
  meeting_likelihood: number;
  revenue_opportunity: string | null;
  confidence: number;
  reasoning: string | null;
  created_at: string;
}

export interface ConversationBuyingStage {
  id: string;
  workspace_id: string;
  conversation_id: string;
  buying_stage: BuyingStage;
  previous_stage: string | null;
  stage_reason: string;
  stage_signals: unknown[];
  confidence: number;
  version: number;
  created_at: string;
}

export interface ConversationRecommendation {
  id: string;
  workspace_id: string;
  conversation_id: string;
  recommended_action: RecommendedAction;
  action_reason: string;
  action_priority: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  reasoning: string | null;
  created_at: string;
}

export interface ConversationReplyLibraryEntry {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  reply_type: ReplyType;
  reply_text: string;
  cta: string | null;
  confidence: number;
  status: 'pending' | 'approved' | 'sent' | 'rejected' | 'edited';
  created_at: string;
}

export interface ConversationEvent {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  message_id: string | null;
  event_type: ConversationEventType;
  event_data: Record<string, unknown>;
  created_at: string;
}

export interface ConversationLabel {
  id: string;
  workspace_id: string;
  conversation_id: string;
  label: ConversationLabelType;
  label_confidence: number;
  created_at: string;
}

export interface ConversationScore {
  id: string;
  workspace_id: string;
  conversation_id: string;
  intent_score: number;
  sentiment_score: number;
  engagement_score: number;
  buying_stage_score: number;
  meeting_readiness_score: number;
  risk_score: number;
  overall_score: number;
  score_explanation: Record<string, string>;
  confidence: number;
  version: number;
  created_at: string;
}

export interface ConversationContextEntry {
  id: string;
  workspace_id: string;
  conversation_id: string;
  context_type: ContextType;
  context_data: Record<string, unknown>;
  relevance_score: number;
  created_at: string;
}

// ============================================================
// Extended Conversation (reuses existing conversations table)
// ============================================================

export interface ConversationWithIntelligence {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;
  campaign_id: string | null;
  prospect_name: string | null;
  prospect_title: string | null;
  company_name: string | null;
  status: string;
  conversation_stage: string;
  buying_stage: BuyingStage;
  meeting_readiness_level: MeetingReadiness;
  risk_level: RiskLevel;
  overall_confidence: number;
  last_analyzed_at: string | null;
  messages: ConversationMessageExtended[];
  intents: ConversationIntent[];
  buyingStages: ConversationBuyingStage[];
  recommendations: ConversationRecommendation[];
  replies: ConversationReplyLibraryEntry[];
  labels: ConversationLabel[];
  score: ConversationScore | null;
  context: ConversationContextEntry[];
  objections: ConversationObjectionExtended[];
  summary: ConversationSummaryExtended | null;
}

export interface ConversationMessageExtended {
  id: string;
  conversation_id: string;
  workspace_id: string | null;
  sender: 'prospect' | 'user' | 'ai';
  channel: string;
  content: string;
  timestamp: string;
  message_type: string;
  attachments: unknown[];
  read_status: boolean;
  delivered_status: boolean;
  reaction: Record<string, unknown> | null;
  is_edited: boolean;
  is_deleted: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ConversationObjectionExtended {
  id: string;
  conversation_analysis_id: string;
  objection_type: string;
  severity: string;
  recommended_response: string | null;
  confidence: number;
  created_at: string;
}

export interface ConversationSummaryExtended {
  id: string;
  conversation_id: string;
  summary: string;
  next_action: string | null;
  meeting_readiness: string;
  executive_summary: string | null;
  recommended_followup: string | null;
  escalation_suggestion: string | null;
  created_at: string;
}

// ============================================================
// AI Generation Types
// ============================================================

export interface ConversationAnalysisInput {
  workspaceId: string;
  conversationId: string;
  messages: Array<{ sender: string; content: string; timestamp: string; message_type: string }>;
  prospectName: string;
  companyName: string;
  prospectTitle?: string;
  previousStage?: BuyingStage;
}

export interface ConversationAnalysisResult {
  intent: {
    primary_intent: PrimaryIntent;
    secondary_intent: PrimaryIntent | null;
    conversation_goal: string;
    urgency: Urgency;
    likelihood_to_buy: number;
    meeting_likelihood: number;
    revenue_opportunity: string | null;
    confidence: number;
    reasoning: string;
  };
  sentiment: {
    sentiment: 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';
    confidence: number;
    reasoning: string;
  };
  buyingStage: {
    buying_stage: BuyingStage;
    stage_reason: string;
    stage_signals: Array<{ signal: string; strength: number }>;
    confidence: number;
  };
  objections: Array<{
    objection_category: ObjectionCategory;
    root_cause: string;
    suggested_response: string;
    supporting_material: string;
    confidence: number;
  }>;
  recommendation: {
    recommended_action: RecommendedAction;
    action_reason: string;
    action_priority: 'low' | 'medium' | 'high' | 'critical';
    confidence: number;
    reasoning: string;
  };
  replies: Array<{
    reply_type: ReplyType;
    reply_text: string;
    cta: string | null;
    confidence: number;
  }>;
  score: {
    intent_score: number;
    sentiment_score: number;
    engagement_score: number;
    buying_stage_score: number;
    meeting_readiness_score: number;
    risk_score: number;
    overall_score: number;
    score_explanation: Record<string, string>;
    confidence: number;
  };
  summary: {
    summary: string;
    executive_summary: string;
    next_action: string;
    recommended_followup: string;
    escalation_suggestion: string | null;
    meeting_readiness: MeetingReadiness;
  };
  labels: ConversationLabelType[];
  meetingReadiness: {
    level: MeetingReadiness;
    reason: string;
    confidence: number;
  };
  scheduling?: {
    prospect_confirmed_time: boolean;
    start_iso: string | null;
    end_iso: string | null;
    timezone: string | null;
    confidence: number;
    evidence: string | null;
  };
  risk: {
    level: RiskLevel;
    factors: string[];
    confidence: number;
  };
}

// ============================================================
// Dashboard Types
// ============================================================

export interface ConversationIntelligenceDashboard {
  totalConversations: number;
  activeConversations: number;
  highIntentLeads: number;
  meetingReadyCount: number;
  objectionCount: number;
  avgScore: number;
  urgentReplies: number;
  conversations: ConversationWithIntelligence[];
  recentEvents: ConversationEvent[];
  topConversations: ConversationWithIntelligence[];
}
