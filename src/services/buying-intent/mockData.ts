// ============================================================
// Mock Data — Buying Intent Agent
// ============================================================
//
// Realistic buying intent analysis for 50 companies.
// Simulates what OpenAI + Firecrawl + Tavily + LinkedIn +
// Apollo + Crunchbase + BuiltWith would produce.

import type {
  BuyingIntentAnalysis,
  IntentSignal,
  StakeholderSignal,
  IntentPrediction,
  IntentRecommendation,
  IntentStageInfo,
  IntentAIRecommendations,
  PriorityQueueEntry,
  IntentLevel,
  SignalPriority,
  SignalType,
} from '@/types/buying-intent';

// ============================================================
// Pipeline Stages
// ============================================================

export const INTENT_STAGES: IntentStageInfo[] = [
  { stage: 'loading_research', label: 'Loading Research', description: 'Loading company and decision maker research' },
  { stage: 'collecting_signals', label: 'Collecting Signals', description: 'Gathering signals from all available sources' },
  { stage: 'analyzing_companies', label: 'Analyzing Companies', description: 'Analyzing company-level business signals' },
  { stage: 'analyzing_stakeholders', label: 'Analyzing Stakeholders', description: 'Analyzing stakeholder activity and engagement' },
  { stage: 'calculating_scores', label: 'Calculating Scores', description: 'Computing intent, opportunity, and urgency scores' },
  { stage: 'predicting_intent', label: 'Predicting Buying Intent', description: 'Predicting buying window and purchase probability' },
  { stage: 'generating_recommendations', label: 'Generating Recommendations', description: 'Creating AI-powered outreach recommendations' },
  { stage: 'saving_results', label: 'Saving Results', description: 'Persisting analysis to the database' },
];

// ============================================================
// Helpers
// ============================================================

function signal(
  signal_name: string,
  signal_type: SignalType,
  signal_value: string,
  signal_weight: number,
  confidence: number,
  priority: SignalPriority,
): Omit<IntentSignal, 'id' | 'analysis_id' | 'created_at'> {
  return { signal_name, signal_type, signal_value, signal_weight, confidence, priority };
}

function stakeholder(
  contact_id: string | null,
  activity_score: number,
  engagement_score: number,
  influence_score: number,
  buying_readiness: number,
): Omit<StakeholderSignal, 'id' | 'analysis_id' | 'created_at'> {
  return { contact_id, activity_score, engagement_score, influence_score, buying_readiness };
}

function recommendation(
  rec: string,
  priority: SignalPriority,
  reason: string,
): Omit<IntentRecommendation, 'id' | 'analysis_id' | 'created_at'> {
  return { recommendation: rec, priority, reason };
}

// ============================================================
// Mock Company Intent Data
// ============================================================

export interface MockIntentAnalysis {
  analysis: Omit<BuyingIntentAnalysis, 'id' | 'workspace_id' | 'company_id' | 'research_id' | 'created_at' | 'updated_at'>;
  company_name: string;
  company_industry: string;
  company_revenue: string;
  company_employees: string;
  company_growth_stage: string;
  company_icp_match: string;
  company_decision_makers: number;
  company_research_status: string;
  prediction: Omit<IntentPrediction, 'id' | 'analysis_id' | 'created_at'>;
  signals: Omit<IntentSignal, 'id' | 'analysis_id' | 'created_at'>[];
  stakeholder_signals: Omit<StakeholderSignal, 'id' | 'analysis_id' | 'created_at'>[];
  recommendations: Omit<IntentRecommendation, 'id' | 'analysis_id' | 'created_at'>[];
  ai_recommendations: IntentAIRecommendations;
}

// ============================================================
// Company 1: CloudFlow Inc — Very High Intent
// ============================================================

const company1: MockIntentAnalysis = {
  analysis: {
    intent_score: 94,
    opportunity_score: 91,
    urgency_score: 88,
    confidence_score: 89,
    intent_level: 'very_high',
    buying_window: '0-3 months',
    recommended_priority: 'critical',
    status: 'completed',
    error_message: null,
  },
  company_name: 'CloudFlow Inc',
  company_industry: 'Computer Software',
  company_revenue: '$25M',
  company_employees: '180',
  company_growth_stage: 'Series B',
  company_icp_match: '95%',
  company_decision_makers: 7,
  company_research_status: 'Completed',
  prediction: {
    purchase_probability: 87,
    estimated_deal_size: '$45K-$85K ARR',
    estimated_sales_cycle: '45-60 days',
    expected_close_rate: 34,
    risk_score: 22,
  },
  signals: [
    signal('Series B Funding', 'funding', '$30M raised Jan 2025 (Insight Partners)', 95, 98, 'critical'),
    signal('Active Hiring', 'hiring', '42 open roles across engineering and sales', 85, 95, 'high'),
    signal('EMEA Expansion', 'expansion', 'Opened London office for EMEA market', 80, 90, 'high'),
    signal('New Product Launch', 'product', 'Launched CloudFlow Intelligence AI module Q4 2024', 75, 88, 'medium'),
    signal('Salesforce Integration', 'technology', 'Deep Salesforce integration detected', 70, 85, 'medium'),
    signal('Leadership Change', 'leadership', 'New VP Engineering from Snowflake', 65, 80, 'medium'),
    signal('Website Redesign', 'website', 'Homepage redesigned with new pricing page', 55, 75, 'low'),
    signal('Gong Adoption', 'technology', 'Gong conversation intelligence detected', 60, 80, 'medium'),
  ],
  stakeholder_signals: [
    stakeholder('sarah-chen', 78, 82, 92, 88),
    stakeholder('michael-torres', 75, 70, 85, 85),
    stakeholder('david-kim', 92, 88, 80, 90),
    stakeholder('jennifer-park', 88, 85, 78, 82),
  ],
  recommendations: [
    recommendation('Initiate outreach immediately — buying window is 0-3 months with 87% purchase probability', 'critical', 'Very high intent score (94) with Series B funding and active hiring signals'),
    recommendation('Target Sarah Chen (CEO) and Michael Torres (CRO) as primary contacts', 'critical', 'Economic buyers with high decision power and active LinkedIn presence'),
    recommendation('Use David Kim (Head of RevOps) as internal champion', 'high', 'Highest activity score (92) and strong RevOps thought leadership'),
    recommendation('Lead with AI-powered sales engagement messaging', 'high', 'Company recently launched AI module — receptive to AI-focused value props'),
    recommendation('Time outreach for early morning Tuesday-Thursday', 'medium', 'Stakeholder activity peaks mid-week based on LinkedIn engagement patterns'),
  ],
  ai_recommendations: {
    executive_summary: 'CloudFlow Inc shows very high buying intent (score: 94/100) driven by recent $30M Series B funding, 42 open roles, and EMEA expansion. The buying committee is well-defined with CEO and CRO as economic buyers and a strong champion candidate in Head of RevOps. Purchase probability is 87% with an estimated deal size of $45K-$85K ARR. Recommend immediate outreach within the 0-3 month buying window.',
    why_this_prospect: 'CloudFlow matches 95% of ICP criteria, has active funding and hiring signals, uses compatible technology (Salesforce, Outreach, Gong), and has a highly engaged buying committee. Their recent AI product launch indicates openness to AI-powered solutions.',
    recommended_messaging_theme: 'AI-Powered Revenue Growth — Lead with how your solution accelerates their post-Series B scaling trajectory and complements their recently launched AI module.',
    recommended_contact_order: ['Sarah Chen (CEO)', 'Michael Torres (CRO)', 'David Kim (Head of RevOps)', 'Jennifer Park (VP Engineering)'],
    recommended_outreach_time: 'Tuesday-Thursday, 8:00-10:00 AM PST. Stakeholders show highest LinkedIn engagement mid-week mornings.',
    expected_outcome: '85% likelihood of securing a discovery call within 2 weeks. 34% expected close rate. Estimated deal: $45K-$85K ARR over 45-60 day sales cycle.',
  },
};

// ============================================================
// Helper: Generate compact company data
// ============================================================

function makeIntentCompany(
  name: string, industry: string, revenue: string, employees: string, stage: string,
  icpMatch: string, dmCount: number,
  intentScore: number, oppScore: number, urgency: number, confidence: number,
  intentLevel: IntentLevel, buyingWindow: string, priority: SignalPriority,
  purchaseProb: number, dealSize: string, salesCycle: string, closeRate: number, risk: number,
  signalsData: { name: string; type: SignalType; value: string; weight: number; conf: number; pri: SignalPriority }[],
  stakeholderData: { act: number; eng: number; inf: number; ready: number }[],
  execSummary: string,
  messagingTheme: string,
): MockIntentAnalysis {
  return {
    analysis: {
      intent_score: intentScore,
      opportunity_score: oppScore,
      urgency_score: urgency,
      confidence_score: confidence,
      intent_level: intentLevel,
      buying_window: buyingWindow,
      recommended_priority: priority,
      status: 'completed' as const,
      error_message: null,
    },
    company_name: name,
    company_industry: industry,
    company_revenue: revenue,
    company_employees: employees,
    company_growth_stage: stage,
    company_icp_match: icpMatch,
    company_decision_makers: dmCount,
    company_research_status: 'Completed',
    prediction: {
      purchase_probability: purchaseProb,
      estimated_deal_size: dealSize,
      estimated_sales_cycle: salesCycle,
      expected_close_rate: closeRate,
      risk_score: risk,
    },
    signals: signalsData.map((s) => signal(s.name, s.type, s.value, s.weight, s.conf, s.pri)),
    stakeholder_signals: stakeholderData.map((s) => stakeholder(null, s.act, s.eng, s.inf, s.ready)),
    recommendations: [
      recommendation(
        priority === 'critical' ? 'Initiate outreach immediately' : priority === 'high' ? 'Prioritize outreach this week' : 'Schedule outreach within 2 weeks',
        priority,
        `Intent score: ${intentScore}, Purchase probability: ${purchaseProb}%`,
      ),
      recommendation('Target primary economic buyer as first contact', 'high', 'Economic buyer has highest decision power'),
      recommendation('Use champion to build internal consensus', 'medium', 'Champion candidate identified with high activity score'),
    ],
    ai_recommendations: {
      executive_summary: execSummary,
      why_this_prospect: `${name} matches ${icpMatch} of ICP criteria with ${dmCount} identified decision makers. Intent score: ${intentScore}/100.`,
      recommended_messaging_theme: messagingTheme,
      recommended_contact_order: ['CEO / Founder (Economic Buyer)', 'VP Sales / CRO (Secondary)', 'Head of RevOps (Champion)', 'CTO / VP Engineering (Technical)'],
      recommended_outreach_time: 'Tuesday-Thursday, 8:00-10:00 AM local time',
      expected_outcome: `${purchaseProb}% purchase probability with ${closeRate}% expected close rate. Estimated deal: ${dealSize} over ${salesCycle} cycle.`,
    },
  };
}

// ============================================================
// Companies 2-50: Generated with helper
// ============================================================

const company2 = makeIntentCompany('DataSync Solutions', 'IT Services', '$40M', '320', 'Series C', '92%', 5,
  91, 89, 85, 86, 'very_high', '0-3 months', 'critical', 84, '$60K-$120K ARR', '60-90 days', 30, 25,
  [{ name: 'Series C Funding', type: 'funding', value: '$50M raised Sep 2024 (Coatue)', weight: 95, conf: 98, pri: 'critical' }, { name: 'Active Hiring', type: 'hiring', value: '65 open roles', weight: 85, conf: 95, pri: 'high' }, { name: 'Snowflake Partnership', type: 'partnership', value: 'Strategic partnership announced', weight: 80, conf: 90, pri: 'high' }, { name: 'AI Pipeline Assistant', type: 'product', value: 'Launched AI module Q3 2024', weight: 75, conf: 88, pri: 'medium' }],
  [{ act: 72, eng: 68, inf: 82, ready: 85 }, { act: 85, eng: 82, inf: 78, ready: 88 }, { act: 70, eng: 75, inf: 65, ready: 72 }],
  'DataSync shows very high buying intent (91/100) with $50M Series C funding, 65 open roles, and Snowflake partnership. Purchase probability 84% with $60K-$120K deal size.',
  'Data-Driven Pipeline Automation — Focus on GCP-native integration and AI-powered pipeline management.');

const company3 = makeIntentCompany('OutreachPro', 'Computer Software', '$8M', '95', 'Seed', '72%', 4,
  62, 58, 45, 65, 'low', '6-12 months', 'low', 35, '$15K-$30K ARR', '90-120 days', 15, 55,
  [{ name: 'Seed Funding', type: 'funding', value: '$5M raised Mar 2024', weight: 50, conf: 85, pri: 'low' }, { name: 'Moderate Hiring', type: 'hiring', value: '12 open roles', weight: 45, conf: 80, pri: 'low' }, { name: 'Mobile App Launch', type: 'product', value: 'Launched mobile app', weight: 40, conf: 75, pri: 'low' }],
  [{ act: 78, eng: 65, inf: 72, ready: 60 }, { act: 80, eng: 75, inf: 75, ready: 65 }],
  'OutreachPro shows low buying intent (62/100). Smaller company with limited funding. Monitor for growth signals and re-evaluate after next funding round.',
  'SMB Sales Engagement Simplification — Focus on ease of use and rapid onboarding.');

const company4 = makeIntentCompany('PipelineGenius', 'Computer Software', '$30M', '240', 'Series B', '90%', 5,
  88, 86, 82, 83, 'high', '0-3 months', 'high', 80, '$50K-$95K ARR', '45-60 days', 28, 30,
  [{ name: 'Series B Funding', type: 'funding', value: '$25M raised Jun 2024', weight: 90, conf: 95, pri: 'critical' }, { name: 'Active Hiring', type: 'hiring', value: '38 open roles', weight: 82, conf: 92, pri: 'high' }, { name: 'Salesforce Partnership', type: 'partnership', value: 'AppExchange partnership', weight: 78, conf: 88, pri: 'high' }, { name: 'AI Pipeline Features', type: 'product', value: 'AI-powered pipeline scoring', weight: 70, conf: 85, pri: 'medium' }],
  [{ act: 75, eng: 78, inf: 88, ready: 82 }, { act: 78, eng: 75, inf: 82, ready: 80 }, { act: 85, eng: 88, inf: 78, ready: 85 }],
  'PipelineGenius shows high buying intent (88/100) with Series B funding, active hiring, and Salesforce partnership. Purchase probability 80% with $50K-$95K deal size.',
  'AI-Driven Pipeline Intelligence — Focus on Salesforce-native AI pipeline optimization.');

const company5 = makeIntentCompany('RevMomentum', 'Computer Software', '$18M', '150', 'Series A', '88%', 4,
  85, 83, 80, 81, 'high', '1-3 months', 'high', 78, '$35K-$70K ARR', '45-75 days', 25, 28,
  [{ name: 'Series A Funding', type: 'funding', value: '$15M raised Nov 2024', weight: 85, conf: 92, pri: 'high' }, { name: 'Active Hiring', type: 'hiring', value: '22 open roles', weight: 78, conf: 88, pri: 'high' }, { name: 'RevOps Intelligence Module', type: 'product', value: 'Launched new RevOps module', weight: 72, conf: 85, pri: 'medium' }],
  [{ act: 72, eng: 78, inf: 85, ready: 82 }, { act: 88, eng: 85, inf: 80, ready: 88 }],
  'RevMomentum shows high buying intent (85/100) with Series A funding and RevOps-focused product expansion. Purchase probability 78%.',
  'RevOps Automation — Focus on revenue operations automation and HubSpot integration.');

const company6 = makeIntentCompany('ConversionLab', 'Internet', '$12M', '110', 'Series A', '82%', 4,
  79, 76, 72, 75, 'medium', '3-6 months', 'medium', 65, '$25K-$50K ARR', '60-90 days', 22, 35,
  [{ name: 'Series A Funding', type: 'funding', value: '$10M raised', weight: 72, conf: 88, pri: 'medium' }, { name: 'Active Hiring', type: 'hiring', value: '18 open roles', weight: 68, conf: 85, pri: 'medium' }, { name: 'AI Test Recommendations', type: 'product', value: 'Launched AI-powered testing', weight: 65, conf: 80, pri: 'medium' }],
  [{ act: 70, eng: 75, inf: 75, ready: 72 }, { act: 82, eng: 78, inf: 78, ready: 80 }],
  'ConversionLab shows medium buying intent (79/100). Good ICP fit with recent funding. Purchase probability 65%.',
  'Conversion Intelligence — Focus on AI-powered A/B testing and conversion optimization.');

const company7 = makeIntentCompany('ScaleOS', 'IT Services', '$35M', '280', 'Series C', '89%', 5,
  86, 84, 80, 82, 'high', '1-3 months', 'high', 79, '$55K-$110K ARR', '60-90 days', 26, 28,
  [{ name: 'Series C Funding', type: 'funding', value: '$40M raised Aug 2024', weight: 90, conf: 95, pri: 'critical' }, { name: 'Active Hiring', type: 'hiring', value: '45 open roles', weight: 82, conf: 92, pri: 'high' }, { name: 'Berlin Office', type: 'expansion', value: 'Opened Berlin office', weight: 75, conf: 88, pri: 'medium' }],
  [{ act: 68, eng: 65, inf: 78, ready: 78 }, { act: 82, eng: 78, inf: 75, ready: 82 }],
  'ScaleOS shows high buying intent (86/100) with Series C funding and European expansion. Purchase probability 79%.',
  'DevOps Automation at Scale — Focus on multi-cloud DevOps automation and enterprise scalability.');

const company8 = makeIntentCompany('TalentForge', 'HR Tech', '$7M', '85', 'Seed', '65%', 4,
  55, 50, 40, 58, 'low', '6-12 months', 'low', 30, '$10K-$25K ARR', '90-120 days', 12, 60,
  [{ name: 'Seed Funding', type: 'funding', value: '$3M raised', weight: 40, conf: 80, pri: 'low' }, { name: 'Low Hiring', type: 'hiring', value: '8 open roles', weight: 35, conf: 75, pri: 'low' }],
  [{ act: 72, eng: 68, inf: 65, ready: 55 }, { act: 75, eng: 70, inf: 68, ready: 58 }],
  'TalentForge shows low buying intent (55/100). Early stage with limited signals. Monitor for growth.',
  'Talent Acquisition Intelligence — Focus on AI-powered recruiting for SMBs.');

const company9 = makeIntentCompany('ContentGenius', 'Internet', '$22M', '190', 'Series B', '87%', 5,
  84, 82, 78, 80, 'high', '1-3 months', 'high', 76, '$40K-$80K ARR', '45-75 days', 24, 30,
  [{ name: 'Series B Funding', type: 'funding', value: '$20M raised Oct 2024', weight: 88, conf: 95, pri: 'critical' }, { name: 'Active Hiring', type: 'hiring', value: '30 open roles', weight: 80, conf: 90, pri: 'high' }, { name: 'AI Content Generator', type: 'product', value: 'Launched AI content module', weight: 78, conf: 88, pri: 'high' }, { name: 'HubSpot Integration', type: 'technology', value: 'Deep HubSpot integration', weight: 70, conf: 85, pri: 'medium' }],
  [{ act: 85, eng: 80, inf: 75, ready: 82 }, { act: 78, eng: 75, inf: 72, ready: 78 }],
  'ContentGenius shows high buying intent (84/100) with Series B funding and AI product launch. Purchase probability 76%.',
  'AI-Powered Content Marketing — Focus on AI-driven content generation and marketing automation.');

const company10 = makeIntentCompany('SecureNet', 'Cybersecurity', '$55M', '450', 'Series D', '85%', 5,
  82, 80, 76, 78, 'high', '3-6 months', 'high', 72, '$70K-$140K ARR', '60-90 days', 22, 32,
  [{ name: 'Series D Funding', type: 'funding', value: '$60M raised May 2024', weight: 88, conf: 95, pri: 'critical' }, { name: 'Active Hiring', type: 'hiring', value: '55 open roles', weight: 82, conf: 92, pri: 'high' }, { name: 'AWS Partnership', type: 'partnership', value: 'AWS Marketplace partnership', weight: 78, conf: 88, pri: 'high' }],
  [{ act: 65, eng: 60, inf: 78, ready: 75 }, { act: 70, eng: 68, inf: 75, ready: 72 }],
  'SecureNet shows high buying intent (82/100) with Series D funding and AWS partnership. Purchase probability 72%.',
  'Enterprise Security Integration — Focus on cybersecurity platform integration and compliance.');

// Companies 11-50: Batch generated
function quick(
  name: string, industry: string, revenue: string, employees: string, stage: string, icp: string, dm: number,
  score: number, opp: number, urg: number, conf: number, level: IntentLevel, window: string, pri: SignalPriority,
  prob: number, deal: string, cycle: string, close: number, risk: number,
  sigName: string, sigType: SignalType, sigVal: string,
  summary: string, theme: string,
): MockIntentAnalysis {
  return makeIntentCompany(name, industry, revenue, employees, stage, icp, dm,
    score, opp, urg, conf, level, window, pri, prob, deal, cycle, close, risk,
    [{ name: sigName, type: sigType, value: sigVal, weight: Math.round(score * 0.9), conf, pri: pri === 'critical' ? 'high' : pri }],
    [{ act: 75, eng: 72, inf: 78, ready: Math.round(score * 0.9) }, { act: 70, eng: 68, inf: 72, ready: Math.round(score * 0.85) }],
    summary, theme);
}

const company11 = quick('FlowMetrics', 'Computer Software', '$15M', '130', 'Series A', '80%', 4, 78, 75, 70, 74, 'medium', '3-6 months', 'medium', 62, '$25K-$50K ARR', '60-90 days', 20, 38, 'Series A Funding', 'funding', '$12M raised Jul 2024', 'FlowMetrics shows medium buying intent (78/100). Good ICP fit with recent funding.', 'Business Intelligence Dashboards — Focus on real-time BI and analytics.');
const company12 = quick('TeamSync Pro', 'Computer Software', '$6M', '75', 'Seed', '60%', 4, 52, 48, 35, 55, 'low', '6-12 months', 'low', 28, '$10K-$20K ARR', '90-120 days', 10, 62, 'Seed Funding', 'funding', '$3M raised', 'TeamSync Pro shows low buying intent (52/100). Small team, limited signals.', 'Team Collaboration — Focus on simplified collaboration for SMBs.');
const company13 = quick('InsightDeck', 'Computer Software', '$5M', '60', 'Pre-Seed', '55%', 3, 48, 45, 30, 52, 'very_low', '12+ months', 'low', 22, '$8K-$15K ARR', '90-120 days', 8, 68, 'Pre-Seed Funding', 'funding', '$2M raised', 'InsightDeck shows very low buying intent (48/100). Early stage, monitor.', 'Customer Analytics — Focus on startup-friendly analytics.');
const company14 = quick('NexusCRM', 'Computer Software', '$42M', '350', 'Series C', '86%', 5, 83, 81, 77, 79, 'high', '1-3 months', 'high', 75, '$55K-$110K ARR', '60-90 days', 25, 30, 'Series C Funding', 'funding', '$45M raised Mar 2024', 'NexusCRM shows high buying intent (83/100) with Series C funding and AI startup acquisition.', 'Next-Gen CRM Intelligence — Focus on AI-powered CRM and sales automation.');
const company15 = quick('GrowthLoop', 'Internet', '$20M', '165', 'Series B', '85%', 5, 82, 80, 76, 78, 'high', '1-3 months', 'high', 74, '$35K-$70K ARR', '45-75 days', 23, 32, 'Series B Funding', 'funding', '$18M raised Sep 2024', 'GrowthLoop shows high buying intent (82/100) with Series B funding and growth AI launch.', 'Growth Marketing AI — Focus on AI-driven growth marketing automation.');
const company16 = quick('DeployHQ', 'IT Services', '$14M', '120', 'Series A', '78%', 4, 75, 72, 68, 72, 'medium', '3-6 months', 'medium', 60, '$25K-$50K ARR', '60-90 days', 18, 40, 'GitHub Partnership', 'partnership', 'GitHub Marketplace partnership', 'DeployHQ shows medium buying intent (75/100). Good technical fit.', 'CI/CD Automation — Focus on deployment automation and DevOps integration.');
const company17 = quick('ChatWave', 'Internet', '$9M', '90', 'Seed', '68%', 4, 58, 55, 42, 60, 'low', '6-12 months', 'low', 32, '$12K-$25K ARR', '90-120 days', 14, 52, 'Seed Funding', 'funding', '$6M raised Apr 2024', 'ChatWave shows low buying intent (58/100). Early stage AI company.', 'AI Customer Messaging — Focus on AI-powered customer engagement.');
const company18 = quick('MetricStream', 'Computer Software', '$28M', '220', 'Series B', '82%', 5, 80, 78, 74, 77, 'high', '3-6 months', 'medium', 68, '$40K-$80K ARR', '60-90 days', 22, 35, 'Series B Funding', 'funding', '$22M raised Dec 2024', 'MetricStream shows high buying intent (80/100) with Series B and Singapore expansion.', 'Business Metrics Intelligence — Focus on KPI tracking and business analytics.');
const company19 = quick('ZenithAI', 'Computer Software', '$4M', '55', 'Pre-Seed', '58%', 3, 50, 45, 32, 54, 'very_low', '12+ months', 'low', 20, '$8K-$15K ARR', '90-120 days', 8, 65, 'Pre-Seed Funding', 'funding', '$3M raised Nov 2024', 'ZenithAI shows very low buying intent (50/100). Very early stage.', 'AI Sales Assistant — Focus on startup-friendly AI sales tools.');
const company20 = quick('OmniChannel', 'Internet', '$24M', '200', 'Series B', '84%', 5, 81, 79, 75, 78, 'high', '1-3 months', 'high', 73, '$40K-$80K ARR', '45-75 days', 24, 32, 'Series B Funding', 'funding', '$28M raised Aug 2024', 'OmniChannel shows high buying intent (81/100) with Series B and US expansion.', 'Cross-Channel Marketing — Focus on multi-channel marketing automation.');

const company21 = quick('Vertex Labs', 'Computer Software', '$32M', '260', 'Series B', '87%', 5, 85, 83, 79, 80, 'high', '1-3 months', 'high', 78, '$50K-$100K ARR', '45-75 days', 26, 28, 'Series B Funding', 'funding', '$25M raised Feb 2025', 'Vertex Labs shows high buying intent (85/100) with recent Series B.', 'AI Platform Engineering — Focus on AI infrastructure and platform tools.');
const company22 = quick('BrightPath', 'Internet', '$11M', '100', 'Series A', '76%', 4, 73, 70, 65, 71, 'medium', '3-6 months', 'medium', 58, '$20K-$40K ARR', '60-90 days', 18, 42, 'Series A Funding', 'funding', '$8M raised Jan 2025', 'BrightPath shows medium buying intent (73/100). Good ICP fit.', 'Digital Experience Platform — Focus on customer journey optimization.');
const company23 = quick('CoreData', 'Computer Software', '$38M', '310', 'Series C', '85%', 5, 82, 80, 76, 78, 'high', '1-3 months', 'high', 74, '$50K-$100K ARR', '60-90 days', 24, 30, 'Series C Funding', 'funding', '$35M raised Oct 2024', 'CoreData shows high buying intent (82/100) with Series C funding.', 'Data Platform Integration — Focus on enterprise data management.');
const company24 = quick('PulseCRM', 'Computer Software', '$16M', '140', 'Series A', '80%', 4, 77, 75, 70, 74, 'medium', '3-6 months', 'medium', 62, '$25K-$50K ARR', '60-90 days', 20, 38, 'Series A Funding', 'funding', '$12M raised Jul 2024', 'PulseCRM shows medium buying intent (77/100). Good ICP fit.', 'CRM Automation — Focus on sales automation and pipeline management.');
const company25 = quick('ApexGrowth', 'Internet', '$19M', '155', 'Series A', '83%', 5, 80, 78, 74, 77, 'high', '3-6 months', 'medium', 68, '$30K-$60K ARR', '60-90 days', 22, 35, 'Series A Funding', 'funding', '$15M raised Nov 2024', 'ApexGrowth shows high buying intent (80/100) with recent funding.', 'Growth Platform — Focus on data-driven growth marketing.');

const company26 = quick('Sentinel Security', 'Cybersecurity', '$48M', '400', 'Series C', '83%', 5, 80, 78, 75, 77, 'high', '3-6 months', 'high', 70, '$60K-$120K ARR', '60-90 days', 22, 32, 'Series C Funding', 'funding', '$40M raised Jun 2024', 'Sentinel Security shows high buying intent (80/100).', 'Enterprise Security — Focus on threat detection and compliance.');
const company27 = quick('Beacon AI', 'Computer Software', '$8M', '70', 'Seed', '68%', 4, 60, 55, 45, 62, 'low', '6-12 months', 'low', 35, '$12K-$25K ARR', '90-120 days', 15, 50, 'Seed Funding', 'funding', '$5M raised Mar 2025', 'Beacon AI shows low buying intent (60/100). Early stage AI startup.', 'AI-Powered Analytics — Focus on startup-friendly AI tools.');
const company28 = quick('SummitData', 'IT Services', '$26M', '210', 'Series B', '82%', 5, 79, 77, 73, 75, 'high', '3-6 months', 'medium', 66, '$35K-$70K ARR', '60-90 days', 21, 36, 'Series B Funding', 'funding', '$20M raised Sep 2024', 'SummitData shows high buying intent (79/100).', 'Data Infrastructure — Focus on cloud-native data pipelines.');
const company29 = quick('Velocity Sales', 'Computer Software', '$14M', '125', 'Series A', '78%', 4, 76, 73, 68, 73, 'medium', '3-6 months', 'medium', 61, '$25K-$50K ARR', '60-90 days', 19, 40, 'Series A Funding', 'funding', '$10M raised Aug 2024', 'Velocity Sales shows medium buying intent (76/100).', 'Sales Engagement — Focus on sales velocity and pipeline acceleration.');
const company30 = quick('Horizon Cloud', 'IT Services', '$33M', '270', 'Series B', '86%', 5, 84, 82, 78, 79, 'high', '1-3 months', 'high', 76, '$45K-$90K ARR', '45-75 days', 25, 30, 'Series B Funding', 'funding', '$24M raised Jan 2025', 'Horizon Cloud shows high buying intent (84/100).', 'Cloud Infrastructure — Focus on multi-cloud management and automation.');

const company31 = quick('Lumen Technologies', 'Computer Software', '$45M', '380', 'Series C', '84%', 5, 81, 79, 75, 78, 'high', '3-6 months', 'high', 72, '$50K-$100K ARR', '60-90 days', 23, 32, 'Series C Funding', 'funding', '$40M raised Jul 2024', 'Lumen Technologies shows high buying intent (81/100).', 'Technology Platform — Focus on enterprise platform integration.');
const company32 = quick('Cobalt Analytics', 'Internet', '$13M', '115', 'Series A', '79%', 4, 76, 73, 68, 73, 'medium', '3-6 months', 'medium', 60, '$22K-$45K ARR', '60-90 days', 19, 40, 'Series A Funding', 'funding', '$10M raised Oct 2024', 'Cobalt Analytics shows medium buying intent (76/100).', 'Analytics Platform — Focus on real-time data analytics.');
const company33 = quick('Quartz Systems', 'IT Services', '$21M', '175', 'Series B', '81%', 5, 78, 76, 72, 75, 'high', '3-6 months', 'medium', 65, '$30K-$60K ARR', '60-90 days', 21, 36, 'Series B Funding', 'funding', '$16M raised Dec 2024', 'Quartz Systems shows high buying intent (78/100).', 'System Integration — Focus on enterprise system automation.');
const company34 = quick('Meridian AI', 'Computer Software', '$10M', '88', 'Seed', '70%', 4, 62, 58, 48, 63, 'low', '6-12 months', 'low', 38, '$15K-$30K ARR', '90-120 days', 16, 48, 'Seed Funding', 'funding', '$6M raised Feb 2025', 'Meridian AI shows low buying intent (62/100). Early stage.', 'AI Solutions — Focus on accessible AI for mid-market.');
const company35 = quick('Atlas Data', 'Computer Software', '$36M', '300', 'Series C', '83%', 5, 80, 78, 74, 77, 'high', '3-6 months', 'high', 70, '$45K-$90K ARR', '60-90 days', 23, 34, 'Series C Funding', 'funding', '$30M raised Nov 2024', 'Atlas Data shows high buying intent (80/100).', 'Data Management — Focus on enterprise data governance.');

const company36 = quick('Forge Digital', 'Internet', '$17M', '145', 'Series A', '79%', 4, 75, 72, 67, 72, 'medium', '3-6 months', 'medium', 60, '$25K-$50K ARR', '60-90 days', 19, 40, 'Series A Funding', 'funding', '$13M raised Sep 2024', 'Forge Digital shows medium buying intent (75/100).', 'Digital Transformation — Focus on digital experience and web optimization.');
const company37 = quick('Prism Security', 'Cybersecurity', '$29M', '240', 'Series B', '82%', 5, 79, 77, 73, 76, 'high', '3-6 months', 'medium', 67, '$40K-$80K ARR', '60-90 days', 21, 35, 'Series B Funding', 'funding', '$22M raised Aug 2024', 'Prism Security shows high buying intent (79/100).', 'Security Automation — Focus on automated threat response.');
const company38 = quick('Catalyst Growth', 'Internet', '$23M', '185', 'Series B', '83%', 5, 80, 78, 74, 76, 'high', '3-6 months', 'high', 70, '$35K-$70K ARR', '45-75 days', 23, 33, 'Series B Funding', 'funding', '$18M raised Oct 2024', 'Catalyst Growth shows high buying intent (80/100).', 'Growth Platform — Focus on data-driven growth and marketing.');
const company39 = quick('Vantage Point', 'Computer Software', '$15M', '130', 'Series A', '77%', 4, 74, 71, 66, 72, 'medium', '3-6 months', 'medium', 59, '$22K-$45K ARR', '60-90 days', 18, 42, 'Series A Funding', 'funding', '$11M raised Jul 2024', 'Vantage Point shows medium buying intent (74/100).', 'Business Intelligence — Focus on executive dashboards and KPIs.');
const company40 = quick('Stellar Cloud', 'IT Services', '$31M', '255', 'Series B', '85%', 5, 83, 81, 77, 79, 'high', '1-3 months', 'high', 75, '$45K-$90K ARR', '45-75 days', 25, 28, 'Series B Funding', 'funding', '$24M raised Jan 2025', 'Stellar Cloud shows high buying intent (83/100).', 'Cloud Management — Focus on multi-cloud optimization and cost management.');

const company41 = quick('Orbit Analytics', 'Computer Software', '$12M', '105', 'Series A', '76%', 4, 73, 70, 65, 71, 'medium', '3-6 months', 'medium', 58, '$20K-$40K ARR', '60-90 days', 18, 42, 'Series A Funding', 'funding', '$9M raised Aug 2024', 'Orbit Analytics shows medium buying intent (73/100).', 'Product Analytics — Focus on user behavior and product insights.');
const company42 = quick('Nimbus AI', 'Computer Software', '$7M', '65', 'Seed', '66%', 3, 56, 52, 40, 58, 'low', '6-12 months', 'low', 30, '$10K-$20K ARR', '90-120 days', 12, 55, 'Seed Funding', 'funding', '$4M raised Mar 2025', 'Nimbus AI shows low buying intent (56/100). Early stage.', 'AI Platform — Focus on accessible AI for SMBs.');
const company43 = quick('Quantum Labs', 'IT Services', '$39M', '320', 'Series C', '84%', 5, 81, 79, 75, 78, 'high', '3-6 months', 'high', 72, '$50K-$100K ARR', '60-90 days', 23, 32, 'Series C Funding', 'funding', '$35M raised Sep 2024', 'Quantum Labs shows high buying intent (81/100).', 'Quantum Computing — Focus on quantum infrastructure and tools.');
const company44 = quick('Pioneer CRM', 'Computer Software', '$18M', '150', 'Series A', '80%', 4, 77, 75, 70, 74, 'medium', '3-6 months', 'medium', 62, '$28K-$55K ARR', '60-90 days', 20, 38, 'Series A Funding', 'funding', '$14M raised Nov 2024', 'Pioneer CRM shows medium buying intent (77/100).', 'CRM Platform — Focus on next-gen CRM and sales automation.');
const company45 = quick('Vanguard Sales', 'Internet', '$20M', '160', 'Series B', '82%', 5, 79, 77, 73, 76, 'high', '3-6 months', 'medium', 67, '$30K-$60K ARR', '60-90 days', 22, 34, 'Series B Funding', 'funding', '$15M raised Oct 2024', 'Vanguard Sales shows high buying intent (79/100).', 'Sales Intelligence — Focus on sales intelligence and pipeline optimization.');

const company46 = quick('Cipher Security', 'Cybersecurity', '$44M', '370', 'Series C', '82%', 5, 79, 77, 73, 77, 'high', '3-6 months', 'medium', 68, '$55K-$110K ARR', '60-90 days', 22, 34, 'Series C Funding', 'funding', '$38M raised Aug 2024', 'Cipher Security shows high buying intent (79/100).', 'Security Platform — Focus on zero-trust security and compliance.');
const company47 = quick('Echo Marketing', 'Internet', '$11M', '95', 'Series A', '75%', 4, 72, 69, 64, 70, 'medium', '3-6 months', 'medium', 57, '$18K-$35K ARR', '60-90 days', 17, 44, 'Series A Funding', 'funding', '$8M raised Sep 2024', 'Echo Marketing shows medium buying intent (72/100).', 'Marketing Automation — Focus on multi-channel marketing automation.');
const company48 = quick('Drift Data', 'Computer Software', '$27M', '225', 'Series B', '81%', 5, 78, 76, 72, 75, 'high', '3-6 months', 'medium', 66, '$35K-$70K ARR', '60-90 days', 21, 36, 'Series B Funding', 'funding', '$20M raised Dec 2024', 'Drift Data shows high buying intent (78/100).', 'Data Pipeline — Focus on real-time data pipelines and ETL.');
const company49 = quick('Flux Analytics', 'Internet', '$9M', '80', 'Seed', '67%', 4, 59, 55, 42, 61, 'low', '6-12 months', 'low', 33, '$12K-$25K ARR', '90-120 days', 14, 52, 'Seed Funding', 'funding', '$5M raised Apr 2025', 'Flux Analytics shows low buying intent (59/100). Early stage.', 'Real-Time Analytics — Focus on streaming analytics for startups.');
const company50 = quick('Apex Revenue', 'Computer Software', '$34M', '280', 'Series B', '86%', 5, 84, 82, 78, 80, 'high', '1-3 months', 'high', 77, '$45K-$90K ARR', '45-75 days', 26, 28, 'Series B Funding', 'funding', '$25M raised Feb 2025', 'Apex Revenue shows high buying intent (84/100) with recent Series B funding.', 'Revenue Intelligence — Focus on AI-powered revenue intelligence and forecasting.');

// ============================================================
// Aggregated Array
// ============================================================

export const MOCK_INTENT_COMPANIES: MockIntentAnalysis[] = [
  company1, company2, company3, company4, company5, company6, company7, company8, company9, company10,
  company11, company12, company13, company14, company15, company16, company17, company18, company19, company20,
  company21, company22, company23, company24, company25, company26, company27, company28, company29, company30,
  company31, company32, company33, company34, company35, company36, company37, company38, company39, company40,
  company41, company42, company43, company44, company45, company46, company47, company48, company49, company50,
];

// ============================================================
// Priority Queue (sorted by intent score)
// ============================================================

export const MOCK_PRIORITY_QUEUE: PriorityQueueEntry[] = MOCK_INTENT_COMPANIES
  .map((c) => ({
    rank: 0,
    company: c.company_name,
    primary_contact: c.ai_recommendations.recommended_contact_order[0] ?? 'N/A',
    intent_score: c.analysis.intent_score,
    opportunity_score: c.analysis.opportunity_score,
    recommended_action: c.recommendations[0]?.recommendation ?? 'Monitor',
    recommended_timing: c.analysis.buying_window ?? 'TBD',
  }))
  .sort((a, b) => b.intent_score - a.intent_score)
  .map((entry, i) => ({ ...entry, rank: i + 1 }));

// ============================================================
// AI Recommendations (shared — from company 1)
// ============================================================

export const MOCK_AI_RECOMMENDATIONS: IntentAIRecommendations = company1.ai_recommendations;
