// ============================================================
// Conversation AI — Types
// ============================================================

export type ConversationStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'escalated'
  | 'handed_off'
  | 'failed';

export type ConversationStage =
  | 'initial_contact'
  | 'connection_accepted'
  | 'first_reply'
  | 'engaged'
  | 'qualified'
  | 'objection_handling'
  | 'meeting_ready'
  | 'handed_off'
  | 'inactive';

export type Sender = 'prospect' | 'user' | 'ai';

export type Channel = 'linkedin' | 'email' | 'whatsapp' | 'slack' | 'manual';

export type MessageType =
  | 'text'
  | 'connection_request'
  | 'connection_accepted'
  | 'voice_note'
  | 'video'
  | 'attachment'
  | 'system';

export type Sentiment = 'very_positive' | 'positive' | 'neutral' | 'negative' | 'very_negative';

export type BuyerIntent = 'none' | 'low' | 'medium' | 'high' | 'very_high';

export type Urgency = 'low' | 'medium' | 'high' | 'critical';

export type InterestLevel = 'none' | 'low' | 'medium' | 'high' | 'very_high';

export type DecisionStage = 'unaware' | 'aware' | 'interested' | 'evaluating' | 'deciding' | 'committed';

export type ObjectionType =
  | 'price'
  | 'timing'
  | 'competition'
  | 'authority'
  | 'need'
  | 'internal_process'
  | 'trust'
  | 'complexity';

export type ObjectionSeverity = 'low' | 'medium' | 'high' | 'critical';

export type ResponseType = 'recommended' | 'alternative' | 'followup' | 'escalation';

export type ResponseStatus = 'pending' | 'approved' | 'sent' | 'rejected' | 'edited';

export type MeetingReadiness = 'not_ready' | 'warming_up' | 'almost_ready' | 'ready' | 'handed_off';

// ============================================================
// Main Records
// ============================================================

export type Conversation = {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  campaign_id: string | null;
  prospect_name: string | null;
  prospect_title: string | null;
  company_name: string | null;
  status: ConversationStatus;
  conversation_stage: ConversationStage;
  meeting_ready: boolean;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type ConversationMessage = {
  id: string;
  conversation_id: string;
  sender: Sender;
  channel: Channel;
  content: string;
  timestamp: string;
  message_type: MessageType;
  created_at: string;
};

export type ConversationAnalysis = {
  id: string;
  conversation_id: string;
  sentiment: Sentiment;
  buyer_intent: BuyerIntent;
  qualification_score: number;
  trust_score: number;
  engagement_score: number;
  conversation_score: number;
  urgency: Urgency;
  interest_level: InterestLevel;
  decision_stage: DecisionStage;
  created_at: string;
};

export type ConversationObjection = {
  id: string;
  conversation_analysis_id: string;
  objection_type: ObjectionType;
  severity: ObjectionSeverity;
  recommended_response: string | null;
  confidence: number;
  created_at: string;
};

export type ConversationAIResponse = {
  id: string;
  conversation_id: string;
  response_type: ResponseType;
  response_text: string;
  confidence: number;
  status: ResponseStatus;
  created_at: string;
};

export type ConversationSummary = {
  id: string;
  conversation_id: string;
  summary: string | null;
  next_action: string | null;
  meeting_readiness: MeetingReadiness;
  executive_summary: string | null;
  recommended_followup: string | null;
  escalation_suggestion: string | null;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullConversation = Conversation & {
  messages: ConversationMessage[];
  analysis: ConversationAnalysis | null;
  objections: ConversationObjection[];
  ai_responses: ConversationAIResponse[];
  summary: ConversationSummary | null;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type ConversationStage_Process =
  | 'loading_messages'
  | 'analyzing_conversation'
  | 'detecting_intent'
  | 'detecting_sentiment'
  | 'qualifying_lead'
  | 'generating_response'
  | 'updating_context'
  | 'saving_analysis';

export type ConversationStageInfo = {
  stage: ConversationStage_Process;
  label: string;
  description: string;
};

// ============================================================
// Timeline Events
// ============================================================

export type ConversationTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Lead Qualification (BANT)
// ============================================================

export type BANTQualification = {
  budget: 'unknown' | 'confirmed' | 'likely' | 'unlikely' | 'none';
  authority: 'unknown' | 'decision_maker' | 'influencer' | 'gatekeeper' | 'none';
  need: 'unknown' | 'critical' | 'high' | 'medium' | 'low' | 'none';
  timeline: 'unknown' | 'immediate' | 'this_quarter' | 'next_quarter' | 'later' | 'none';
  qualification_score: number;
  decision_maker_status: 'confirmed' | 'likely' | 'unconfirmed' | 'not_decision_maker';
};

// ============================================================
// Conversation Health
// ============================================================

export type ConversationHealth = {
  engagement_trend: 'increasing' | 'stable' | 'decreasing' | 'flat';
  response_time_avg: number;
  positive_signals: string[];
  negative_signals: string[];
  risk_alerts: string[];
  momentum_score: number;
};

// ============================================================
// AI Recommendations
// ============================================================

export type ConversationAIRecommendations = {
  executive_summary: string;
  recommended_next_action: string;
  recommended_followup: string;
  escalation_suggestion: string;
  meeting_readiness: MeetingReadiness;
};

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'json' | 'csv';

export type ExportConfig = {
  format: ExportFormat;
  data: string;
  filename: string;
};

// ============================================================
// Service Interface Types (for future API integrations)
// ============================================================

export type OpenAIAnalysisResult = {
  sentiment: Sentiment;
  buyer_intent: BuyerIntent;
  summary: string;
  recommended_reply: string;
};

export type AnthropicReviewResult = {
  review: string;
  risk_assessment: string;
  recommendation: string;
};

export type LinkedInMessagesResult = {
  messages: { sender: string; content: string; timestamp: string }[];
};

export type EmailThreadsResult = {
  threads: { sender: string; content: string; timestamp: string }[];
};

export type WhatsAppMessagesResult = {
  messages: { sender: string; content: string; timestamp: string }[];
};

export type CRMConversationUpdate = {
  updated: boolean;
  contact_id: string;
};

export type MeetingAgentHandoffResult = {
  handed_off: boolean;
  meeting_id: string;
};
