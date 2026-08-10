// ============================================================
// Revenue Strategy & Campaign Intelligence Types
// ============================================================

export type StrategyStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type CampaignStrategyStatus = 'draft' | 'approved' | 'active' | 'paused' | 'archived';
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';
export type SequenceType =
  | 'linkedin_only' | 'email_only' | 'linkedin_email' | 'warm_followup'
  | 'cold_outbound' | 'enterprise_abm' | 'founder_outreach'
  | 'channel_partner' | 'referral_campaign';
export type MessageAssetType =
  | 'linkedin_connection_hook' | 'linkedin_opening_message' | 'follow_up_theme'
  | 'email_subject_line' | 'email_opener' | 'value_hook' | 'trust_builder'
  | 'social_proof' | 'industry_angle' | 'persona_angle' | 'objection_response'
  | 'cta_library';
export type ChannelType = 'linkedin' | 'email' | 'both' | 'voice_note' | 'video_message' | 'referral';
export type TemplateChannel = 'linkedin' | 'email' | 'voice_note' | 'video_message';
export type GoalType =
  | 'book_meetings' | 'generate_demos' | 'generate_qualified_opportunities'
  | 'enterprise_expansion' | 'partnership_outreach' | 'affiliate_recruitment'
  | 'account_expansion' | 'product_launch' | 'hiring_outreach';
export type ApprovalAction = 'approve' | 'edit' | 'duplicate' | 'save_template';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'completed';

// ============================================================
// Database Record Types
// ============================================================

export interface RevenueStrategy {
  id: string;
  workspace_id: string;
  revenue_dna_id: string | null;
  market_profile_id: string | null;

  best_icp: Record<string, unknown>;
  best_market: string | null;
  best_industry: string | null;
  best_geography: string | null;
  best_company_size: string | null;
  best_decision_makers: string[];
  best_messaging_angle: string | null;
  best_outreach_channel: string | null;
  best_campaign_sequence: string | null;
  best_follow_up_timing: string | null;
  expected_reply_rate: number;
  expected_meeting_rate: number;
  expected_revenue: string | null;
  estimated_campaign_duration: string | null;
  confidence_score: number;
  completion_percentage: number;
  status: StrategyStatus;
  error_message: string | null;
  ai_reasoning: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignStrategy {
  id: string;
  workspace_id: string;
  revenue_strategy_id: string;

  strategy_name: string;
  objective: string | null;
  recommended_icp: Record<string, unknown>;
  target_industry: string | null;
  target_geography: string | null;
  target_company_size: string | null;
  target_revenue_range: string | null;
  decision_maker_personas: string[];
  pain_points: string[];
  buying_triggers: string[];
  business_outcomes: string[];
  unique_messaging_angle: string | null;
  competitive_positioning: string | null;
  primary_cta: string | null;
  secondary_cta: string | null;
  risk_level: RiskLevel | null;
  expected_roi: string | null;
  expected_meetings: number;
  estimated_pipeline: string | null;
  confidence_score: number;
  ai_recommendation: string | null;
  status: CampaignStrategyStatus;
  created_at: string;
  updated_at: string;
}

export interface CampaignSequence {
  id: string;
  workspace_id: string;
  campaign_strategy_id: string;

  sequence_name: string;
  sequence_type: SequenceType;
  touch_order: number;
  delay_between_touches: string | null;
  purpose: string | null;
  success_criteria: string | null;
  escalation_rules: string[];
  exit_rules: string[];
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface MessageLibraryAsset {
  id: string;
  workspace_id: string;
  revenue_strategy_id: string | null;
  campaign_strategy_id: string | null;

  asset_type: MessageAssetType;
  content: string;
  target_persona: string | null;
  target_industry: string | null;
  context: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface MessagingTemplate {
  id: string;
  workspace_id: string;
  campaign_strategy_id: string | null;

  template_name: string;
  channel: TemplateChannel;
  persona: string | null;
  industry: string | null;
  subject: string | null;
  body: string;
  variables: string[];
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface ChannelRecommendation {
  id: string;
  workspace_id: string;
  revenue_strategy_id: string;

  channel: ChannelType;
  recommendation: string;
  reasoning: string | null;
  estimated_performance: Record<string, unknown>;
  estimated_reply_rate: number | null;
  estimated_meeting_rate: number | null;
  is_primary: boolean;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignGoal {
  id: string;
  workspace_id: string;
  campaign_strategy_id: string | null;

  goal_type: GoalType;
  goal_description: string | null;
  messaging_adaptation: string | null;
  target_metric: string | null;
  target_value: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface CampaignStrategyVersion {
  id: string;
  workspace_id: string;
  campaign_strategy_id: string;

  version_number: number;
  snapshot: Record<string, unknown>;
  change_description: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StrategyApproval {
  id: string;
  workspace_id: string;
  campaign_strategy_id: string;

  action: ApprovalAction;
  status: ApprovalStatus;
  feedback: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
}

// ============================================================
// Composite Types
// ============================================================

export interface FullRevenueStrategy {
  strategy: RevenueStrategy;
  campaigns: CampaignStrategy[];
  sequences: Record<string, CampaignSequence[]>;
  messageLibrary: MessageLibraryAsset[];
  templates: MessagingTemplate[];
  channels: ChannelRecommendation[];
  goals: CampaignGoal[];
  approvals: StrategyApproval[];
}

// ============================================================
// AI Generation Types
// ============================================================

export interface RevenueStrategyInput {
  workspaceId: string;
  revenueDNA?: {
    target_industries?: string[];
    differentiators?: string[];
    sales_motion?: string | null;
    geographies?: string[];
    buyer_personas?: Array<{ role: string; goals: string[]; challenges: string[] }>;
    buying_signals?: string[];
    typical_objections?: string[];
  } | null;
  marketIntel?: {
    profile?: {
      total_addressable_market?: string | null;
      growing_industries?: string[];
      market_saturation?: string | null;
      average_sales_cycle?: string | null;
      average_deal_size?: string | null;
      growth_potential?: number;
    };
    segments?: Array<{ segment_name: string; opportunity_score: number; recommended: boolean }>;
    opportunities?: Array<{ company_name: string; signal_type: string; priority: string; opportunity_score: number }>;
    trends?: Array<{ trend_name: string; trend_type: string; impact_level: string }>;
  } | null;
}

export interface RevenueStrategyGenerationResult {
  strategy: Omit<RevenueStrategy, 'id' | 'workspace_id' | 'revenue_dna_id' | 'market_profile_id' | 'created_at' | 'updated_at' | 'status' | 'error_message'>;
  campaigns: Array<Omit<CampaignStrategy, 'id' | 'workspace_id' | 'revenue_strategy_id' | 'created_at' | 'updated_at'> & { sequences: Omit<CampaignSequence, 'id' | 'workspace_id' | 'campaign_strategy_id' | 'created_at' | 'updated_at'>[] }>;
  messageLibrary: Omit<MessageLibraryAsset, 'id' | 'workspace_id' | 'revenue_strategy_id' | 'campaign_strategy_id' | 'created_at' | 'updated_at'>[];
  channels: Omit<ChannelRecommendation, 'id' | 'workspace_id' | 'revenue_strategy_id' | 'created_at' | 'updated_at'>[];
  goals: Omit<CampaignGoal, 'id' | 'workspace_id' | 'campaign_strategy_id' | 'created_at' | 'updated_at'>[];
}
