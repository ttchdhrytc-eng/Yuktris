// ============================================================
// Mock Data — Sales Navigator Intelligence Agent
// ============================================================
//
// Realistic Sales Navigator search strategies for Yuktris.
// 3 search templates: Enterprise SaaS, IT Services, Digital Marketing Agencies.
// Simulates what OpenAI + Tavily + LinkedIn SN would produce.

import type {
  SNSearch,
  CompanyFilters,
  LeadFilters,
  SearchTemplate,
  SNStageInfo,
  SearchQuality,
  SNRecommendations,
} from '@/types/sales-navigator';

// ============================================================
// Pipeline Stages
// ============================================================

export const SN_STAGES: SNStageInfo[] = [
  { stage: 'loading_icp', label: 'Loading ICP', description: 'Loading Ideal Customer Profile from ICP Intelligence Agent' },
  { stage: 'building_filters', label: 'Building Filters', description: 'Generating company and lead search filters' },
  { stage: 'generating_boolean', label: 'Generating Boolean Queries', description: 'Creating optimized boolean search queries' },
  { stage: 'optimizing_search', label: 'Optimizing Search', description: 'Optimizing filter combinations for maximum coverage' },
  { stage: 'validating_strategy', label: 'Validating Strategy', description: 'Validating search strategy and estimating results' },
  { stage: 'saving_configuration', label: 'Saving Configuration', description: 'Persisting search configuration to the database' },
];

// ============================================================
// Search 1 — Enterprise SaaS (Primary)
// ============================================================

export const MOCK_SEARCH_1: Omit<SNSearch, 'id' | 'workspace_id' | 'icp_id' | 'discovery_id' | 'created_at' | 'updated_at'> = {
  name: 'Enterprise SaaS Search Strategy',
  description: 'Optimized Sales Navigator search for Enterprise SaaS companies with 50–500 employees using Salesforce or HubSpot, targeting VP Sales and RevOps leaders.',
  status: 'completed',
  search_type: 'both',
  quality_score: 94,
  coverage_score: 88,
  error_message: null,
};

export const MOCK_COMPANY_FILTERS_1: Omit<CompanyFilters, 'id' | 'search_id' | 'created_at'> = {
  industry: ['Computer Software', 'Internet', 'Information Technology & Services', 'SaaS'],
  company_size: ['51-200', '201-500', '501-1000'],
  revenue: ['$5M-$10M', '$10M-$50M', '$50M-$100M'],
  country: ['United States', 'Canada', 'United Kingdom'],
  technology: ['Salesforce', 'HubSpot', 'Outreach', 'SalesLoft'],
  company_type: ['Public Company', 'Privately Held', 'Subsidiary'],
  growth_stage: ['Series A', 'Series B', 'Series C'],
  keywords: ['sales engagement', 'outbound sales', 'SDR', 'revenue operations', 'sales tech', 'RevOps'],
  negative_keywords: ['recruiting', 'staffing', 'student', 'intern'],
  boolean_query: '(industry:"Computer Software" OR industry:"Internet" OR industry:"SaaS") AND (company_size:"51-200" OR company_size:"201-500" OR company_size:"501-1000") AND (technology:"Salesforce" OR technology:"HubSpot") NOT (keyword:"recruiting" OR keyword:"staffing" OR title:"Student" OR title:"Intern")',
};

export const MOCK_LEAD_FILTERS_1: Omit<LeadFilters, 'id' | 'search_id' | 'created_at'> = {
  job_titles: ['VP of Sales', 'Chief Revenue Officer', 'Head of RevOps', 'Director of Sales Development', 'VP Sales'],
  departments: ['Sales', 'Revenue Operations'],
  seniority: ['VP', 'CXO', 'Director', 'Manager'],
  years_in_role: '1+',
  years_at_company: '1+',
  relationship: ['2nd degree', '3rd degree+'],
  location: ['United States', 'Canada', 'United Kingdom'],
  open_profile: true,
};

// ============================================================
// Search 2 — IT Services (Secondary)
// ============================================================

export const MOCK_SEARCH_2: Omit<SNSearch, 'id' | 'workspace_id' | 'icp_id' | 'discovery_id' | 'created_at' | 'updated_at'> = {
  name: 'IT Services Search Strategy',
  description: 'Sales Navigator search for IT Services & Software companies with 100–1000 employees, targeting CIOs and VP Sales for enterprise IT consulting.',
  status: 'completed',
  search_type: 'both',
  quality_score: 86,
  coverage_score: 82,
  error_message: null,
};

export const MOCK_COMPANY_FILTERS_2: Omit<CompanyFilters, 'id' | 'search_id' | 'created_at'> = {
  industry: ['Information Technology & Services', 'Computer Software', 'IT Consulting'],
  company_size: ['101-250', '251-500', '501-1000'],
  revenue: ['$10M-$50M', '$50M-$100M', '$100M+'],
  country: ['United States', 'Canada'],
  technology: ['AWS', 'Azure', 'Jira', 'ServiceNow'],
  company_type: ['Privately Held', 'Public Company'],
  growth_stage: ['Series B', 'Series C', 'Bootstrapped'],
  keywords: ['IT services', 'managed services', 'IT consulting', 'digital transformation', 'cloud migration'],
  negative_keywords: ['recruiting', 'freelance', 'student'],
  boolean_query: '(industry:"Information Technology & Services" OR industry:"Computer Software") AND (company_size:"101-250" OR company_size:"251-500" OR company_size:"501-1000") AND (technology:"AWS" OR technology:"Azure") NOT (keyword:"recruiting" OR title:"Student")',
};

export const MOCK_LEAD_FILTERS_2: Omit<LeadFilters, 'id' | 'search_id' | 'created_at'> = {
  job_titles: ['VP of Sales', 'Chief Information Officer', 'Director of Business Development', 'CIO', 'VP Sales'],
  departments: ['Sales', 'Information Technology', 'Business Development'],
  seniority: ['VP', 'CXO', 'Director'],
  years_in_role: '1+',
  years_at_company: '2+',
  relationship: ['2nd degree', '3rd degree+'],
  location: ['United States', 'Canada'],
  open_profile: false,
};

// ============================================================
// Search 3 — Digital Marketing Agencies (Tertiary)
// ============================================================

export const MOCK_SEARCH_3: Omit<SNSearch, 'id' | 'workspace_id' | 'icp_id' | 'discovery_id' | 'created_at' | 'updated_at'> = {
  name: 'Digital Marketing Agencies Search Strategy',
  description: 'Sales Navigator search for Digital Marketing Agencies with 20–200 employees, targeting Founders and Heads of Growth for outbound marketing services.',
  status: 'completed',
  search_type: 'both',
  quality_score: 80,
  coverage_score: 76,
  error_message: null,
};

export const MOCK_COMPANY_FILTERS_3: Omit<CompanyFilters, 'id' | 'search_id' | 'created_at'> = {
  industry: ['Marketing & Advertising', 'Public Relations', 'Design'],
  company_size: ['11-50', '51-200'],
  revenue: ['$1M-$5M', '$5M-$20M'],
  country: ['United States', 'United Kingdom', 'Canada', 'Australia'],
  technology: ['HubSpot', 'Google Ads', 'Semrush'],
  company_type: ['Privately Held', 'Partnership'],
  growth_stage: ['Bootstrapped', 'Seed'],
  keywords: ['digital marketing agency', 'growth agency', 'performance marketing', 'outbound marketing'],
  negative_keywords: ['freelance', 'student', 'intern'],
  boolean_query: '(industry:"Marketing & Advertising") AND (company_size:"11-50" OR company_size:"51-200") AND technology:"HubSpot" NOT (title:"Intern" OR title:"Student")',
};

export const MOCK_LEAD_FILTERS_3: Omit<LeadFilters, 'id' | 'search_id' | 'created_at'> = {
  job_titles: ['Founder', 'CEO', 'COO', 'Head of Growth', 'Managing Director'],
  departments: ['Leadership', 'Operations', 'Marketing'],
  seniority: ['CXO', 'VP', 'Director', 'Owner'],
  years_in_role: '1+',
  years_at_company: '1+',
  relationship: ['1st degree', '2nd degree', '3rd degree+'],
  location: ['United States', 'United Kingdom', 'Canada', 'Australia'],
  open_profile: true,
};

// ============================================================
// Search Quality Data
// ============================================================

export const MOCK_QUALITY_1: SearchQuality = {
  coverage_score: 88,
  estimated_result_count: '2,400–3,200 companies, 8,500–12,000 leads',
  filter_completeness: 92,
  search_complexity: 'medium',
  recommendations: [
    'Add "Gong" to technology filters to capture companies using conversation intelligence',
    'Consider adding "Series D" to growth stage for broader coverage',
    'Enable "Open Profile" filter to increase reachable leads by 35%',
    'Add "Head of Sales" to job titles for additional decision-maker coverage',
  ],
};

export const MOCK_QUALITY_2: SearchQuality = {
  coverage_score: 82,
  estimated_result_count: '1,800–2,500 companies, 5,200–7,800 leads',
  filter_completeness: 85,
  search_complexity: 'high',
  recommendations: [
    'Add "Germany" to countries to expand DACH market coverage',
    'Consider removing "years_at_company" filter to increase lead pool',
    'Add "Head of IT" to job titles for broader stakeholder coverage',
  ],
};

export const MOCK_QUALITY_3: SearchQuality = {
  coverage_score: 76,
  estimated_result_count: '1,200–1,800 companies, 3,500–5,200 leads',
  filter_completeness: 78,
  search_complexity: 'low',
  recommendations: [
    'Add "Netherlands" to countries for broader European coverage',
    'Include "Creative Director" in job titles for additional reach',
    'Consider adding "Meta Ads" to technology filters',
  ],
};

// ============================================================
// AI Recommendations
// ============================================================

export const MOCK_RECOMMENDATIONS: SNRecommendations = {
  suggested_improvements: [
    'Add "Gong" and "ZoomInfo" to technology filters — 68% of qualified companies use at least one',
    'Enable "Open Profile" filter to increase reachable leads by 35%',
    'Add "Head of Sales" and "Sales Operations Manager" to job titles for wider coverage',
    'Consider expanding to DACH region (Germany, Austria, Switzerland) for additional 1,200+ companies',
  ],
  additional_filters: [
    'Company Type: Add "Subsidiary" to capture acquired startups',
    'Growth Stage: Add "Series D" for late-stage companies with larger budgets',
    'Technology: Add "Gong" for conversation intelligence users',
    'Years in Role: Set to "1+" to target newly promoted decision-makers',
  ],
  alternative_searches: [
    'Create a separate search for "RevOps Leaders" using only RevOps titles and departments',
    'Build a "Newly Funded" search targeting companies that raised in the last 90 days',
    'Create a "Sales Tech Stack" search filtering for companies using 3+ sales tools',
  ],
  recommended_titles: [
    'VP of Sales', 'Chief Revenue Officer', 'Head of RevOps', 'Director of Sales Development',
    'VP Sales', 'Head of Sales', 'Sales Operations Manager', 'Director of Revenue Operations',
  ],
  recommended_keywords: [
    'sales engagement', 'outbound sales', 'SDR', 'revenue operations', 'sales tech',
    'RevOps', 'sales enablement', 'pipeline generation', 'sales forecasting', 'deal management',
  ],
  expected_performance: 'Estimated 2,400–3,200 company results and 8,500–12,000 lead results. Expected 15–20% connection rate with Open Profile enabled. Projected 180–240 meetings booked per quarter based on ICP conversion rates.',
};

// ============================================================
// Saved Templates
// ============================================================

export const MOCK_TEMPLATES: Omit<SearchTemplate, 'id' | 'workspace_id' | 'created_at'>[] = [
  {
    template_name: 'Enterprise SaaS Template',
    description: 'Optimized search template for Enterprise SaaS companies with 50–500 employees',
    template_json: {
      search_type: 'both',
      company_filters: MOCK_COMPANY_FILTERS_1,
      lead_filters: MOCK_LEAD_FILTERS_1,
    },
    is_default: true,
  },
  {
    template_name: 'IT Services Template',
    description: 'Search template for IT Services companies with 100–1000 employees',
    template_json: {
      search_type: 'both',
      company_filters: MOCK_COMPANY_FILTERS_2,
      lead_filters: MOCK_LEAD_FILTERS_2,
    },
    is_default: false,
  },
  {
    template_name: 'Digital Marketing Agencies Template',
    description: 'Search template for Digital Marketing Agencies with 20–200 employees',
    template_json: {
      search_type: 'both',
      company_filters: MOCK_COMPANY_FILTERS_3,
      lead_filters: MOCK_LEAD_FILTERS_3,
    },
    is_default: false,
  },
];

// ============================================================
// Aggregated Arrays
// ============================================================

export const MOCK_SEARCHES = [MOCK_SEARCH_1, MOCK_SEARCH_2, MOCK_SEARCH_3];
export const MOCK_COMPANY_FILTERS = [MOCK_COMPANY_FILTERS_1, MOCK_COMPANY_FILTERS_2, MOCK_COMPANY_FILTERS_3];
export const MOCK_LEAD_FILTERS = [MOCK_LEAD_FILTERS_1, MOCK_LEAD_FILTERS_2, MOCK_LEAD_FILTERS_3];
export const MOCK_QUALITY = [MOCK_QUALITY_1, MOCK_QUALITY_2, MOCK_QUALITY_3];
