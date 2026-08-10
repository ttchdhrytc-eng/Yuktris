// ============================================================
// Outreach Intelligence Engine Types — Phase 7
// ============================================================

export type OutreachDecisionType =
  | 'contact_immediately' | 'wait_3_days' | 'wait_7_days'
  | 'engage_content_first' | 'connect_first' | 'email_first'
  | 'linkedin_first' | 'multi_channel' | 'skip_prospect' | 'revisit_later';

export type ChannelType = 'linkedin' | 'email' | 'linkedin_email' | 'voice_note' | 'video' | 'multi_channel';
export type DayOfWeek = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
export type CTAType = 'meeting' | 'demo' | 'call' | 'resource' | 'question' | 'soft' | 'referral' | 'breakup';
export type IcebreakerType = 'news' | 'funding' | 'hiring' | 'content' | 'milestone' | 'personal' | 'industry' | 'competitor' | 'technology' | 'mutual_connection';
export type TrustSignalType = 'case_study' | 'testimonial' | 'metric' | 'award' | 'certification' | 'partnership' | 'social_proof' | 'authority' | 'data_point' | 'guarantee';
export type ReasoningType = 'decision' | 'personalization' | 'timing' | 'channel' | 'message' | 'scoring';

// ============================================================
// Database Record Types
// ============================================================

export interface OutreachDecision {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  decision: OutreachDecisionType;
  decision_reason: string;
  confidence_score: number;
  version: number;
  status: 'active' | 'superseded' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface OutreachScore {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  connection_probability: number;
  reply_probability: number;
  meeting_probability: number;
  revenue_probability: number;
  relationship_difficulty: number;
  channel_effectiveness: Record<string, number>;
  timing_score: number;
  personalization_score: number;
  overall_outreach_score: number;
  scoring_explanation: Record<string, string>;
  confidence_score: number;
  version: number;
  scored_at: string;
  created_at: string;
  updated_at: string;
}

export interface TimingRecommendation {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  best_day: DayOfWeek | null;
  best_hour: number | null;
  best_sequence_timing: Record<string, unknown>;
  follow_up_delay_days: number;
  maximum_attempts: number;
  cooling_period_days: number;
  retry_window_days: number;
  timezone: string | null;
  timezone_aware: boolean;
  timing_reason: string | null;
  confidence_score: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelStrategy {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  recommended_channel: ChannelType;
  channel_reason: string;
  channel_priority: Array<{ channel: string; priority: number }>;
  expected_performance: Record<string, unknown>;
  linkedin_feasibility: string | null;
  email_feasibility: string | null;
  confidence_score: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MessageStrategy {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  connection_request_strategy: string | null;
  first_message_strategy: string | null;
  second_message_strategy: string | null;
  follow_up_strategy: string | null;
  re_engagement_strategy: string | null;
  email_strategy: string | null;
  voice_note_strategy: string | null;
  video_strategy: string | null;
  cta_strategy: string | null;
  objection_prevention_strategy: string | null;
  strategy_reasoning: string | null;
  confidence_score: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CTALibraryEntry {
  id: string;
  workspace_id: string;
  cta_text: string;
  cta_type: CTAType;
  cta_angle: string | null;
  target_persona: string | null;
  target_industry: string | null;
  effectiveness_score: number;
  usage_count: number;
  success_count: number;
  confidence_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface IcebreakerLibraryEntry {
  id: string;
  workspace_id: string;
  icebreaker_text: string;
  icebreaker_type: IcebreakerType;
  target_persona: string | null;
  target_industry: string | null;
  reference_url: string | null;
  effectiveness_score: number;
  usage_count: number;
  success_count: number;
  confidence_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TrustSignalLibraryEntry {
  id: string;
  workspace_id: string;
  signal_text: string;
  signal_type: TrustSignalType;
  target_persona: string | null;
  target_industry: string | null;
  effectiveness_score: number;
  usage_count: number;
  success_count: number;
  confidence_score: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OutreachReasoning {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  reasoning_type: ReasoningType;
  reasoning_text: string;
  reasoning_factors: Record<string, unknown>;
  confidence_score: number;
  version: number;
  created_at: string;
}

export interface PersonalizationProfile {
  id: string;
  workspace_id: string | null;
  company_id: string | null;
  contact_id: string | null;
  personalization_summary: string | null;
  personalization_score: number;
  communication_style: string | null;
  tone: string | null;
  value_proposition: string | null;
  cta_strategy: string | null;
  website_references: unknown[];
  news_references: unknown[];
  linkedin_references: unknown[];
  technology_references: unknown[];
  industry_references: unknown[];
  pain_point_references: unknown[];
  competitor_references: unknown[];
  case_study_recommendations: unknown[];
  trust_signals: unknown[];
  conversation_angle: string | null;
  icebreakers: unknown[];
  status: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

// ============================================================
// Composite Types
// ============================================================

export interface ProspectOutreachIntelligence {
  company: { id: string; name: string; industry: string | null; website: string | null };
  contact: { id: string; full_name: string | null; job_title: string | null; department: string | null; linkedin_url: string | null } | null;
  decision: OutreachDecision | null;
  score: OutreachScore | null;
  timing: TimingRecommendation | null;
  channel: ChannelStrategy | null;
  message: MessageStrategy | null;
  personalization: PersonalizationProfile | null;
  reasoning: OutreachReasoning[];
}

export interface OutreachDashboard {
  totalProspects: number;
  totalDecided: number;
  contactImmediately: number;
  waitOrNurture: number;
  skipOrRevisit: number;
  avgOutreachScore: number;
  avgReplyProbability: number;
  avgMeetingProbability: number;
  topProspects: ProspectOutreachIntelligence[];
  recentReasoning: OutreachReasoning[];
}

// ============================================================
// AI Generation Types
// ============================================================

export interface OutreachIntelligenceInput {
  workspaceId: string;
  companyId: string;
  contactId?: string;
  company: { name: string; industry?: string; website?: string; size?: string; description?: string };
  contact?: { full_name?: string; job_title?: string; department?: string; seniority?: string; linkedin_url?: string };
  signals: { type: string; strength: number; data?: Record<string, unknown> }[];
  prospectScore?: { overall_prospect_score: number; reply_probability: number; meeting_probability: number };
  revenueStrategy?: { best_messaging_angle?: string; best_outreach_channel?: string; best_cta?: string };
}

export interface OutreachIntelligenceResult {
  decision: { type: OutreachDecisionType; reason: string; confidence: number };
  score: {
    connection_probability: number; reply_probability: number; meeting_probability: number;
    revenue_probability: number; relationship_difficulty: number;
    channel_effectiveness: Record<string, number>; timing_score: number;
    personalization_score: number; overall_outreach_score: number;
    scoring_explanation: Record<string, string>; confidence: number;
  };
  timing: {
    best_day: DayOfWeek; best_hour: number; best_sequence_timing: Record<string, unknown>;
    follow_up_delay_days: number; maximum_attempts: number; cooling_period_days: number;
    retry_window_days: number; timezone: string; timing_reason: string; confidence: number;
  };
  channel: {
    recommended_channel: ChannelType; channel_reason: string;
    channel_priority: Array<{ channel: string; priority: number }>;
    expected_performance: Record<string, unknown>;
    linkedin_feasibility: string; email_feasibility: string; confidence: number;
  };
  message: {
    connection_request_strategy: string; first_message_strategy: string;
    second_message_strategy: string; follow_up_strategy: string;
    re_engagement_strategy: string; email_strategy: string;
    voice_note_strategy: string; video_strategy: string;
    cta_strategy: string; objection_prevention_strategy: string;
    strategy_reasoning: string; confidence: number;
  };
  personalization: {
    personalization_summary: string; communication_style: string; tone: string;
    value_proposition: string; cta_strategy: string;
    website_references: unknown[]; news_references: unknown[];
    linkedin_references: unknown[]; technology_references: unknown[];
    industry_references: unknown[]; pain_point_references: unknown[];
    competitor_references: unknown[]; case_study_recommendations: unknown[];
    trust_signals: unknown[]; conversation_angle: string;
    icebreakers: unknown[]; confidence: number;
  };
  reasoning: Array<{ type: ReasoningType; text: string; factors: Record<string, unknown>; confidence: number }>;
}
