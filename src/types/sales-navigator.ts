// ============================================================
// Sales Navigator Intelligence Agent — Types
// ============================================================

export type SNSearchStatus = 'queued' | 'processing' | 'completed' | 'failed';
export type SNSearchType = 'company' | 'lead' | 'both';

// ============================================================
// Main Records
// ============================================================

export type SNSearch = {
  id: string;
  workspace_id: string;
  icp_id: string | null;
  discovery_id: string | null;
  name: string;
  description: string | null;
  status: SNSearchStatus;
  search_type: SNSearchType;
  quality_score: number;
  coverage_score: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyFilters = {
  id: string;
  search_id: string;
  industry: string[];
  company_size: string[];
  revenue: string[];
  country: string[];
  technology: string[];
  company_type: string[];
  growth_stage: string[];
  keywords: string[];
  negative_keywords: string[];
  boolean_query: string | null;
  created_at: string;
};

export type LeadFilters = {
  id: string;
  search_id: string;
  job_titles: string[];
  departments: string[];
  seniority: string[];
  years_in_role: string | null;
  years_at_company: string | null;
  relationship: string[];
  location: string[];
  open_profile: boolean;
  created_at: string;
};

export type SearchTemplate = {
  id: string;
  workspace_id: string;
  template_name: string;
  description: string | null;
  template_json: Record<string, unknown>;
  is_default: boolean;
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullSNSearch = SNSearch & {
  company_filters: CompanyFilters | null;
  lead_filters: LeadFilters | null;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type SNStage =
  | 'loading_icp'
  | 'building_filters'
  | 'generating_boolean'
  | 'optimizing_search'
  | 'validating_strategy'
  | 'saving_configuration';

export type SNStageInfo = {
  stage: SNStage;
  label: string;
  description: string;
};

export type SNTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Quality & Coverage
// ============================================================

export type SearchQuality = {
  coverage_score: number;
  estimated_result_count: string;
  filter_completeness: number;
  search_complexity: 'low' | 'medium' | 'high';
  recommendations: string[];
};

// ============================================================
// AI Recommendations
// ============================================================

export type SNRecommendations = {
  suggested_improvements: string[];
  additional_filters: string[];
  alternative_searches: string[];
  recommended_titles: string[];
  recommended_keywords: string[];
  expected_performance: string;
};

// ============================================================
// Export Types
// ============================================================

export type ExportFormat = 'json' | 'csv' | 'config' | 'api_payload';

export type ExportConfig = {
  format: ExportFormat;
  data: string;
  filename: string;
};

// ============================================================
// Service Interface Types (for future API integrations)
// ============================================================

export type FilterOptimizationResult = {
  optimized_filters: CompanyFilters;
  changes: string[];
};

export type BooleanGenerationResult = {
  boolean_query: string;
  positive_keywords: string[];
  negative_keywords: string[];
};

export type TitleResearchResult = {
  title: string;
  department: string;
  seniority: string;
  frequency: string;
};

export type DepartmentResearchResult = {
  department: string;
  common_titles: string[];
  seniority_levels: string[];
};

export type TechnologyResearchResult = {
  technology: string;
  adoption_rate: string;
  industries: string[];
};

export type IndustryResearchResult = {
  industry: string;
  growth_rate: string;
  common_technologies: string[];
};

export type SavedSearchResult = {
  search_id: string;
  saved: boolean;
};

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
};
