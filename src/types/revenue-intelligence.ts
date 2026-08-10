// ============================================================
// Enterprise Revenue Intelligence Engine — Type Definitions
// ============================================================

// ============================================================
// Signal Types
// ============================================================

export type SignalType =
  | 'buying_intent'
  | 'growth'
  | 'technology_fit'
  | 'service_fit'
  | 'risk'
  | 'urgency'
  | 'relationship'
  | 'competitive'
  | 'icp_match'
  | 'market_fit'
  | 'industry_fit'
  | 'decision_maker_confidence';

export type SignalSource =
  | 'research_intelligence'
  | 'knowledge_graph'
  | 'ai_agent'
  | 'manual'
  | 'external_provider';

export type IntelligenceSignal = {
  id: string;
  workspace_id: string | null;
  company_id: string;
  signal_type: SignalType;
  signal_strength: number;
  confidence_score: number;
  source: SignalSource;
  description: string | null;
  detected_at: string;
  created_at: string;
};

// ============================================================
// Scoring
// ============================================================

export type ScoreResult = {
  score: number;
  confidence: number;
  factors: ScoreFactor[];
};

export type ScoreFactor = {
  name: string;
  weight: number;
  value: number;
  description: string;
};

export type RevenueScores = {
  overall_score: number;
  icp_score: number;
  opportunity_score: number;
  buying_intent_score: number;
  growth_score: number;
  technology_fit_score: number;
  service_fit_score: number;
  risk_score: number;
  urgency_score: number;
  relationship_score: number;
  confidence_score: number;
};

// ============================================================
// Priority
// ============================================================

export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'none';

// ============================================================
// Database Records
// ============================================================

export type RevenueProfileRecord = {
  id: string;
  workspace_id: string | null;
  company_id: string;
  overall_score: number;
  icp_score: number;
  opportunity_score: number;
  buying_intent_score: number;
  growth_score: number;
  technology_fit_score: number;
  service_fit_score: number;
  risk_score: number;
  urgency_score: number;
  relationship_score: number;
  confidence_score: number;
  priority: Priority;
  recommended_action: string | null;
  version: number;
  analysis_duration_ms: number | null;
  created_at: string;
  updated_at: string;
};

export type RevenueRecommendationRecord = {
  id: string;
  workspace_id: string | null;
  company_id: string;
  recommendation_type: RecommendationType;
  title: string;
  description: string | null;
  priority: Priority;
  status: RecommendationStatus;
  created_at: string;
};

export type RecommendationType =
  | 'next_best_action'
  | 'outreach'
  | 'proposal'
  | 'case_study'
  | 'service'
  | 'follow_up'
  | 'meeting'
  | 'decision_makers';

export type RecommendationStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'archived';

// ============================================================
// Analysis Input
// ============================================================

export type CompanyIntelligenceInput = {
  company_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  sub_industry: string | null;
  business_model: string | null;
  company_size: string | null;
  locations: string[];
  summary: string | null;
  technology_stack: { name: string; category: string; confidence: number }[];
  services: { name: string; description: string; category: string }[];
  products: { name: string; description: string; category: string }[];
  target_market: { segment: string; description: string }[];
  brand_positioning: string | null;
  social_profiles: { platform: string; url: string }[];
  buying_signals: { signal_type: string; description: string; confidence: number }[];
  growth_signals: { signal_type: string; description: string; confidence: number }[];
  decision_makers: { name: string; title: string; department: string; confidence: number }[];
  competitive_positioning: { competitors: string[]; differentiators: string[]; market_position: string };
  confidence_score: number | null;
};

export type ICPDefinition = {
  target_industries: string[];
  target_company_sizes: string[];
  target_business_models: string[];
  target_locations: string[];
  target_technologies: string[];
  excluded_industries: string[];
  excluded_company_sizes: string[];
};

export type AnalysisContext = {
  company: CompanyIntelligenceInput;
  icp: ICPDefinition | null;
  graphRelationships: { relationship_type: string; target_name: string; target_type: string }[];
  existingSignals: IntelligenceSignal[];
  workspaceId: string | null;
};

// ============================================================
// Analysis Result
// ============================================================

export type AnalysisResult = {
  profile: RevenueScores;
  signals: Omit<IntelligenceSignal, 'id' | 'workspace_id' | 'company_id' | 'created_at'>[];
  recommendations: Omit<RevenueRecommendationRecord, 'id' | 'workspace_id' | 'company_id' | 'created_at'>[];
  priority: Priority;
  recommendedAction: string;
  durationMs: number;
};

// ============================================================
// Monitoring
// ============================================================

export type RevenueMonitorSummary = {
  total_profiles: number;
  average_overall_score: number;
  average_icp_score: number;
  average_buying_intent_score: number;
  average_growth_score: number;
  average_confidence: number;
  priority_distribution: Record<string, number>;
  total_signals: number;
  total_recommendations: number;
  pending_recommendations: number;
  accepted_recommendations: number;
  average_analysis_duration_ms: number;
  icp_distribution: { high: number; medium: number; low: number };
  buying_signal_trends: Record<string, number>;
};

// ============================================================
// Health
// ============================================================

export type RevenueHealth = {
  healthy: boolean;
  total_profiles: number;
  total_signals: number;
  total_recommendations: number;
  stale_profiles: number;
  low_confidence_profiles: number;
  errors: string[];
};
