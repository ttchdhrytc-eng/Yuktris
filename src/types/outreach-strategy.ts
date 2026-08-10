// ============================================================
// Outreach Strategy Agent — Types
// ============================================================

export type CampaignType = 'multi_touch' | 'single_touch' | 'sequence' | 'drip' | 'ab_test';

export type CampaignStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'archived';

export type TouchpointStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'failed';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type OutreachChannel =
  | 'linkedin_connection'
  | 'linkedin_message'
  | 'linkedin_followup'
  | 'email'
  | 'voice_note'
  | 'video_message'
  | 'referral'
  | 'manual_task';

// ============================================================
// Main Records
// ============================================================

export type OutreachCampaign = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  campaign_name: string;
  campaign_type: CampaignType;
  campaign_status: CampaignStatus;
  campaign_score: number;
  success_probability: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type Touchpoint = {
  id: string;
  campaign_id: string;
  sequence: number;
  channel: string;
  purpose: string | null;
  timing: string | null;
  cta: string | null;
  status: TouchpointStatus;
  created_at: string;
};

export type ChannelStrategy = {
  id: string;
  campaign_id: string;
  channel: string;
  priority: Priority;
  confidence: number;
  created_at: string;
};

export type TimingStrategy = {
  id: string;
  campaign_id: string;
  best_day: string | null;
  best_time: string | null;
  follow_up_interval: string | null;
  cooling_period: string | null;
  maximum_attempts: number;
  campaign_expiry: string | null;
  created_at: string;
};

export type CampaignMetrics = {
  id: string;
  campaign_id: string;
  expected_acceptance_rate: number;
  expected_reply_rate: number;
  expected_meeting_rate: number;
  confidence: number;
  created_at: string;
};

export type OutreachRecommendation = {
  id: string;
  campaign_id: string;
  recommendation: string | null;
  priority: Priority;
  reason: string | null;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullOutreachCampaign = OutreachCampaign & {
  touchpoints: Touchpoint[];
  channel_strategy: ChannelStrategy[];
  timing_strategy: TimingStrategy | null;
  campaign_metrics: CampaignMetrics | null;
  recommendations: OutreachRecommendation[];
};

// ============================================================
// Pipeline Stages
// ============================================================

export type OutreachStage =
  | 'loading_blueprint'
  | 'building_campaign'
  | 'generating_touchpoints'
  | 'selecting_channels'
  | 'optimizing_timing'
  | 'generating_ctas'
  | 'calculating_success'
  | 'saving_campaign';

export type OutreachStageInfo = {
  stage: OutreachStage;
  label: string;
  description: string;
};

export type OutreachTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Messaging Framework
// ============================================================

export type MessagingFramework = {
  opening_goal: string;
  value_message: string;
  social_proof: string;
  objection_handling_theme: string;
  cta_framework: string;
};

// ============================================================
// AI Recommendations Summary
// ============================================================

export type OutreachAIRecommendations = {
  executive_summary: string;
  recommended_campaign: string;
  risk_factors: string[];
  optimization_suggestions: string[];
  recommended_next_action: string;
  campaign_readiness: 'not_ready' | 'partially_ready' | 'ready' | 'highly_ready';
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

export type OpenAICampaignResult = {
  campaign_name: string;
  campaign_type: CampaignType;
  campaign_score: number;
  success_probability: number;
  reasoning: string;
};

export type LinkedInValidationResult = {
  valid: boolean;
  warnings: string[];
  connection_limit: number;
};

export type CRMHistoryResult = {
  campaign_id: string;
  previous_campaigns: number;
  last_contacted: string | null;
  response_history: string[];
};

export type CalendarScheduleResult = {
  recommended_slots: string[];
  timezone: string;
  availability_window: string;
};

export type EmailTimingResult = {
  best_send_time: string;
  best_day: string;
  avoid_times: string[];
};
