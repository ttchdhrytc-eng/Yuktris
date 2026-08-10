// ============================================================
// Enterprise Outreach Intelligence Engine — Type Definitions
// ============================================================

export type CampaignType =
  | 'cold_outreach' | 'warm_outreach' | 'inbound_followup' | 'proposal_followup'
  | 'meeting_followup' | 're_engagement' | 'nurture' | 'customer_expansion'
  | 'renewal' | 'referral' | 'custom';

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';
export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type ChannelType = 'email' | 'linkedin' | 'phone' | 'sms' | 'whatsapp' | 'slack' | 'teams' | 'future';

export type MessageStatus = 'prepared' | 'queued' | 'sent' | 'delivered' | 'opened' | 'replied' | 'bounced' | 'failed';

export type EventType =
  | 'prepared' | 'sent' | 'delivered' | 'opened' | 'clicked' | 'replied'
  | 'bounced' | 'failed' | 'meeting_booked' | 'proposal_sent';

export type ReplyClassification =
  | 'positive' | 'negative' | 'neutral' | 'meeting_request' | 'objection'
  | 'out_of_office' | 'unsubscribe' | 'ask_for_info' | 'referral';

export type VariantType = 'subject' | 'body' | 'cta' | 'icebreaker';

export type SendWindow = {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
};

export type OutreachCampaignRecord = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  campaign_name: string;
  campaign_type: CampaignType;
  campaign_status: CampaignStatus;
  campaign_score: number | null;
  success_probability: number | null;
  error_message: string | null;
  priority: Priority;
  target_channels: ChannelType[];
  strategy: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignSequenceRecord = {
  id: string;
  workspace_id: string | null;
  campaign_id: string;
  sequence_name: string;
  total_steps: number;
  total_duration_days: number;
  target_timezone: string | null;
  send_windows: SendWindow[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type CampaignStepRecord = {
  id: string;
  workspace_id: string | null;
  sequence_id: string;
  step_number: number;
  step_name: string;
  channel: ChannelType;
  delay_days: number;
  delay_hours: number;
  message_template: string | null;
  conditions: Record<string, unknown>;
  is_conditional: boolean;
  created_at: string;
};

export type OutreachMessageRecord = {
  id: string;
  workspace_id: string | null;
  campaign_id: string | null;
  sequence_id: string | null;
  step_id: string | null;
  contact_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  channel: ChannelType;
  subject_line: string | null;
  message_body: string;
  cta: string | null;
  personalization: Record<string, unknown>;
  icebreaker: string | null;
  status: MessageStatus;
  score: number;
  prepared_at: string;
  sent_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
};

export type MessageVariantRecord = {
  id: string;
  workspace_id: string | null;
  message_id: string;
  variant_type: VariantType;
  variant_content: string;
  variant_label: string | null;
  score: number;
  is_winner: boolean;
  created_at: string;
};

export type AudienceSegmentRecord = {
  id: string;
  workspace_id: string | null;
  campaign_id: string | null;
  segment_name: string;
  segment_type: string;
  criteria: Record<string, unknown>;
  contact_count: number;
  priority_level: Priority;
  created_at: string;
};

export type EngagementEventRecord = {
  id: string;
  workspace_id: string | null;
  message_id: string | null;
  campaign_id: string | null;
  event_type: EventType;
  event_data: Record<string, unknown>;
  created_at: string;
};

export type ReplyClassificationRecord = {
  id: string;
  workspace_id: string | null;
  message_id: string;
  reply_content: string | null;
  classification: ReplyClassification;
  intent_score: number;
  meeting_intent: boolean;
  opportunity_detected: boolean;
  suggested_action: string | null;
  created_at: string;
};

export type CampaignMetricsRecord = {
  id: string;
  workspace_id: string | null;
  campaign_id: string;
  total_messages: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  total_positive_replies: number;
  total_meetings_booked: number;
  total_proposals_sent: number;
  total_bounced: number;
  total_failed: number;
  open_rate: number;
  reply_rate: number;
  positive_reply_rate: number;
  meeting_rate: number;
  conversion_rate: number;
  bounce_rate: number;
  channel_performance: Record<string, unknown>;
  best_subject_lines: string[];
  best_ctas: string[];
  calculated_at: string;
};

export type CampaignStrategy = {
  approach: string;
  primary_channels: ChannelType[];
  message_tone: string;
  personalization_level: string;
  follow_up_cadence: string;
  success_probability: number;
};

export type MessageContent = {
  subject_line: string;
  message_body: string;
  cta: string;
  icebreaker: string;
  personalization: Record<string, unknown>;
};

export type GeneratedMessage = {
  channel: ChannelType;
  step_number: number;
  subject_line: string;
  message_body: string;
  cta: string;
  icebreaker: string;
  personalization: Record<string, unknown>;
  score: number;
  variants: { type: VariantType; content: string; label: string; score: number }[];
};

export type SequencePlan = {
  sequence_name: string;
  total_steps: number;
  total_duration_days: number;
  steps: {
    step_number: number;
    step_name: string;
    channel: ChannelType;
    delay_days: number;
    delay_hours: number;
    message_template: string;
    is_conditional: boolean;
    conditions: Record<string, unknown>;
  }[];
  send_windows: SendWindow[];
  target_timezone: string;
};

export type AudienceSegment = {
  segment_name: string;
  segment_type: string;
  criteria: Record<string, unknown>;
  priority_level: Priority;
  contact_count: number;
};

export type ChannelRecommendation = {
  channel: ChannelType;
  score: number;
  reason: string;
};

export type TimingRecommendation = {
  day_of_week: number;
  start_hour: number;
  end_hour: number;
  timezone: string;
  confidence: number;
  reason: string;
};

export type EngagementScore = {
  score: number;
  level: 'high' | 'medium' | 'low' | 'none';
  factors: { factor: string; weight: number; value: number }[];
};

export type ReplyAnalysis = {
  classification: ReplyClassification;
  intent_score: number;
  meeting_intent: boolean;
  opportunity_detected: boolean;
  suggested_action: string;
};

export type OutreachGenerateRequest = {
  companyId: string;
  contactId?: string;
  contactName?: string;
  contactEmail?: string;
  campaignType: CampaignType;
  campaignName?: string;
  targetChannels?: ChannelType[];
  workspaceId?: string | null;
  priority?: Priority;
  customInstructions?: string;
};

export type OutreachGenerationResult = {
  campaignId: string;
  sequenceId: string;
  strategy: CampaignStrategy;
  sequence: SequencePlan;
  messages: GeneratedMessage[];
  audienceSegment: AudienceSegment;
  channelRecommendations: ChannelRecommendation[];
  timingRecommendation: TimingRecommendation;
  engagementScore: EngagementScore;
};

export type OutreachHealth = {
  healthy: boolean;
  total_campaigns: number;
  active_campaigns: number;
  draft_campaigns: number;
  completed_campaigns: number;
  total_messages: number;
  total_sequences: number;
  total_segments: number;
  pending_messages: number;
  errors: string[];
};

export type OutreachAnalytics = {
  total_campaigns: number;
  active_campaigns: number;
  total_messages: number;
  total_sent: number;
  total_opened: number;
  total_replied: number;
  total_positive_replies: number;
  total_meetings_booked: number;
  open_rate: number;
  reply_rate: number;
  positive_reply_rate: number;
  meeting_rate: number;
  conversion_rate: number;
  bounce_rate: number;
  campaign_type_distribution: Record<string, number>;
  channel_distribution: Record<string, number>;
  status_distribution: Record<string, number>;
  recent_campaigns: OutreachCampaignRecord[];
  best_performing_campaigns: { id: string; name: string; reply_rate: number; meeting_rate: number }[];
};
