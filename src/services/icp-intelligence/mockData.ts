// ============================================================
// Mock Data — ICP Intelligence Agent
// ============================================================
//
// Realistic ICP data for Yuktris (the product itself):
// AI-powered B2B Sales Platform.
// Simulates what OpenAI + Tavily + Firecrawl would produce.
// 3 distinct ICPs with full profiles.

import type {
  ICP,
  ICPCompanyProfile,
  ICPDecisionMaker,
  ICPPainPoint,
  ICPGoal,
  ICPBuyingTrigger,
  ICPNegativeFilter,
  SalesNavigatorFilters,
  ICPRecommendations,
  BusinessSummary,
  ICPStageInfo,
} from '@/types/icp-intelligence';

// ============================================================
// Pipeline Stages
// ============================================================

export const ICP_STAGES: ICPStageInfo[] = [
  { stage: 'reading_business', label: 'Reading Business Analysis', description: 'Loading data from the Business Intelligence Agent' },
  { stage: 'reading_market', label: 'Reading Market Analysis', description: 'Loading data from the Market Intelligence Agent' },
  { stage: 'generating_icps', label: 'Generating ICPs', description: 'Creating multiple Ideal Customer Profiles' },
  { stage: 'scoring_icps', label: 'Scoring ICPs', description: 'Scoring each ICP by opportunity, competition, and revenue' },
  { stage: 'creating_personas', label: 'Creating Buyer Personas', description: 'Building decision-maker personas and pain points' },
  { stage: 'building_filters', label: 'Building Sales Navigator Filters', description: 'Generating LinkedIn Sales Navigator search filters' },
  { stage: 'generating_recommendations', label: 'Generating Recommendations', description: 'Creating GTM strategy and messaging' },
  { stage: 'saving', label: 'Saving', description: 'Persisting all ICP data to the database' },
];

// ============================================================
// Business Summary (from BI Agent)
// ============================================================

export const MOCK_BUSINESS_SUMMARY: BusinessSummary = {
  business_type: 'SaaS Platform',
  industry: 'B2B Software / Sales Technology',
  products: ['AI Sales Agent', 'Market Intelligence Agent', 'ICP Intelligence Agent', 'Business Intelligence Agent'],
  services: ['Autonomous outreach automation', 'Market analysis', 'ICP generation', 'Sales navigator filter building'],
  revenue_model: 'SaaS Subscription (monthly/annual)',
  usp: 'The only AI-native platform that autonomously researches, personalizes, and books meetings — combining intent signals, AI personalization, and multi-channel outreach in one platform.',
  business_goals: [
    'Reach 500+ paying customers within 12 months',
    'Achieve $5M ARR in Year 1',
    'Expand into DACH and Nordics markets',
    'Build 10,000+ prospect database',
  ],
  target_regions: ['United States', 'United Kingdom', 'Canada', 'Germany', 'Australia', 'Netherlands'],
};

// ============================================================
// ICP 1 — B2B SaaS Companies (Primary)
// ============================================================

export const MOCK_ICP_1: Omit<ICP, 'id' | 'workspace_id' | 'business_analysis_id' | 'market_analysis_id' | 'created_at' | 'updated_at'> = {
  name: 'B2B SaaS Companies',
  description: 'Software-as-a-Service companies with 50–500 employees that need to scale outbound sales efficiently. Tech-savvy buyers with growing sales teams and budget for sales tooling.',
  priority: 'primary',
  confidence: 94,
  opportunity_score: 96,
  competition_score: 72,
  revenue_score: 92,
  conversion_rate: 18.5,
  estimated_deal_size: '$12,000 ARR',
  status: 'completed',
  error_message: null,
};

export const MOCK_ICP_1_PROFILE: Omit<ICPCompanyProfile, 'id' | 'icp_id' | 'created_at'> = {
  industry: 'B2B Software / SaaS',
  sub_industry: 'Sales Technology, MarTech, RevTech',
  company_size: '50–500 employees',
  revenue_range: '$5M–$50M ARR',
  employee_count: '50–500',
  funding_stage: 'Series A–Series C',
  business_model: 'Subscription SaaS',
  technology_stack: ['Salesforce', 'HubSpot', 'Outreach', 'SalesLoft', 'Apollo', 'Zoom', 'Slack', 'Gong'],
  country: 'United States',
  region: 'North America',
  city: 'San Francisco, New York, Austin, Boston',
};

export const MOCK_ICP_1_DECISION_MAKERS: Omit<ICPDecisionMaker, 'id' | 'icp_id' | 'created_at'>[] = [
  { department: 'Sales', job_title: 'VP of Sales', seniority: 'VP', responsibilities: 'Owns sales strategy, team performance, and tooling decisions', authority_score: 92, priority: 'critical' },
  { department: 'Revenue Operations', job_title: 'Head of RevOps', seniority: 'Director', responsibilities: 'Manages sales tech stack, processes, and data', authority_score: 88, priority: 'critical' },
  { department: 'Sales', job_title: 'Chief Revenue Officer', seniority: 'C-Level', responsibilities: 'Oversees all revenue functions and budget approval', authority_score: 95, priority: 'high' },
  { department: 'Marketing', job_title: 'VP of Marketing', seniority: 'VP', responsibilities: 'Aligns marketing with sales, influences tool selection', authority_score: 70, priority: 'medium' },
  { department: 'Sales', job_title: 'Director of Sales Development', seniority: 'Director', responsibilities: 'Manages SDR team and outreach strategy', authority_score: 78, priority: 'high' },
];

export const MOCK_ICP_1_PAIN_POINTS: Omit<ICPPainPoint, 'id' | 'icp_id' | 'created_at'>[] = [
  { pain_point: 'Manual prospect research takes 40% of SDR time', severity: 'high', urgency: 'high', business_impact: 'SDRs spend 3+ hours/day researching prospects instead of selling', recommended_solution: 'AI-powered research agent that auto-enriches prospects in seconds' },
  { pain_point: 'Low reply rates from generic outreach', severity: 'high', urgency: 'high', business_impact: 'Average reply rate below 2%, wasting pipeline capacity', recommended_solution: 'AI personalization at scale with intent-driven messaging' },
  { pain_point: 'No visibility into buying intent signals', severity: 'critical', urgency: 'high', business_impact: 'Sales teams outreach at the wrong time, missing high-intent windows', recommended_solution: 'Real-time intent signals from hiring, funding, and tech changes' },
  { pain_point: 'Sales tech stack fragmentation', severity: 'medium', urgency: 'medium', business_impact: 'Multiple tools with poor integration, data silos', recommended_solution: 'All-in-one platform combining data, intent, and outreach' },
  { pain_point: 'Difficulty scaling outbound without adding headcount', severity: 'high', urgency: 'medium', business_impact: 'Revenue growth tied to SDR hiring, limiting scalability', recommended_solution: 'AI agents that handle research, personalization, and booking autonomously' },
];

export const MOCK_ICP_1_GOALS: Omit<ICPGoal, 'id' | 'icp_id' | 'created_at'>[] = [
  { goal: 'Increase outbound reply rates by 3x', priority: 'critical', category: 'revenue' },
  { goal: 'Reduce SDR research time by 80%', priority: 'high', category: 'operational' },
  { goal: 'Scale outbound without adding SDR headcount', priority: 'high', category: 'revenue' },
  { goal: 'Improve CRM data quality and enrichment', priority: 'medium', category: 'technology' },
  { goal: 'Align sales and marketing on target accounts', priority: 'medium', category: 'marketing' },
  { goal: 'Implement intent-based outreach strategy', priority: 'high', category: 'operational' },
];

export const MOCK_ICP_1_TRIGGERS: Omit<ICPBuyingTrigger, 'id' | 'icp_id' | 'created_at'>[] = [
  { trigger: 'Hiring SDRs or AEs', description: 'Active job postings for sales roles indicate team expansion and need for sales tools', confidence: 94, priority: 'critical' },
  { trigger: 'Raised Series A+ funding', description: 'Fresh capital means budget for sales infrastructure and scaling outreach', confidence: 96, priority: 'critical' },
  { trigger: 'New VP Sales or CRO hired', description: 'New sales leadership evaluates tools within 60 days of starting', confidence: 90, priority: 'high' },
  { trigger: 'Switching CRM (e.g., Pipedrive to Salesforce)', description: 'CRM migration signals tech stack transformation and openness to new tools', confidence: 85, priority: 'high' },
  { trigger: 'Product launch or market expansion', description: 'Companies launching new products need to scale outreach to promote them', confidence: 80, priority: 'medium' },
  { trigger: 'Attending sales conferences (SaaStr, Reach)', description: 'Active interest in sales technology and networking', confidence: 72, priority: 'medium' },
];

export const MOCK_ICP_1_NEGATIVE_FILTERS: Omit<ICPNegativeFilter, 'id' | 'icp_id' | 'created_at'>[] = [
  { filter_type: 'company_size', value: '1–10 employees', reason: 'Too small to have a dedicated sales team or budget for sales tooling' },
  { filter_type: 'industry', value: 'Construction', reason: 'Low tech adoption, long sales cycles, not a fit for AI sales tools' },
  { filter_type: 'industry', value: 'Real Estate (residential)', reason: 'Different sales motion, not B2B outbound' },
  { filter_type: 'country', value: 'India', reason: 'Low buying power for $12K ARR product, price-sensitive market' },
  { filter_type: 'technology', value: 'No CRM in use', reason: 'Companies without a CRM are not ready for sales automation' },
  { filter_type: 'revenue_range', value: 'Under $1M ARR', reason: 'Insufficient budget for premium sales tooling' },
];

export const MOCK_ICP_1_SALES_NAV: Omit<SalesNavigatorFilters, 'id' | 'icp_id' | 'created_at'> = {
  industry: ['Computer Software', 'Internet', 'Information Technology & Services', 'Marketing & Advertising'],
  company_size: ['51-200', '201-500', '501-1000'],
  location: ['United States', 'Canada', 'United Kingdom'],
  keywords: ['sales engagement', 'outbound sales', 'SDR', 'revenue operations', 'sales tech', 'RevOps'],
  titles: ['VP Sales', 'Chief Revenue Officer', 'Head of RevOps', 'Director of Sales Development', 'VP of Sales', 'Head of Sales'],
  departments: ['Sales', 'Revenue Operations'],
  technology: ['Salesforce', 'HubSpot', 'Outreach', 'SalesLoft'],
  boolean_query: '(title:"VP Sales" OR title:"Chief Revenue Officer" OR title:"Head of RevOps" OR title:"Director of Sales Development") AND (company_size:"51-200" OR company_size:"201-500" OR company_size:"501-1000") AND industry:"Computer Software" NOT title:"Student" NOT company:"recruiting"',
};

// ============================================================
// ICP 2 — Digital Marketing Agencies (Secondary)
// ============================================================

export const MOCK_ICP_2: Omit<ICP, 'id' | 'workspace_id' | 'business_analysis_id' | 'market_analysis_id' | 'created_at' | 'updated_at'> = {
  name: 'Digital Marketing Agencies',
  description: 'Marketing and advertising agencies with 20–200 employees managing outbound campaigns for multiple clients. Need scalable outreach tools and client reporting.',
  priority: 'secondary',
  confidence: 86,
  opportunity_score: 82,
  competition_score: 65,
  revenue_score: 78,
  conversion_rate: 14.2,
  estimated_deal_size: '$8,400 ARR',
  status: 'completed',
  error_message: null,
};

export const MOCK_ICP_2_PROFILE: Omit<ICPCompanyProfile, 'id' | 'icp_id' | 'created_at'> = {
  industry: 'Marketing & Advertising',
  sub_industry: 'Digital Marketing, Growth Agencies, Performance Marketing',
  company_size: '20–200 employees',
  revenue_range: '$2M–$20M',
  employee_count: '20–200',
  funding_stage: 'Bootstrapped or Seed',
  business_model: 'Agency / Services',
  technology_stack: ['HubSpot', 'Google Ads', 'Meta Ads', 'Semrush', 'Ahrefs', 'Slack', 'Notion'],
  country: 'United States',
  region: 'North America',
  city: 'New York, Los Angeles, Chicago, Austin',
};

export const MOCK_ICP_2_DECISION_MAKERS: Omit<ICPDecisionMaker, 'id' | 'icp_id' | 'created_at'>[] = [
  { department: 'Leadership', job_title: 'Founder / CEO', seniority: 'C-Level', responsibilities: 'Owns business strategy and tool decisions for the agency', authority_score: 95, priority: 'critical' },
  { department: 'Operations', job_title: 'COO / Head of Operations', seniority: 'Director', responsibilities: 'Manages agency operations and client delivery', authority_score: 82, priority: 'high' },
  { department: 'Marketing', job_title: 'Head of Growth', seniority: 'Director', responsibilities: 'Leads client growth strategy and outreach campaigns', authority_score: 80, priority: 'high' },
  { department: 'Sales', job_title: 'Business Development Manager', seniority: 'Manager', responsibilities: 'Drives new client acquisition for the agency', authority_score: 68, priority: 'medium' },
];

export const MOCK_ICP_2_PAIN_POINTS: Omit<ICPPainPoint, 'id' | 'icp_id' | 'created_at'>[] = [
  { pain_point: 'Managing outreach across multiple clients is time-consuming', severity: 'high', urgency: 'high', business_impact: 'Account managers spend 50% of time on manual outreach setup', recommended_solution: 'Multi-client campaign management with AI personalization' },
  { pain_point: 'Difficulty proving ROI to clients', severity: 'high', urgency: 'medium', business_impact: 'Client churn due to lack of transparent reporting', recommended_solution: 'Real-time campaign analytics and client-facing dashboards' },
  { pain_point: 'Inconsistent lead quality across clients', severity: 'medium', urgency: 'medium', business_impact: 'Variable client results, hard to scale', recommended_solution: 'AI-driven lead scoring and ICP-based targeting' },
  { pain_point: 'High tool costs across the tech stack', severity: 'medium', urgency: 'low', business_impact: 'Margins squeezed by multiple SaaS subscriptions', recommended_solution: 'All-in-one platform replacing 3–5 separate tools' },
];

export const MOCK_ICP_2_GOALS: Omit<ICPGoal, 'id' | 'icp_id' | 'created_at'>[] = [
  { goal: 'Scale to 20+ active client campaigns', priority: 'high', category: 'revenue' },
  { goal: 'Improve client retention to 90%+', priority: 'high', category: 'operational' },
  { goal: 'Reduce campaign setup time by 60%', priority: 'high', category: 'operational' },
  { goal: 'Add outbound lead gen as a new service offering', priority: 'medium', category: 'revenue' },
  { goal: 'Automate client reporting and dashboards', priority: 'medium', category: 'technology' },
];

export const MOCK_ICP_2_TRIGGERS: Omit<ICPBuyingTrigger, 'id' | 'icp_id' | 'created_at'>[] = [
  { trigger: 'Hiring account managers or growth marketers', description: 'Team expansion signals need for scalable campaign tools', confidence: 86, priority: 'high' },
  { trigger: 'Won new client requiring outbound services', description: 'New client wins create immediate need for outreach infrastructure', confidence: 84, priority: 'high' },
  { trigger: 'Expanding service offerings to include outbound', description: 'Agencies adding outbound as a service need specialized tools', confidence: 82, priority: 'high' },
  { trigger: 'Churn from existing tool (e.g., leaving Outreach)', description: 'Looking for alternatives due to cost or complexity', confidence: 78, priority: 'medium' },
  { trigger: 'Rebranding or repositioning', description: 'Agency growth phase, evaluating new tools and processes', confidence: 70, priority: 'medium' },
];

export const MOCK_ICP_2_NEGATIVE_FILTERS: Omit<ICPNegativeFilter, 'id' | 'icp_id' | 'created_at'>[] = [
  { filter_type: 'company_size', value: '1–10 employees', reason: 'Solo freelancers, not agencies with multi-client needs' },
  { filter_type: 'industry', value: 'Traditional PR agencies', reason: 'Not focused on digital outbound, different workflow' },
  { filter_type: 'revenue_range', value: 'Under $500K', reason: 'Insufficient budget for agency-level tooling' },
  { filter_type: 'technology', value: 'No marketing automation', reason: 'Not ready for advanced outreach automation' },
];

export const MOCK_ICP_2_SALES_NAV: Omit<SalesNavigatorFilters, 'id' | 'icp_id' | 'created_at'> = {
  industry: ['Marketing & Advertising', 'Public Relations', 'Design'],
  company_size: ['11-50', '51-200'],
  location: ['United States', 'United Kingdom', 'Canada'],
  keywords: ['digital marketing agency', 'growth agency', 'performance marketing', 'outbound marketing'],
  titles: ['Founder', 'CEO', 'COO', 'Head of Growth', 'Managing Director'],
  departments: ['Leadership', 'Operations', 'Marketing'],
  technology: ['HubSpot', 'Google Ads', 'Semrush'],
  boolean_query: '(title:"Founder" OR title:"CEO" OR title:"COO" OR title:"Head of Growth") AND industry:"Marketing & Advertising" AND company_size:"11-50" NOT title:"Intern"',
};

// ============================================================
// ICP 3 — IT Services & Software Companies (Tertiary)
// ============================================================

export const MOCK_ICP_3: Omit<ICP, 'id' | 'workspace_id' | 'business_analysis_id' | 'market_analysis_id' | 'created_at' | 'updated_at'> = {
  name: 'IT Services & Software Companies',
  description: 'IT services firms and software companies with 100–1000 employees that provide consulting, managed services, or custom software. Need outbound to acquire new enterprise clients.',
  priority: 'tertiary',
  confidence: 80,
  opportunity_score: 74,
  competition_score: 68,
  revenue_score: 84,
  conversion_rate: 11.8,
  estimated_deal_size: '$18,000 ARR',
  status: 'completed',
  error_message: null,
};

export const MOCK_ICP_3_PROFILE: Omit<ICPCompanyProfile, 'id' | 'icp_id' | 'created_at'> = {
  industry: 'Information Technology & Services',
  sub_industry: 'IT Consulting, Managed Services, Custom Software Development',
  company_size: '100–1000 employees',
  revenue_range: '$10M–$100M',
  employee_count: '100–1000',
  funding_stage: 'Series B+ or Bootstrapped',
  business_model: 'Services + Software',
  technology_stack: ['Jira', 'Salesforce', 'ServiceNow', 'AWS', 'Azure', 'Slack', 'Microsoft Teams'],
  country: 'United States',
  region: 'North America',
  city: 'Dallas, Atlanta, Denver, Seattle',
};

export const MOCK_ICP_3_DECISION_MAKERS: Omit<ICPDecisionMaker, 'id' | 'icp_id' | 'created_at'>[] = [
  { department: 'Sales', job_title: 'VP of Sales', seniority: 'VP', responsibilities: 'Owns sales strategy and enterprise client acquisition', authority_score: 90, priority: 'critical' },
  { department: 'Leadership', job_title: 'Chief Information Officer', seniority: 'C-Level', responsibilities: 'Oversees IT strategy and vendor selection', authority_score: 88, priority: 'high' },
  { department: 'Business Development', job_title: 'Director of Business Development', seniority: 'Director', responsibilities: 'Drives new enterprise partnerships and client acquisition', authority_score: 76, priority: 'high' },
  { department: 'Sales', job_title: 'Account Executive', seniority: 'Manager', responsibilities: 'Closes enterprise deals, needs better prospecting tools', authority_score: 60, priority: 'medium' },
];

export const MOCK_ICP_3_PAIN_POINTS: Omit<ICPPainPoint, 'id' | 'icp_id' | 'created_at'>[] = [
  { pain_point: 'Long enterprise sales cycles with multiple stakeholders', severity: 'high', urgency: 'medium', business_impact: '6–12 month sales cycles, pipeline visibility is critical', recommended_solution: 'AI-powered stakeholder mapping and multi-threading outreach' },
  { pain_point: 'Difficulty identifying enterprise decision-makers', severity: 'high', urgency: 'high', business_impact: 'Wasted time on wrong contacts, low connection rates', recommended_solution: 'Decision-maker identification with authority scoring' },
  { pain_point: 'Inconsistent outbound across the sales team', severity: 'medium', urgency: 'medium', business_impact: 'Variable results, no standardized process', recommended_solution: 'Templated AI campaigns with personalization at scale' },
  { pain_point: 'Limited visibility into target account activity', severity: 'medium', urgency: 'medium', business_impact: 'Missed opportunities when target accounts show buying signals', recommended_solution: 'Account-level intent monitoring and alerts' },
];

export const MOCK_ICP_3_GOALS: Omit<ICPGoal, 'id' | 'icp_id' | 'created_at'>[] = [
  { goal: 'Increase enterprise client base by 40%', priority: 'high', category: 'revenue' },
  { goal: 'Shorten sales cycle by 30%', priority: 'high', category: 'operational' },
  { goal: 'Improve win rate on RFPs', priority: 'medium', category: 'revenue' },
  { goal: 'Standardize outbound process across AEs', priority: 'medium', category: 'operational' },
  { goal: 'Implement account-based marketing strategy', priority: 'high', category: 'marketing' },
];

export const MOCK_ICP_3_TRIGGERS: Omit<ICPBuyingTrigger, 'id' | 'icp_id' | 'created_at'>[] = [
  { trigger: 'IT modernization initiative', description: 'Companies investing in IT transformation need consulting and managed services', confidence: 88, priority: 'high' },
  { trigger: 'Cloud migration projects', description: 'Moving to AWS/Azure creates demand for IT services and consulting', confidence: 85, priority: 'high' },
  { trigger: 'New CIO or IT Director hired', description: 'New IT leadership evaluates vendors and partners within 90 days', confidence: 82, priority: 'high' },
  { trigger: 'Digital transformation budget approved', description: 'Budget allocation signals readiness to engage vendors', confidence: 80, priority: 'medium' },
  { trigger: 'Compliance requirements (SOC2, GDPR)', description: 'Compliance needs drive demand for IT consulting services', confidence: 75, priority: 'medium' },
];

export const MOCK_ICP_3_NEGATIVE_FILTERS: Omit<ICPNegativeFilter, 'id' | 'icp_id' | 'created_at'>[] = [
  { filter_type: 'company_size', value: '1–50 employees', reason: 'Too small for enterprise IT services engagement' },
  { filter_type: 'industry', value: 'Retail (brick & mortar)', reason: 'Different IT needs, not a fit for enterprise software services' },
  { filter_type: 'country', value: 'Countries with low IT spending', reason: 'Insufficient IT budget for $18K ARR product' },
  { filter_type: 'technology', value: 'No cloud infrastructure', reason: 'Not ready for cloud-based IT services' },
];

export const MOCK_ICP_3_SALES_NAV: Omit<SalesNavigatorFilters, 'id' | 'icp_id' | 'created_at'> = {
  industry: ['Information Technology & Services', 'Computer Software', 'IT Consulting'],
  company_size: ['101-250', '251-500', '501-1000'],
  location: ['United States', 'Canada'],
  keywords: ['IT services', 'managed services', 'IT consulting', 'digital transformation', 'cloud migration'],
  titles: ['VP Sales', 'CIO', 'Director of Business Development', 'Chief Information Officer', 'VP of Sales'],
  departments: ['Sales', 'Information Technology', 'Business Development'],
  technology: ['Salesforce', 'Jira', 'ServiceNow', 'AWS'],
  boolean_query: '(title:"VP Sales" OR title:"CIO" OR title:"Director of Business Development") AND (industry:"Information Technology & Services" OR industry:"Computer Software") AND (company_size:"101-250" OR company_size:"251-500" OR company_size:"501-1000") NOT title:"Student"',
};

// ============================================================
// Recommendations
// ============================================================

export const MOCK_RECOMMENDATIONS: ICPRecommendations = {
  executive_summary:
    'Three distinct Ideal Customer Profiles have been identified for Yuktris. The primary ICP — B2B SaaS Companies (50–500 employees) — represents the highest opportunity with 96/100 opportunity score and 18.5% estimated close rate. Secondary ICPs in Digital Marketing Agencies and IT Services provide diversification across different sales motions. The combined addressable market across all three ICPs exceeds $8.4B. Recommended approach: lead with the primary ICP using a product-led growth motion, expand into agencies via partnerships, and target IT services with an enterprise sales motion.',
  primary_icp: 'B2B SaaS Companies',
  secondary_icps: ['Digital Marketing Agencies', 'IT Services & Software Companies'],
  priority_order: ['B2B SaaS Companies', 'Digital Marketing Agencies', 'IT Services & Software Companies'],
  sales_strategy:
    'Lead with the primary ICP (B2B SaaS) using a product-led growth entry point. Target VP Sales and RevOps leaders with a 14-day free trial, then convert to paid at $299/mo. Expand into Digital Marketing Agencies via channel partnerships and referral programs. Pursue IT Services with a direct enterprise sales motion, targeting CIOs and VP Sales with 6-month pilots. Allocate 70% of outbound capacity to the primary ICP, 20% to agencies, and 10% to IT services in Phase 1.',
  recommended_messaging:
    'Primary ICP: "Stop researching. Start closing." — Lead with 80% research time reduction and 3.2x reply rates. Secondary: "Scale client campaigns without adding headcount." Tertiary: "Win enterprise deals with AI-powered stakeholder mapping." Objection handling: "Half the price of Outreach, 3x the AI capability." Social proof: "Trusted by 500+ revenue teams."',
  estimated_pipeline: '$2.4M qualified pipeline in Q1, scaling to $8M by Q4',
};

// ============================================================
// Aggregated Mock Data Arrays (for service convenience)
// ============================================================

export const MOCK_ICPS = [MOCK_ICP_1, MOCK_ICP_2, MOCK_ICP_3];
export const MOCK_ICP_PROFILES = [MOCK_ICP_1_PROFILE, MOCK_ICP_2_PROFILE, MOCK_ICP_3_PROFILE];
export const MOCK_ICP_DECISION_MAKERS = [MOCK_ICP_1_DECISION_MAKERS, MOCK_ICP_2_DECISION_MAKERS, MOCK_ICP_3_DECISION_MAKERS];
export const MOCK_ICP_PAIN_POINTS = [MOCK_ICP_1_PAIN_POINTS, MOCK_ICP_2_PAIN_POINTS, MOCK_ICP_3_PAIN_POINTS];
export const MOCK_ICP_GOALS = [MOCK_ICP_1_GOALS, MOCK_ICP_2_GOALS, MOCK_ICP_3_GOALS];
export const MOCK_ICP_TRIGGERS = [MOCK_ICP_1_TRIGGERS, MOCK_ICP_2_TRIGGERS, MOCK_ICP_3_TRIGGERS];
export const MOCK_ICP_NEGATIVE_FILTERS = [MOCK_ICP_1_NEGATIVE_FILTERS, MOCK_ICP_2_NEGATIVE_FILTERS, MOCK_ICP_3_NEGATIVE_FILTERS];
export const MOCK_ICP_SALES_NAV = [MOCK_ICP_1_SALES_NAV, MOCK_ICP_2_SALES_NAV, MOCK_ICP_3_SALES_NAV];
