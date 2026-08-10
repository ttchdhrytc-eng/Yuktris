// ============================================================
// Company Research Agent — Types
// ============================================================

export type ResearchStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type GrowthSignalType =
  | 'funding'
  | 'hiring'
  | 'expansion'
  | 'acquisition'
  | 'partnership'
  | 'new_office'
  | 'new_product'
  | 'leadership_change';

export type SignalPriority = 'low' | 'medium' | 'high' | 'critical';

export type TechCategory =
  | 'frontend'
  | 'backend'
  | 'hosting'
  | 'cloud'
  | 'crm'
  | 'marketing'
  | 'sales'
  | 'analytics'
  | 'ai_tools'
  | 'security'
  | 'payment'
  | 'cms';

// ============================================================
// Main Records
// ============================================================

export type CompanyResearch = {
  id: string;
  workspace_id: string;
  company_id: string | null;
  research_status: ResearchStatus;
  research_score: number;
  confidence_score: number;
  executive_summary: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyProfile = {
  id: string;
  research_id: string;
  company_name: string;
  website: string | null;
  industry: string | null;
  sub_industry: string | null;
  headquarters: string | null;
  founded: string | null;
  locations: string[];
  employee_count: string | null;
  annual_revenue: string | null;
  company_size: string | null;
  business_model: string | null;
  target_market: string | null;
  mission: string | null;
  vision: string | null;
  description: string | null;
  created_at: string;
};

export type ProductService = {
  id: string;
  research_id: string;
  name: string;
  category: string | null;
  pricing_model: string | null;
  target_audience: string | null;
  competitive_advantage: string | null;
  created_at: string;
};

export type TechnologyProfile = {
  id: string;
  research_id: string;
  category: TechCategory;
  technology_name: string;
  version: string | null;
  confidence: number;
  created_at: string;
};

export type GrowthSignal = {
  id: string;
  research_id: string;
  signal_type: GrowthSignalType;
  description: string;
  priority: SignalPriority;
  confidence: number;
  created_at: string;
};

export type DigitalPresence = {
  id: string;
  research_id: string;
  platform: string;
  url: string | null;
  followers: string | null;
  activity_score: number;
  created_at: string;
};

export type CompanyBusinessAnalysis = {
  id: string;
  research_id: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  business_risks: string[];
  market_position: string | null;
  competitive_advantages: string[];
  created_at: string;
};

// ============================================================
// Composite Types
// ============================================================

export type FullCompanyResearch = CompanyResearch & {
  profile: CompanyProfile | null;
  products_services: ProductService[];
  technology_profiles: TechnologyProfile[];
  growth_signals: GrowthSignal[];
  digital_presence: DigitalPresence[];
  business_analysis: CompanyBusinessAnalysis | null;
};

// ============================================================
// Pipeline Stages
// ============================================================

export type ResearchStage =
  | 'loading_company'
  | 'website_analysis'
  | 'technology_detection'
  | 'business_model_analysis'
  | 'products_services'
  | 'growth_analysis'
  | 'digital_presence'
  | 'swot_generation'
  | 'executive_summary'
  | 'scoring'
  | 'saving_results';

export type ResearchStageInfo = {
  stage: ResearchStage;
  label: string;
  description: string;
};

export type ResearchTimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// AI Recommendations
// ============================================================

export type ResearchRecommendations = {
  executive_summary: string;
  business_fit: 'strong' | 'moderate' | 'weak';
  opportunity_rating: 'high' | 'medium' | 'low';
  recommended_next_action: string;
  should_continue: boolean;
  reasoning: string;
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

export type CrawlResult = {
  pages: CrawledPage[];
  product_pages: CrawledPage[];
  service_pages: CrawledPage[];
  pricing_pages: CrawledPage[];
};

export type CrawledPage = {
  url: string;
  title: string;
  content: string;
};

export type TechnologyDetectionResult = {
  category: TechCategory;
  technology_name: string;
  version: string | null;
  confidence: number;
};

export type CompanyEnrichmentResult = {
  company_name: string;
  website: string | null;
  industry: string | null;
  employee_count: string | null;
  annual_revenue: string | null;
  headquarters: string | null;
};

export type FundingHistoryResult = {
  round: string;
  amount: string;
  date: string;
  investors: string[];
};

export type LeadershipResult = {
  name: string;
  title: string;
  start_date: string | null;
};

export type NewsResult = {
  title: string;
  source: string;
  date: string;
  summary: string;
};

export type CompetitorResult = {
  name: string;
  website: string | null;
  market_share: string | null;
};
