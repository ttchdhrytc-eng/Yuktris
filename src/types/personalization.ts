// ============================================================
// Personalization Agent — Types
// ============================================================

export type PersonalizationStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type PainPointCategory =
  | 'current_challenges'
  | 'likely_frustrations'
  | 'business_goals'
  | 'operational_issues'
  | 'growth_challenges'
  | 'technology_challenges';

export type PainPointPriority = 'low' | 'medium' | 'high' | 'critical';

export type HookType =
  | 'recent_company_event'
  | 'technology_mention'
  | 'hiring_mention'
  | 'expansion_mention'
  | 'mutual_interest'
  | 'industry_trend';

export type AssetType =
  | 'case_study'
  | 'testimonial'
  | 'portfolio'
  | 'landing_page'
  | 'whitepaper'
  | 'article'
  | 'video';

export type AssetPriority = 'low' | 'medium' | 'high' | 'critical';

export type CTAType = 'primary' | 'secondary' | 'soft' | 'hard';

export type CTAPriority = 'low' | 'medium' | 'high' | 'critical';

export type CommunicationStyle =
  | 'formal'
  | 'consultative'
  | 'direct'
  | 'conversational'
  | 'executive';

export type Tone =
  | 'professional'
  | 'friendly'
  | 'authoritative'
  | 'empathetic'
  | 'urgent'
  | 'inspirational';

// ============================================================
// Main Records
// ============================================================

export type PersonalizationProfile = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  contact_id: string | null;
  personalization_score: number;
  communication_style: string | null;
  tone: string | null;
  value_proposition: string | null;
  cta_strategy: string | null;
  status: PersonalizationStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type PainPoint = {
  id: string;
  profile_id: string;
  category: PainPointCategory;
  description: string | null;
  priority: PainPointPriority;
  confidence: number;
  created_at: string;
};

export type OpeningHook = {
  id: string;
  profile_id: string;
  hook_type: HookType;
  hook_text: string | null;
  confidence: number;
  created_at: string;
};

export type RecommendedAsset = {
  id: string;
  profile_id: string;
  asset_type: AssetType;
  title: string | null;
  url: string | null;
  priority: AssetPriority;
  created_at: string;
};

export type CTARecommendation = {
  id: string;
  profile_id: string;
  cta_type: CTAType;
  cta_text: string | null;
  priority: CTAPriority;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullPersonalizationProfile = PersonalizationProfile & {
  pain_points: PainPoint[];
  opening_hooks: OpeningHook[];
  recommended_assets: RecommendedAsset[];
  cta_recommendations: CTARecommendation[];
};

// ============================================================
// Pipeline Stages
// ============================================================

export type PersonalizationStage =
  | 'loading_intelligence'
  | 'analyzing_prospect'
  | 'generating_pain_points'
  | 'selecting_value_proposition'
  | 'creating_hooks'
  | 'generating_cta'
  | 'building_blueprint'
  | 'saving_results';

export type PersonalizationStageInfo = {
  stage: PersonalizationStage;
  label: string;
  description: string;
};

export type PersonalizationTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// AI Recommendations Summary
// ============================================================

export type PersonalizationAIRecommendations = {
  executive_summary: string;
  prospect_summary: string;
  company_summary: string;
  business_opportunity: string;
  key_insights: string[];
  recommended_messaging_angle: string;
  conversation_context: string;
  outreach_readiness: 'not_ready' | 'partially_ready' | 'ready' | 'highly_ready';
};

// ============================================================
// Communication Profile
// ============================================================

export type CommunicationProfile = {
  tone: Tone;
  writing_style: CommunicationStyle;
  length_preference: 'concise' | 'medium' | 'detailed';
  professionality: number;
  humor_level: number;
  directness: number;
  urgency: number;
};

// ============================================================
// Value Proposition
// ============================================================

export type ValueProposition = {
  primary_value_proposition: string;
  secondary_value_proposition: string;
  unique_selling_points: string[];
  competitive_advantages: string[];
  recommended_services: string[];
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

export type OpenAIBlueprintResult = {
  personalization_score: number;
  communication_style: CommunicationStyle;
  tone: Tone;
  value_proposition: string;
  reasoning: string;
};

export type FirecrawlCompanyUpdate = {
  url: string;
  update_type: string;
  content: string;
  detected_at: string;
};

export type TavilyIndustryResult = {
  topic: string;
  summary: string;
  source: string;
  url: string;
};

export type LinkedInActivityResult = {
  contact_name: string;
  activity_level: 'high' | 'medium' | 'low';
  recent_posts: number;
  engagement_rate: number;
  primary_topics: string[];
};

export type CRMAssetResult = {
  asset_type: AssetType;
  title: string;
  url: string;
  relevance_score: number;
};
