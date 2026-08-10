// ============================================================
// Business Intelligence Agent — Types
// ============================================================

export type AnalysisStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type PageType =
  | 'homepage'
  | 'services'
  | 'pricing'
  | 'blog'
  | 'resources'
  | 'contact'
  | 'faq'
  | 'testimonials'
  | 'case_studies'
  | 'other';

export type BusinessAnalysis = {
  id: string;
  workspace_id: string;
  website: string;
  company_name: string | null;
  industry: string | null;
  country: string | null;
  language: string | null;
  timezone: string | null;
  description: string | null;
  business_model: string | null;
  products: string[];
  services: string[];
  pricing_model: string | null;
  target_audience: string | null;
  usp: string | null;
  customer_problems: string[];
  business_goals: string[];
  revenue_model: string | null;
  competitive_position: string | null;
  confidence_score: number;
  business_category: string | null;
  primary_icp: string | null;
  completion_percentage: number;
  analysis_status: AnalysisStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type WebsitePage = {
  id: string;
  analysis_id: string;
  page_title: string | null;
  url: string;
  page_type: PageType;
  content: string | null;
  summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type BusinessInsights = {
  id: string;
  analysis_id: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
  executive_summary: string | null;
  raw_json: Record<string, unknown>;
  created_at: string;
};

export type FullAnalysis = BusinessAnalysis & {
  pages: WebsitePage[];
  insights: BusinessInsights | null;
};

export type AnalysisStage =
  | 'connecting'
  | 'crawling'
  | 'reading'
  | 'extracting_services'
  | 'understanding'
  | 'generating_summary'
  | 'saving';

export type AnalysisStageInfo = {
  stage: AnalysisStage;
  label: string;
  description: string;
};

export type TimelineEvent = {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
};

// ============================================================
// Service Interface Types
// ============================================================

export type CrawlResult = {
  url: string;
  title: string;
  content: string;
  markdown: string;
  metadata: Record<string, unknown>;
};

export type ExtractedPage = {
  url: string;
  title: string;
  pageType: PageType;
  content: string;
  markdown: string;
  metadata: Record<string, unknown>;
};

export type BusinessSummary = {
  businessModel: string;
  products: string[];
  services: string[];
  pricingModel: string;
  targetAudience: string;
  usp: string;
  customerProblems: string[];
  businessGoals: string[];
  revenueModel: string;
  competitivePosition: string;
  executiveSummary: string;
};

export type InsightResult = {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  risks: string[];
};

export type CompanyResearch = {
  name: string;
  industry: string;
  description: string;
  competitors: string[];
  marketPosition: string;
};

export type CompetitorResearch = {
  name: string;
  website: string;
  strengths: string[];
  weaknesses: string[];
  marketShare: string | null;
};

export type IndustryResearch = {
  industry: string;
  marketSize: string | null;
  growthRate: string | null;
  trends: string[];
  keyPlayers: string[];
};
