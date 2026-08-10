// ============================================================
// Mock Data — Personalization Agent
// ============================================================
//
// Realistic personalization blueprints for 50 prospects.
// Simulates what OpenAI + Firecrawl + Tavily + LinkedIn + CRM
// would produce.

import type {
  PersonalizationProfile,
  PainPoint,
  OpeningHook,
  RecommendedAsset,
  CTARecommendation,
  PersonalizationStageInfo,
  PersonalizationAIRecommendations,
  CommunicationProfile,
  ValueProposition,
  PainPointCategory,
  PainPointPriority,
  HookType,
  AssetType,
  AssetPriority,
  CTAType,
  CTAPriority,
  Tone,
  CommunicationStyle,
} from '@/types/personalization';

// ============================================================
// Pipeline Stages
// ============================================================

export const PERSONALIZATION_STAGES: PersonalizationStageInfo[] = [
  { stage: 'loading_intelligence', label: 'Loading Intelligence', description: 'Loading Buying Intent, Company Research, and Decision Maker data' },
  { stage: 'analyzing_prospect', label: 'Analyzing Prospect', description: 'Analyzing prospect background and company context' },
  { stage: 'generating_pain_points', label: 'Generating Pain Points', description: 'Identifying challenges, frustrations, and business goals' },
  { stage: 'selecting_value_proposition', label: 'Selecting Value Proposition', description: 'Matching value proposition to prospect needs' },
  { stage: 'creating_hooks', label: 'Creating Hooks', description: 'Generating personalized opening hooks' },
  { stage: 'generating_cta', label: 'Generating CTA', description: 'Creating call-to-action strategy' },
  { stage: 'building_blueprint', label: 'Building Blueprint', description: 'Assembling complete personalization blueprint' },
  { stage: 'saving_results', label: 'Saving Results', description: 'Persisting blueprint to the database' },
];

// ============================================================
// Helpers
// ============================================================

function painPoint(
  category: PainPointCategory,
  description: string,
  priority: PainPointPriority,
  confidence: number,
): Omit<PainPoint, 'id' | 'profile_id' | 'created_at'> {
  return { category, description, priority, confidence };
}

function hook(
  hook_type: HookType,
  hook_text: string,
  confidence: number,
): Omit<OpeningHook, 'id' | 'profile_id' | 'created_at'> {
  return { hook_type, hook_text, confidence };
}

function asset(
  asset_type: AssetType,
  title: string,
  url: string,
  priority: AssetPriority,
): Omit<RecommendedAsset, 'id' | 'profile_id' | 'created_at'> {
  return { asset_type, title, url, priority };
}

function cta(
  cta_type: CTAType,
  cta_text: string,
  priority: CTAPriority,
): Omit<CTARecommendation, 'id' | 'profile_id' | 'created_at'> {
  return { cta_type, cta_text, priority };
}

// ============================================================
// Mock Prospect Data
// ============================================================

export interface MockPersonalization {
  profile: Omit<PersonalizationProfile, 'id' | 'workspace_id' | 'company_id' | 'contact_id' | 'created_at' | 'updated_at'>;
  prospect_name: string;
  prospect_title: string;
  company_name: string;
  company_industry: string;
  intent_score: number;
  priority: string;
  pain_points: Omit<PainPoint, 'id' | 'profile_id' | 'created_at'>[];
  opening_hooks: Omit<OpeningHook, 'id' | 'profile_id' | 'created_at'>[];
  recommended_assets: Omit<RecommendedAsset, 'id' | 'profile_id' | 'created_at'>[];
  cta_recommendations: Omit<CTARecommendation, 'id' | 'profile_id' | 'created_at'>[];
  communication_profile: CommunicationProfile;
  value_proposition: ValueProposition;
  ai_recommendations: PersonalizationAIRecommendations;
}

// ============================================================
// Prospect 1: Sarah Chen — CloudFlow Inc (Very High Intent)
// ============================================================

const prospect1: MockPersonalization = {
  profile: {
    personalization_score: 92,
    communication_style: 'executive',
    tone: 'professional',
    value_proposition: 'Accelerate post-Series B revenue growth with AI-powered pipeline intelligence that integrates natively with Salesforce and Gong.',
    cta_strategy: 'Direct discovery call with ROI-focused agenda',
    status: 'completed',
    error_message: null,
  },
  prospect_name: 'Sarah Chen',
  prospect_title: 'CEO',
  company_name: 'CloudFlow Inc',
  company_industry: 'Computer Software',
  intent_score: 94,
  priority: 'critical',
  pain_points: [
    painPoint('current_challenges', 'Scaling sales pipeline efficiently post-Series B without adding headcount', 'critical', 92),
    painPoint('business_goals', 'Achieve 3x revenue growth in 18 months to position for Series C', 'critical', 90),
    painPoint('growth_challenges', 'Managing EMEA expansion while maintaining North American growth velocity', 'high', 85),
    painPoint('operational_issues', 'RevOps team spending too much time on manual pipeline reporting', 'high', 82),
    painPoint('technology_challenges', 'Need better integration between Salesforce, Gong, and Outreach.io data silos', 'high', 80),
    painPoint('likely_frustrations', 'Lack of real-time visibility into pipeline health across multiple geographies', 'medium', 75),
  ],
  opening_hooks: [
    hook('recent_company_event', 'Congratulations on the $30M Series B from Insight Partners — exciting to see CloudFlow\'s trajectory.', 95),
    hook('expansion_mention', 'Noticed CloudFlow just opened the London office for EMEA — that\'s a significant milestone for pipeline management.', 90),
    hook('technology_mention', 'Saw the CloudFlow Intelligence AI module launch — impressed by how you\'ve embedded AI into the platform.', 88),
    hook('hiring_mention', '42 open roles is impressive — scaling the team while maintaining velocity is no small feat.', 85),
    hook('mutual_interest', 'Both CloudFlow and our team are passionate about AI-driven revenue operations — I think there\'s strong alignment.', 82),
    hook('industry_trend', 'The shift toward AI-powered sales engagement is accelerating — Gartner predicts 70% of B2B sales orgs will use it by 2026.', 78),
  ],
  recommended_assets: [
    asset('case_study', 'How Snowflake Scaled Pipeline 3x with AI Revenue Intelligence', 'https://example.com/case-studies/snowflake-pipeline', 'critical'),
    asset('testimonial', 'HubSpot VP Sales: "AI pipeline intelligence transformed our forecasting accuracy"', 'https://example.com/testimonials/hubspot-vp-sales', 'high'),
    asset('whitepaper', 'The Post-Series B Revenue Playbook: Scaling to $100M ARR', 'https://example.com/whitepapers/post-series-b-revenue', 'high'),
    asset('landing_page', 'AI-Powered Pipeline Intelligence for Series B-C SaaS Companies', 'https://example.com/landing/pipeline-intelligence', 'medium'),
    asset('article', 'Why EMEA Expansion Requires a New Revenue Operating Model', 'https://example.com/articles/emea-revenue-ops', 'medium'),
  ],
  cta_recommendations: [
    cta('primary', 'Would you be open to a 20-minute discovery call next Tuesday or Wednesday to explore how AI pipeline intelligence can accelerate CloudFlow\'s post-Series B growth?', 'critical'),
    cta('secondary', 'I\'d love to share how we helped Snowflake scale their pipeline 3x — would a quick call this week work?', 'high'),
    cta('soft', 'Would it be helpful if I sent over our Post-Series B Revenue Playbook for your team to review?', 'medium'),
    cta('hard', 'I have two slots open next Tuesday at 10 AM or 2 PM PST — which works for a focused conversation on pipeline acceleration?', 'high'),
  ],
  communication_profile: {
    tone: 'professional',
    writing_style: 'executive',
    length_preference: 'concise',
    professionality: 90,
    humor_level: 20,
    directness: 85,
    urgency: 75,
  },
  value_proposition: {
    primary_value_proposition: 'AI-powered pipeline intelligence that helps Series B-C SaaS companies scale revenue 3x without proportionally increasing headcount.',
    secondary_value_proposition: 'Native Salesforce + Gong integration that eliminates RevOps reporting overhead and provides real-time pipeline visibility across geographies.',
    unique_selling_points: [
      'AI-driven pipeline scoring with 94% accuracy',
      'Native Salesforce, Gong, and Outreach.io integration',
      'Real-time multi-geography pipeline visibility',
      'Automated RevOps reporting — saves 15+ hours/week',
    ],
    competitive_advantages: [
      'Only platform with deep Gong conversation intelligence integration',
      'Purpose-built for Series B-C scaling companies',
      'AI pipeline scoring trained on 10M+ B2B deals',
      'Setup in under 2 weeks vs. 3-month implementations',
    ],
    recommended_services: [
      'AI Pipeline Intelligence Platform',
      'RevOps Automation Module',
      'Multi-Geography Pipeline Dashboard',
    ],
  },
  ai_recommendations: {
    executive_summary: 'Sarah Chen, CEO of CloudFlow Inc, is a high-priority prospect with 94/100 intent score. Post-Series B with $30M raised, CloudFlow is scaling aggressively with 42 open roles and EMEA expansion. Sarah needs AI-powered pipeline intelligence to scale revenue without proportional headcount increases. Recommend immediate executive-level outreach with ROI-focused messaging.',
    prospect_summary: 'Sarah Chen is the CEO and co-founder of CloudFlow Inc, a Series B SaaS company in the computer software space. She recently raised $30M from Insight Partners and is aggressively scaling. Her LinkedIn activity shows strong thought leadership in AI and RevOps. She values efficiency, data-driven decisions, and strategic partnerships.',
    company_summary: 'CloudFlow Inc is a Series B SaaS company with ~180 employees and $25M revenue. They recently launched an AI module, opened a London office for EMEA expansion, and are actively hiring across engineering and sales. Their tech stack includes Salesforce, Gong, and Outreach.io.',
    business_opportunity: 'CloudFlow\'s post-Series B scaling creates an immediate need for pipeline intelligence. Their EMEA expansion and aggressive hiring indicate they need to scale revenue operations efficiently. The AI module launch shows openness to AI-powered solutions. Estimated deal size: $45K-$85K ARR with 87% purchase probability.',
    key_insights: [
      'Series B funding ($30M) creates urgency for scalable revenue growth',
      'EMEA expansion requires multi-geography pipeline visibility',
      '42 open roles indicate scaling pressure on RevOps',
      'AI module launch shows receptiveness to AI-powered tools',
      'Existing Gong + Salesforce stack indicates integration requirements',
    ],
    recommended_messaging_angle: 'Lead with post-Series B scaling — focus on how AI pipeline intelligence helps CloudFlow achieve 3x revenue growth without proportionally increasing headcount. Reference the Snowflake case study as proof.',
    conversation_context: 'Sarah is in scaling mode post-Series B. She\'s thinking about EMEA expansion, RevOps efficiency, and pipeline visibility. Reference the $30M raise, London office, and AI module launch as conversation starters. She responds well to data-driven, executive-level communication.',
    outreach_readiness: 'highly_ready',
  },
};

// ============================================================
// Helper: Generate compact prospect data
// ============================================================

function makeProspect(
  name: string, title: string, company: string, industry: string, intent: number, priority: string,
  score: number, style: CommunicationStyle, tone: Tone,
  vp: string, ctaStrategy: string,
  pains: { cat: PainPointCategory; desc: string; pri: PainPointPriority; conf: number }[],
  hooksData: { type: HookType; text: string; conf: number }[],
  assetsData: { type: AssetType; title: string; url: string; pri: AssetPriority }[],
  ctasData: { type: CTAType; text: string; pri: CTAPriority }[],
  commProfile: CommunicationProfile,
  valueProp: ValueProposition,
  execSummary: string,
  prospectSummary: string,
  companySummary: string,
  businessOpp: string,
  keyInsights: string[],
  messagingAngle: string,
  convContext: string,
  readiness: 'not_ready' | 'partially_ready' | 'ready' | 'highly_ready',
): MockPersonalization {
  return {
    profile: {
      personalization_score: score,
      communication_style: style,
      tone,
      value_proposition: vp,
      cta_strategy: ctaStrategy,
      status: 'completed' as const,
      error_message: null,
    },
    prospect_name: name,
    prospect_title: title,
    company_name: company,
    company_industry: industry,
    intent_score: intent,
    priority,
    pain_points: pains.map((p) => painPoint(p.cat, p.desc, p.pri, p.conf)),
    opening_hooks: hooksData.map((h) => hook(h.type, h.text, h.conf)),
    recommended_assets: assetsData.map((a) => asset(a.type, a.title, a.url, a.pri)),
    cta_recommendations: ctasData.map((c) => cta(c.type, c.text, c.pri)),
    communication_profile: commProfile,
    value_proposition: valueProp,
    ai_recommendations: {
      executive_summary: execSummary,
      prospect_summary: prospectSummary,
      company_summary: companySummary,
      business_opportunity: businessOpp,
      key_insights: keyInsights,
      recommended_messaging_angle: messagingAngle,
      conversation_context: convContext,
      outreach_readiness: readiness,
    },
  };
}

// ============================================================
// Prospects 2-50: Generated with helper
// ============================================================

const prospect2 = makeProspect(
  'Michael Torres', 'CRO', 'CloudFlow Inc', 'Computer Software', 94, 'critical',
  90, 'consultative', 'professional',
  'Scale revenue operations with AI-powered pipeline intelligence that integrates with your existing Salesforce and Gong stack.',
  'Discovery call focused on RevOps efficiency and pipeline acceleration',
  [
    { cat: 'current_challenges', desc: 'Pipeline forecasting accuracy below 70% — board is demanding better visibility', pri: 'critical', conf: 90 },
    { cat: 'business_goals', desc: 'Hit $50M ARR within 18 months to position for Series C', pri: 'critical', conf: 88 },
    { cat: 'operational_issues', desc: 'SDR team productivity plateauing despite headcount increases', pri: 'high', conf: 82 },
    { cat: 'growth_challenges', desc: 'Scaling EMEA sales team without proven playbook', pri: 'high', conf: 80 },
  ],
  [
    { type: 'recent_company_event', text: 'Congrats on the $30M Series B — the growth trajectory at CloudFlow is impressive.', conf: 92 },
    { type: 'hiring_mention', text: '42 open roles shows serious scaling — how are you managing pipeline across the expanding team?', conf: 85 },
    { type: 'technology_mention', text: 'Noticed you\'re using Gong for conversation intelligence — we integrate natively with that stack.', conf: 88 },
  ],
  [
    { type: 'case_study', title: 'How Snowflake Scaled Pipeline 3x with AI Revenue Intelligence', url: 'https://example.com/case-studies/snowflake', pri: 'critical' },
    { type: 'whitepaper', title: 'The CRO\'s Guide to Scaling Revenue Post-Series B', url: 'https://example.com/whitepapers/cro-scaling', pri: 'high' },
    { type: 'testimonial', title: 'Gong CRO: "AI pipeline intelligence transformed our forecasting"', url: 'https://example.com/testimonials/gong-cro', pri: 'high' },
  ],
  [
    { type: 'primary', text: 'Would you be open to a 20-minute call to discuss how AI pipeline intelligence can improve your forecasting accuracy to 90%+?', pri: 'critical' },
    { type: 'secondary', text: 'I\'d love to share how we helped Snowflake\'s CRO scale pipeline 3x — any time this week?', pri: 'high' },
    { type: 'soft', text: 'Would it help if I sent our CRO Scaling Guide for your review?', pri: 'medium' },
    { type: 'hard', text: 'I have Tuesday at 10 AM or Thursday at 2 PM open — which works for a pipeline-focused conversation?', pri: 'high' },
  ],
  { tone: 'professional', writing_style: 'consultative', length_preference: 'medium', professionality: 85, humor_level: 15, directness: 80, urgency: 70 },
  {
    primary_value_proposition: 'AI-powered pipeline intelligence that improves forecasting accuracy to 90%+ for Series B-C SaaS companies.',
    secondary_value_proposition: 'Native Salesforce + Gong integration that eliminates manual RevOps reporting and provides real-time pipeline visibility.',
    unique_selling_points: ['94% forecasting accuracy', 'Native Gong integration', 'Real-time pipeline scoring', '15+ hours/week RevOps savings'],
    competitive_advantages: ['Only platform with deep Gong integration', 'Purpose-built for Series B-C', 'AI trained on 10M+ B2B deals', '2-week setup vs. 3-month implementations'],
    recommended_services: ['AI Pipeline Intelligence Platform', 'RevOps Automation Module', 'Forecasting Accuracy Suite'],
  },
  'Michael Torres, CRO of CloudFlow Inc, is a critical-priority prospect with 94/100 intent score. As CRO post-Series B, he needs to improve forecasting accuracy and scale revenue operations. Recommend consultative outreach focused on RevOps efficiency.',
  'Michael Torres is the CRO at CloudFlow Inc. He owns revenue forecasting and sales team productivity. Post-Series B, he\'s under pressure to deliver predictable growth. Values data-driven decisions and operational efficiency.',
  'CloudFlow Inc is a Series B SaaS company with ~180 employees. Recently raised $30M, expanding to EMEA, and actively hiring 42 roles. Uses Salesforce, Gong, and Outreach.io.',
  'CloudFlow\'s CRO needs to improve forecasting accuracy and scale RevOps. Estimated deal: $45K-$85K ARR with 84% purchase probability.',
  ['Board pressure on forecasting accuracy', 'SDR productivity plateauing', 'EMEA scaling without proven playbook', 'Gong integration indicates openness to AI tools'],
  'Lead with forecasting accuracy — CROs care about predictability. Reference the Snowflake case study and 94% accuracy metric.',
  'Michael is under board pressure to deliver predictable revenue. He values data, efficiency, and proven playbooks. Reference the $30M raise and EMEA expansion as context.',
  'highly_ready',
);

function quick(
  name: string, title: string, company: string, industry: string, intent: number, priority: string,
  score: number, style: CommunicationStyle, tone: Tone,
  vp: string, ctaStrategy: string,
  painDesc: string, hookText: string, caseStudyTitle: string,
  execSummary: string, messagingAngle: string,
  readiness: 'not_ready' | 'partially_ready' | 'ready' | 'highly_ready',
): MockPersonalization {
  return makeProspect(
    name, title, company, industry, intent, priority,
    score, style, tone, vp, ctaStrategy,
    [
      { cat: 'current_challenges', desc: painDesc, pri: priority === 'critical' ? 'critical' : 'high', conf: score },
      { cat: 'business_goals', desc: 'Drive revenue growth and operational efficiency', pri: 'high', conf: Math.round(score * 0.9) },
      { cat: 'operational_issues', desc: 'Manual reporting and pipeline visibility gaps', pri: 'medium', conf: Math.round(score * 0.8) },
    ],
    [
      { type: 'recent_company_event', text: hookText, conf: Math.round(score * 0.95) },
      { type: 'industry_trend', text: 'The shift toward AI-powered sales intelligence is accelerating across the industry.', conf: Math.round(score * 0.75) },
    ],
    [
      { type: 'case_study', title: caseStudyTitle, url: `https://example.com/case-studies/${company.toLowerCase().replace(/\s/g, '-')}`, pri: 'high' },
      { type: 'whitepaper', title: 'The AI Revenue Intelligence Playbook', url: 'https://example.com/whitepapers/ai-revenue', pri: 'medium' },
    ],
    [
      { type: 'primary', text: 'Would you be open to a brief call to explore how AI revenue intelligence can help your team?', pri: priority === 'critical' ? 'critical' : 'high' },
      { type: 'soft', text: 'Would it be helpful if I sent over some relevant resources?', pri: 'medium' },
    ],
    { tone, writing_style: style, length_preference: 'medium', professionality: Math.round(score * 0.9), humor_level: 20, directness: 70, urgency: 60 },
    {
      primary_value_proposition: vp,
      secondary_value_proposition: 'Native integrations with your existing sales stack for seamless adoption.',
      unique_selling_points: ['AI-driven scoring', 'Native integrations', 'Real-time insights', 'Rapid implementation'],
      competitive_advantages: ['Purpose-built for scaling SaaS', 'AI trained on millions of B2B deals', '2-week setup'],
      recommended_services: ['AI Revenue Intelligence Platform', 'Pipeline Automation Module'],
    },
    execSummary,
    `${name} is the ${title} at ${company}. Active in the ${industry} space with strong interest in AI-driven solutions.`,
    `${company} is a company in the ${industry} space with ${intent}/100 intent score.`,
    `${company} represents a strong opportunity with ${intent}% intent score. Estimated deal: $30K-$80K ARR.`,
    ['Strong ICP fit', 'Active growth signals', 'Compatible tech stack', 'Engaged decision makers'],
    messagingAngle,
    `${name} is focused on growth and efficiency. Reference recent company activities and industry trends as conversation starters.`,
    readiness,
  );
}

const prospect3 = quick('David Kim', 'Head of RevOps', 'CloudFlow Inc', 'Computer Software', 92, 'critical', 88, 'direct', 'professional', 'Automate RevOps reporting and pipeline scoring with AI-powered intelligence.', 'Technical demo focused on integration and automation', 'Manual RevOps reporting consuming 15+ hours per week', 'Saw your AI module launch — impressive work embedding AI into CloudFlow\'s platform.', 'How RevOps Teams Save 15+ Hours/Week with AI Pipeline Intelligence', 'David Kim, Head of RevOps at CloudFlow, is a critical champion candidate. He needs to automate reporting and improve pipeline visibility. Technical, data-driven, values integrations.', 'Lead with technical integration — RevOps leaders care about automation and data quality.', 'highly_ready');

const prospect4 = quick('Jennifer Park', 'VP Engineering', 'CloudFlow Inc', 'Computer Software', 85, 'high', 82, 'consultative', 'professional', 'AI-powered pipeline intelligence with deep technical integration and enterprise-grade reliability.', 'Technical deep-dive on architecture and integration', 'Engineering team spending too much time on internal tooling vs. product', 'Noticed CloudFlow\'s AI module — the technical architecture behind it is impressive.', 'How Engineering Teams Build AI Pipeline Intelligence at Scale', 'Jennifer Park, VP Engineering at CloudFlow, is a technical evaluator. She cares about architecture, reliability, and integration depth. Position as a technical partner.', 'Lead with technical depth — engineering leaders value architecture and reliability.', 'ready');

const prospect5 = quick('Alex Rivera', 'CEO', 'DataSync Solutions', 'IT Services', 91, 'critical', 89, 'executive', 'professional', 'Scale data pipeline operations with AI-powered revenue intelligence for Series C growth.', 'Executive discovery call focused on scaling strategy', 'Scaling data operations post-Series C without proportional headcount increase', 'Congrats on the $50M Series C from Coatue — DataSync\'s growth is remarkable.', 'How DataSync Companies Scale Revenue 3x Post-Series C', 'Alex Rivera, CEO of DataSync Solutions, is a critical prospect with 91/100 intent. Post-Series C with $50M raised, needs to scale revenue operations efficiently.', 'Lead with Series C scaling — focus on efficient growth and pipeline intelligence.', 'highly_ready');

const prospect6 = quick('Brian Lee', 'CRO', 'DataSync Solutions', 'IT Services', 88, 'high', 85, 'consultative', 'authoritative', 'Improve forecasting accuracy and pipeline velocity with AI-powered revenue intelligence.', 'Discovery call on forecasting and pipeline optimization', 'Forecasting accuracy below 75% with board pressure for predictability', 'Noticed DataSync\'s Snowflake partnership — strong technical positioning.', 'How IT Services Companies Improve Forecasting Accuracy by 25%', 'Brian Lee, CRO at DataSync, needs better forecasting and pipeline velocity. Consultative approach with data-driven messaging.', 'Lead with forecasting accuracy — CROs need predictable growth.', 'ready');

const prospect7 = quick('Carlos Mendez', 'VP Sales', 'PipelineGenius', 'Computer Software', 80, 'high', 78, 'direct', 'urgent', 'Accelerate pipeline velocity with AI-powered sales intelligence and Salesforce-native integration.', 'Pipeline-focused discovery call', 'Sales pipeline velocity has plateaued despite team expansion', 'Saw the Salesforce AppExchange partnership — great move for PipelineGenius.', 'How SaaS Companies Accelerate Pipeline Velocity with AI', 'Carlos Mendez, VP Sales at PipelineGenius, needs to accelerate pipeline velocity. Direct, urgent messaging with focus on speed.', 'Lead with pipeline velocity — sales leaders care about speed and conversion.', 'ready');

const prospect8 = quick('Diana Foster', 'CMO', 'RevMomentum', 'Computer Software', 78, 'high', 76, 'conversational', 'friendly', 'Align marketing and sales with AI-powered revenue intelligence and shared pipeline visibility.', 'Cross-functional alignment discussion', 'Marketing and sales alignment gaps causing pipeline leakage', 'Noticed RevMomentum\'s new RevOps module — great focus on alignment.', 'How CMOs Drive Revenue with AI-Powered Marketing Intelligence', 'Diana Foster, CMO at RevMomentum, needs better marketing-sales alignment. Friendly, conversational approach.', 'Lead with marketing-sales alignment — CMOs care about pipeline contribution.', 'partially_ready');

const prospect9 = quick('Eric Wang', 'CEO', 'ConversionLab', 'Internet', 65, 'medium', 68, 'executive', 'professional', 'AI-powered conversion intelligence for data-driven growth optimization.', 'Executive briefing on AI conversion trends', 'Limited visibility into conversion funnel bottlenecks', 'Saw ConversionLab\'s AI testing module — innovative approach to optimization.', 'How Internet Companies Optimize Conversions with AI', 'Eric Wang, CEO at ConversionLab, has medium intent. Professional, executive-level outreach with focus on data-driven growth.', 'Lead with conversion intelligence — CEOs care about funnel optimization.', 'partially_ready');

const prospect10 = quick('Fiona Zhang', 'Head of Growth', 'ScaleOS', 'IT Services', 79, 'high', 77, 'direct', 'urgent', 'Scale growth operations across multiple geographies with AI-powered intelligence.', 'Growth strategy discussion', 'Managing multi-geography growth without unified pipeline visibility', 'Noticed ScaleOS\'s Berlin office expansion — impressive European growth.', 'How IT Services Companies Scale Multi-Geography Growth', 'Fiona Zhang, Head of Growth at ScaleOS, needs multi-geography growth intelligence. Direct, urgent messaging.', 'Lead with multi-geography scaling — growth leaders need unified visibility.', 'ready');

const prospect11 = quick('Greg Thompson', 'CRO', 'ContentGenius', 'Internet', 76, 'high', 75, 'consultative', 'professional', 'AI-powered content intelligence that drives pipeline growth and revenue attribution.', 'Content-to-revenue pipeline discussion', 'Content marketing ROI attribution gaps causing budget pressure', 'Saw ContentGenius\'s AI content generator — impressive product evolution.', 'How Content Marketing Drives 40% of Pipeline for SaaS Companies', 'Greg Thompson, CRO at ContentGenius, needs content-to-revenue attribution. Consultative, professional approach.', 'Lead with content ROI — CROs need to justify marketing spend.', 'partially_ready');

const prospect12 = quick('Hannah Brooks', 'VP RevOps', 'NexusCRM', 'Computer Software', 75, 'medium', 73, 'direct', 'professional', 'AI-powered CRM intelligence that automates RevOps reporting and improves data quality.', 'RevOps automation demo', 'Manual CRM data entry and reporting consuming team bandwidth', 'Noticed NexusCRM\'s AI startup acquisition — interesting product strategy.', 'How RevOps Teams Automate CRM Intelligence with AI', 'Hannah Brooks, VP RevOps at NexusCRM, needs CRM automation. Direct, professional approach.', 'Lead with RevOps automation — RevOps leaders care about efficiency.', 'partially_ready');

const prospect13 = quick('Ian Clarke', 'CEO', 'GrowthLoop', 'Internet', 74, 'medium', 72, 'executive', 'inspirational', 'AI-powered growth intelligence that turns data into actionable revenue strategies.', 'Executive strategy session', 'Growth team lacking data-driven decision-making framework', 'GrowthLoop\'s growth AI launch is a strong move in the market.', 'How AI Growth Intelligence Drives 3x Revenue for Internet Companies', 'Ian Clarke, CEO at GrowthLoop, needs growth intelligence. Inspirational, executive approach.', 'Lead with growth intelligence — CEOs need strategic vision.', 'partially_ready');

const prospect14 = quick('Julia Santos', 'CRO', 'SecureNet', 'Cybersecurity', 72, 'medium', 70, 'consultative', 'authoritative', 'AI-powered security sales intelligence for enterprise pipeline acceleration.', 'Enterprise sales strategy discussion', 'Enterprise sales cycle too long for security products', 'SecureNet\'s AWS Marketplace partnership is a strong distribution play.', 'How Cybersecurity Companies Accelerate Enterprise Sales Cycles', 'Julia Santos, CRO at SecureNet, needs enterprise sales acceleration. Authoritative, consultative approach.', 'Lead with enterprise sales acceleration — security CROs need shorter cycles.', 'partially_ready');

const prospect15 = quick('Kevin O\'Brien', 'VP Sales', 'DeployHQ', 'IT Services', 68, 'medium', 65, 'direct', 'professional', 'AI-powered DevOps sales intelligence for pipeline acceleration and technical selling.', 'Technical sales pipeline discussion', 'Technical sales team struggling with pipeline qualification', 'DeployHQ\'s GitHub Marketplace partnership shows strong developer focus.', 'How DevOps Companies Accelerate Technical Sales with AI', 'Kevin O\'Brien, VP Sales at DeployHQ, needs technical sales intelligence. Direct, professional approach.', 'Lead with technical sales — DevOps sales leaders need qualification tools.', 'partially_ready');

const prospect16 = quick('Laura Bennett', 'CEO', 'ChatWave', 'Internet', 58, 'low', 55, 'conversational', 'friendly', 'AI-powered customer engagement intelligence for startup growth.', 'Introductory conversation on AI trends', 'Early-stage company needing scalable growth strategy', 'Saw ChatWave\'s seed funding — exciting AI messaging startup.', 'How AI Startups Scale Customer Engagement Intelligence', 'Laura Bennett, CEO at ChatWave, is early stage with low intent. Friendly, conversational approach for relationship building.', 'Lead with industry trends — early-stage CEOs need market education.', 'partially_ready');

const prospect17 = quick('Marcus Johnson', 'CRO', 'MetricStream', 'Computer Software', 70, 'medium', 68, 'consultative', 'professional', 'AI-powered business metrics intelligence for data-driven revenue operations.', 'Metrics-driven sales discussion', 'Business metrics tracking fragmented across multiple tools', 'MetricStream\'s Singapore expansion shows strong APAC growth.', 'How SaaS Companies Unify Business Metrics with AI', 'Marcus Johnson, CRO at MetricStream, needs unified metrics intelligence. Professional, consultative approach.', 'Lead with metrics unification — CROs need consolidated visibility.', 'partially_ready');

const prospect18 = quick('Nina Patel', 'Head of RevOps', 'OmniChannel', 'Internet', 73, 'high', 71, 'direct', 'professional', 'AI-powered cross-channel intelligence for unified pipeline management.', 'Cross-channel pipeline discussion', 'Cross-channel pipeline visibility gaps causing attribution issues', 'OmniChannel\'s US expansion and Series B funding show strong momentum.', 'How Cross-Channel Companies Unify Pipeline with AI', 'Nina Patel, Head of RevOps at OmniChannel, needs cross-channel intelligence. Direct, professional approach.', 'Lead with cross-channel unification — RevOps needs unified pipeline.', 'ready');

const prospect19 = quick('Oscar Ruiz', 'CEO', 'Vertex Labs', 'Computer Software', 78, 'high', 76, 'executive', 'professional', 'AI platform engineering intelligence for scaling infrastructure and revenue.', 'Executive platform strategy discussion', 'AI platform scaling challenges as company grows post-Series B', 'Vertex Labs\' Series B funding shows strong investor confidence.', 'How AI Platform Companies Scale Revenue Intelligence', 'Oscar Ruiz, CEO at Vertex Labs, needs platform scaling intelligence. Executive, professional approach.', 'Lead with platform scaling — CEOs need strategic growth tools.', 'ready');

const prospect20 = quick('Priya Sharma', 'CRO', 'BrightPath', 'Internet', 65, 'medium', 63, 'consultative', 'friendly', 'AI-powered digital experience intelligence for customer-centric revenue growth.', 'Customer experience revenue discussion', 'Digital experience gaps impacting customer retention and expansion', 'BrightPath\'s Series A funding shows promising growth trajectory.', 'How Digital Experience Companies Drive Revenue with AI', 'Priya Sharma, CRO at BrightPath, needs digital experience intelligence. Friendly, consultative approach.', 'Lead with digital experience — CROs need customer-centric growth.', 'partially_ready');

const prospect21 = quick('Quentin Adams', 'VP Sales', 'CoreData', 'Computer Software', 74, 'medium', 72, 'direct', 'authoritative', 'AI-powered data platform intelligence for enterprise sales acceleration.', 'Enterprise data sales discussion', 'Enterprise data sales cycles too long and complex', 'CoreData\'s Series C funding positions them well for enterprise growth.', 'How Data Platform Companies Accelerate Enterprise Sales', 'Quentin Adams, VP Sales at CoreData, needs enterprise sales acceleration. Authoritative, direct approach.', 'Lead with enterprise sales — data platform sales need acceleration.', 'partially_ready');

const prospect22 = quick('Rachel Green', 'Head of Growth', 'PulseCRM', 'Computer Software', 67, 'medium', 65, 'conversational', 'professional', 'AI-powered CRM intelligence for growth automation and pipeline optimization.', 'Growth automation discussion', 'CRM automation gaps limiting growth team efficiency', 'PulseCRM\'s Series A funding shows good early traction.', 'How CRM Companies Automate Growth with AI', 'Rachel Green, Head of Growth at PulseCRM, needs CRM automation. Professional, conversational approach.', 'Lead with growth automation — growth leaders need scalable tools.', 'partially_ready');

const prospect23 = quick('Sam Wilson', 'CRO', 'ApexGrowth', 'Internet', 70, 'medium', 68, 'consultative', 'professional', 'AI-powered growth platform intelligence for data-driven revenue acceleration.', 'Growth platform strategy discussion', 'Growth platform lacking AI-driven insights for revenue optimization', 'ApexGrowth\'s Series A funding shows strong growth potential.', 'How Growth Platforms Drive Revenue with AI Intelligence', 'Sam Wilson, CRO at ApexGrowth, needs growth platform intelligence. Professional, consultative approach.', 'Lead with growth intelligence — CROs need data-driven growth.', 'partially_ready');

const prospect24 = quick('Tara Mitchell', 'CEO', 'Sentinel Security', 'Cybersecurity', 72, 'high', 70, 'executive', 'authoritative', 'AI-powered security intelligence for enterprise threat-aware revenue operations.', 'Executive security strategy discussion', 'Security market expansion requiring scalable sales approach', 'Sentinel Security\'s Series C funding shows strong market position.', 'How Security Companies Scale Revenue with AI Intelligence', 'Tara Mitchell, CEO at Sentinel Security, needs security sales intelligence. Authoritative, executive approach.', 'Lead with security intelligence — CEOs need scalable sales strategies.', 'ready');

const prospect25 = quick('Uma Krishnan', 'VP RevOps', 'Beacon AI', 'Computer Software', 60, 'low', 58, 'direct', 'professional', 'AI-powered analytics intelligence for startup RevOps automation.', 'RevOps automation intro', 'Early-stage RevOps needing automation but budget constrained', 'Beacon AI\'s seed funding shows promising AI analytics focus.', 'How AI Startups Automate RevOps Intelligence', 'Uma Krishnan, VP RevOps at Beacon AI, is early stage. Professional, direct approach for relationship building.', 'Lead with RevOps automation — early RevOps needs affordable tools.', 'partially_ready');

const prospect26 = quick('Victor Chen', 'CRO', 'SummitData', 'IT Services', 71, 'medium', 69, 'consultative', 'professional', 'AI-powered data infrastructure intelligence for pipeline acceleration.', 'Data infrastructure sales discussion', 'Data infrastructure sales team needs better pipeline qualification', 'SummitData\'s Series B funding shows strong data market position.', 'How Data Infrastructure Companies Accelerate Pipeline with AI', 'Victor Chen, CRO at SummitData, needs data infrastructure sales intelligence. Professional, consultative approach.', 'Lead with pipeline acceleration — CROs need qualified pipeline.', 'partially_ready');

const prospect27 = quick('Wendy Lopez', 'Head of Sales', 'Velocity Sales', 'Computer Software', 69, 'medium', 67, 'direct', 'urgent', 'AI-powered sales velocity intelligence for pipeline acceleration and conversion.', 'Sales velocity discussion', 'Sales velocity plateauing despite team expansion and training', 'Velocity Sales\' Series A funding shows good early momentum.', 'How SaaS Companies Accelerate Sales Velocity with AI', 'Wendy Lopez, Head of Sales at Velocity Sales, needs sales velocity intelligence. Direct, urgent approach.', 'Lead with sales velocity — sales leaders need conversion tools.', 'partially_ready');

const prospect28 = quick('Xavier Dubois', 'CEO', 'Horizon Cloud', 'IT Services', 76, 'high', 74, 'executive', 'professional', 'AI-powered cloud infrastructure intelligence for multi-cloud revenue operations.', 'Executive cloud strategy discussion', 'Multi-cloud management complexity impacting revenue operations', 'Horizon Cloud\'s Series B funding shows strong cloud market position.', 'How Cloud Companies Scale Revenue with AI Intelligence', 'Xavier Dubois, CEO at Horizon Cloud, needs cloud intelligence. Executive, professional approach.', 'Lead with cloud intelligence — CEOs need multi-cloud revenue tools.', 'ready');

const prospect29 = quick('Yuki Tanaka', 'CRO', 'Lumen Technologies', 'Computer Software', 72, 'medium', 70, 'consultative', 'professional', 'AI-powered technology platform intelligence for enterprise revenue acceleration.', 'Enterprise platform sales discussion', 'Technology platform sales needing better enterprise qualification', 'Lumen Technologies\' Series C funding shows strong enterprise position.', 'How Technology Platforms Accelerate Enterprise Revenue with AI', 'Yuki Tanaka, CRO at Lumen Technologies, needs enterprise sales intelligence. Professional, consultative approach.', 'Lead with enterprise sales — CROs need qualified enterprise pipeline.', 'partially_ready');

const prospect30 = quick('Zara Ali', 'VP RevOps', 'Cobalt Analytics', 'Internet', 68, 'medium', 66, 'direct', 'professional', 'AI-powered analytics intelligence for RevOps automation and pipeline visibility.', 'Analytics RevOps discussion', 'Analytics platform RevOps needing better pipeline visibility', 'Cobalt Analytics\' Series A funding shows promising analytics focus.', 'How Analytics Companies Automate RevOps with AI', 'Zara Ali, VP RevOps at Cobalt Analytics, needs analytics RevOps intelligence. Direct, professional approach.', 'Lead with RevOps automation — analytics RevOps needs visibility.', 'partially_ready');

const prospect31 = quick('Aaron Black', 'CRO', 'Quartz Systems', 'IT Services', 71, 'medium', 69, 'consultative', 'professional', 'AI-powered system integration intelligence for enterprise sales acceleration.', 'System integration sales discussion', 'System integration sales cycles too long for enterprise clients', 'Quartz Systems\' Series B funding shows strong integration market.', 'How System Integrators Accelerate Enterprise Sales with AI', 'Aaron Black, CRO at Quartz Systems, needs integration sales intelligence. Professional, consultative approach.', 'Lead with enterprise sales — integrators need shorter cycles.', 'partially_ready');

const prospect32 = quick('Bella Cruz', 'Head of Growth', 'Meridian AI', 'Computer Software', 62, 'low', 60, 'conversational', 'friendly', 'AI-powered solutions intelligence for mid-market growth acceleration.', 'Mid-market growth intro', 'Early-stage AI company needing scalable growth strategy', 'Meridian AI\'s seed funding shows promising AI solutions focus.', 'How AI Startups Scale Mid-Market Growth', 'Bella Cruz, Head of Growth at Meridian AI, is early stage. Friendly, conversational approach.', 'Lead with mid-market growth — early-stage needs affordable scaling.', 'partially_ready');

const prospect33 = quick('Cody Evans', 'CRO', 'Atlas Data', 'Computer Software', 72, 'medium', 70, 'consultative', 'authoritative', 'AI-powered data management intelligence for enterprise revenue operations.', 'Data management sales discussion', 'Data management sales needing better enterprise pipeline qualification', 'Atlas Data\'s Series C funding shows strong data management position.', 'How Data Management Companies Scale Enterprise Revenue', 'Cody Evans, CRO at Atlas Data, needs data management intelligence. Authoritative, consultative approach.', 'Lead with data management — CROs need enterprise pipeline tools.', 'partially_ready');

const prospect34 = quick('Dana Hart', 'VP Sales', 'Forge Digital', 'Internet', 67, 'medium', 65, 'direct', 'professional', 'AI-powered digital transformation intelligence for pipeline acceleration.', 'Digital transformation sales discussion', 'Digital transformation sales needing better qualification tools', 'Forge Digital\'s Series A funding shows good digital market traction.', 'How Digital Companies Accelerate Sales with AI', 'Dana Hart, VP Sales at Forge Digital, needs digital sales intelligence. Direct, professional approach.', 'Lead with digital sales — sales leaders need qualification tools.', 'partially_ready');

const prospect35 = quick('Ethan Ward', 'CRO', 'Prism Security', 'Cybersecurity', 73, 'high', 71, 'consultative', 'authoritative', 'AI-powered security automation intelligence for enterprise sales acceleration.', 'Security automation sales discussion', 'Security automation sales needing better enterprise pipeline', 'Prism Security\'s Series B funding shows strong security market position.', 'How Security Companies Automate Sales with AI', 'Ethan Ward, CRO at Prism Security, needs security sales intelligence. Authoritative, consultative approach.', 'Lead with security automation — CROs need enterprise pipeline.', 'ready');

const prospect36 = quick('Faye Dunn', 'Head of RevOps', 'Catalyst Growth', 'Internet', 74, 'high', 72, 'direct', 'professional', 'AI-powered growth platform intelligence for RevOps automation and pipeline optimization.', 'Growth platform RevOps discussion', 'Growth platform RevOps needing better pipeline visibility and automation', 'Catalyst Growth\'s Series B funding shows strong growth platform position.', 'How Growth Platforms Automate RevOps with AI', 'Faye Dunn, Head of RevOps at Catalyst Growth, needs growth RevOps intelligence. Direct, professional approach.', 'Lead with RevOps automation — growth platforms need pipeline visibility.', 'ready');

const prospect37 = quick('Gavin Reed', 'CRO', 'Vantage Point', 'Computer Software', 66, 'medium', 64, 'consultative', 'professional', 'AI-powered business intelligence for executive dashboards and revenue operations.', 'BI sales discussion', 'BI sales needing better executive-level qualification', 'Vantage Point\'s Series A funding shows good BI market traction.', 'How BI Companies Accelerate Executive Sales with AI', 'Gavin Reed, CRO at Vantage Point, needs BI sales intelligence. Professional, consultative approach.', 'Lead with executive BI — CROs need executive-level tools.', 'partially_ready');

const prospect38 = quick('Holly Bates', 'VP Sales', 'Stellar Cloud', 'IT Services', 79, 'high', 77, 'direct', 'urgent', 'AI-powered cloud management intelligence for multi-cloud revenue acceleration.', 'Cloud management sales discussion', 'Cloud management sales needing better multi-cloud qualification', 'Stellar Cloud\'s Series B funding shows strong cloud management position.', 'How Cloud Companies Accelerate Multi-Cloud Sales with AI', 'Holly Bates, VP Sales at Stellar Cloud, needs cloud sales intelligence. Direct, urgent approach.', 'Lead with multi-cloud sales — sales leaders need qualification tools.', 'ready');

const prospect39 = quick('Ivan Petrov', 'CRO', 'Orbit Analytics', 'Computer Software', 65, 'medium', 63, 'consultative', 'professional', 'AI-powered product analytics intelligence for revenue operations and pipeline optimization.', 'Product analytics sales discussion', 'Product analytics sales needing better pipeline qualification', 'Orbit Analytics\' Series A funding shows promising analytics focus.', 'How Analytics Companies Accelerate Sales with AI', 'Ivan Petrov, CRO at Orbit Analytics, needs analytics sales intelligence. Professional, consultative approach.', 'Lead with analytics sales — CROs need qualified pipeline.', 'partially_ready');

const prospect40 = quick('Jade Morrison', 'Head of Growth', 'Nimbus AI', 'Computer Software', 56, 'low', 54, 'conversational', 'friendly', 'AI-powered platform intelligence for SMB growth acceleration.', 'SMB growth intro', 'Early-stage AI platform needing affordable growth strategy', 'Nimbus AI\'s seed funding shows early AI platform focus.', 'How AI Startups Scale SMB Growth Intelligence', 'Jade Morrison, Head of Growth at Nimbus AI, is early stage. Friendly, conversational approach.', 'Lead with SMB growth — early-stage needs affordable tools.', 'partially_ready');

const prospect41 = quick('Karl Schmidt', 'CRO', 'Quantum Labs', 'IT Services', 76, 'high', 74, 'consultative', 'authoritative', 'AI-powered quantum infrastructure intelligence for enterprise revenue operations.', 'Quantum infrastructure sales discussion', 'Quantum infrastructure sales needing better enterprise qualification', 'Quantum Labs\' Series C funding shows strong quantum market position.', 'How Quantum Companies Scale Enterprise Revenue with AI', 'Karl Schmidt, CRO at Quantum Labs, needs quantum sales intelligence. Authoritative, consultative approach.', 'Lead with quantum intelligence — CROs need enterprise pipeline.', 'ready');

const prospect42 = quick('Lena Park', 'VP RevOps', 'Pioneer CRM', 'Computer Software', 67, 'medium', 65, 'direct', 'professional', 'AI-powered CRM platform intelligence for RevOps automation and pipeline optimization.', 'CRM platform RevOps discussion', 'CRM platform RevOps needing better pipeline visibility', 'Pioneer CRM\'s Series A funding shows good CRM market traction.', 'How CRM Companies Automate RevOps with AI', 'Lena Park, VP RevOps at Pioneer CRM, needs CRM RevOps intelligence. Direct, professional approach.', 'Lead with RevOps automation — CRM RevOps needs visibility.', 'partially_ready');

const prospect43 = quick('Mason Cole', 'CRO', 'Vanguard Sales', 'Internet', 71, 'medium', 69, 'consultative', 'professional', 'AI-powered sales intelligence for pipeline optimization and revenue acceleration.', 'Sales intelligence discussion', 'Sales intelligence platform needing better pipeline qualification', 'Vanguard Sales\' Series B funding shows strong sales intelligence position.', 'How Sales Intelligence Companies Accelerate Revenue with AI', 'Mason Cole, CRO at Vanguard Sales, needs sales intelligence. Professional, consultative approach.', 'Lead with sales intelligence — CROs need qualified pipeline.', 'partially_ready');

const prospect44 = quick('Nora Fields', 'Head of Growth', 'Cipher Security', 'Cybersecurity', 71, 'medium', 69, 'direct', 'professional', 'AI-powered security platform intelligence for growth acceleration and pipeline optimization.', 'Security growth discussion', 'Security platform growth needing better pipeline visibility', 'Cipher Security\'s Series C funding shows strong security market position.', 'How Security Companies Accelerate Growth with AI', 'Nora Fields, Head of Growth at Cipher Security, needs security growth intelligence. Direct, professional approach.', 'Lead with security growth — growth leaders need pipeline visibility.', 'partially_ready');

const prospect45 = quick('Owen Hunt', 'CRO', 'Echo Marketing', 'Internet', 64, 'medium', 62, 'consultative', 'friendly', 'AI-powered marketing automation intelligence for revenue operations and pipeline optimization.', 'Marketing automation sales discussion', 'Marketing automation sales needing better qualification tools', 'Echo Marketing\'s Series A funding shows good marketing automation traction.', 'How Marketing Companies Automate Sales with AI', 'Owen Hunt, CRO at Echo Marketing, needs marketing sales intelligence. Friendly, consultative approach.', 'Lead with marketing automation — CROs need qualification tools.', 'partially_ready');

const prospect46 = quick('Penny Watts', 'VP RevOps', 'Drift Data', 'Computer Software', 70, 'medium', 68, 'direct', 'professional', 'AI-powered data pipeline intelligence for RevOps automation and real-time pipeline visibility.', 'Data pipeline RevOps discussion', 'Data pipeline RevOps needing better real-time visibility', 'Drift Data\'s Series B funding shows strong data pipeline position.', 'How Data Pipeline Companies Automate RevOps with AI', 'Penny Watts, VP RevOps at Drift Data, needs data RevOps intelligence. Direct, professional approach.', 'Lead with RevOps automation — data RevOps needs real-time visibility.', 'partially_ready');

const prospect47 = quick('Riley Cooper', 'Head of Sales', 'Flux Analytics', 'Internet', 59, 'low', 56, 'conversational', 'friendly', 'AI-powered streaming analytics intelligence for startup growth and pipeline optimization.', 'Streaming analytics intro', 'Early-stage analytics company needing scalable growth strategy', 'Flux Analytics\' seed funding shows promising streaming analytics focus.', 'How Analytics Startups Scale Growth with AI', 'Riley Cooper, Head of Sales at Flux Analytics, is early stage. Friendly, conversational approach.', 'Lead with analytics growth — early-stage needs affordable tools.', 'partially_ready');

const prospect48 = quick('Sasha Lee', 'CRO', 'Apex Revenue', 'Computer Software', 78, 'high', 76, 'consultative', 'professional', 'AI-powered revenue intelligence for pipeline forecasting and sales acceleration.', 'Revenue intelligence discussion', 'Revenue intelligence platform needing better forecasting accuracy', 'Apex Revenue\'s Series B funding shows strong revenue intelligence position.', 'How Revenue Intelligence Companies Scale with AI', 'Sasha Lee, CRO at Apex Revenue, needs revenue intelligence. Professional, consultative approach.', 'Lead with revenue intelligence — CROs need forecasting accuracy.', 'ready');

const prospect49 = quick('Tony Stark', 'VP Sales', 'Lumen Technologies', 'Computer Software', 70, 'medium', 68, 'direct', 'authoritative', 'AI-powered technology platform intelligence for enterprise sales acceleration.', 'Enterprise platform sales discussion', 'Technology platform enterprise sales needing better qualification', 'Lumen Technologies\' Series C funding shows strong enterprise position.', 'How Technology Platforms Accelerate Enterprise Sales with AI', 'Tony Stark, VP Sales at Lumen Technologies, needs enterprise sales intelligence. Authoritative, direct approach.', 'Lead with enterprise sales — sales leaders need qualified pipeline.', 'partially_ready');

const prospect50 = quick('Ursula Vance', 'Head of RevOps', 'GrowthLoop', 'Internet', 73, 'high', 71, 'direct', 'professional', 'AI-powered growth marketing intelligence for RevOps automation and pipeline optimization.', 'Growth marketing RevOps discussion', 'Growth marketing RevOps needing better pipeline visibility and automation', 'GrowthLoop\'s Series B funding shows strong growth marketing position.', 'How Growth Marketing Companies Automate RevOps with AI', 'Ursula Vance, Head of RevOps at GrowthLoop, needs growth RevOps intelligence. Direct, professional approach.', 'Lead with RevOps automation — growth RevOps needs pipeline visibility.', 'ready');

// ============================================================
// Aggregated Array
// ============================================================

export const MOCK_PROSPECTS: MockPersonalization[] = [
  prospect1, prospect2, prospect3, prospect4, prospect5, prospect6, prospect7, prospect8, prospect9, prospect10,
  prospect11, prospect12, prospect13, prospect14, prospect15, prospect16, prospect17, prospect18, prospect19, prospect20,
  prospect21, prospect22, prospect23, prospect24, prospect25, prospect26, prospect27, prospect28, prospect29, prospect30,
  prospect31, prospect32, prospect33, prospect34, prospect35, prospect36, prospect37, prospect38, prospect39, prospect40,
  prospect41, prospect42, prospect43, prospect44, prospect45, prospect46, prospect47, prospect48, prospect49, prospect50,
];

// ============================================================
// AI Recommendations (shared — from prospect 1)
// ============================================================

export const MOCK_AI_RECOMMENDATIONS: PersonalizationAIRecommendations = prospect1.ai_recommendations;
