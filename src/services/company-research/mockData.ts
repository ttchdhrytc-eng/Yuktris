// ============================================================
// Mock Data — Company Research Agent
// ============================================================
//
// Realistic company research data for 20 companies.
// Simulates what Firecrawl + Tavily + OpenAI + BuiltWith + Wappalyzer
// + Clearbit + Crunchbase + Apollo would produce.

import type {
  CompanyResearch,
  CompanyProfile,
  ProductService,
  TechnologyProfile,
  GrowthSignal,
  DigitalPresence,
  CompanyBusinessAnalysis,
  ResearchStageInfo,
  ResearchRecommendations,
  TechCategory,
  GrowthSignalType,
  SignalPriority,
} from '@/types/company-research';

// ============================================================
// Pipeline Stages
// ============================================================

export const RESEARCH_STAGES: ResearchStageInfo[] = [
  { stage: 'loading_company', label: 'Loading Company', description: 'Loading company from Prospect Discovery Agent' },
  { stage: 'website_analysis', label: 'Analyzing Website', description: 'Crawling and extracting website content' },
  { stage: 'technology_detection', label: 'Detecting Technologies', description: 'Identifying technology stack via BuiltWith/Wappalyzer' },
  { stage: 'business_model_analysis', label: 'Analyzing Business Model', description: 'Extracting business model and target market' },
  { stage: 'products_services', label: 'Extracting Products & Services', description: 'Identifying products, services, and pricing' },
  { stage: 'growth_analysis', label: 'Analyzing Growth Signals', description: 'Detecting funding, hiring, and expansion signals' },
  { stage: 'digital_presence', label: 'Analyzing Digital Presence', description: 'Mapping social and digital footprint' },
  { stage: 'swot_generation', label: 'Generating SWOT', description: 'Creating SWOT analysis and market positioning' },
  { stage: 'executive_summary', label: 'Generating Executive Summary', description: 'Synthesizing research into executive summary' },
  { stage: 'scoring', label: 'Calculating Scores', description: 'Computing research and confidence scores' },
  { stage: 'saving_results', label: 'Saving Results', description: 'Persisting research to the database' },
];

// ============================================================
// Helper: Generate tech profiles
// ============================================================

function tech(
  category: TechCategory,
  technology_name: string,
  version: string | null,
  confidence: number,
): Omit<TechnologyProfile, 'id' | 'research_id' | 'created_at'> {
  return { category, technology_name, version, confidence };
}

// ============================================================
// Helper: Generate growth signals
// ============================================================

function signal(
  signal_type: GrowthSignalType,
  description: string,
  priority: SignalPriority,
  confidence: number,
): Omit<GrowthSignal, 'id' | 'research_id' | 'created_at'> {
  return { signal_type, description, priority, confidence };
}

// ============================================================
// Helper: Generate digital presence
// ============================================================

function presence(
  platform: string,
  url: string,
  followers: string,
  activity_score: number,
): Omit<DigitalPresence, 'id' | 'research_id' | 'created_at'> {
  return { platform, url, followers, activity_score };
}

// ============================================================
// Company Research Data — 20 Companies
// ============================================================

export interface MockCompanyResearch {
  research: Omit<CompanyResearch, 'id' | 'workspace_id' | 'company_id' | 'created_at' | 'updated_at'>;
  profile: Omit<CompanyProfile, 'id' | 'research_id' | 'created_at'>;
  products_services: Omit<ProductService, 'id' | 'research_id' | 'created_at'>[];
  technology_profiles: Omit<TechnologyProfile, 'id' | 'research_id' | 'created_at'>[];
  growth_signals: Omit<GrowthSignal, 'id' | 'research_id' | 'created_at'>[];
  digital_presence: Omit<DigitalPresence, 'id' | 'research_id' | 'created_at'>[];
  business_analysis: Omit<CompanyBusinessAnalysis, 'id' | 'research_id' | 'created_at'>;
  recommendations: ResearchRecommendations;
}

// --- Company 1: CloudFlow Inc ---
const company1: MockCompanyResearch = {
  research: {
    research_status: 'completed',
    research_score: 92,
    confidence_score: 88,
    executive_summary: 'CloudFlow is a fast-growing SaaS company providing sales engagement automation for mid-market B2B teams. With 180 employees, $25M ARR, and Series B funding, they are an ideal ICP fit. Their technology stack (Salesforce, Outreach, Gong) and active hiring signal strong growth trajectory.',
    error_message: null,
  },
  profile: {
    company_name: 'CloudFlow Inc',
    website: 'cloudflow.io',
    industry: 'Computer Software',
    sub_industry: 'Sales Engagement Platform',
    headquarters: 'San Francisco, CA',
    founded: '2018',
    locations: ['San Francisco, CA', 'Austin, TX', 'London, UK'],
    employee_count: '180',
    annual_revenue: '$25M',
    company_size: '51-200',
    business_model: 'B2B SaaS Subscription',
    target_market: 'Mid-market B2B sales teams (50-500 reps)',
    mission: 'Empower every sales team to engage buyers at the right moment with the right message.',
    vision: 'A world where every sales conversation is intelligent, personalized, and timely.',
    description: 'CloudFlow provides an AI-powered sales engagement platform that automates multi-channel outreach, tracks buyer intent, and optimizes sales sequences for B2B revenue teams.',
  },
  products_services: [
    { name: 'CloudFlow Engage', category: 'Platform', pricing_model: 'Per-seat SaaS ($85/user/mo)', target_audience: 'SDR and AE teams', competitive_advantage: 'AI-powered sequence optimization' },
    { name: 'CloudFlow Intelligence', category: 'Add-on', pricing_model: 'Usage-based ($0.10/enrichment)', target_audience: 'RevOps teams', competitive_advantage: 'Real-time buyer intent scoring' },
    { name: 'CloudFlow Analytics', category: 'Add-on', pricing_model: 'Flat $500/mo', target_audience: 'Sales managers', competitive_advantage: 'Predictive deal health scoring' },
  ],
  technology_profiles: [
    tech('frontend', 'React', '18', 95),
    tech('frontend', 'TypeScript', null, 90),
    tech('backend', 'Node.js', '20', 88),
    tech('backend', 'PostgreSQL', '15', 85),
    tech('hosting', 'Vercel', null, 92),
    tech('cloud', 'AWS', null, 80),
    tech('crm', 'Salesforce', null, 95),
    tech('sales', 'Outreach', null, 90),
    tech('sales', 'Gong', null, 85),
    tech('marketing', 'HubSpot', null, 78),
    tech('analytics', 'Amplitude', null, 82),
    tech('security', 'Okta', null, 88),
    tech('payment', 'Paddle', null, 95),
  ],
  growth_signals: [
    signal('funding', 'Raised $30M Series B led by Insight Partners (Jan 2025)', 'critical', 95),
    signal('hiring', '42 open roles across engineering, sales, and marketing', 'high', 90),
    signal('expansion', 'Opened London office to serve EMEA market', 'high', 85),
    signal('new_product', 'Launched CloudFlow Intelligence AI module in Q4 2024', 'medium', 80),
    signal('leadership_change', 'Appointed new VP of Engineering from Snowflake', 'medium', 75),
  ],
  digital_presence: [
    presence('Website', 'cloudflow.io', '—', 95),
    presence('Blog', 'cloudflow.io/blog', '—', 80),
    presence('LinkedIn', 'linkedin.com/company/cloudflow', '24,500 followers', 90),
    presence('X (Twitter)', 'x.com/cloudflow', '8,200 followers', 70),
    presence('YouTube', 'youtube.com/@cloudflow', '3,100 subscribers', 65),
    presence('GitHub', 'github.com/cloudflow', '1,200 stars', 72),
  ],
  business_analysis: {
    strengths: ['Strong product-market fit in sales engagement', 'AI-first approach differentiates from legacy tools', 'High customer retention (94% NRR)', 'Experienced leadership team from Snowflake, Salesforce'],
    weaknesses: ['Limited brand awareness compared to Outreach.io', 'Pricing may be high for small teams', 'No free tier available', 'EMEA presence still nascent'],
    opportunities: ['EMEA expansion with London office', 'AI-powered intent scoring is a growing market', 'Partnership potential with CRM vendors', 'Upsell Intelligence module to existing base'],
    threats: ['Outreach and SalesLoft dominate the market', 'Economic downturn may slow SaaS spending', 'CRM vendors building native engagement features'],
    business_risks: ['Customer concentration in tech sector', 'Reliance on Salesforce ecosystem', 'High burn rate post-Series B'],
    market_position: 'Challenger in the sales engagement market, positioned between legacy tools and AI-native platforms.',
    competitive_advantages: ['AI-powered sequence optimization', 'Real-time buyer intent scoring', 'Predictive deal health analytics', 'Multi-channel orchestration'],
  },
  recommendations: {
    executive_summary: 'CloudFlow is an exceptional ICP fit with strong growth signals, ideal technology stack, and active expansion. Recommend immediate move to Decision Maker Research.',
    business_fit: 'strong',
    opportunity_rating: 'high',
    recommended_next_action: 'Proceed to Decision Maker Research — target VP of Sales, Head of RevOps, and CRO',
    should_continue: true,
    reasoning: 'Company matches all ICP criteria: B2B SaaS, 51-200 employees, $25M revenue, uses Salesforce + Outreach, Series B funded, actively hiring. High research and confidence scores indicate reliable data.',
  },
};

// --- Company 2: DataSync Solutions ---
const company2: MockCompanyResearch = {
  research: {
    research_status: 'completed',
    research_score: 85,
    confidence_score: 82,
    executive_summary: 'DataSync provides data integration and ETL tooling for enterprise data teams. With 320 employees and $40M ARR, they fit the ICP well. Their technology stack and recent Series C funding indicate strong growth.',
    error_message: null,
  },
  profile: {
    company_name: 'DataSync Solutions',
    website: 'datasync.com',
    industry: 'Information Technology & Services',
    sub_industry: 'Data Integration Platform',
    headquarters: 'Austin, TX',
    founded: '2016',
    locations: ['Austin, TX', 'New York, NY', 'Toronto, CA'],
    employee_count: '320',
    annual_revenue: '$40M',
    company_size: '201-500',
    business_model: 'B2B SaaS Subscription',
    target_market: 'Enterprise data engineering teams',
    mission: 'Make data integration seamless, reliable, and accessible for every organization.',
    vision: 'A world where data flows freely between every system without friction.',
    description: 'DataSync offers a cloud-native data integration platform that enables enterprises to build, manage, and monitor ETL pipelines at scale.',
  },
  products_services: [
    { name: 'DataSync Platform', category: 'Platform', pricing_model: 'Tiered SaaS ($2K-$50K/mo)', target_audience: 'Data engineering teams', competitive_advantage: 'No-code pipeline builder with 300+ connectors' },
    { name: 'DataSync Monitor', category: 'Add-on', pricing_model: 'Included with Platform', target_audience: 'Data ops teams', competitive_advantage: 'Real-time pipeline health monitoring' },
    { name: 'DataSync Consulting', category: 'Service', pricing_model: 'Professional services ($250/hr)', target_audience: 'Enterprise IT', competitive_advantage: 'Dedicated solutions architects' },
  ],
  technology_profiles: [
    tech('frontend', 'Vue.js', '3', 85),
    tech('backend', 'Python', '3.12', 92),
    tech('backend', 'Go', '1.21', 78),
    tech('cloud', 'GCP', null, 90),
    tech('cloud', 'AWS', null, 75),
    tech('crm', 'Salesforce', null, 82),
    tech('marketing', 'Marketo', null, 75),
    tech('analytics', 'Looker', null, 88),
    tech('security', 'Auth0', null, 85),
    tech('payment', 'Paddle', null, 80),
  ],
  growth_signals: [
    signal('funding', 'Raised $50M Series C led by Coatue (Sep 2024)', 'critical', 92),
    signal('hiring', '65 open roles, heavy in engineering and customer success', 'high', 88),
    signal('partnership', 'Announced strategic partnership with Snowflake', 'high', 85),
    signal('new_product', 'Launched DataSync AI Pipeline Assistant in Q3 2024', 'medium', 78),
    signal('expansion', 'Expanded to Toronto office for Canadian market', 'medium', 72),
  ],
  digital_presence: [
    presence('Website', 'datasync.com', '—', 90),
    presence('Blog', 'datasync.com/blog', '—', 85),
    presence('LinkedIn', 'linkedin.com/company/datasync', '18,300 followers', 85),
    presence('X (Twitter)', 'x.com/datasync', '5,600 followers', 65),
    presence('GitHub', 'github.com/datasync', '2,800 stars', 80),
  ],
  business_analysis: {
    strengths: ['300+ data connectors', 'Strong enterprise customer base', 'GCP-native architecture appeals to cloud-first enterprises', 'High NRR (110%)'],
    weaknesses: ['Complex onboarding for smaller teams', 'Pricing not transparent', 'Limited self-serve options', 'Heavy reliance on GCP ecosystem'],
    opportunities: ['AI pipeline assistant is early to market', 'Snowflake partnership opens cross-sell', 'Mid-market segment underserved', 'International expansion potential'],
    threats: ['Fivetran and Airbyte are well-funded competitors', 'Cloud providers building native ETL tools', 'Open-source alternatives gaining traction'],
    business_risks: ['Revenue concentration in top 20 customers', 'Long sales cycles (6-9 months)', 'GCP dependency creates vendor lock-in concerns'],
    market_position: 'Established player in the data integration market, positioned between Fivetran and enterprise ETL tools.',
    competitive_advantages: ['300+ pre-built connectors', 'AI-powered pipeline assistant', 'Snowflake partnership', 'Enterprise-grade monitoring'],
  },
  recommendations: {
    executive_summary: 'DataSync is a strong ICP fit with enterprise-grade data integration. Series C funding and Snowflake partnership signal growth. Recommend proceeding to Decision Maker Research.',
    business_fit: 'strong',
    opportunity_rating: 'high',
    recommended_next_action: 'Proceed to Decision Maker Research — target VP Engineering, Head of Data, CTO',
    should_continue: true,
    reasoning: 'Matches ICP: B2B SaaS, 201-500 employees, $40M revenue, uses Salesforce, Series C funded, active hiring. Strong technology alignment with Snowflake ecosystem.',
  },
};

// --- Company 3: OutreachPro ---
const company3: MockCompanyResearch = {
  research: {
    research_status: 'completed',
    research_score: 78,
    confidence_score: 75,
    executive_summary: 'OutreachPro provides sales engagement tooling for SMB sales teams. With 95 employees and $8M ARR, they are a moderate ICP fit. Their smaller size and limited technology stack may reduce opportunity.',
    error_message: null,
  },
  profile: {
    company_name: 'OutreachPro',
    website: 'outreachpro.com',
    industry: 'Computer Software',
    sub_industry: 'Sales Engagement',
    headquarters: 'Denver, CO',
    founded: '2020',
    locations: ['Denver, CO'],
    employee_count: '95',
    annual_revenue: '$8M',
    company_size: '51-200',
    business_model: 'B2B SaaS Subscription',
    target_market: 'SMB sales teams (5-50 reps)',
    mission: 'Make outbound sales accessible for every growing business.',
    vision: 'Democratize enterprise-grade sales engagement for SMBs.',
    description: 'OutreachPro offers a simplified sales engagement platform designed for small-to-midsize B2B sales teams.',
  },
  products_services: [
    { name: 'OutreachPro Core', category: 'Platform', pricing_model: 'Per-seat SaaS ($45/user/mo)', target_audience: 'SMB SDR teams', competitive_advantage: 'Simplified onboarding in under 1 hour' },
    { name: 'OutreachPro Templates', category: 'Add-on', pricing_model: 'Included', target_audience: 'Sales reps', competitive_advantage: '200+ pre-built sequence templates' },
  ],
  technology_profiles: [
    tech('frontend', 'React', '17', 82),
    tech('backend', 'Ruby on Rails', '7', 78),
    tech('hosting', 'Heroku', null, 85),
    tech('crm', 'HubSpot', null, 88),
    tech('sales', 'Outreach', null, 70),
    tech('analytics', 'Google Analytics', null, 75),
    tech('payment', 'Paddle', null, 90),
  ],
  growth_signals: [
    signal('funding', 'Raised $5M Seed from Founders Fund (Mar 2024)', 'medium', 80),
    signal('hiring', '12 open roles, mostly in sales and marketing', 'medium', 75),
    signal('new_product', 'Launched mobile app for on-the-go sequence management', 'low', 65),
  ],
  digital_presence: [
    presence('Website', 'outreachpro.com', '—', 75),
    presence('Blog', 'outreachpro.com/blog', '—', 60),
    presence('LinkedIn', 'linkedin.com/company/outreachpro', '6,800 followers', 70),
    presence('X (Twitter)', 'x.com/outreachpro', '2,100 followers', 55),
  ],
  business_analysis: {
    strengths: ['Simple, fast onboarding', 'Affordable for SMBs', 'Strong template library', 'Good HubSpot integration'],
    weaknesses: ['Limited enterprise features', 'No AI capabilities', 'Small team may struggle with scale', 'Single office, no international presence'],
    opportunities: ['SMB market is large and underserved', 'Mobile app differentiates', 'Could expand to mid-market with enterprise tier'],
    threats: ['CloudFlow and Outreach.io moving downstream', 'HubSpot building native engagement', 'Limited funding compared to competitors'],
    business_risks: ['Low funding runway', 'Single-product dependency', 'Small team concentration risk'],
    market_position: 'Niche player in SMB sales engagement, below CloudFlow and Outreach.io in market share.',
    competitive_advantages: ['Fast onboarding', 'Affordable pricing', 'Mobile-first approach', '200+ templates'],
  },
  recommendations: {
    executive_summary: 'OutreachPro is a moderate ICP fit. While they are in the right industry, their smaller size and limited funding suggest lower opportunity. Consider monitoring for future growth.',
    business_fit: 'moderate',
    opportunity_rating: 'medium',
    recommended_next_action: 'Monitor for growth signals — re-evaluate after next funding round',
    should_continue: false,
    reasoning: 'Company is in the right industry (B2B SaaS, sales engagement) but at 95 employees and $8M revenue, they are smaller than ideal ICP. Limited technology stack and Seed-only funding reduce confidence in growth trajectory.',
  },
};

// --- Companies 4-20: Compact mock data ---
function makeCompany(
  name: string,
  website: string,
  industry: string,
  subIndustry: string,
  hq: string,
  founded: string,
  employees: string,
  revenue: string,
  size: string,
  score: number,
  confidence: number,
  fit: 'strong' | 'moderate' | 'weak',
  rating: 'high' | 'medium' | 'low',
  shouldContinue: boolean,
  summary: string,
  techStack: { category: TechCategory; name: string; version: string | null; confidence: number }[],
  signals: { type: GrowthSignalType; desc: string; priority: SignalPriority; conf: number }[],
): MockCompanyResearch {
  return {
    research: {
      research_status: 'completed',
      research_score: score,
      confidence_score: confidence,
      executive_summary: summary,
      error_message: null,
    },
    profile: {
      company_name: name,
      website,
      industry,
      sub_industry: subIndustry,
      headquarters: hq,
      founded,
      locations: [hq],
      employee_count: employees,
      annual_revenue: revenue,
      company_size: size,
      business_model: 'B2B SaaS Subscription',
      target_market: 'B2B companies',
      mission: `Mission statement for ${name}.`,
      vision: `Vision statement for ${name}.`,
      description: `${name} is a ${subIndustry.toLowerCase()} company based in ${hq}.`,
    },
    products_services: [
      { name: `${name.split(' ')[0]} Platform`, category: 'Platform', pricing_model: 'Per-seat SaaS', target_audience: 'B2B teams', competitive_advantage: 'Integrated workflow automation' },
      { name: `${name.split(' ')[0]} Analytics`, category: 'Add-on', pricing_model: 'Flat rate', target_audience: 'Operations teams', competitive_advantage: 'Real-time dashboards' },
    ],
    technology_profiles: techStack.map((t) => tech(t.category, t.name, t.version, t.confidence)),
    growth_signals: signals.map((s) => signal(s.type, s.desc, s.priority, s.conf)),
    digital_presence: [
      presence('Website', website, '—', 80),
      presence('LinkedIn', `linkedin.com/company/${name.split(' ')[0].toLowerCase()}`, '10,000+ followers', 75),
      presence('X (Twitter)', `x.com/${name.split(' ')[0].toLowerCase()}`, '3,000+ followers', 60),
    ],
    business_analysis: {
      strengths: ['Strong product offering', 'Growing customer base', 'Experienced team'],
      weaknesses: ['Limited brand awareness', 'Competitive market'],
      opportunities: ['Market expansion', 'Product diversification'],
      threats: ['Well-funded competitors', 'Market consolidation'],
      business_risks: ['Customer concentration', 'Long sales cycles'],
      market_position: `${name} is a growing player in the ${subIndustry.toLowerCase()} market.`,
      competitive_advantages: ['Integrated platform', 'Strong customer support', 'Competitive pricing'],
    },
    recommendations: {
      executive_summary: summary,
      business_fit: fit,
      opportunity_rating: rating,
      recommended_next_action: shouldContinue ? 'Proceed to Decision Maker Research' : 'Monitor for growth signals',
      should_continue: shouldContinue,
      reasoning: `Research score: ${score}. Confidence: ${confidence}. Fit: ${fit}.`,
    },
  };
}

const company4 = makeCompany('PipelineGenius', 'pipelinegenius.com', 'Computer Software', 'Sales Pipeline Management', 'Seattle, WA', '2017', '240', '$30M', '201-500', 89, 85, 'strong', 'high', true,
  'PipelineGenius provides AI-driven pipeline management for B2B sales teams. 240 employees, $30M ARR, Series B. Strong ICP fit with Salesforce integration.',
  [tech('crm', 'Salesforce', null, 95), tech('sales', 'Outreach', null, 88), tech('analytics', 'Tableau', null, 82), tech('cloud', 'AWS', null, 85)],
  [signal('funding', 'Raised $25M Series B (Jun 2024)', 'critical', 90), signal('hiring', '38 open roles', 'high', 85), signal('partnership', 'Salesforce AppExchange partnership', 'high', 80)]);

const company5 = makeCompany('RevMomentum', 'revmomentum.io', 'Computer Software', 'Revenue Operations', 'Boston, MA', '2019', '150', '$18M', '51-200', 87, 83, 'strong', 'high', true,
  'RevMomentum offers RevOps automation for B2B SaaS companies. 150 employees, $18M ARR, Series A. Excellent ICP fit with HubSpot and Gong.',
  [tech('crm', 'HubSpot', null, 92), tech('sales', 'Gong', null, 88), tech('marketing', 'Marketo', null, 75), tech('analytics', 'Amplitude', null, 80)],
  [signal('funding', 'Raised $15M Series A (Nov 2024)', 'high', 85), signal('hiring', '22 open roles', 'medium', 78), signal('new_product', 'Launched RevOps Intelligence module', 'medium', 75)]);

const company6 = makeCompany('ConversionLab', 'conversionlab.com', 'Internet', 'Conversion Optimization', 'New York, NY', '2018', '110', '$12M', '51-200', 82, 78, 'strong', 'medium', true,
  'ConversionLab provides A/B testing and conversion optimization for SaaS companies. 110 employees, $12M ARR. Good ICP fit.',
  [tech('frontend', 'React', '18', 88), tech('backend', 'Node.js', '20', 85), tech('analytics', 'Mixpanel', null, 90), tech('cloud', 'AWS', null, 82)],
  [signal('hiring', '18 open roles', 'medium', 75), signal('new_product', 'Launched AI-powered test recommendations', 'medium', 72)]);

const company7 = makeCompany('ScaleOS', 'scaleos.io', 'Information Technology & Services', 'DevOps Automation', 'Portland, OR', '2016', '280', '$35M', '201-500', 84, 80, 'strong', 'high', true,
  'ScaleOS provides DevOps automation for engineering teams. 280 employees, $35M ARR, Series C. Strong ICP fit.',
  [tech('cloud', 'AWS', null, 95), tech('cloud', 'Azure', null, 80), tech('backend', 'Go', '1.21', 88), tech('security', 'Vault', null, 82)],
  [signal('funding', 'Raised $40M Series C (Aug 2024)', 'critical', 92), signal('hiring', '45 open roles', 'high', 88), signal('expansion', 'Opened Berlin office', 'medium', 75)]);

const company8 = makeCompany('TalentForge', 'talentforge.com', 'Human Resources', 'Talent Acquisition Platform', 'Chicago, IL', '2019', '85', '$7M', '51-200', 72, 68, 'moderate', 'medium', false,
  'TalentForge provides AI-powered talent acquisition for mid-market companies. 85 employees, $7M ARR. Moderate ICP fit.',
  [tech('crm', 'Salesforce', null, 78), tech('frontend', 'React', '17', 80), tech('cloud', 'GCP', null, 75)],
  [signal('funding', 'Raised $3M Seed (Feb 2024)', 'low', 70), signal('hiring', '8 open roles', 'low', 65)]);

const company9 = makeCompany('ContentGenius', 'contentgenius.io', 'Internet', 'Content Marketing Platform', 'Austin, TX', '2017', '190', '$22M', '51-200', 86, 82, 'strong', 'high', true,
  'ContentGenius provides AI-powered content marketing for B2B SaaS. 190 employees, $22M ARR, Series B. Strong ICP fit.',
  [tech('marketing', 'HubSpot', null, 90), tech('crm', 'Salesforce', null, 85), tech('ai_tools', 'OpenAI', null, 92), tech('analytics', 'Google Analytics', null, 78)],
  [signal('funding', 'Raised $20M Series B (Oct 2024)', 'critical', 88), signal('hiring', '30 open roles', 'high', 82), signal('new_product', 'Launched AI Content Generator', 'high', 85)]);

const company10 = makeCompany('SecureNet', 'securenet.io', 'Computer & Network Security', 'Cybersecurity Platform', 'San Jose, CA', '2015', '450', '$55M', '201-500', 81, 78, 'strong', 'medium', true,
  'SecureNet provides enterprise cybersecurity solutions. 450 employees, $55M ARR, Series D. Good ICP fit.',
  [tech('security', 'Okta', null, 92), tech('cloud', 'AWS', null, 88), tech('backend', 'Java', '21', 80), tech('crm', 'Salesforce', null, 82)],
  [signal('funding', 'Raised $60M Series D (May 2024)', 'critical', 90), signal('hiring', '55 open roles', 'high', 85), signal('partnership', 'AWS Marketplace partnership', 'high', 82)]);

const company11 = makeCompany('FlowMetrics', 'flowmetrics.com', 'Computer Software', 'Business Intelligence', 'Salt Lake City, UT', '2018', '130', '$15M', '51-200', 80, 76, 'strong', 'medium', true,
  'FlowMetrics provides BI dashboards for SaaS companies. 130 employees, $15M ARR, Series A. Good ICP fit.',
  [tech('analytics', 'Looker', null, 88), tech('backend', 'Python', '3.12', 85), tech('cloud', 'AWS', null, 80), tech('crm', 'HubSpot', null, 75)],
  [signal('funding', 'Raised $12M Series A (Jul 2024)', 'high', 82), signal('hiring', '20 open roles', 'medium', 75)]);

const company12 = makeCompany('TeamSync Pro', 'teamsyncpro.com', 'Computer Software', 'Collaboration Platform', 'Los Angeles, CA', '2019', '75', '$6M', '51-200', 68, 65, 'moderate', 'low', false,
  'TeamSync Pro provides team collaboration tools for SMBs. 75 employees, $6M ARR. Moderate ICP fit, smaller than ideal.',
  [tech('frontend', 'Vue.js', '3', 78), tech('backend', 'Node.js', '20', 75), tech('cloud', 'AWS', null, 72)],
  [signal('hiring', '10 open roles', 'low', 68), signal('new_product', 'Launched project templates', 'low', 60)]);

const company13 = makeCompany('InsightDeck', 'insightdeck.io', 'Computer Software', 'Customer Analytics', 'Remote', '2020', '60', '$5M', '11-50', 65, 62, 'moderate', 'low', false,
  'InsightDeck provides customer analytics for SaaS startups. 60 employees, $5M ARR. Moderate ICP fit, early stage.',
  [tech('analytics', 'Amplitude', null, 82), tech('frontend', 'React', '18', 80), tech('backend', 'Python', '3.11', 78)],
  [signal('funding', 'Raised $2M Pre-Seed (Jan 2025)', 'low', 65), signal('hiring', '5 open roles', 'low', 60)]);

const company14 = makeCompany('NexusCRM', 'nexuscrm.com', 'Computer Software', 'CRM Platform', 'Dallas, TX', '2016', '350', '$42M', '201-500', 83, 80, 'strong', 'high', true,
  'NexusCRM provides a next-gen CRM for B2B sales teams. 350 employees, $42M ARR, Series C. Strong ICP fit.',
  [tech('crm', 'Salesforce', null, 88), tech('backend', 'Java', '21', 85), tech('cloud', 'AWS', null, 90), tech('sales', 'Gong', null, 80)],
  [signal('funding', 'Raised $45M Series C (Mar 2024)', 'critical', 90), signal('hiring', '50 open roles', 'high', 85), signal('acquisition', 'Acquired AI startup LeadScore', 'high', 82)]);

const company15 = makeCompany('GrowthLoop', 'growthloop.io', 'Internet', 'Growth Marketing Platform', 'San Francisco, CA', '2018', '165', '$20M', '51-200', 85, 81, 'strong', 'high', true,
  'GrowthLoop provides growth marketing automation for B2B SaaS. 165 employees, $20M ARR, Series B. Strong ICP fit.',
  [tech('marketing', 'HubSpot', null, 92), tech('crm', 'Salesforce', null, 85), tech('analytics', 'Mixpanel', null, 80), tech('ai_tools', 'OpenAI', null, 85)],
  [signal('funding', 'Raised $18M Series B (Sep 2024)', 'critical', 88), signal('hiring', '28 open roles', 'high', 82), signal('new_product', 'Launched Growth AI Assistant', 'high', 80)]);

const company16 = makeCompany('DeployHQ', 'deployhq.com', 'Information Technology & Services', 'Deployment Automation', 'Remote', '2017', '120', '$14M', '51-200', 77, 74, 'strong', 'medium', true,
  'DeployHQ provides CI/CD and deployment automation. 120 employees, $14M ARR. Good ICP fit.',
  [tech('cloud', 'AWS', null, 85), tech('cloud', 'Azure', null, 78), tech('backend', 'Go', '1.21', 82), tech('security', 'Vault', null, 75)],
  [signal('hiring', '15 open roles', 'medium', 72), signal('partnership', 'GitHub Marketplace partnership', 'medium', 70)]);

const company17 = makeCompany('ChatWave', 'chatwave.io', 'Internet', 'Customer Messaging', 'Miami, FL', '2020', '90', '$9M', '51-200', 74, 70, 'moderate', 'medium', false,
  'ChatWave provides AI-powered customer messaging for SaaS. 90 employees, $9M ARR. Moderate ICP fit.',
  [tech('frontend', 'React', '18', 82), tech('backend', 'Node.js', '20', 78), tech('ai_tools', 'OpenAI', null, 85), tech('cloud', 'GCP', null, 75)],
  [signal('funding', 'Raised $6M Seed (Apr 2024)', 'medium', 75), signal('hiring', '12 open roles', 'low', 68)]);

const company18 = makeCompany('MetricStream', 'metricstream.com', 'Computer Software', 'Business Metrics Platform', 'Atlanta, GA', '2016', '220', '$28M', '201-500', 82, 79, 'strong', 'medium', true,
  'MetricStream provides business metrics and KPI tracking for SaaS companies. 220 employees, $28M ARR, Series B. Good ICP fit.',
  [tech('analytics', 'Tableau', null, 88), tech('crm', 'Salesforce', null, 82), tech('backend', 'Python', '3.12', 85), tech('cloud', 'AWS', null, 80)],
  [signal('funding', 'Raised $22M Series B (Dec 2024)', 'critical', 88), signal('hiring', '32 open roles', 'high', 80), signal('expansion', 'Opened Singapore office', 'medium', 75)]);

const company19 = makeCompany('ZenithAI', 'zenithai.io', 'Computer Software', 'AI Sales Assistant', 'San Francisco, CA', '2021', '55', '$4M', '11-50', 70, 67, 'moderate', 'medium', false,
  'ZenithAI provides AI-powered sales assistants for startups. 55 employees, $4M ARR. Moderate ICP fit, early stage.',
  [tech('ai_tools', 'OpenAI', null, 95), tech('frontend', 'React', '18', 82), tech('backend', 'Python', '3.12', 85), tech('cloud', 'AWS', null, 78)],
  [signal('funding', 'Raised $3M Pre-Seed (Nov 2024)', 'low', 70), signal('hiring', '8 open roles', 'low', 65), signal('new_product', 'Launched AI Deal Coach', 'medium', 72)]);

const company20 = makeCompany('OmniChannel', 'omnichannel.com', 'Internet', 'Multi-channel Marketing', 'Toronto, CA', '2017', '200', '$24M', '201-500', 84, 80, 'strong', 'high', true,
  'OmniChannel provides multi-channel marketing automation for B2B companies. 200 employees, $24M ARR, Series B. Strong ICP fit.',
  [tech('marketing', 'Marketo', null, 90), tech('crm', 'Salesforce', null, 88), tech('analytics', 'Amplitude', null, 82), tech('cloud', 'AWS', null, 85)],
  [signal('funding', 'Raised $28M Series B (Aug 2024)', 'critical', 90), signal('hiring', '35 open roles', 'high', 85), signal('expansion', 'Expanded to US market', 'high', 82), signal('new_product', 'Launched Cross-channel Attribution', 'medium', 78)]);

// ============================================================
// Aggregated Array
// ============================================================

export const MOCK_COMPANIES: MockCompanyResearch[] = [
  company1, company2, company3, company4, company5, company6, company7, company8, company9, company10,
  company11, company12, company13, company14, company15, company16, company17, company18, company19, company20,
];

// ============================================================
// AI Recommendations (shared)
// ============================================================

export const MOCK_RECOMMENDATIONS: ResearchRecommendations = company1.recommendations;
