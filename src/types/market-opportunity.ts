// ============================================================
// Market Opportunity & Discovery Types
// ============================================================

export type MarketProfileStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type SaturationLevel = 'low' | 'medium' | 'high' | 'very_high';
export type RiskLevel = 'low' | 'medium' | 'high' | 'very_high';
export type SegmentType = 'industry' | 'sub_industry' | 'vertical' | 'geography' | 'technology_ecosystem' | 'business_model' | 'growth_stage' | 'company_size';
export type SignalType =
  | 'hiring' | 'funding' | 'expansion' | 'new_office' | 'technology_adoption'
  | 'vendor_change' | 'linkedin_content' | 'executive_change' | 'product_launch'
  | 'new_market_entry' | 'buying_intent' | 'compliance_change' | 'merger_acquisition'
  | 'leadership_change' | 'technology_migration' | 'digital_transformation';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Urgency = 'low' | 'medium' | 'high' | 'immediate';
export type TrendType = 'growth' | 'decline' | 'emerging' | 'disruption' | 'regulatory' | 'technology' | 'consumer_behavior' | 'economic';
export type ImpactLevel = 'low' | 'medium' | 'high' | 'transformative';
export type TimeHorizon = 'immediate' | 'short_term' | 'medium_term' | 'long_term';

export interface MarketProfile {
  id: string;
  workspace_id: string;
  market_analysis_id: string | null;
  total_addressable_market: string | null;
  serviceable_addressable_market: string | null;
  ideal_market: string | null;
  emerging_markets: string[];
  growing_industries: string[];
  declining_industries: string[];
  market_saturation: SaturationLevel | null;
  competitive_density: SaturationLevel | null;
  average_sales_cycle: string | null;
  average_deal_size: string | null;
  buying_committee_complexity: SaturationLevel | null;
  technology_adoption: string | null;
  digital_maturity: SaturationLevel | null;
  growth_potential: number;
  risk_level: RiskLevel | null;
  confidence_score: number;
  completion_percentage: number;
  status: MarketProfileStatus;
  error_message: string | null;
  last_refreshed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketSegment {
  id: string;
  workspace_id: string;
  market_profile_id: string;
  segment_name: string;
  segment_type: SegmentType;
  description: string | null;
  market_size: string | null;
  growth_rate: string | null;
  opportunity_score: number;
  competition_level: SaturationLevel | null;
  recommended: boolean;
  reason: string | null;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface MarketOpportunity {
  id: string;
  workspace_id: string;
  market_profile_id: string | null;
  company_name: string;
  website: string | null;
  industry: string | null;
  reason: string;
  signal_type: SignalType;
  priority: Priority;
  confidence: number;
  recommended_action: string | null;
  urgency: Urgency | null;
  expected_conversion_probability: number | null;
  opportunity_score: number;
  signal_metadata: Record<string, unknown>;
  discovered_at: string;
  created_at: string;
  updated_at: string;
}

export interface MarketScore {
  id: string;
  workspace_id: string;
  market_opportunity_id: string;
  company_name: string;
  revenue_dna_fit: number;
  icp_fit: number;
  buying_signals_score: number;
  technology_fit: number;
  industry_fit: number;
  growth_stage_fit: number;
  competition_score: number;
  risk_score: number;
  geography_fit: number;
  market_momentum: number;
  decision_maker_accessibility: number;
  expected_reply_rate: number;
  expected_meeting_rate: number;
  expected_deal_quality: number;
  expected_sales_cycle: string | null;
  overall_score: number;
  overall_confidence: number;
  scoring_factors: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TargetAccountList {
  id: string;
  workspace_id: string;
  market_profile_id: string | null;
  list_name: string;
  description: string | null;
  selection_reason: string;
  estimated_opportunities: number;
  average_score: number;
  risk_level: RiskLevel | null;
  expected_roi: string | null;
  recommended: boolean;
  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface TargetAccountMember {
  id: string;
  workspace_id: string;
  target_account_list_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  opportunity_score: number;
  signal_summary: string | null;
  recommended_action: string | null;
  confidence_score: number;
  created_at: string;
}

export interface MarketTrend {
  id: string;
  workspace_id: string;
  market_profile_id: string | null;
  trend_name: string;
  trend_type: TrendType;
  description: string | null;
  affected_industries: string[];
  impact_level: ImpactLevel;
  opportunity: string | null;
  time_horizon: TimeHorizon | null;
  momentum: number;
  confidence: number;
  signal_count: number;
  created_at: string;
  updated_at: string;
}

export interface FullMarketIntelligence {
  profile: MarketProfile;
  segments: MarketSegment[];
  opportunities: MarketOpportunity[];
  scores: MarketScore[];
  targetLists: TargetAccountList[];
  trends: MarketTrend[];
}

export interface TargetListWithMembers extends TargetAccountList {
  members: TargetAccountMember[];
}

export interface MarketIntelligenceInput {
  workspaceId: string;
  website?: string;
  companyName?: string;
  businessAnalysis?: {
    industry?: string | null;
    description?: string | null;
    business_model?: string | null;
    products?: string[] | string;
    services?: string[] | string;
    target_audience?: string | null;
    usp?: string | null;
    competitive_position?: string | null;
  };
  revenueDNA?: {
    target_industries?: string[];
    differentiators?: string[];
    sales_motion?: string | null;
    geographies?: string[];
  };
}

export interface MarketIntelligenceGenerationResult {
  profile: Omit<MarketProfile, 'id' | 'workspace_id' | 'market_analysis_id' | 'created_at' | 'updated_at' | 'status' | 'error_message' | 'last_refreshed_at'>;
  segments: Array<Omit<MarketSegment, 'id' | 'workspace_id' | 'market_profile_id' | 'created_at' | 'updated_at'>>;
  opportunities: Array<Omit<MarketOpportunity, 'id' | 'workspace_id' | 'market_profile_id' | 'discovered_at' | 'created_at' | 'updated_at'>>;
  scores: Array<Omit<MarketScore, 'id' | 'workspace_id' | 'market_opportunity_id' | 'created_at' | 'updated_at'> & { company_name: string }>;
  targetLists: Array<{
    list_name: string;
    description: string;
    selection_reason: string;
    estimated_opportunities: number;
    average_score: number;
    risk_level: RiskLevel;
    expected_roi: string;
    recommended: boolean;
    confidence_score: number;
    members: Array<Omit<TargetAccountMember, 'id' | 'workspace_id' | 'target_account_list_id' | 'created_at'>>;
  }>;
  trends: Array<Omit<MarketTrend, 'id' | 'workspace_id' | 'market_profile_id' | 'created_at' | 'updated_at'>>;
}
