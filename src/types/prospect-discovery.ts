// ============================================================
// Prospect Discovery Agent — Types
// ============================================================

export type DiscoveryStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type CompanyStatus = 'discovered' | 'qualified' | 'saved' | 'ignored' | 'researching';
export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type ExclusionReason =
  | 'outside_icp'
  | 'wrong_country'
  | 'wrong_revenue'
  | 'wrong_industry'
  | 'too_small'
  | 'too_large'
  | 'duplicate'
  | 'competitor';

// ============================================================
// Main Records
// ============================================================

export type ProspectDiscovery = {
  id: string;
  workspace_id: string;
  icp_id: string | null;
  status: DiscoveryStatus;
  total_found: number;
  qualified_count: number;
  high_priority_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type DiscoveredCompany = {
  id: string;
  discovery_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  country: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  company_size: string | null;
  growth_stage: string | null;
  technology_stack: string[];
  description: string | null;
  opportunity_score: number;
  growth_score: number;
  icp_match_score: number;
  priority: Priority;
  status: CompanyStatus;
  created_at: string;
};

export type CompanyScore = {
  id: string;
  company_id: string;
  revenue_score: number;
  growth_score: number;
  competition_score: number;
  technology_score: number;
  market_score: number;
  overall_score: number;
  created_at: string;
};

export type ProspectRecommendation = {
  id: string;
  company_id: string;
  recommendation: string;
  priority: Priority;
  reason: string | null;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type CompanyWithScores = DiscoveredCompany & {
  scores: CompanyScore | null;
  recommendation: ProspectRecommendation | null;
};

export type FullDiscoveryResult = ProspectDiscovery & {
  companies: CompanyWithScores[];
};

export type DiscoveryRecommendations = {
  executive_summary: string;
  recommended_companies: string[];
  priority_order: string[];
  best_opportunities: string[];
  suggested_next_action: string;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type DiscoveryStage =
  | 'loading_icp'
  | 'searching_companies'
  | 'filtering_results'
  | 'calculating_scores'
  | 'ranking_companies'
  | 'generating_recommendations'
  | 'saving_results';

export type DiscoveryStageInfo = {
  stage: DiscoveryStage;
  label: string;
  description: string;
};

export type DiscoveryTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Service Interface Types (for future API integrations)
// ============================================================

export type SearchParams = {
  industry: string;
  companySize: string;
  countries: string[];
  technologies: string[];
  revenueRange: string;
};

export type CompanySearchResult = {
  company_name: string;
  website: string;
  industry: string;
  country: string;
  employee_count: string;
  annual_revenue: string;
  growth_stage: string;
};

export type CompanyEnrichmentResult = {
  company_name: string;
  description: string;
  products: string[];
  services: string[];
  business_model: string;
  markets: string[];
  industries: string[];
  technology_stack: string[];
};

export type TechnologyStackResult = {
  frontend: string[];
  backend: string[];
  crm: string[];
  marketing_stack: string[];
  sales_tools: string[];
  cloud_platform: string[];
  ai_tools: string[];
};

export type CompanyFundingResult = {
  company_name: string;
  total_funding: string;
  funding_rounds: string[];
  last_funding_date: string;
  investors: string[];
};

export type ExclusionRecord = {
  company_name: string;
  reason: ExclusionReason;
  details: string;
};

export type ScoringResult = {
  revenue_score: number;
  growth_score: number;
  competition_score: number;
  technology_score: number;
  market_score: number;
  overall_score: number;
};

export type ICPMatchResult = {
  match_score: number;
  matched_criteria: string[];
  unmatched_criteria: string[];
};

export type RecommendationResult = {
  recommendation: string;
  priority: Priority;
  reason: string;
};
