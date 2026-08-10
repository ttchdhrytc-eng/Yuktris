// ============================================================
// ICP Intelligence Agent — Types
// ============================================================

export type ICPStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type ICPPriority = 'primary' | 'secondary' | 'tertiary';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type Severity = 'low' | 'medium' | 'high' | 'critical';
export type Urgency = 'low' | 'medium' | 'high' | 'immediate';
export type GoalCategory = 'business' | 'revenue' | 'marketing' | 'operational' | 'technology';
export type NegativeFilterType = 'industry' | 'country' | 'company_size' | 'technology' | 'revenue_range';

// ============================================================
// Main ICP Record
// ============================================================

export type ICP = {
  id: string;
  workspace_id: string;
  business_analysis_id: string | null;
  market_analysis_id: string | null;
  name: string;
  description: string | null;
  priority: ICPPriority;
  confidence: number;
  opportunity_score: number;
  competition_score: number;
  revenue_score: number;
  conversion_rate: number;
  estimated_deal_size: string | null;
  status: ICPStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

// ============================================================
// Child Records
// ============================================================

export type ICPCompanyProfile = {
  id: string;
  icp_id: string;
  industry: string | null;
  sub_industry: string | null;
  company_size: string | null;
  revenue_range: string | null;
  employee_count: string | null;
  funding_stage: string | null;
  business_model: string | null;
  technology_stack: string[];
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
};

export type ICPDecisionMaker = {
  id: string;
  icp_id: string;
  department: string | null;
  job_title: string | null;
  seniority: string | null;
  responsibilities: string | null;
  authority_score: number;
  priority: Priority;
  created_at: string;
};

export type ICPPainPoint = {
  id: string;
  icp_id: string;
  pain_point: string;
  severity: Severity;
  urgency: Urgency;
  business_impact: string | null;
  recommended_solution: string | null;
  created_at: string;
};

export type ICPGoal = {
  id: string;
  icp_id: string;
  goal: string;
  priority: Priority;
  category: GoalCategory;
  created_at: string;
};

export type ICPBuyingTrigger = {
  id: string;
  icp_id: string;
  trigger: string;
  description: string | null;
  confidence: number;
  priority: Priority;
  created_at: string;
};

export type ICPNegativeFilter = {
  id: string;
  icp_id: string;
  filter_type: NegativeFilterType;
  value: string;
  reason: string | null;
  created_at: string;
};

export type SalesNavigatorFilters = {
  id: string;
  icp_id: string;
  industry: string[];
  company_size: string[];
  location: string[];
  keywords: string[];
  titles: string[];
  departments: string[];
  technology: string[];
  boolean_query: string | null;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullICP = ICP & {
  company_profile: ICPCompanyProfile | null;
  decision_makers: ICPDecisionMaker[];
  pain_points: ICPPainPoint[];
  goals: ICPGoal[];
  buying_triggers: ICPBuyingTrigger[];
  negative_filters: ICPNegativeFilter[];
  sales_navigator_filters: SalesNavigatorFilters | null;
};

export type ICPGenerationResult = {
  icps: FullICP[];
  recommendations: ICPRecommendations;
};

export type ICPRecommendations = {
  executive_summary: string;
  primary_icp: string;
  secondary_icps: string[];
  priority_order: string[];
  sales_strategy: string;
  recommended_messaging: string;
  estimated_pipeline: string;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type ICPStage =
  | 'reading_business'
  | 'reading_market'
  | 'generating_icps'
  | 'scoring_icps'
  | 'creating_personas'
  | 'building_filters'
  | 'generating_recommendations'
  | 'saving';

export type ICPStageInfo = {
  stage: ICPStage;
  label: string;
  description: string;
};

export type ICPTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Service Interface Types (for future API integrations)
// ============================================================

export type ICPGenerationInput = {
  businessAnalysisId: string;
  marketAnalysisId: string;
  workspaceId: string;
};

export type ICPScoringInput = {
  name: string;
  description: string;
  industry: string;
  companySize: string;
  revenueRange: string;
};

export type ICPScoringResult = {
  confidence: number;
  opportunityScore: number;
  competitionScore: number;
  revenueScore: number;
  conversionRate: number;
};

export type BuyerPersonaResult = {
  department: string;
  jobTitle: string;
  seniority: string;
  responsibilities: string;
  authorityScore: number;
  priority: Priority;
};

export type PainPointResult = {
  painPoint: string;
  severity: Severity;
  urgency: Urgency;
  businessImpact: string;
  recommendedSolution: string;
};

export type GoalResult = {
  goal: string;
  priority: Priority;
  category: GoalCategory;
};

export type BuyingTriggerResult = {
  trigger: string;
  description: string;
  confidence: number;
  priority: Priority;
};

export type SalesNavigatorResult = {
  industry: string[];
  companySize: string[];
  location: string[];
  keywords: string[];
  titles: string[];
  departments: string[];
  technology: string[];
  booleanQuery: string;
};

export type IndustryResearchResult = {
  name: string;
  growthRate: string;
  marketSize: string;
  keyTrends: string[];
};

export type BuyerRoleResearchResult = {
  department: string;
  commonTitles: string[];
  seniority: string;
  responsibilities: string[];
};

export type BuyingTriggerResearchResult = {
  trigger: string;
  description: string;
  industries: string[];
};

export type TechnologyUsageResult = {
  technology: string;
  industry: string;
  adoptionRate: string;
  companySize: string;
};

export type CompanyInfoResult = {
  industry: string;
  companySize: string;
  revenueRange: string;
  technologyStack: string[];
  businessModel: string;
};

export type IndustrySignalResult = {
  signal: string;
  industry: string;
  confidence: number;
  description: string;
};

// ============================================================
// Business Summary (from BI Agent, read-only display)
// ============================================================

export type BusinessSummary = {
  business_type: string | null;
  industry: string | null;
  products: string[];
  services: string[];
  revenue_model: string | null;
  usp: string | null;
  business_goals: string[];
  target_regions: string[];
};
