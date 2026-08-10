// ============================================================
// Revenue DNA Types
// ============================================================

export type RevenueDNAStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type SalesMotion = 'smb' | 'mid_market' | 'enterprise' | 'mixed';
export type CompetitorType = 'direct' | 'indirect' | 'alternative';
export type PropositionType = 'primary' | 'secondary' | 'industry_specific' | 'persona_specific';

// Database record types (match DB columns)

export interface RevenueDNAProfile {
  id: string;
  workspace_id: string;
  business_analysis_id: string | null;

  business_identity: BusinessIdentity;
  core_services: string[];
  target_industries: string[];
  ideal_customer_characteristics: string[];

  market_position: MarketPosition;
  differentiators: string[];
  business_strengths: string[];
  brand_positioning: string | null;

  pain_points_solved: string[];
  customer_outcomes: string[];

  buying_committee: BuyingCommitteeMember[];
  buying_signals: string[];
  disqualifiers: string[];

  sales_motion: SalesMotion | null;
  sales_motion_detail: string | null;
  typical_objections: string[];
  offer_types: string[];

  geographies: string[];
  languages: string[];
  technologies: string[];

  trust_signals: string[];
  content_assets: string[];

  keywords: string[];
  categories: string[];
  company_size: string | null;
  geographic_markets: string[];
  market_maturity: string | null;

  confidence_score: number;
  completion_percentage: number;
  status: RevenueDNAStatus;
  error_message: string | null;

  created_at: string;
  updated_at: string;
}

export interface BusinessIdentity {
  name?: string;
  website?: string;
  description?: string;
  industry?: string;
  business_model?: string;
  pricing_model?: string;
  value_proposition?: string;
  target_customers?: string;
  company_size?: string;
}

export interface MarketPosition {
  position?: string;
  market_share?: string;
  maturity?: string;
  positioning_statement?: string;
}

export interface BuyingCommitteeMember {
  role: string;
  department: string;
  influence: 'low' | 'medium' | 'high';
  involvement: 'initiator' | 'influencer' | 'decider' | 'buyer' | 'user' | 'gatekeeper';
}

export interface BuyerPersona {
  id: string;
  workspace_id: string;
  revenue_dna_id: string;

  role: string;
  responsibilities: string[];
  goals: string[];
  kpis: string[];
  daily_challenges: string[];
  common_objections: string[];
  buying_authority: string | null;
  preferred_communication_style: string | null;
  linkedin_behavior: {
    activity_level?: string;
    content_preferences?: string[];
    best_outreach_style?: string;
  };
  email_behavior: {
    response_patterns?: string;
    preferred_subject_style?: string;
    best_send_times?: string;
  };
  typical_questions: string[];
  recommended_messaging_style: string | null;

  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface CompetitorIntelligence {
  id: string;
  workspace_id: string;
  revenue_dna_id: string;

  competitor_name: string;
  competitor_type: CompetitorType;
  key_differentiators: string[];
  pricing_positioning: string | null;
  messaging_differences: string[];
  strengths: string[];
  weaknesses: string[];
  competitive_opportunities: string[];
  website: string | null;

  confidence_score: number;
  created_at: string;
  updated_at: string;
}

export interface ValueProposition {
  id: string;
  workspace_id: string;
  revenue_dna_id: string;

  proposition_type: PropositionType;
  target_industry: string | null;
  target_persona: string | null;
  content: string;

  email_hooks: string[];
  linkedin_hooks: string[];
  opening_messages: string[];
  conversation_starters: string[];
  trust_builders: string[];
  social_proof_suggestions: string[];
  cta_suggestions: string[];

  confidence_score: number;
  created_at: string;
  updated_at: string;
}

// Composite type for full Revenue DNA with all child records

export interface FullRevenueDNA {
  profile: RevenueDNAProfile;
  personas: BuyerPersona[];
  competitors: CompetitorIntelligence[];
  valuePropositions: ValueProposition[];
}

// AI generation input/output types

export interface RevenueDNAInput {
  workspaceId: string;
  website: string;
  companyName?: string;
  businessAnalysisId?: string;
  businessAnalysis?: {
    company_name?: string | null;
    industry?: string | null;
    description?: string | null;
    business_model?: string | null;
    products?: string[] | string;
    services?: string[] | string;
    pricing_model?: string | null;
    target_audience?: string | null;
    usp?: string | null;
    customer_problems?: string[] | string;
    business_goals?: string[] | string;
    revenue_model?: string | null;
    competitive_position?: string | null;
  };
}

export interface RevenueDNAGenerationResult {
  profile: Omit<RevenueDNAProfile, 'id' | 'workspace_id' | 'business_analysis_id' | 'created_at' | 'updated_at' | 'status' | 'error_message'>;
  personas: Array<Omit<BuyerPersona, 'id' | 'workspace_id' | 'revenue_dna_id' | 'created_at' | 'updated_at'>>;
  competitors: Array<Omit<CompetitorIntelligence, 'id' | 'workspace_id' | 'revenue_dna_id' | 'created_at' | 'updated_at'>>;
  valuePropositions: Array<Omit<ValueProposition, 'id' | 'workspace_id' | 'revenue_dna_id' | 'created_at' | 'updated_at'>>;
}
