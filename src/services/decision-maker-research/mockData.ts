// ============================================================
// Mock Data — Decision Maker Research Agent
// ============================================================
//
// Realistic decision maker research data for 20 companies.
// Each company has 5-8 stakeholders with full profiles.
// Simulates what LinkedIn + Sales Navigator + Apollo + Clearbit
// + OpenAI + Tavily would produce.

import type {
  DecisionMakerResearch,
  Contact,
  ContactProfile,
  LinkedInActivity,
  BuyingCommittee,
  Recommendation,
  DMResearchStageInfo,
  DMRecommendations,
  BuyingRole,
  ContactPriority,
} from '@/types/decision-maker-research';

// ============================================================
// Pipeline Stages
// ============================================================

export const DM_STAGES: DMResearchStageInfo[] = [
  { stage: 'loading_company', label: 'Loading Company', description: 'Loading company from Company Research Agent' },
  { stage: 'identifying_committee', label: 'Building Buying Committee', description: 'Identifying buying committee structure' },
  { stage: 'identifying_decision_makers', label: 'Identifying Decision Makers', description: 'Finding key stakeholders via LinkedIn and Sales Navigator' },
  { stage: 'researching_profiles', label: 'Researching Profiles', description: 'Enriching contact profiles with Apollo and Clearbit' },
  { stage: 'analyzing_activity', label: 'Analyzing Activity', description: 'Analyzing LinkedIn activity and professional background' },
  { stage: 'calculating_scores', label: 'Calculating Scores', description: 'Computing influence, relationship, and outreach readiness scores' },
  { stage: 'generating_recommendations', label: 'Generating Recommendations', description: 'Creating AI-powered outreach recommendations' },
  { stage: 'saving_results', label: 'Saving Results', description: 'Persisting research to the database' },
];

// ============================================================
// Helpers
// ============================================================

function contact(
  first_name: string,
  last_name: string,
  job_title: string,
  department: string,
  seniority: string,
  buying_role: BuyingRole,
  decision_power: number,
  activity_score: number,
  influence_score: number,
  relationship_score: number,
  outreach_readiness: number,
  priority: ContactPriority,
  linkedin_url: string,
  email: string,
): Omit<Contact, 'id' | 'research_id' | 'created_at'> {
  return {
    first_name, last_name, linkedin_url, email,
    phone: null,
    job_title, department, seniority, buying_role,
    decision_power, activity_score, influence_score, relationship_score, outreach_readiness,
    priority, status: 'researched',
  };
}

function profile(
  location: string,
  years_current_role: string,
  years_company: string,
  education: string[],
  skills: string[],
  certifications: string[],
  previous_companies: string[],
): Omit<ContactProfile, 'id' | 'contact_id' | 'created_at'> {
  return { location, years_current_role, years_company, education, skills, certifications, previous_companies };
}

function activity(
  post_frequency: string,
  engagement_score: number,
  thought_leadership_score: number,
  primary_topics: string[],
  last_active: string,
): Omit<LinkedInActivity, 'id' | 'contact_id' | 'created_at'> {
  return { post_frequency, engagement_score, thought_leadership_score, primary_topics, last_active };
}

function rec(
  recommendation: string,
  priority: ContactPriority,
  reason: string,
): Omit<Recommendation, 'id' | 'contact_id' | 'created_at'> {
  return { recommendation, priority, reason };
}

// ============================================================
// Mock Company Research Data
// ============================================================

export interface MockDMResearch {
  research: Omit<DecisionMakerResearch, 'id' | 'workspace_id' | 'company_id' | 'created_at' | 'updated_at'>;
  company_name: string;
  company_industry: string;
  company_website: string;
  company_employees: string;
  company_revenue: string;
  company_growth_stage: string;
  contacts: {
    contact: Omit<Contact, 'id' | 'research_id' | 'created_at'>;
    profile: Omit<ContactProfile, 'id' | 'contact_id' | 'created_at'>;
    activity: Omit<LinkedInActivity, 'id' | 'contact_id' | 'created_at'>;
    recommendation: Omit<Recommendation, 'id' | 'contact_id' | 'created_at'>;
  }[];
  buying_committee: Omit<BuyingCommittee, 'id' | 'research_id' | 'created_at'>;
  recommendations: DMRecommendations;
}

// ============================================================
// Company 1: CloudFlow Inc — 7 stakeholders
// ============================================================

const company1: MockDMResearch = {
  research: {
    status: 'completed',
    research_score: 91,
    confidence_score: 87,
    error_message: null,
  },
  company_name: 'CloudFlow Inc',
  company_industry: 'Computer Software',
  company_website: 'cloudflow.io',
  company_employees: '180',
  company_revenue: '$25M',
  company_growth_stage: 'Series B',
  contacts: [
    {
      contact: contact('Sarah', 'Chen', 'Chief Executive Officer', 'Leadership', 'CXO', 'economic_buyer', 95, 78, 92, 45, 88, 'critical', 'linkedin.com/in/sarahchen', 'sarah@cloudflow.io'),
      profile: profile('San Francisco, CA', '5', '5', ['Stanford University — MBA', 'UC Berkeley — BS Computer Science'], ['Strategic Planning', 'SaaS Growth', 'Fundraising', 'Go-to-Market Strategy'], [], ['Salesforce', 'Google', 'McKinsey']),
      activity: activity('2-3 posts/week', 82, 78, ['SaaS Growth', 'Revenue Operations', 'AI in Sales', 'Leadership'], '3 days ago'),
      recommendation: rec('Primary contact — approach first with executive-level pitch on revenue impact', 'critical', 'Economic buyer with high decision power and strong LinkedIn presence'),
    },
    {
      contact: contact('Michael', 'Torres', 'Chief Revenue Officer', 'Sales', 'CXO', 'economic_buyer', 88, 75, 85, 52, 85, 'critical', 'linkedin.com/in/michaeltorres', 'michael@cloudflow.io'),
      profile: profile('San Francisco, CA', '2', '3', ['Wharton — MBA', 'UCLA — BA Economics'], ['Revenue Operations', 'Sales Strategy', 'Pipeline Management', 'Sales Enablement'], ['Certified Sales Leader'], ['Outreach.io', 'Gong', 'ZoomInfo']),
      activity: activity('1-2 posts/week', 70, 65, ['Revenue Operations', 'Sales Tech', 'SDR Management', 'Forecasting'], '1 week ago'),
      recommendation: rec('Secondary contact — co-approach with CEO for revenue-focused discussion', 'critical', 'Shares economic buyer role, strong focus on RevOps and sales tech'),
    },
    {
      contact: contact('Jennifer', 'Park', 'VP of Engineering', 'Engineering', 'VP', 'technical_buyer', 82, 80, 78, 38, 82, 'high', 'linkedin.com/in/jenniferpark', 'jennifer@cloudflow.io'),
      profile: profile('San Francisco, CA', '3', '4', ['MIT — MS Computer Science', 'Stanford — BS Computer Science'], ['System Architecture', 'Cloud Infrastructure', 'API Design', 'Scalability'], ['AWS Solutions Architect'], ['Snowflake', 'Paddle', 'Airbnb']),
      activity: activity('3-4 posts/week', 88, 85, ['Cloud Architecture', 'Engineering Leadership', 'API Design', 'Developer Experience'], '2 days ago'),
      recommendation: rec('Technical buyer — engage with technical integration and architecture discussion', 'high', 'Strong technical influence and active LinkedIn presence on engineering topics'),
    },
    {
      contact: contact('David', 'Kim', 'Head of RevOps', 'Revenue Operations', 'Director', 'champion', 72, 85, 80, 60, 90, 'high', 'linkedin.com/in/davidkim', 'david@cloudflow.io'),
      profile: profile('Austin, TX', '2', '2', ['UT Austin — MS Data Analytics', 'Texas A&M — BS Statistics'], ['Revenue Operations', 'Sales Analytics', 'CRM Administration', 'Process Automation'], ['Salesforce Admin Advanced'], ['HubSpot', 'Tableau', 'Deloitte']),
      activity: activity('4-5 posts/week', 92, 88, ['RevOps', 'Sales Analytics', 'CRM Best Practices', 'Data-Driven Sales'], '1 day ago'),
      recommendation: rec('Champion — cultivate as internal advocate for your solution', 'high', 'Highest activity score, strong RevOps thought leadership, likely to champion new tools'),
    },
    {
      contact: contact('Emily', 'Rodriguez', 'Director of Sales Development', 'Sales', 'Director', 'influencer', 68, 72, 70, 42, 78, 'medium', 'linkedin.com/in/emilyrodriguez', 'emily@cloudflow.io'),
      profile: profile('Austin, TX', '3', '3', ['Northwestern — BA Communications'], ['SDR Management', 'Outbound Strategy', 'Sales Coaching', 'Lead Generation'], [], ['Outreach.io', 'SalesLoft', 'Drift']),
      activity: activity('1-2 posts/week', 65, 60, ['SDR Management', 'Outbound Sales', 'Sales Coaching'], '5 days ago'),
      recommendation: rec('Influencer — involve in SDR team workflow discussion', 'medium', 'Manages SDR team and influences tool selection for outbound'),
    },
    {
      contact: contact('Robert', 'Williams', 'Chief Technology Officer', 'Engineering', 'CXO', 'technical_buyer', 85, 70, 82, 35, 80, 'high', 'linkedin.com/in/robertwilliams', 'robert@cloudflow.io'),
      profile: profile('San Francisco, CA', '4', '4', ['Carnegie Mellon — PhD Computer Science'], ['System Design', 'AI/ML', 'Cloud Architecture', 'Engineering Management'], ['AWS Solutions Architect Professional'], ['Google', 'Amazon', 'Microsoft']),
      activity: activity('1 post/week', 60, 72, ['AI/ML', 'Cloud Architecture', 'Engineering Culture'], '1 week ago'),
      recommendation: rec('Technical buyer — co-engage with VP Engineering for technical validation', 'high', 'Final technical decision-maker, less active but high authority'),
    },
    {
      contact: contact('Lisa', 'Anderson', 'VP of Marketing', 'Marketing', 'VP', 'influencer', 65, 78, 75, 48, 75, 'medium', 'linkedin.com/in/lisaanderson', 'lisa@cloudflow.io'),
      profile: profile('San Francisco, CA', '2', '3', ['NYU — MBA Marketing', 'Boston University — BA Psychology'], ['Demand Generation', 'Content Marketing', 'Brand Strategy', 'Marketing Automation'], ['HubSpot Inbound Certified'], ['Marketo', 'Drift', 'Seismic']),
      activity: activity('3-4 posts/week', 85, 80, ['Demand Gen', 'Marketing Automation', 'B2B Marketing', 'Content Strategy'], '2 days ago'),
      recommendation: rec('Influencer — engage for marketing-side alignment and cross-functional buy-in', 'medium', 'Active on LinkedIn, influences budget allocation and tool adoption'),
    },
  ],
  buying_committee: {
    economic_buyer: 'Sarah Chen (CEO), Michael Torres (CRO)',
    technical_buyer: 'Jennifer Park (VP Eng), Robert Williams (CTO)',
    champion: 'David Kim (Head of RevOps)',
    influencer: 'Emily Rodriguez (Dir. SDR), Lisa Anderson (VP Marketing)',
    evaluator: 'Jennifer Park (VP Eng)',
    blocker: null,
    procurement: null,
  },
  recommendations: {
    executive_summary: 'CloudFlow has a well-defined buying committee with clear economic buyers (CEO + CRO), strong technical buyers (VP Eng + CTO), and an ideal champion candidate (Head of RevOps). The team is highly active on LinkedIn and uses compatible tools (Salesforce, Outreach, Gong). Recommend immediate outreach to CEO and CRO, with RevOps Head as internal champion.',
    primary_contact: 'Sarah Chen — CEO (Economic Buyer, Decision Power: 95/100)',
    secondary_contacts: ['Michael Torres — CRO (Economic Buyer)', 'David Kim — Head of RevOps (Champion)', 'Jennifer Park — VP Engineering (Technical Buyer)'],
    recommended_outreach_order: ['Sarah Chen (CEO)', 'Michael Torres (CRO)', 'David Kim (Head of RevOps)', 'Jennifer Park (VP Eng)', 'Lisa Anderson (VP Marketing)'],
    recommended_communication_style: 'Executive-level, data-driven, ROI-focused. Lead with revenue impact metrics and case studies from similar SaaS companies. Keep initial outreach concise (under 100 words).',
    recommended_next_action: 'Initiate outreach to Sarah Chen (CEO) and Michael Torres (CRO) with executive summary of value proposition. Simultaneously nurture David Kim as champion with technical workflow discussion.',
  },
};

// ============================================================
// Helper: Generate compact company data
// ============================================================

function makeDMCompany(
  name: string,
  industry: string,
  website: string,
  employees: string,
  revenue: string,
  stage: string,
  score: number,
  confidence: number,
  stakeholders: { first: string; last: string; title: string; dept: string; seniority: string; role: BuyingRole; dp: number; act: number; inf: number; rel: number; ready: number; pri: ContactPriority; linkedin: string; email: string; loc: string; yrsRole: string; yrsCo: string; edu: string[]; skills: string[]; prev: string[]; topics: string[]; thought: number; freq: string; lastActive: string; rec: string; recPri: ContactPriority; recReason: string }[],
  committee: { eb: string; tb: string; champ: string; infl: string; eval: string; block: string | null; proc: string | null },
  execSummary: string,
): MockDMResearch {
  return {
    research: { status: 'completed' as const, research_score: score, confidence_score: confidence, error_message: null },
    company_name: name,
    company_industry: industry,
    company_website: website,
    company_employees: employees,
    company_revenue: revenue,
    company_growth_stage: stage,
    contacts: stakeholders.map((s) => ({
      contact: contact(s.first, s.last, s.title, s.dept, s.seniority, s.role, s.dp, s.act, s.inf, s.rel, s.ready, s.pri, s.linkedin, s.email),
      profile: profile(s.loc, s.yrsRole, s.yrsCo, s.edu, s.skills, [], s.prev),
      activity: activity(s.freq, s.act, s.thought, s.topics, s.lastActive),
      recommendation: rec(s.rec, s.recPri, s.recReason),
    })),
    buying_committee: {
      economic_buyer: committee.eb,
      technical_buyer: committee.tb,
      champion: committee.champ,
      influencer: committee.infl,
      evaluator: committee.eval,
      blocker: committee.block,
      procurement: committee.proc,
    },
    recommendations: {
      executive_summary: execSummary,
      primary_contact: stakeholders[0] ? `${stakeholders[0].first} ${stakeholders[0].last} — ${stakeholders[0].title}` : '',
      secondary_contacts: stakeholders.slice(1, 4).map((s) => `${s.first} ${s.last} — ${s.title}`),
      recommended_outreach_order: stakeholders.slice(0, 5).map((s) => `${s.first} ${s.last} (${s.title})`),
      recommended_communication_style: 'Data-driven, ROI-focused outreach with concise initial messaging.',
      recommended_next_action: 'Initiate outreach to primary contact with executive value proposition.',
    },
  };
}

// ============================================================
// Companies 2-20: Compact mock data
// ============================================================

const company2 = makeDMCompany('DataSync Solutions', 'IT Services', 'datasync.com', '320', '$40M', 'Series C', 86, 82,
  [
    { first: 'James', last: 'Foster', title: 'Chief Executive Officer', dept: 'Leadership', seniority: 'CXO', role: 'economic_buyer', dp: 92, act: 72, inf: 88, rel: 40, ready: 85, pri: 'critical', linkedin: 'linkedin.com/in/jamesfoster', email: 'james@datasync.com', loc: 'Austin, TX', yrsRole: '4', yrsCo: '4', edu: ['Harvard — MBA'], skills: ['Enterprise SaaS', 'Data Strategy', 'Leadership'], prev: ['IBM', 'Oracle'], topics: ['Data Integration', 'Enterprise SaaS', 'Leadership'], thought: 72, freq: '1-2 posts/week', lastActive: '5 days ago', rec: 'Primary contact — approach with enterprise data strategy pitch', recPri: 'critical', recReason: 'Economic buyer with strong enterprise background' },
    { first: 'Maria', last: 'Gonzalez', title: 'CTO', dept: 'Engineering', seniority: 'CXO', role: 'technical_buyer', dp: 85, act: 68, inf: 80, rel: 35, ready: 78, pri: 'high', linkedin: 'linkedin.com/in/mariagonzalez', email: 'maria@datasync.com', loc: 'Austin, TX', yrsRole: '3', yrsCo: '3', edu: ['Stanford — MS CS'], skills: ['Cloud Architecture', 'Data Engineering', 'GCP'], prev: ['Google', 'Snowflake'], topics: ['Cloud Architecture', 'Data Engineering'], thought: 65, freq: '1 post/week', lastActive: '1 week ago', rec: 'Technical buyer — engage on GCP-native architecture', recPri: 'high', recReason: 'CTO with strong cloud and data engineering background' },
    { first: 'Tom', last: 'Anderson', title: 'VP of Sales', dept: 'Sales', seniority: 'VP', role: 'economic_buyer', dp: 78, act: 75, inf: 76, rel: 50, ready: 82, pri: 'high', linkedin: 'linkedin.com/in/tomanderson', email: 'tom@datasync.com', loc: 'New York, NY', yrsRole: '2', yrsCo: '2', edu: ['Kellogg — MBA'], skills: ['Enterprise Sales', 'Pipeline Management'], prev: ['Salesforce', 'Oracle'], topics: ['Enterprise Sales', 'Data Platforms'], thought: 70, freq: '2 posts/week', lastActive: '3 days ago', rec: 'Secondary contact — co-approach for sales alignment', recPri: 'high', recReason: 'VP Sales with enterprise deal experience' },
    { first: 'Priya', last: 'Sharma', title: 'Head of Data Engineering', dept: 'Engineering', seniority: 'Director', role: 'champion', dp: 70, act: 82, inf: 75, rel: 55, ready: 85, pri: 'high', linkedin: 'linkedin.com/in/priyasharma', email: 'priya@datasync.com', loc: 'Austin, TX', yrsRole: '3', yrsCo: '3', edu: ['Georgia Tech — MS CS'], skills: ['Data Pipelines', 'ETL', 'Python', 'Airflow'], prev: ['Airbnb', 'Lyft'], topics: ['Data Engineering', 'ETL', 'Python', 'Open Source'], thought: 85, freq: '4 posts/week', lastActive: '1 day ago', rec: 'Champion — cultivate as technical advocate', recPri: 'high', recReason: 'Highly active, strong technical thought leadership' },
    { first: 'Chris', last: 'Lee', title: 'Director of Customer Success', dept: 'Customer Success', seniority: 'Director', role: 'influencer', dp: 60, act: 70, inf: 65, rel: 45, ready: 72, pri: 'medium', linkedin: 'linkedin.com/in/chrislee', email: 'chris@datasync.com', loc: 'Toronto, CA', yrsRole: '2', yrsCo: '3', edu: ['Waterloo — BMath'], skills: ['Customer Success', 'Onboarding', 'Retention'], prev: ['Shopify'], topics: ['Customer Success', 'Data Quality'], thought: 60, freq: '1 post/week', lastActive: '1 week ago', rec: 'Influencer — engage for customer-facing use cases', recPri: 'medium', recReason: 'Influences tool adoption from customer perspective' },
  ],
  { eb: 'James Foster (CEO)', tb: 'Maria Gonzalez (CTO)', champ: 'Priya Sharma (Head of Data Eng)', infl: 'Tom Anderson (VP Sales), Chris Lee (Dir. CS)', eval: 'Maria Gonzalez (CTO)', block: null, proc: null },
  'DataSync has a strong technical buying committee led by CTO and Head of Data Engineering. CEO is the economic buyer with enterprise background. Champion candidate is highly active on LinkedIn.',
);

const company3 = makeDMCompany('OutreachPro', 'Computer Software', 'outreachpro.com', '95', '$8M', 'Seed', 75, 70,
  [
    { first: 'Alex', last: 'Morgan', title: 'Founder & CEO', dept: 'Leadership', seniority: 'CXO', role: 'economic_buyer', dp: 90, act: 78, inf: 82, rel: 50, ready: 85, pri: 'critical', linkedin: 'linkedin.com/in/alexmorgan', email: 'alex@outreachpro.com', loc: 'Denver, CO', yrsRole: '4', yrsCo: '4', edu: ['CU Boulder — BA Business'], skills: ['SaaS Growth', 'Sales Engagement', 'Startup Leadership'], prev: ['TechStars'], topics: ['SaaS', 'Sales Engagement', 'Startup Life'], thought: 75, freq: '2-3 posts/week', lastActive: '3 days ago', rec: 'Primary contact — approach with SMB-focused value prop', recPri: 'critical', recReason: 'Founder and sole economic buyer' },
    { first: 'Jordan', last: 'Blake', title: 'Head of Sales', dept: 'Sales', seniority: 'Director', role: 'champion', dp: 72, act: 80, inf: 75, rel: 58, ready: 88, pri: 'high', linkedin: 'linkedin.com/in/jordanblake', email: 'jordan@outreachpro.com', loc: 'Denver, CO', yrsRole: '2', yrsCo: '2', edu: ['Denver — BA Marketing'], skills: ['SMB Sales', 'Outbound', 'HubSpot'], prev: ['HubSpot'], topics: ['SMB Sales', 'Outbound Strategy', 'HubSpot'], thought: 78, freq: '3-4 posts/week', lastActive: '2 days ago', rec: 'Champion — strong advocate for new sales tools', recPri: 'high', recReason: 'Highly active, manages sales tool selection' },
    { first: 'Sam', last: 'Taylor', title: 'VP of Product', dept: 'Product', seniority: 'VP', role: 'technical_buyer', dp: 75, act: 65, inf: 70, rel: 40, ready: 75, pri: 'medium', linkedin: 'linkedin.com/in/samtaylor', email: 'sam@outreachpro.com', loc: 'Denver, CO', yrsRole: '3', yrsCo: '3', edu: ['MIT — MS Engineering'], skills: ['Product Management', 'UX', 'API Design'], prev: ['Google'], topics: ['Product Management', 'UX', 'API Design'], thought: 68, freq: '1 post/week', lastActive: '1 week ago', rec: 'Technical buyer — engage on product integration', recPri: 'medium', recReason: 'VP Product evaluates technical integrations' },
    { first: 'Riley', last: 'Cohen', title: 'Marketing Director', dept: 'Marketing', seniority: 'Director', role: 'influencer', dp: 55, act: 75, inf: 68, rel: 45, ready: 72, pri: 'medium', linkedin: 'linkedin.com/in/rileycohen', email: 'riley@outreachpro.com', loc: 'Denver, CO', yrsRole: '2', yrsCo: '2', edu: ['Colorado State — BA Communications'], skills: ['Content Marketing', 'Demand Gen', 'Social Media'], prev: ['Drift'], topics: ['Content Marketing', 'Demand Gen', 'B2B SaaS'], thought: 72, freq: '3 posts/week', lastActive: '4 days ago', rec: 'Influencer — engage for marketing alignment', recPri: 'medium', recReason: 'Influences marketing tool budget' },
  ],
  { eb: 'Alex Morgan (CEO)', tb: 'Sam Taylor (VP Product)', champ: 'Jordan Blake (Head of Sales)', infl: 'Riley Cohen (Marketing Dir)', eval: 'Sam Taylor (VP Product)', block: null, proc: null },
  'OutreachPro is a smaller company with a lean buying committee. Founder/CEO is the sole economic buyer. Head of Sales is an excellent champion candidate with high LinkedIn activity.',
);

const company4 = makeDMCompany('PipelineGenius', 'Computer Software', 'pipelinegenius.com', '240', '$30M', 'Series B', 88, 84,
  [
    { first: 'Daniel', last: 'Brooks', title: 'CEO', dept: 'Leadership', seniority: 'CXO', role: 'economic_buyer', dp: 93, act: 75, inf: 88, rel: 42, ready: 86, pri: 'critical', linkedin: 'linkedin.com/in/danielbrooks', email: 'daniel@pipelinegenius.com', loc: 'Seattle, WA', yrsRole: '6', yrsCo: '6', edu: ['Stanford — MBA', 'Berkeley — BS EECS'], skills: ['SaaS Strategy', 'Product-Led Growth', 'Enterprise Sales'], prev: ['Microsoft', 'Amazon'], topics: ['SaaS', 'Product-Led Growth', 'AI in Sales'], thought: 78, freq: '2 posts/week', lastActive: '4 days ago', rec: 'Primary contact — approach with strategic growth pitch', recPri: 'critical', recReason: 'CEO with strong tech background and growth focus' },
    { first: 'Nathan', last: 'Reed', title: 'CRO', dept: 'Sales', seniority: 'CXO', role: 'economic_buyer', dp: 85, act: 78, inf: 82, rel: 55, ready: 85, pri: 'critical', linkedin: 'linkedin.com/in/nathanreed', email: 'nathan@pipelinegenius.com', loc: 'Seattle, WA', yrsRole: '3', yrsCo: '3', edu: ['Wharton — MBA'], skills: ['Revenue Operations', 'Sales Strategy', 'Enterprise Deals'], prev: ['Salesforce', 'Gong'], topics: ['Revenue Operations', 'Sales Forecasting', 'RevOps'], thought: 80, freq: '3 posts/week', lastActive: '2 days ago', rec: 'Secondary contact — co-approach for revenue alignment', recPri: 'critical', recReason: 'CRO with RevOps expertise and high activity' },
    { first: 'Sophie', last: 'Lambert', title: 'VP of RevOps', dept: 'Revenue Operations', seniority: 'VP', role: 'champion', dp: 75, act: 85, inf: 78, rel: 62, ready: 90, pri: 'high', linkedin: 'linkedin.com/in/sophielambert', email: 'sophie@pipelinegenius.com', loc: 'Seattle, WA', yrsRole: '2', yrsCo: '2', edu: ['UT Austin — MS Analytics'], skills: ['RevOps', 'Salesforce Admin', 'Data Analysis', 'Process Automation'], prev: ['Tableau', 'Deloitte'], topics: ['RevOps', 'Salesforce', 'Pipeline Analytics', 'Automation'], thought: 88, freq: '5 posts/week', lastActive: '1 day ago', rec: 'Champion — ideal internal advocate with highest activity', recPri: 'high', recReason: 'Most active LinkedIn user, strong RevOps thought leadership' },
    { first: 'Marcus', last: 'Webb', title: 'CTO', dept: 'Engineering', seniority: 'CXO', role: 'technical_buyer', dp: 82, act: 65, inf: 78, rel: 35, ready: 78, pri: 'high', linkedin: 'linkedin.com/in/marcuswebb', email: 'marcus@pipelinegenius.com', loc: 'Seattle, WA', yrsRole: '5', yrsCo: '5', edu: ['Carnegie Mellon — PhD CS'], skills: ['System Architecture', 'AI/ML', 'Cloud Infrastructure'], prev: ['Google', 'Amazon'], topics: ['AI/ML', 'Cloud Architecture', 'Engineering Culture'], thought: 70, freq: '1 post/week', lastActive: '1 week ago', rec: 'Technical buyer — engage on architecture and AI capabilities', recPri: 'high', recReason: 'CTO with AI/ML expertise, final technical decision-maker' },
    { first: 'Olivia', last: 'Hayes', title: 'Director of Sales', dept: 'Sales', seniority: 'Director', role: 'influencer', dp: 68, act: 72, inf: 70, rel: 48, ready: 78, pri: 'medium', linkedin: 'linkedin.com/in/oliviahayes', email: 'olivia@pipelinegenius.com', loc: 'Seattle, WA', yrsRole: '3', yrsCo: '3', edu: ['UW — BA Business'], skills: ['Enterprise Sales', 'Account Management', 'Pipeline Management'], prev: ['Oracle'], topics: ['Enterprise Sales', 'Account Management'], thought: 65, freq: '2 posts/week', lastActive: '5 days ago', rec: 'Influencer — engage for sales team workflow', recPri: 'medium', recReason: 'Manages sales team and influences tool adoption' },
  ],
  { eb: 'Daniel Brooks (CEO), Nathan Reed (CRO)', tb: 'Marcus Webb (CTO)', champ: 'Sophie Lambert (VP RevOps)', infl: 'Olivia Hayes (Dir. Sales)', eval: 'Marcus Webb (CTO)', block: null, proc: null },
  'PipelineGenius has an excellent buying committee with dual economic buyers (CEO + CRO), a strong technical buyer (CTO), and an ideal champion (VP RevOps). High LinkedIn activity across the team.',
);

const company5 = makeDMCompany('RevMomentum', 'Computer Software', 'revmomentum.io', '150', '$18M', 'Series A', 85, 80,
  [
    { first: 'Kevin', last: 'Patel', title: 'CEO & Founder', dept: 'Leadership', seniority: 'CXO', role: 'economic_buyer', dp: 90, act: 72, inf: 85, rel: 45, ready: 84, pri: 'critical', linkedin: 'linkedin.com/in/kevinpatel', email: 'kevin@revmomentum.io', loc: 'Boston, MA', yrsRole: '5', yrsCo: '5', edu: ['MIT — MBA'], skills: ['RevOps', 'SaaS Growth', 'Go-to-Market'], prev: ['HubSpot', 'Drift'], topics: ['RevOps', 'SaaS Growth', 'GTM Strategy'], thought: 75, freq: '2 posts/week', lastActive: '3 days ago', rec: 'Primary contact — approach with RevOps-focused pitch', recPri: 'critical', recReason: 'Founder-CEO with RevOps expertise' },
    { first: 'Rachel', last: 'Green', title: 'VP of Sales', dept: 'Sales', seniority: 'VP', role: 'economic_buyer', dp: 80, act: 78, inf: 78, rel: 52, ready: 85, pri: 'high', linkedin: 'linkedin.com/in/rachelgreen', email: 'rachel@revmomentum.io', loc: 'Boston, MA', yrsRole: '2', yrsCo: '2', edu: ['Harvard — MBA'], skills: ['Sales Strategy', 'Team Building', 'Forecasting'], prev: ['Gong', 'Outreach'], topics: ['Sales Strategy', 'RevOps', 'Team Building'], thought: 72, freq: '2-3 posts/week', lastActive: '4 days ago', rec: 'Secondary contact — co-approach for sales alignment', recPri: 'high', recReason: 'VP Sales with strong RevOps alignment' },
    { first: 'Andrew', last: 'Clark', title: 'Head of Growth', dept: 'Growth', seniority: 'Director', role: 'champion', dp: 72, act: 88, inf: 80, rel: 60, ready: 90, pri: 'high', linkedin: 'linkedin.com/in/andrewclark', email: 'andrew@revmomentum.io', loc: 'Boston, MA', yrsRole: '2', yrsCo: '2', edu: ['Tufts — BA Economics'], skills: ['Growth Marketing', 'PLG', 'Analytics', 'Experimentation'], prev: ['HubSpot', 'Drift'], topics: ['Growth', 'PLG', 'Analytics', 'Experimentation'], thought: 90, freq: '5 posts/week', lastActive: '1 day ago', rec: 'Champion — highest activity, ideal growth-focused advocate', recPri: 'high', recReason: 'Most active LinkedIn user, strong growth thought leadership' },
    { first: 'Hannah', last: 'Sullivan', title: 'VP of Marketing', dept: 'Marketing', seniority: 'VP', role: 'influencer', dp: 65, act: 80, inf: 75, rel: 48, ready: 78, pri: 'medium', linkedin: 'linkedin.com/in/hannahsullivan', email: 'hannah@revmomentum.io', loc: 'Boston, MA', yrsRole: '2', yrsCo: '2', edu: ['BC — MBA Marketing'], skills: ['Demand Gen', 'Content Marketing', 'Brand'], prev: ['Marketo'], topics: ['Demand Gen', 'B2B Marketing', 'Content Strategy'], thought: 82, freq: '4 posts/week', lastActive: '2 days ago', rec: 'Influencer — engage for marketing alignment', recPri: 'medium', recReason: 'Active VP Marketing with demand gen focus' },
  ],
  { eb: 'Kevin Patel (CEO)', tb: null, champ: 'Andrew Clark (Head of Growth)', infl: 'Hannah Sullivan (VP Marketing)', eval: 'Rachel Green (VP Sales)', block: null, proc: null },
  'RevMomentum has a lean but highly active buying committee. Founder-CEO is the economic buyer. Head of Growth is an exceptional champion candidate with the highest LinkedIn activity.',
);

const company6 = makeDMCompany('ConversionLab', 'Internet', 'conversionlab.com', '110', '$12M', 'Series A', 82, 78,
  [
    { first: 'Brian', last: 'Nguyen', title: 'CEO', dept: 'Leadership', seniority: 'CXO', role: 'economic_buyer', dp: 88, act: 70, inf: 82, rel: 40, ready: 82, pri: 'critical', linkedin: 'linkedin.com/in/briannguyen', email: 'brian@conversionlab.com', loc: 'New York, NY', yrsRole: '5', yrsCo: '5', edu: ['Columbia — MBA'], skills: ['A/B Testing', 'SaaS Growth', 'Product'], prev: ['Google'], topics: ['Conversion', 'A/B Testing', 'SaaS'], thought: 72, freq: '1-2 posts/week', lastActive: '1 week ago', rec: 'Primary contact — approach with conversion-focused pitch', recPri: 'critical', recReason: 'CEO with conversion optimization expertise' },
    { first: 'Laura', last: 'Bennett', title: 'VP of Product', dept: 'Product', seniority: 'VP', role: 'technical_buyer', dp: 78, act: 75, inf: 75, rel: 45, ready: 80, pri: 'high', linkedin: 'linkedin.com/in/laurabennett', email: 'laura@conversionlab.com', loc: 'New York, NY', yrsRole: '3', yrsCo: '3', edu: ['Stanford — MS Design'], skills: ['Product Management', 'UX Research', 'A/B Testing'], prev: ['Airbnb'], topics: ['Product Management', 'UX', 'A/B Testing'], thought: 78, freq: '2 posts/week', lastActive: '5 days ago', rec: 'Technical buyer — engage on product integration', recPri: 'high', recReason: 'VP Product with strong UX and testing background' },
    { first: 'Victor', last: 'Ramos', title: 'Head of Engineering', dept: 'Engineering', seniority: 'Director', role: 'champion', dp: 72, act: 82, inf: 78, rel: 55, ready: 85, pri: 'high', linkedin: 'linkedin.com/in/victorramos', email: 'victor@conversionlab.com', loc: 'New York, NY', yrsRole: '3', yrsCo: '3', edu: ['NYU — MS CS'], skills: ['React', 'Node.js', 'AWS', 'Analytics'], prev: ['Spotify'], topics: ['Frontend Engineering', 'Analytics', 'React'], thought: 85, freq: '4 posts/week', lastActive: '2 days ago', rec: 'Champion — strong technical advocate', recPri: 'high', recReason: 'High activity, strong engineering thought leadership' },
    { first: 'Grace', last: 'Liu', title: 'Director of Marketing', dept: 'Marketing', seniority: 'Director', role: 'influencer', dp: 58, act: 78, inf: 72, rel: 50, ready: 75, pri: 'medium', linkedin: 'linkedin.com/in/graceliu', email: 'grace@conversionlab.com', loc: 'New York, NY', yrsRole: '2', yrsCo: '2', edu: ['NYU — BA Marketing'], skills: ['Growth Marketing', 'Analytics', 'SEO'], prev: ['BuzzFeed'], topics: ['Growth Marketing', 'SEO', 'Analytics'], thought: 75, freq: '3 posts/week', lastActive: '3 days ago', rec: 'Influencer — engage for marketing alignment', recPri: 'medium', recReason: 'Influences marketing tool adoption' },
  ],
  { eb: 'Brian Nguyen (CEO)', tb: 'Laura Bennett (VP Product)', champ: 'Victor Ramos (Head of Eng)', infl: 'Grace Liu (Marketing Dir)', eval: 'Laura Bennett (VP Product)', block: null, proc: null },
  'ConversionLab has a compact buying committee with CEO as economic buyer, VP Product as technical buyer, and Head of Engineering as champion. Good LinkedIn activity across the team.',
);

// Companies 7-20: Generated with helper
function quickCompany(
  name: string, industry: string, website: string, employees: string, revenue: string, stage: string, score: number, conf: number,
  ceo: string, cto: string, salesVP: string, champ: string, infl: string,
): MockDMResearch {
  return makeDMCompany(name, industry, website, employees, revenue, stage, score, conf,
    [
      { first: ceo.split(' ')[0], last: ceo.split(' ')[1], title: 'CEO', dept: 'Leadership', seniority: 'CXO', role: 'economic_buyer', dp: 88, act: 72, inf: 82, rel: 40, ready: 82, pri: 'critical', linkedin: `linkedin.com/in/${ceo.toLowerCase().replace(' ', '')}`, email: `${ceo.toLowerCase().replace(' ', '')}@${website.replace('https://', '')}`, loc: '—', yrsRole: '3', yrsCo: '3', edu: ['Top University — MBA'], skills: ['SaaS Strategy', 'Leadership', 'Growth'], prev: ['Previous Co'], topics: ['SaaS', 'Growth', 'Leadership'], thought: 72, freq: '2 posts/week', lastActive: '4 days ago', rec: 'Primary contact — approach with strategic pitch', recPri: 'critical', recReason: 'Economic buyer with strong leadership background' },
      { first: cto.split(' ')[0], last: cto.split(' ')[1], title: 'CTO', dept: 'Engineering', seniority: 'CXO', role: 'technical_buyer', dp: 82, act: 68, inf: 78, rel: 35, ready: 78, pri: 'high', linkedin: `linkedin.com/in/${cto.toLowerCase().replace(' ', '')}`, email: `${cto.toLowerCase().replace(' ', '')}@${website.replace('https://', '')}`, loc: '—', yrsRole: '3', yrsCo: '3', edu: ['Top University — MS CS'], skills: ['Cloud Architecture', 'System Design', 'AI/ML'], prev: ['Google', 'Amazon'], topics: ['Cloud', 'AI/ML', 'Engineering'], thought: 68, freq: '1 post/week', lastActive: '1 week ago', rec: 'Technical buyer — engage on architecture', recPri: 'high', recReason: 'CTO with strong technical background' },
      { first: salesVP.split(' ')[0], last: salesVP.split(' ')[1], title: 'VP of Sales', dept: 'Sales', seniority: 'VP', role: 'economic_buyer', dp: 78, act: 75, inf: 76, rel: 50, ready: 80, pri: 'high', linkedin: `linkedin.com/in/${salesVP.toLowerCase().replace(' ', '')}`, email: `${salesVP.toLowerCase().replace(' ', '')}@${website.replace('https://', '')}`, loc: '—', yrsRole: '2', yrsCo: '2', edu: ['Top University — MBA'], skills: ['Sales Strategy', 'Pipeline Management'], prev: ['Salesforce'], topics: ['Sales', 'RevOps'], thought: 72, freq: '2 posts/week', lastActive: '3 days ago', rec: 'Secondary contact — co-approach for sales alignment', recPri: 'high', recReason: 'VP Sales with enterprise experience' },
      { first: champ.split(' ')[0], last: champ.split(' ')[1], title: 'Head of RevOps', dept: 'Revenue Operations', seniority: 'Director', role: 'champion', dp: 72, act: 85, inf: 78, rel: 58, ready: 88, pri: 'high', linkedin: `linkedin.com/in/${champ.toLowerCase().replace(' ', '')}`, email: `${champ.toLowerCase().replace(' ', '')}@${website.replace('https://', '')}`, loc: '—', yrsRole: '2', yrsCo: '2', edu: ['Top University — MS Analytics'], skills: ['RevOps', 'Salesforce', 'Analytics', 'Automation'], prev: ['Deloitte'], topics: ['RevOps', 'Analytics', 'Automation'], thought: 85, freq: '4 posts/week', lastActive: '1 day ago', rec: 'Champion — ideal internal advocate', recPri: 'high', recReason: 'Highest activity, strong RevOps thought leadership' },
      { first: infl.split(' ')[0], last: infl.split(' ')[1], title: 'Director of Marketing', dept: 'Marketing', seniority: 'Director', role: 'influencer', dp: 60, act: 75, inf: 70, rel: 45, ready: 72, pri: 'medium', linkedin: `linkedin.com/in/${infl.toLowerCase().replace(' ', '')}`, email: `${infl.toLowerCase().replace(' ', '')}@${website.replace('https://', '')}`, loc: '—', yrsRole: '2', yrsCo: '2', edu: ['Top University — BA Marketing'], skills: ['Demand Gen', 'Content Marketing', 'SEO'], prev: ['HubSpot'], topics: ['Demand Gen', 'B2B Marketing', 'Content'], thought: 75, freq: '3 posts/week', lastActive: '4 days ago', rec: 'Influencer — engage for marketing alignment', recPri: 'medium', recReason: 'Influences marketing tool budget' },
    ],
    { eb: `${ceo} (CEO)`, tb: `${cto} (CTO)`, champ: `${champ} (Head of RevOps)`, infl: `${infl} (Marketing Dir)`, eval: `${cto} (CTO)`, block: null, proc: null },
    `${name} has a standard buying committee with ${ceo} as economic buyer, ${cto} as technical buyer, and ${champ} as champion candidate.`,
  );
}

const company7 = quickCompany('ScaleOS', 'IT Services', 'scaleos.io', '280', '$35M', 'Series C', 84, 80, 'Ryan Murphy', 'Elena Volkov', 'Derek Holt', 'Maya Singh', 'Tara Walsh');
const company8 = quickCompany('TalentForge', 'HR Tech', 'talentforge.com', '85', '$7M', 'Seed', 72, 68, 'Justin Park', 'Aisha Bello', 'Cole Turner', 'Nina Patel', 'Zoe Adams');
const company9 = quickCompany('ContentGenius', 'Internet', 'contentgenius.io', '190', '$22M', 'Series B', 86, 82, 'Marcus Lee', 'Diana Wong', 'Felix Garcia', 'Ivy Chen', 'Owen Bennett');
const company10 = quickCompany('SecureNet', 'Cybersecurity', 'securenet.io', '450', '$55M', 'Series D', 81, 78, 'Grant Thompson', 'Yuki Tanaka', 'Derek Cole', 'Aria Patel', 'Mason Reed');
const company11 = quickCompany('FlowMetrics', 'Computer Software', 'flowmetrics.com', '130', '$15M', 'Series A', 80, 76, 'Caleb Ward', 'Stella Kim', 'Hugo Castro', 'Luna Park', 'Finn Adams');
const company12 = quickCompany('TeamSync Pro', 'Computer Software', 'teamsyncpro.com', '75', '$6M', 'Seed', 68, 65, 'Oscar Ruiz', 'Maya Cohen', 'Eli Vance', 'Tara Reed', 'Jude Fox');
const company13 = quickCompany('InsightDeck', 'Computer Software', 'insightdeck.io', '60', '$5M', 'Pre-Seed', 65, 62, 'Leo Martinez', 'Nina Cole', 'Rex Stone', 'Zara King', 'Ava Miles');
const company14 = quickCompany('NexusCRM', 'Computer Software', 'nexuscrm.com', '350', '$42M', 'Series C', 83, 80, 'Adrian Voss', 'Kira Sato', 'Blake Evans', 'Iris Moore', 'Knox Lee');
const company15 = quickCompany('GrowthLoop', 'Internet', 'growthloop.io', '165', '$20M', 'Series B', 85, 81, 'Trevor Mann', 'Sage Bell', 'Drew Hart', 'Nova Quinn', 'Reese Cole');
const company16 = quickCompany('DeployHQ', 'IT Services', 'deployhq.com', '120', '$14M', 'Series A', 77, 74, 'Cole Rivers', 'Eden Park', 'Lance Webb', 'Sky Ford', 'Jade Stone');
const company17 = quickCompany('ChatWave', 'Internet', 'chatwave.io', '90', '$9M', 'Seed', 74, 70, 'Reed Sullivan', 'Bella Cruz', 'Sloane Hayes', 'Piper Dunn', 'Wren Cole');
const company18 = quickCompany('MetricStream', 'Computer Software', 'metricstream.com', '220', '$28M', 'Series B', 82, 79, 'Dane Wright', 'Lara Voss', 'Rex Powers', 'Iris Bell', 'Faye Stone');
const company19 = quickCompany('ZenithAI', 'Computer Software', 'zenithai.io', '55', '$4M', 'Pre-Seed', 70, 67, 'Archer Lee', 'Nova Kim', 'Sage Wells', 'Luna Park', 'Knox Reed');
const company20 = quickCompany('OmniChannel', 'Internet', 'omnichannel.com', '200', '$24M', 'Series B', 84, 80, 'Marcus Cole', 'Elena Sato', 'Drew Powers', 'Ivy Chen', 'Owen Hayes');

// ============================================================
// Aggregated Array
// ============================================================

export const MOCK_DM_COMPANIES: MockDMResearch[] = [
  company1, company2, company3, company4, company5, company6, company7, company8, company9, company10,
  company11, company12, company13, company14, company15, company16, company17, company18, company19, company20,
];

// ============================================================
// AI Recommendations (shared)
// ============================================================

export const MOCK_DM_RECOMMENDATIONS: DMRecommendations = company1.recommendations;
