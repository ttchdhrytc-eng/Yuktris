// ============================================================
// Mock Data — Prospect Discovery Agent
// ============================================================
//
// Realistic company data for Yuktris prospect discovery.
// 50 companies across 5 categories matching the primary ICP
// (B2B SaaS Companies, 50–500 employees).
// Simulates what Tavily + Firecrawl + Clearbit + Apollo would produce.

import type {
  DiscoveredCompany,
  CompanyScore,
  ProspectRecommendation,
  DiscoveryRecommendations,
  DiscoveryStageInfo,
  ExclusionRecord,
  CompanyEnrichmentResult,
  TechnologyStackResult,
} from '@/types/prospect-discovery';

// ============================================================
// Pipeline Stages
// ============================================================

export const DISCOVERY_STAGES: DiscoveryStageInfo[] = [
  { stage: 'loading_icp', label: 'Loading ICP', description: 'Loading Ideal Customer Profile from ICP Intelligence Agent' },
  { stage: 'searching_companies', label: 'Searching Companies', description: 'Discovering companies matching ICP criteria' },
  { stage: 'filtering_results', label: 'Filtering Results', description: 'Excluding companies outside ICP parameters' },
  { stage: 'calculating_scores', label: 'Calculating Scores', description: 'Scoring companies by opportunity, growth, and ICP match' },
  { stage: 'ranking_companies', label: 'Ranking Companies', description: 'Ranking companies by overall score and priority' },
  { stage: 'generating_recommendations', label: 'Generating Recommendations', description: 'Creating AI-powered recommendations for top companies' },
  { stage: 'saving_results', label: 'Saving Results', description: 'Persisting discovery results to the database' },
];

// ============================================================
// Company Templates
// ============================================================

type CompanyTemplate = {
  name: string;
  website: string;
  industry: string;
  country: string;
  employee_count: string;
  annual_revenue: string;
  company_size: string;
  growth_stage: string;
  technology_stack: string[];
  description: string;
  opportunity_score: number;
  growth_score: number;
  icp_match_score: number;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'discovered' | 'qualified' | 'saved' | 'ignored' | 'researching';
};

const companyTemplates: CompanyTemplate[] = [
  // --- B2B SaaS Startups (12) ---
  { name: 'GrowthForge', website: 'growthforge.io', industry: 'B2B SaaS', country: 'United States', employee_count: '85', annual_revenue: '$8M ARR', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['Salesforce', 'HubSpot', 'Outreach', 'Slack', 'AWS'], description: 'AI-powered sales enablement platform for mid-market SaaS companies.', opportunity_score: 94, growth_score: 88, icp_match_score: 96, priority: 'critical', status: 'qualified' },
  { name: 'ScaleMetrics', website: 'scalemetrics.com', industry: 'B2B SaaS', country: 'United States', employee_count: '120', annual_revenue: '$12M ARR', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['Salesforce', 'Gong', 'Outreach', 'Zoom', 'GCP'], description: 'Revenue intelligence and analytics platform for sales teams.', opportunity_score: 92, growth_score: 85, icp_match_score: 94, priority: 'critical', status: 'qualified' },
  { name: 'PipelineGenius', website: 'pipelinegenius.ai', industry: 'B2B SaaS', country: 'United States', employee_count: '65', annual_revenue: '$5M ARR', company_size: '51-200', growth_stage: 'Seed', technology_stack: ['HubSpot', 'Apollo', 'Slack', 'Notion', 'AWS'], description: 'AI-driven pipeline generation and forecasting tool.', opportunity_score: 90, growth_score: 82, icp_match_score: 92, priority: 'high', status: 'qualified' },
  { name: 'CloseRate', website: 'closerate.io', industry: 'B2B SaaS', country: 'Canada', employee_count: '95', annual_revenue: '$7M ARR', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['Salesforce', 'SalesLoft', 'Gong', 'Slack', 'Azure'], description: 'AI-powered close rate optimization platform for SaaS sales teams.', opportunity_score: 88, growth_score: 86, icp_match_score: 90, priority: 'high', status: 'qualified' },
  { name: 'DealCloud', website: 'dealcloud.co', industry: 'B2B SaaS', country: 'United States', employee_count: '180', annual_revenue: '$15M ARR', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Salesforce', 'Outreach', 'Zoom', 'Gong', 'AWS'], description: 'Cloud-based deal management and CRM platform for sales teams.', opportunity_score: 86, growth_score: 78, icp_match_score: 88, priority: 'high', status: 'discovered' },
  { name: 'RevPath', website: 'revpath.io', industry: 'B2B SaaS', country: 'United States', employee_count: '75', annual_revenue: '$6M ARR', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['HubSpot', 'Outreach', 'Slack', 'AWS'], description: 'Revenue path optimization and sales journey mapping tool.', opportunity_score: 85, growth_score: 80, icp_match_score: 86, priority: 'high', status: 'discovered' },
  { name: 'OutboundPro', website: 'outboundpro.ai', industry: 'B2B SaaS', country: 'United Kingdom', employee_count: '110', annual_revenue: '$9M ARR', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['Salesforce', 'Apollo', 'Zoom', 'Slack', 'AWS'], description: 'AI-powered outbound sales automation platform.', opportunity_score: 84, growth_score: 82, icp_match_score: 85, priority: 'medium', status: 'discovered' },
  { name: 'ConvertFlow', website: 'convertflow.io', industry: 'B2B SaaS', country: 'United States', employee_count: '55', annual_revenue: '$4M ARR', company_size: '51-200', growth_stage: 'Seed', technology_stack: ['HubSpot', 'Slack', 'Notion', 'AWS'], description: 'Conversion optimization and lead flow automation for SaaS.', opportunity_score: 82, growth_score: 75, icp_match_score: 84, priority: 'medium', status: 'discovered' },
  { name: 'SyncSales', website: 'syncsales.com', industry: 'B2B SaaS', country: 'Australia', employee_count: '90', annual_revenue: '$7M ARR', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['Salesforce', 'Outreach', 'Gong', 'Zoom', 'AWS'], description: 'Sales team synchronization and collaboration platform.', opportunity_score: 80, growth_score: 72, icp_match_score: 82, priority: 'medium', status: 'discovered' },
  { name: 'LeadEngine', website: 'leadengine.io', industry: 'B2B SaaS', country: 'United States', employee_count: '140', annual_revenue: '$11M ARR', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Salesforce', 'Apollo', 'HubSpot', 'Slack', 'GCP'], description: 'Lead generation engine with AI-powered scoring and routing.', opportunity_score: 78, growth_score: 68, icp_match_score: 80, priority: 'medium', status: 'discovered' },
  { name: 'FunnelScience', website: 'funnelscience.ai', industry: 'B2B SaaS', country: 'Germany', employee_count: '70', annual_revenue: '$5M ARR', company_size: '51-200', growth_stage: 'Seed', technology_stack: ['HubSpot', 'Slack', 'AWS', 'Notion'], description: 'Sales funnel analytics and optimization platform.', opportunity_score: 76, growth_score: 70, icp_match_score: 78, priority: 'low', status: 'discovered' },
  { name: 'QuoteWin', website: 'quotewin.com', industry: 'B2B SaaS', country: 'United States', employee_count: '160', annual_revenue: '$13M ARR', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Salesforce', 'Gong', 'Zoom', 'AWS'], description: 'AI-powered quote-to-win platform for SaaS sales teams.', opportunity_score: 74, growth_score: 65, icp_match_score: 76, priority: 'low', status: 'discovered' },

  // --- Digital Marketing Agencies (12) ---
  { name: 'Digital Surgeons', website: 'digitalsurgeons.com', industry: 'Marketing & Advertising', country: 'United States', employee_count: '85', annual_revenue: '$8M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Google Ads', 'Semrush', 'Slack', 'Notion'], description: 'Full-service digital marketing agency specializing in growth strategy.', opportunity_score: 82, growth_score: 78, icp_match_score: 85, priority: 'high', status: 'qualified' },
  { name: 'GrowthLab', website: 'growthlab.agency', industry: 'Marketing & Advertising', country: 'United States', employee_count: '65', annual_revenue: '$6M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Ahrefs', 'Google Ads', 'Slack'], description: 'Growth marketing agency for B2B SaaS companies.', opportunity_score: 80, growth_score: 82, icp_match_score: 82, priority: 'high', status: 'qualified' },
  { name: 'PixelPunch', website: 'pixelpunch.io', industry: 'Marketing & Advertising', country: 'United Kingdom', employee_count: '45', annual_revenue: '$4M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Figma', 'Google Ads', 'Slack'], description: 'Creative digital agency focused on performance marketing.', opportunity_score: 78, growth_score: 75, icp_match_score: 80, priority: 'medium', status: 'discovered' },
  { name: 'BrandBoost', website: 'brandboost.agency', industry: 'Marketing & Advertising', country: 'United States', employee_count: '75', annual_revenue: '$7M', company_size: '51-200', growth_stage: 'Seed', technology_stack: ['HubSpot', 'Semrush', 'Meta Ads', 'Slack', 'Notion'], description: 'Brand-focused marketing agency for tech startups.', opportunity_score: 76, growth_score: 70, icp_match_score: 78, priority: 'medium', status: 'discovered' },
  { name: 'ContentKing', website: 'contentking.io', industry: 'Marketing & Advertising', country: 'Canada', employee_count: '55', annual_revenue: '$5M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Ahrefs', 'Slack', 'Google Ads'], description: 'Content marketing agency specializing in SEO and thought leadership.', opportunity_score: 74, growth_score: 68, icp_match_score: 76, priority: 'medium', status: 'discovered' },
  { name: 'MarketMakers', website: 'marketmakers.co', industry: 'Marketing & Advertising', country: 'United States', employee_count: '120', annual_revenue: '$10M', company_size: '101-500', growth_stage: 'Seed', technology_stack: ['HubSpot', 'Google Ads', 'Semrush', 'Slack', 'Notion'], description: 'Full-stack growth agency for B2B companies.', opportunity_score: 72, growth_score: 65, icp_match_score: 74, priority: 'low', status: 'discovered' },
  { name: 'AdVantage', website: 'advantage.agency', industry: 'Marketing & Advertising', country: 'Australia', employee_count: '40', annual_revenue: '$3M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Google Ads', 'Meta Ads', 'Slack'], description: 'Performance advertising agency for SaaS companies.', opportunity_score: 70, growth_score: 72, icp_match_score: 72, priority: 'low', status: 'discovered' },
  { name: 'FunnelForce', website: 'funnelforce.io', industry: 'Marketing & Advertising', country: 'United States', employee_count: '90', annual_revenue: '$8M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Outreach', 'Google Ads', 'Slack'], description: 'Funnel optimization and demand generation agency.', opportunity_score: 68, growth_score: 62, icp_match_score: 70, priority: 'low', status: 'discovered' },
  { name: 'SocialScale', website: 'socialscale.agency', industry: 'Marketing & Advertising', country: 'United States', employee_count: '50', annual_revenue: '$4M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Meta Ads', 'Slack', 'Notion'], description: 'Social media marketing agency for B2B brands.', opportunity_score: 66, growth_score: 60, icp_match_score: 68, priority: 'low', status: 'discovered' },
  { name: 'ClickConvert', website: 'clickconvert.co', industry: 'Marketing & Advertising', country: 'Netherlands', employee_count: '35', annual_revenue: '$3M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Google Ads', 'Slack'], description: 'PPC and conversion optimization agency.', opportunity_score: 64, growth_score: 58, icp_match_score: 66, priority: 'low', status: 'discovered' },
  { name: 'ReachMedia', website: 'reachmedia.agency', industry: 'Marketing & Advertising', country: 'United States', employee_count: '110', annual_revenue: '$9M', company_size: '101-500', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Google Ads', 'Semrush', 'Slack'], description: 'Digital marketing agency specializing in outbound campaigns.', opportunity_score: 62, growth_score: 55, icp_match_score: 64, priority: 'low', status: 'discovered' },
  { name: 'TrendSetters', website: 'trendsetters.io', industry: 'Marketing & Advertising', country: 'Germany', employee_count: '60', annual_revenue: '$5M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Ahrefs', 'Slack'], description: 'Trend-driven marketing agency for European tech companies.', opportunity_score: 60, growth_score: 52, icp_match_score: 62, priority: 'low', status: 'discovered' },

  // --- IT Services & Software Companies (12) ---
  { name: 'CloudNative', website: 'cloudnative.io', industry: 'Information Technology & Services', country: 'United States', employee_count: '250', annual_revenue: '$25M', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Jira', 'ServiceNow', 'AWS', 'Slack', 'Salesforce'], description: 'Cloud-native IT services and consulting company.', opportunity_score: 84, growth_score: 80, icp_match_score: 82, priority: 'high', status: 'qualified' },
  { name: 'DevOpsHub', website: 'devopshub.com', industry: 'Information Technology & Services', country: 'United States', employee_count: '180', annual_revenue: '$18M', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Jira', 'AWS', 'Azure', 'Slack', 'Salesforce'], description: 'DevOps consulting and managed services provider.', opportunity_score: 82, growth_score: 76, icp_match_score: 80, priority: 'high', status: 'qualified' },
  { name: 'TechSphere', website: 'techsphere.io', industry: 'Information Technology & Services', country: 'Canada', employee_count: '320', annual_revenue: '$30M', company_size: '101-500', growth_stage: 'Series C', technology_stack: ['Jira', 'ServiceNow', 'Azure', 'AWS', 'Salesforce'], description: 'Enterprise IT consulting and digital transformation firm.', opportunity_score: 80, growth_score: 72, icp_match_score: 78, priority: 'medium', status: 'discovered' },
  { name: 'CodeWorks', website: 'codeworks.dev', industry: 'Information Technology & Services', country: 'United States', employee_count: '150', annual_revenue: '$14M', company_size: '101-500', growth_stage: 'Series A', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack'], description: 'Custom software development and IT services company.', opportunity_score: 78, growth_score: 74, icp_match_score: 76, priority: 'medium', status: 'discovered' },
  { name: 'InfraPro', website: 'infrapro.io', industry: 'Information Technology & Services', country: 'United States', employee_count: '200', annual_revenue: '$20M', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Jira', 'ServiceNow', 'AWS', 'Azure', 'Slack'], description: 'Infrastructure management and cloud migration specialist.', opportunity_score: 76, growth_score: 68, icp_match_score: 74, priority: 'medium', status: 'discovered' },
  { name: 'SysDesign', website: 'sysdesign.co', industry: 'Information Technology & Services', country: 'United Kingdom', employee_count: '140', annual_revenue: '$13M', company_size: '101-500', growth_stage: 'Series A', technology_stack: ['Jira', 'AWS', 'Slack', 'Salesforce'], description: 'Systems design and IT architecture consulting firm.', opportunity_score: 74, growth_score: 66, icp_match_score: 72, priority: 'medium', status: 'discovered' },
  { name: 'DataFlow', website: 'dataflow.io', industry: 'Information Technology & Services', country: 'United States', employee_count: '110', annual_revenue: '$10M', company_size: '101-500', growth_stage: 'Series A', technology_stack: ['Jira', 'AWS', 'GCP', 'Slack'], description: 'Data engineering and analytics infrastructure services.', opportunity_score: 72, growth_score: 70, icp_match_score: 70, priority: 'low', status: 'discovered' },
  { name: 'NetScale', website: 'netscale.com', industry: 'Information Technology & Services', country: 'Australia', employee_count: '160', annual_revenue: '$15M', company_size: '101-500', growth_stage: 'Series B', technology_stack: ['Jira', 'AWS', 'ServiceNow', 'Slack'], description: 'Network infrastructure and scaling services provider.', opportunity_score: 70, growth_score: 62, icp_match_score: 68, priority: 'low', status: 'discovered' },
  { name: 'SecureIT', website: 'secureit.io', industry: 'Information Technology & Services', country: 'United States', employee_count: '130', annual_revenue: '$12M', company_size: '101-500', growth_stage: 'Series A', technology_stack: ['Jira', 'AWS', 'Slack', 'Salesforce'], description: 'Cybersecurity and IT compliance consulting firm.', opportunity_score: 68, growth_score: 64, icp_match_score: 66, priority: 'low', status: 'discovered' },
  { name: 'AgileWorks', website: 'agileworks.dev', industry: 'Information Technology & Services', country: 'Germany', employee_count: '95', annual_revenue: '$8M', company_size: '51-200', growth_stage: 'Series A', technology_stack: ['Jira', 'GitHub', 'Slack', 'AWS'], description: 'Agile transformation and software development consulting.', opportunity_score: 66, growth_score: 58, icp_match_score: 64, priority: 'low', status: 'discovered' },
  { name: 'CloudShift', website: 'cloudshift.io', industry: 'Information Technology & Services', country: 'United States', employee_count: '220', annual_revenue: '$22M', company_size: '101-500', growth_stage: 'Series C', technology_stack: ['Jira', 'AWS', 'Azure', 'ServiceNow', 'Slack'], description: 'Cloud migration and digital transformation consultancy.', opportunity_score: 64, growth_score: 56, icp_match_score: 62, priority: 'low', status: 'discovered' },
  { name: 'ITBridge', website: 'itbridge.co', industry: 'Information Technology & Services', country: 'Canada', employee_count: '85', annual_revenue: '$7M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'AWS', 'Slack'], description: 'IT bridge consulting and managed services company.', opportunity_score: 62, growth_score: 50, icp_match_score: 60, priority: 'low', status: 'discovered' },

  // --- Software Development Agencies (8) ---
  { name: 'BuildSphere', website: 'buildsphere.dev', industry: 'Software Development', country: 'United States', employee_count: '75', annual_revenue: '$7M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack', 'Notion'], description: 'Custom software development agency for startups.', opportunity_score: 80, growth_score: 78, icp_match_score: 82, priority: 'high', status: 'qualified' },
  { name: 'CodeNest', website: 'codenest.io', industry: 'Software Development', country: 'United States', employee_count: '60', annual_revenue: '$5M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack'], description: 'Full-stack development agency specializing in SaaS products.', opportunity_score: 78, growth_score: 76, icp_match_score: 80, priority: 'high', status: 'discovered' },
  { name: 'DevForge', website: 'devforge.co', industry: 'Software Development', country: 'United Kingdom', employee_count: '50', annual_revenue: '$4M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'GCP', 'Slack'], description: 'Software development forge for enterprise applications.', opportunity_score: 76, growth_score: 72, icp_match_score: 78, priority: 'medium', status: 'discovered' },
  { name: 'AppCatalyst', website: 'appcatalyst.io', industry: 'Software Development', country: 'United States', employee_count: '90', annual_revenue: '$8M', company_size: '51-200', growth_stage: 'Seed', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack', 'Notion'], description: 'Application development catalyst for high-growth startups.', opportunity_score: 74, growth_score: 70, icp_match_score: 76, priority: 'medium', status: 'discovered' },
  { name: 'SoftStack', website: 'softstack.dev', industry: 'Software Development', country: 'Australia', employee_count: '45', annual_revenue: '$3M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack'], description: 'Software stack development and consulting agency.', opportunity_score: 72, growth_score: 68, icp_match_score: 74, priority: 'medium', status: 'discovered' },
  { name: 'LaunchPad', website: 'launchpad.dev', industry: 'Software Development', country: 'United States', employee_count: '65', annual_revenue: '$5M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack'], description: 'MVP and product launch development agency.', opportunity_score: 70, growth_score: 74, icp_match_score: 72, priority: 'low', status: 'discovered' },
  { name: 'StackWorks', website: 'stackworks.io', industry: 'Software Development', country: 'Canada', employee_count: '55', annual_revenue: '$4M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'Azure', 'Slack'], description: 'Full-stack development and architecture consulting.', opportunity_score: 68, growth_score: 62, icp_match_score: 70, priority: 'low', status: 'discovered' },
  { name: 'ByteCraft', website: 'bytecraft.co', industry: 'Software Development', country: 'Germany', employee_count: '40', annual_revenue: '$3M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['Jira', 'GitHub', 'AWS', 'Slack'], description: 'Craft software development agency for European startups.', opportunity_score: 66, growth_score: 60, icp_match_score: 68, priority: 'low', status: 'discovered' },

  // --- HubSpot Partner Agencies (6) ---
  { name: 'HubGrowth Partners', website: 'hubgrowthpartners.com', industry: 'Marketing & Advertising', country: 'United States', employee_count: '70', annual_revenue: '$6M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Salesforce', 'Slack', 'Notion'], description: 'HubSpot Diamond Partner agency specializing in inbound growth.', opportunity_score: 86, growth_score: 82, icp_match_score: 88, priority: 'high', status: 'qualified' },
  { name: 'InboundLab', website: 'inboundlab.io', industry: 'Marketing & Advertising', country: 'United States', employee_count: '50', annual_revenue: '$4M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Slack', 'Notion'], description: 'HubSpot Platinum Partner focused on inbound marketing automation.', opportunity_score: 84, growth_score: 78, icp_match_score: 86, priority: 'high', status: 'discovered' },
  { name: 'HubMasters', website: 'hubmasters.co', industry: 'Marketing & Advertising', country: 'United Kingdom', employee_count: '45', annual_revenue: '$3M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Slack'], description: 'HubSpot Gold Partner agency for European markets.', opportunity_score: 82, growth_score: 76, icp_match_score: 84, priority: 'medium', status: 'discovered' },
  { name: 'GrowthHub', website: 'growthhub.agency', industry: 'Marketing & Advertising', country: 'United States', employee_count: '85', annual_revenue: '$7M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Salesforce', 'Slack', 'Notion'], description: 'HubSpot Diamond Partner for RevOps and sales alignment.', opportunity_score: 80, growth_score: 74, icp_match_score: 82, priority: 'medium', status: 'discovered' },
  { name: 'HubFlow', website: 'hubflow.io', industry: 'Marketing & Advertising', country: 'Canada', employee_count: '40', annual_revenue: '$3M', company_size: '11-50', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Slack'], description: 'HubSpot Solutions Partner specializing in workflow automation.', opportunity_score: 78, growth_score: 70, icp_match_score: 80, priority: 'low', status: 'discovered' },
  { name: 'PartnerPro', website: 'partnerpro.agency', industry: 'Marketing & Advertising', country: 'Australia', employee_count: '55', annual_revenue: '$4M', company_size: '51-200', growth_stage: 'Bootstrapped', technology_stack: ['HubSpot', 'Slack', 'Notion'], description: 'HubSpot Platinum Partner for APAC region.', opportunity_score: 76, growth_score: 66, icp_match_score: 78, priority: 'low', status: 'discovered' },
];

// ============================================================
// Generate Full Mock Data
// ============================================================

function generateMockCompanies(): Omit<DiscoveredCompany, 'id' | 'discovery_id' | 'created_at'>[] {
  return companyTemplates.map((c) => ({
    company_name: c.name,
    website: c.website,
    industry: c.industry,
    country: c.country,
    employee_count: c.employee_count,
    annual_revenue: c.annual_revenue,
    company_size: c.company_size,
    growth_stage: c.growth_stage,
    technology_stack: c.technology_stack,
    description: c.description,
    opportunity_score: c.opportunity_score,
    growth_score: c.growth_score,
    icp_match_score: c.icp_match_score,
    priority: c.priority,
    status: c.status,
  }));
}

export const MOCK_COMPANIES = generateMockCompanies();

// ============================================================
// Generate Company Scores
// ============================================================

export function generateMockScores(company: { opportunity_score: number; growth_score: number }): Omit<CompanyScore, 'id' | 'company_id' | 'created_at'> {
  const revenue_score = Math.min(100, Math.round(company.opportunity_score * 0.9 + Math.random() * 10));
  const competition_score = Math.min(100, Math.round(40 + Math.random() * 40));
  const technology_score = Math.min(100, Math.round(60 + Math.random() * 35));
  const market_score = Math.min(100, Math.round(company.growth_score * 0.85 + Math.random() * 15));
  const overall_score = Math.round(
    (revenue_score * 0.25 + company.growth_score * 0.2 + competition_score * 0.15 + technology_score * 0.15 + market_score * 0.25),
  );

  return {
    revenue_score,
    growth_score: company.growth_score,
    competition_score,
    technology_score,
    market_score,
    overall_score,
  };
}

export const MOCK_COMPANY_SCORES = MOCK_COMPANIES.map((c) => generateMockScores(c));

// ============================================================
// Generate Recommendations
// ============================================================

export const MOCK_RECOMMENDATIONS_DATA: Omit<ProspectRecommendation, 'id' | 'company_id' | 'created_at'>[] = MOCK_COMPANIES.map((c) => {
  if (c.priority === 'critical') {
    return {
      recommendation: `Initiate outbound immediately — ${c.company_name} shows 96%+ ICP match and active growth signals.`,
      priority: 'critical' as const,
      reason: 'Highest opportunity score with strong growth indicators and technology stack alignment.',
    };
  }
  if (c.priority === 'high') {
    return {
      recommendation: `Add ${c.company_name} to priority outreach queue — strong ICP match and growth trajectory.`,
      priority: 'high' as const,
      reason: 'High opportunity score with relevant technology stack and market positioning.',
    };
  }
  if (c.priority === 'medium') {
    return {
      recommendation: `Research ${c.company_name} further before outreach — moderate ICP match.`,
      priority: 'medium' as const,
      reason: 'Meets basic ICP criteria but may require additional qualification.',
    };
  }
  return {
    recommendation: `Monitor ${c.company_name} for future outreach — lower priority.`,
    priority: 'low' as const,
    reason: 'Below average ICP match or growth score. Keep in pipeline for future rounds.',
  };
});

// ============================================================
// Discovery Recommendations Summary
// ============================================================

export const MOCK_DISCOVERY_RECOMMENDATIONS: DiscoveryRecommendations = {
  executive_summary:
    'Discovery identified 50 companies matching the primary ICP (B2B SaaS Companies). 12 companies qualified as high-priority targets with ICP match scores above 85%. The top 5 companies — GrowthForge, ScaleMetrics, PipelineGenius, HubGrowth Partners, and CloudNative — show the strongest combination of opportunity score, growth trajectory, and technology stack alignment. Recommended next step: move the top 12 qualified companies to the Company Research Agent for deep enrichment and decision-maker identification.',
  recommended_companies: ['GrowthForge', 'ScaleMetrics', 'PipelineGenius', 'CloseRate', 'HubGrowth Partners'],
  priority_order: ['GrowthForge', 'ScaleMetrics', 'PipelineGenius', 'CloseRate', 'HubGrowth Partners', 'CloudNative', 'BuildSphere', 'DevOpsHub', 'DealCloud', 'RevPath', 'Digital Surgeons', 'GrowthLab'],
  best_opportunities: [
    'GrowthForge — 94 opportunity score, 96% ICP match, Series A funded, actively hiring SDRs',
    'ScaleMetrics — 92 opportunity score, 94% ICP match, using Salesforce + Outreach + Gong',
    'PipelineGenius — 90 opportunity score, 92% ICP match, AI-driven pipeline tool with strong growth',
    'HubGrowth Partners — 86 opportunity score, 88% ICP match, HubSpot Diamond Partner with RevOps focus',
    'CloudNative — 84 opportunity score, 82% ICP match, Series B funded, cloud-native IT services',
  ],
  suggested_next_action: 'Move the top 12 qualified companies to the Company Research Agent for deep enrichment, decision-maker identification, and Sales Navigator search building.',
};

// ============================================================
// Exclusion Records
// ============================================================

export const MOCK_EXCLUSIONS: ExclusionRecord[] = [
  { company_name: 'LocalBakery Inc.', reason: 'wrong_industry', details: 'Food & Beverage industry — does not match B2B SaaS ICP' },
  { company_name: 'TinyStartup LLC', reason: 'too_small', details: '3 employees — below minimum company size threshold (50+)' },
  { company_name: 'MegaCorp Industries', reason: 'too_large', details: '15,000 employees — above maximum company size threshold (500)' },
  { company_name: 'Outreach.io', reason: 'competitor', details: 'Direct competitor — excluded from prospecting' },
  { company_name: 'SalesLoft Inc.', reason: 'competitor', details: 'Direct competitor — excluded from prospecting' },
  { company_name: 'Duplicate Co.', reason: 'duplicate', details: 'Already exists in CRM as "Duplicate Company"' },
  { company_name: 'LowBudget SaaS', reason: 'wrong_revenue', details: '$200K ARR — below revenue threshold ($2M+)' },
  { company_name: 'OffshoreDev Ltd.', reason: 'wrong_country', details: 'Based in India — outside target regions (US, UK, CA, AU, DE, NL)' },
];

// ============================================================
// Company Enrichment Data (for Business Info tab)
// ============================================================

export const MOCK_ENRICHMENT_DATA: Record<string, CompanyEnrichmentResult> = {
  GrowthForge: {
    company_name: 'GrowthForge',
    description: 'AI-powered sales enablement platform that helps mid-market SaaS companies automate outreach, track engagement, and close deals faster. Founded in 2021, headquartered in San Francisco.',
    products: ['GrowthForge Platform', 'AI Outreach Assistant', 'Sales Analytics Dashboard', 'Meeting Scheduler'],
    services: ['Sales enablement consulting', 'CRM integration setup', 'Custom workflow automation', 'Training and onboarding'],
    business_model: 'SaaS Subscription (annual contracts, per-seat pricing)',
    markets: ['North America', 'EMEA', 'APAC'],
    industries: ['B2B SaaS', 'Sales Technology', 'RevTech'],
    technology_stack: ['Salesforce', 'HubSpot', 'Outreach', 'Slack', 'AWS', 'React', 'Node.js', 'PostgreSQL'],
  },
  ScaleMetrics: {
    company_name: 'ScaleMetrics',
    description: 'Revenue intelligence platform that provides real-time analytics, forecasting, and pipeline optimization for sales teams. Series A funded, 120 employees.',
    products: ['Revenue Intelligence Platform', 'Pipeline Forecaster', 'Deal Analytics', 'Team Performance Tracker'],
    services: ['Revenue operations consulting', 'Data integration', 'Custom reporting', 'Sales process optimization'],
    business_model: 'SaaS Subscription (monthly and annual plans)',
    markets: ['North America', 'Europe'],
    industries: ['B2B SaaS', 'Sales Technology', 'Analytics'],
    technology_stack: ['Salesforce', 'Gong', 'Outreach', 'Zoom', 'GCP', 'Python', 'BigQuery'],
  },
};

// ============================================================
// Technology Stack Data (for Technology Stack tab)
// ============================================================

export const MOCK_TECH_STACKS: Record<string, TechnologyStackResult> = {
  GrowthForge: {
    frontend: ['React', 'TypeScript', 'Tailwind CSS'],
    backend: ['Node.js', 'Express', 'GraphQL'],
    crm: ['Salesforce', 'HubSpot'],
    marketing_stack: ['HubSpot', 'Google Ads'],
    sales_tools: ['Outreach', 'Gong', 'Zoom'],
    cloud_platform: ['AWS', 'Vercel'],
    ai_tools: ['OpenAI', 'LangChain'],
  },
  ScaleMetrics: {
    frontend: ['Vue.js', 'TypeScript'],
    backend: ['Python', 'FastAPI', 'PostgreSQL'],
    crm: ['Salesforce'],
    marketing_stack: ['HubSpot', 'Marketo'],
    sales_tools: ['Outreach', 'Gong', 'Zoom'],
    cloud_platform: ['GCP', 'BigQuery'],
    ai_tools: ['OpenAI', 'TensorFlow'],
  },
};

// ============================================================
// Default enrichment (fallback for companies without specific data)
// ============================================================

export function getEnrichmentForCompany(companyName: string): CompanyEnrichmentResult {
  return MOCK_ENRICHMENT_DATA[companyName] ?? {
    company_name: companyName,
    description: `${companyName} is a company in the B2B SaaS space.`,
    products: ['Core Platform'],
    services: ['Consulting', 'Implementation', 'Support'],
    business_model: 'SaaS Subscription',
    markets: ['North America'],
    industries: ['B2B SaaS'],
    technology_stack: [],
  };
}

export function getTechStackForCompany(companyName: string): TechnologyStackResult {
  return MOCK_TECH_STACKS[companyName] ?? {
    frontend: [],
    backend: [],
    crm: [],
    marketing_stack: [],
    sales_tools: [],
    cloud_platform: [],
    ai_tools: [],
  };
}
