// ============================================================
// Mock Data — Outreach Strategy Agent
// ============================================================
//
// Realistic outreach campaigns for 50 prospects.
// Simulates what OpenAI + LinkedIn + CRM + Calendar + Email
// would produce.

import type {
  OutreachCampaign,
  Touchpoint,
  ChannelStrategy,
  TimingStrategy,
  CampaignMetrics,
  OutreachRecommendation,
  OutreachStageInfo,
  MessagingFramework,
  OutreachAIRecommendations,
  CampaignType,
  Priority,
} from '@/types/outreach-strategy';

// ============================================================
// Pipeline Stages
// ============================================================

export const OUTREACH_STAGES: OutreachStageInfo[] = [
  { stage: 'loading_blueprint', label: 'Loading Blueprint', description: 'Loading personalization blueprint and prospect data' },
  { stage: 'building_campaign', label: 'Building Campaign', description: 'Generating campaign structure and goals' },
  { stage: 'generating_touchpoints', label: 'Generating Touchpoints', description: 'Creating 6-touchpoint sequence with channels and CTAs' },
  { stage: 'selecting_channels', label: 'Selecting Channels', description: 'Prioritizing LinkedIn, email, and video channels' },
  { stage: 'optimizing_timing', label: 'Optimizing Timing', description: 'Calculating best days, times, and intervals' },
  { stage: 'generating_ctas', label: 'Generating CTAs', description: 'Creating call-to-action framework for each touchpoint' },
  { stage: 'calculating_success', label: 'Calculating Success Rate', description: 'Estimating acceptance, reply, and meeting rates' },
  { stage: 'saving_campaign', label: 'Saving Campaign', description: 'Persisting campaign to the database' },
];

// ============================================================
// Mock Prospect Data
// ============================================================

export interface MockCampaign {
  campaign: Omit<OutreachCampaign, 'id' | 'workspace_id' | 'company_id' | 'contact_id' | 'created_at' | 'updated_at'>;
  prospect_name: string;
  prospect_title: string;
  company_name: string;
  buying_intent: number;
  priority: Priority;
  personalization_score: number;
  touchpoints: Omit<Touchpoint, 'id' | 'campaign_id' | 'created_at'>[];
  channel_strategy: Omit<ChannelStrategy, 'id' | 'campaign_id' | 'created_at'>[];
  timing_strategy: Omit<TimingStrategy, 'id' | 'campaign_id' | 'created_at'>;
  campaign_metrics: Omit<CampaignMetrics, 'id' | 'campaign_id' | 'created_at'>;
  recommendations: Omit<OutreachRecommendation, 'id' | 'campaign_id' | 'created_at'>[];
  messaging_framework: MessagingFramework;
  ai_recommendations: OutreachAIRecommendations;
}

// ============================================================
// Helper: Build standard 6-touchpoint sequence
// ============================================================

function buildTouchpoints(
  cta1: string, cta2: string, cta3: string, cta4: string, cta5: string, cta6: string,
): Omit<Touchpoint, 'id' | 'campaign_id' | 'created_at'>[] {
  return [
    { sequence: 1, channel: 'linkedin_connection', purpose: 'Establish initial connection with personalized note', timing: 'Day 1 — Morning', cta: cta1, status: 'pending' },
    { sequence: 2, channel: 'linkedin_message', purpose: 'Send value-driven message referencing recent company event', timing: 'Day 3 — Afternoon', cta: cta2, status: 'pending' },
    { sequence: 3, channel: 'email', purpose: 'Share relevant case study and social proof', timing: 'Day 7 — Morning', cta: cta3, status: 'pending' },
    { sequence: 4, channel: 'linkedin_followup', purpose: 'Follow-up with additional value and insight', timing: 'Day 12 — Afternoon', cta: cta4, status: 'pending' },
    { sequence: 5, channel: 'video_message', purpose: 'Send personalized video message to stand out', timing: 'Day 18 — Morning', cta: cta5, status: 'pending' },
    { sequence: 6, channel: 'email', purpose: 'Break-up email with soft CTA and future optionality', timing: 'Day 25 — Afternoon', cta: cta6, status: 'pending' },
  ];
}

function buildChannelStrategy(): Omit<ChannelStrategy, 'id' | 'campaign_id' | 'created_at'>[] {
  return [
    { channel: 'linkedin_connection', priority: 'critical', confidence: 92 },
    { channel: 'linkedin_message', priority: 'critical', confidence: 90 },
    { channel: 'email', priority: 'high', confidence: 85 },
    { channel: 'linkedin_followup', priority: 'high', confidence: 82 },
    { channel: 'video_message', priority: 'medium', confidence: 75 },
    { channel: 'voice_note', priority: 'medium', confidence: 70 },
    { channel: 'referral', priority: 'low', confidence: 60 },
    { channel: 'manual_task', priority: 'low', confidence: 55 },
  ];
}

function buildTimingStrategy(maxAttempts: number): Omit<TimingStrategy, 'id' | 'campaign_id' | 'created_at'> {
  return {
    best_day: 'Tuesday',
    best_time: '9:00 AM — 11:00 AM local time',
    follow_up_interval: '3-5 business days between touchpoints',
    cooling_period: '30 days after final touchpoint',
    maximum_attempts: maxAttempts,
    campaign_expiry: '45 days from first touchpoint',
  };
}

function buildMetrics(acc: number, reply: number, meeting: number, conf: number): Omit<CampaignMetrics, 'id' | 'campaign_id' | 'created_at'> {
  return {
    expected_acceptance_rate: acc,
    expected_reply_rate: reply,
    expected_meeting_rate: meeting,
    confidence: conf,
  };
}

// ============================================================
// Helper: Generate compact campaign data
// ============================================================

function makeCampaign(
  name: string, title: string, company: string, intent: number, priority: Priority, persScore: number,
  campaignName: string, campaignType: CampaignType, score: number, successProb: number,
  ctas: string[],
  metrics: { acc: number; reply: number; meeting: number; conf: number },
  messaging: MessagingFramework,
  aiRecs: OutreachAIRecommendations,
  maxAttempts = 6,
): MockCampaign {
  return {
    campaign: {
      campaign_name: campaignName,
      campaign_type: campaignType,
      campaign_status: 'completed',
      campaign_score: score,
      success_probability: successProb,
      error_message: null,
    },
    prospect_name: name,
    prospect_title: title,
    company_name: company,
    buying_intent: intent,
    priority,
    personalization_score: persScore,
    touchpoints: buildTouchpoints(ctas[0], ctas[1], ctas[2], ctas[3], ctas[4], ctas[5]),
    channel_strategy: buildChannelStrategy(),
    timing_strategy: buildTimingStrategy(maxAttempts),
    campaign_metrics: buildMetrics(metrics.acc, metrics.reply, metrics.meeting, metrics.conf),
    recommendations: [
      { recommendation: aiRecs.recommended_next_action, priority: 'critical', reason: 'Highest probability of engagement based on intent signals and personalization score.' },
      { recommendation: aiRecs.optimization_suggestions[0] ?? 'Optimize send times based on prospect timezone.', priority: 'high', reason: 'Timing optimization can increase reply rates by 15-20%.' },
      { recommendation: aiRecs.optimization_suggestions[1] ?? 'Add social proof in touchpoint 3.', priority: 'medium', reason: 'Social proof reduces skepticism and increases trust.' },
      { recommendation: aiRecs.risk_factors[0] ?? 'Monitor for non-response after touchpoint 4.', priority: 'medium', reason: 'Non-response after 4 touchpoints indicates low intent or wrong timing.' },
    ],
    messaging_framework: messaging,
    ai_recommendations: aiRecs,
  };
}

// ============================================================
// Standard CTAs
// ============================================================

// Standard CTAs available for reuse across campaigns

const executiveCTAs = [
  'Personalized connection request referencing Series B funding and growth trajectory',
  'Would you be open to a 20-minute discovery call about accelerating post-funding growth?',
  'I\'d love to share how we helped Snowflake scale 3x — would a call this week work?',
  'Did you have a chance to review the Snowflake case study? Any initial thoughts?',
  'I recorded a brief video outlining 3 growth levers for CloudFlow — would Tuesday work?',
  'If Q2 isn\'t the right time, I\'m happy to reconnect in Q3 — just let me know.',
];

// ============================================================
// Prospect 1: Sarah Chen — CloudFlow Inc (Critical Priority)
// ============================================================

const prospect1 = makeCampaign(
  'Sarah Chen', 'CEO', 'CloudFlow Inc', 94, 'critical', 92,
  'CloudFlow Inc — Post-Series B Pipeline Acceleration',
  'multi_touch', 92, 87,
  executiveCTAs,
  { acc: 88, reply: 62, meeting: 35, conf: 90 },
  {
    opening_goal: 'Establish credibility by referencing CloudFlow\'s $30M Series B and EMEA expansion.',
    value_message: 'AI-powered pipeline intelligence helps Series B-C SaaS companies scale revenue 3x without proportional headcount increases.',
    social_proof: 'Snowflake scaled pipeline 3x using our platform — same stage, same challenges.',
    objection_handling_theme: 'Address "too early" objection by showing ROI timeline and 2-week implementation.',
    cta_framework: 'Progressive CTAs: connection → value message → case study → follow-up → video → break-up.',
  },
  {
    executive_summary: 'Sarah Chen, CEO of CloudFlow Inc, is a critical-priority prospect with 94/100 buying intent and 92/100 personalization score. Post-Series B with $30M raised, CloudFlow needs AI-powered pipeline intelligence to scale revenue efficiently. Recommend a 6-touchpoint multi-channel campaign over 25 days with LinkedIn-first strategy.',
    recommended_campaign: 'Multi-touch campaign with LinkedIn connection → message → email → follow-up → video → break-up sequence over 25 days.',
    risk_factors: [
      'Sarah may be too busy post-funding to respond to cold outreach',
      'CloudFlow may already have a RevOps solution in place',
      'EMEA expansion may consume her bandwidth for the next 30 days',
    ],
    optimization_suggestions: [
      'Send touchpoint 1 on Tuesday morning for highest connection acceptance rate',
      'Reference the AI module launch in touchpoint 2 to show product awareness',
      'Use video message in touchpoint 5 to differentiate from standard outreach',
    ],
    recommended_next_action: 'Launch campaign immediately — send LinkedIn connection request on Tuesday at 9 AM PST.',
    campaign_readiness: 'highly_ready',
  },
);

// ============================================================
// Helper: Quick campaign generator for prospects 2-50
// ============================================================

function quick(
  name: string, title: string, company: string, intent: number, priority: Priority, persScore: number,
  campaignName: string, campaignType: CampaignType, score: number, successProb: number,
  valueProp: string, caseStudy: string,
  execSummary: string, nextAction: string,
  readiness: 'not_ready' | 'partially_ready' | 'ready' | 'highly_ready',
): MockCampaign {
  const ctas = [
    `Personalized connection request referencing ${company}'s recent growth`,
    `Would you be open to a brief call about ${valueProp.toLowerCase()}?`,
    `I thought you might find this case study relevant — would a 15-min call work?`,
    `Did you have a chance to review the case study? Happy to walk through it.`,
    `I recorded a 2-min video specifically for you — would a call next week work?`,
    `If the timing isn't right, I'm happy to reconnect next quarter — just let me know.`,
  ];

  const accBase = Math.min(95, intent - 5);
  const replyBase = Math.round(intent * 0.65);
  const meetingBase = Math.round(intent * 0.38);
  const confBase = Math.min(95, score - 3);

  return makeCampaign(
    name, title, company, intent, priority, persScore,
    campaignName, campaignType, score, successProb,
    ctas,
    { acc: accBase, reply: replyBase, meeting: meetingBase, conf: confBase },
    {
      opening_goal: `Establish credibility by referencing ${company}'s recent milestones and growth trajectory.`,
      value_message: valueProp,
      social_proof: caseStudy,
      objection_handling_theme: 'Address timing objection by showing ROI timeline and rapid implementation.',
      cta_framework: 'Progressive CTAs: connection → value message → case study → follow-up → video → break-up.',
    },
    {
      executive_summary: execSummary,
      recommended_campaign: `${campaignType.replace('_', '-')} campaign with 6 touchpoints over 25 days across LinkedIn and email.`,
      risk_factors: [
        `${name} may be too busy to respond to cold outreach`,
        `${company} may already have a solution in place`,
        'Budget constraints may delay purchasing decisions',
      ],
      optimization_suggestions: [
        'Send touchpoint 1 on Tuesday morning for highest acceptance rate',
        `Reference ${company}'s recent milestones in touchpoint 2`,
        'Use video message in touchpoint 5 to differentiate',
      ],
      recommended_next_action: nextAction,
      campaign_readiness: readiness,
    },
  );
}

// ============================================================
// Prospects 2-50
// ============================================================

const prospect2 = quick('Michael Torres', 'CRO', 'CloudFlow Inc', 94, 'critical', 90, 'CloudFlow Inc — RevOps Forecasting & Pipeline Acceleration', 'multi_touch', 90, 85, 'AI-powered pipeline intelligence for forecasting accuracy and RevOps efficiency', 'How Snowflake improved forecasting accuracy by 25%', 'Michael Torres, CRO at CloudFlow Inc, is a critical prospect with 94/100 intent. Needs forecasting accuracy and pipeline velocity. Recommend 6-touchpoint campaign with RevOps-focused messaging.', 'Launch campaign — send LinkedIn connection on Tuesday at 9 AM PST.', 'highly_ready');

const prospect3 = quick('David Kim', 'Head of RevOps', 'CloudFlow Inc', 92, 'critical', 88, 'CloudFlow Inc — RevOps Automation & Reporting', 'multi_touch', 88, 83, 'Automate RevOps reporting and pipeline scoring with AI intelligence', 'How RevOps teams save 15+ hours/week with AI pipeline intelligence', 'David Kim, Head of RevOps at CloudFlow, is a critical champion. Needs automated reporting and pipeline visibility. Technical, data-driven approach.', 'Launch campaign — send LinkedIn connection referencing AI module launch.', 'highly_ready');

const prospect4 = quick('Jennifer Park', 'VP Engineering', 'CloudFlow Inc', 85, 'high', 82, 'CloudFlow Inc — Technical Integration & Architecture', 'multi_touch', 82, 78, 'AI-powered pipeline intelligence with deep technical integration', 'How engineering teams build AI pipeline intelligence at scale', 'Jennifer Park, VP Engineering at CloudFlow, is a technical evaluator. Cares about architecture and integration depth.', 'Launch campaign with technical deep-dive focus.', 'ready');

const prospect5 = quick('Alex Rivera', 'CEO', 'DataSync Solutions', 91, 'critical', 89, 'DataSync Solutions — Post-Series C Revenue Scaling', 'multi_touch', 89, 84, 'Scale data pipeline operations with AI-powered revenue intelligence', 'How DataSync companies scale revenue 3x post-Series C', 'Alex Rivera, CEO of DataSync Solutions, is critical with 91/100 intent. Post-Series C with $50M raised, needs to scale revenue operations.', 'Launch campaign immediately — reference $50M Series C.', 'highly_ready');

const prospect6 = quick('Brian Lee', 'CRO', 'DataSync Solutions', 88, 'high', 85, 'DataSync Solutions — Forecasting & Pipeline Optimization', 'multi_touch', 85, 80, 'Improve forecasting accuracy and pipeline velocity with AI', 'How IT services companies improve forecasting by 25%', 'Brian Lee, CRO at DataSync, needs better forecasting and pipeline velocity. Data-driven, consultative approach.', 'Launch campaign with forecasting accuracy focus.', 'ready');

const prospect7 = quick('Carlos Mendez', 'VP Sales', 'PipelineGenius', 80, 'high', 78, 'PipelineGenius — Pipeline Velocity Acceleration', 'multi_touch', 78, 73, 'Accelerate pipeline velocity with AI-powered sales intelligence', 'How SaaS companies accelerate pipeline velocity with AI', 'Carlos Mendez, VP Sales at PipelineGenius, needs to accelerate pipeline velocity. Direct, urgent messaging.', 'Launch campaign with velocity-focused messaging.', 'ready');

const prospect8 = quick('Diana Foster', 'CMO', 'RevMomentum', 78, 'high', 76, 'RevMomentum — Marketing-Sales Alignment', 'multi_touch', 76, 71, 'Align marketing and sales with AI-powered revenue intelligence', 'How CMOs drive revenue with AI-powered marketing intelligence', 'Diana Foster, CMO at RevMomentum, needs marketing-sales alignment. Conversational approach.', 'Launch campaign with alignment-focused messaging.', 'partially_ready');

const prospect9 = quick('Eric Wang', 'CEO', 'ConversionLab', 65, 'medium', 68, 'ConversionLab — AI Conversion Intelligence', 'sequence', 68, 63, 'AI-powered conversion intelligence for data-driven growth', 'How internet companies optimize conversions with AI', 'Eric Wang, CEO at ConversionLab, has medium intent. Professional, executive-level outreach.', 'Launch campaign with conversion intelligence focus.', 'partially_ready');

const prospect10 = quick('Fiona Zhang', 'Head of Growth', 'ScaleOS', 79, 'high', 77, 'ScaleOS — Multi-Geography Growth Intelligence', 'multi_touch', 77, 72, 'Scale growth operations across geographies with AI intelligence', 'How IT services companies scale multi-geography growth', 'Fiona Zhang, Head of Growth at ScaleOS, needs multi-geography growth intelligence. Direct, urgent approach.', 'Launch campaign with multi-geography scaling focus.', 'ready');

const prospect11 = quick('Greg Thompson', 'CRO', 'ContentGenius', 76, 'high', 75, 'ContentGenius — Content-to-Revenue Attribution', 'multi_touch', 75, 70, 'AI-powered content intelligence that drives pipeline growth', 'How content marketing drives 40% of pipeline for SaaS', 'Greg Thompson, CRO at ContentGenius, needs content-to-revenue attribution.', 'Launch campaign with content ROI focus.', 'partially_ready');

const prospect12 = quick('Hannah Brooks', 'VP RevOps', 'NexusCRM', 75, 'medium', 73, 'NexusCRM — CRM Automation & Intelligence', 'multi_touch', 73, 68, 'AI-powered CRM intelligence that automates RevOps reporting', 'How RevOps teams automate CRM intelligence with AI', 'Hannah Brooks, VP RevOps at NexusCRM, needs CRM automation.', 'Launch campaign with RevOps automation focus.', 'partially_ready');

const prospect13 = quick('Ian Clarke', 'CEO', 'GrowthLoop', 74, 'medium', 72, 'GrowthLoop — AI Growth Intelligence', 'sequence', 72, 67, 'AI-powered growth intelligence for data-driven revenue strategies', 'How AI growth intelligence drives 3x revenue', 'Ian Clarke, CEO at GrowthLoop, needs growth intelligence. Inspirational approach.', 'Launch campaign with growth intelligence focus.', 'partially_ready');

const prospect14 = quick('Julia Santos', 'CRO', 'SecureNet', 72, 'medium', 70, 'SecureNet — Enterprise Sales Acceleration', 'multi_touch', 70, 65, 'AI-powered security sales intelligence for enterprise pipeline', 'How cybersecurity companies accelerate enterprise sales', 'Julia Santos, CRO at SecureNet, needs enterprise sales acceleration.', 'Launch campaign with enterprise sales focus.', 'partially_ready');

const prospect15 = quick('Kevin O\'Brien', 'VP Sales', 'DeployHQ', 68, 'medium', 65, 'DeployHQ — Technical Sales Intelligence', 'sequence', 65, 60, 'AI-powered DevOps sales intelligence for pipeline acceleration', 'How DevOps companies accelerate technical sales with AI', 'Kevin O\'Brien, VP Sales at DeployHQ, needs technical sales intelligence.', 'Launch campaign with technical sales focus.', 'partially_ready');

const prospect16 = quick('Laura Bennett', 'CEO', 'ChatWave', 58, 'low', 55, 'ChatWave — AI Customer Engagement Intelligence', 'drip', 55, 50, 'AI-powered customer engagement intelligence for startup growth', 'How AI startups scale customer engagement', 'Laura Bennett, CEO at ChatWave, is early stage with low intent. Relationship-building approach.', 'Launch drip campaign with industry trends focus.', 'partially_ready');

const prospect17 = quick('Marcus Johnson', 'CRO', 'MetricStream', 70, 'medium', 68, 'MetricStream — Unified Business Metrics', 'multi_touch', 68, 63, 'AI-powered business metrics intelligence for RevOps', 'How SaaS companies unify business metrics with AI', 'Marcus Johnson, CRO at MetricStream, needs unified metrics intelligence.', 'Launch campaign with metrics unification focus.', 'partially_ready');

const prospect18 = quick('Nina Patel', 'Head of RevOps', 'OmniChannel', 73, 'high', 71, 'OmniChannel — Cross-Channel Pipeline Intelligence', 'multi_touch', 71, 66, 'AI-powered cross-channel intelligence for unified pipeline', 'How cross-channel companies unify pipeline with AI', 'Nina Patel, Head of RevOps at OmniChannel, needs cross-channel intelligence.', 'Launch campaign with cross-channel focus.', 'ready');

const prospect19 = quick('Oscar Ruiz', 'CEO', 'Vertex Labs', 78, 'high', 76, 'Vertex Labs — AI Platform Scaling Intelligence', 'multi_touch', 76, 71, 'AI platform engineering intelligence for scaling infrastructure', 'How AI platform companies scale revenue intelligence', 'Oscar Ruiz, CEO at Vertex Labs, needs platform scaling intelligence.', 'Launch campaign with platform scaling focus.', 'ready');

const prospect20 = quick('Priya Sharma', 'CRO', 'BrightPath', 65, 'medium', 63, 'BrightPath — Digital Experience Revenue Intelligence', 'sequence', 63, 58, 'AI-powered digital experience intelligence for revenue growth', 'How digital experience companies drive revenue with AI', 'Priya Sharma, CRO at BrightPath, needs digital experience intelligence.', 'Launch campaign with digital experience focus.', 'partially_ready');

const prospect21 = quick('Quentin Adams', 'VP Sales', 'CoreData', 74, 'medium', 72, 'CoreData — Enterprise Data Sales Acceleration', 'multi_touch', 72, 67, 'AI-powered data platform intelligence for enterprise sales', 'How data platform companies accelerate enterprise sales', 'Quentin Adams, VP Sales at CoreData, needs enterprise sales acceleration.', 'Launch campaign with enterprise sales focus.', 'partially_ready');

const prospect22 = quick('Rachel Green', 'Head of Growth', 'PulseCRM', 67, 'medium', 65, 'PulseCRM — CRM Growth Automation', 'sequence', 65, 60, 'AI-powered CRM intelligence for growth automation', 'How CRM companies automate growth with AI', 'Rachel Green, Head of Growth at PulseCRM, needs CRM automation.', 'Launch campaign with growth automation focus.', 'partially_ready');

const prospect23 = quick('Sam Wilson', 'CRO', 'ApexGrowth', 70, 'medium', 68, 'ApexGrowth — Growth Platform Intelligence', 'multi_touch', 68, 63, 'AI-powered growth platform intelligence for revenue acceleration', 'How growth platforms drive revenue with AI', 'Sam Wilson, CRO at ApexGrowth, needs growth platform intelligence.', 'Launch campaign with growth intelligence focus.', 'partially_ready');

const prospect24 = quick('Tara Mitchell', 'CEO', 'Sentinel Security', 72, 'high', 70, 'Sentinel Security — Security Revenue Intelligence', 'multi_touch', 70, 65, 'AI-powered security intelligence for enterprise revenue', 'How security companies scale revenue with AI', 'Tara Mitchell, CEO at Sentinel Security, needs security sales intelligence.', 'Launch campaign with security intelligence focus.', 'ready');

const prospect25 = quick('Uma Krishnan', 'VP RevOps', 'Beacon AI', 60, 'low', 58, 'Beacon AI — Startup RevOps Automation', 'drip', 58, 53, 'AI-powered analytics intelligence for startup RevOps', 'How AI startups automate RevOps intelligence', 'Uma Krishnan, VP RevOps at Beacon AI, is early stage. Relationship-building approach.', 'Launch drip campaign with RevOps automation focus.', 'partially_ready');

const prospect26 = quick('Victor Chen', 'CRO', 'SummitData', 71, 'medium', 69, 'SummitData — Data Infrastructure Sales Intelligence', 'multi_touch', 69, 64, 'AI-powered data infrastructure intelligence for pipeline', 'How data infrastructure companies accelerate pipeline', 'Victor Chen, CRO at SummitData, needs data infrastructure sales intelligence.', 'Launch campaign with pipeline acceleration focus.', 'partially_ready');

const prospect27 = quick('Wendy Lopez', 'Head of Sales', 'Velocity Sales', 69, 'medium', 67, 'Velocity Sales — Sales Velocity Intelligence', 'multi_touch', 67, 62, 'AI-powered sales velocity intelligence for pipeline acceleration', 'How SaaS companies accelerate sales velocity with AI', 'Wendy Lopez, Head of Sales at Velocity Sales, needs sales velocity intelligence.', 'Launch campaign with velocity focus.', 'partially_ready');

const prospect28 = quick('Xavier Dubois', 'CEO', 'Horizon Cloud', 76, 'high', 74, 'Horizon Cloud — Multi-Cloud Revenue Intelligence', 'multi_touch', 74, 69, 'AI-powered cloud infrastructure intelligence for multi-cloud revenue', 'How cloud companies scale revenue with AI', 'Xavier Dubois, CEO at Horizon Cloud, needs cloud intelligence.', 'Launch campaign with multi-cloud focus.', 'ready');

const prospect29 = quick('Yuki Tanaka', 'CRO', 'Lumen Technologies', 72, 'medium', 70, 'Lumen Technologies — Enterprise Platform Sales', 'multi_touch', 70, 65, 'AI-powered technology platform intelligence for enterprise revenue', 'How technology platforms accelerate enterprise revenue', 'Yuki Tanaka, CRO at Lumen Technologies, needs enterprise sales intelligence.', 'Launch campaign with enterprise sales focus.', 'partially_ready');

const prospect30 = quick('Zara Ali', 'VP RevOps', 'Cobalt Analytics', 68, 'medium', 66, 'Cobalt Analytics — Analytics RevOps Intelligence', 'sequence', 66, 61, 'AI-powered analytics intelligence for RevOps automation', 'How analytics companies automate RevOps with AI', 'Zara Ali, VP RevOps at Cobalt Analytics, needs analytics RevOps intelligence.', 'Launch campaign with RevOps automation focus.', 'partially_ready');

const prospect31 = quick('Aaron Black', 'CRO', 'Quartz Systems', 71, 'medium', 69, 'Quartz Systems — Integration Sales Acceleration', 'multi_touch', 69, 64, 'AI-powered system integration intelligence for enterprise sales', 'How system integrators accelerate enterprise sales', 'Aaron Black, CRO at Quartz Systems, needs integration sales intelligence.', 'Launch campaign with enterprise sales focus.', 'partially_ready');

const prospect32 = quick('Bella Cruz', 'Head of Growth', 'Meridian AI', 62, 'low', 60, 'Meridian AI — Mid-Market Growth Intelligence', 'drip', 60, 55, 'AI-powered solutions intelligence for mid-market growth', 'How AI startups scale mid-market growth', 'Bella Cruz, Head of Growth at Meridian AI, is early stage. Relationship-building approach.', 'Launch drip campaign with mid-market focus.', 'partially_ready');

const prospect33 = quick('Cody Evans', 'CRO', 'Atlas Data', 72, 'medium', 70, 'Atlas Data — Data Management Revenue Intelligence', 'multi_touch', 70, 65, 'AI-powered data management intelligence for enterprise revenue', 'How data management companies scale enterprise revenue', 'Cody Evans, CRO at Atlas Data, needs data management intelligence.', 'Launch campaign with enterprise sales focus.', 'partially_ready');

const prospect34 = quick('Dana Hart', 'VP Sales', 'Forge Digital', 67, 'medium', 65, 'Forge Digital — Digital Sales Intelligence', 'sequence', 65, 60, 'AI-powered digital transformation intelligence for pipeline', 'How digital companies accelerate sales with AI', 'Dana Hart, VP Sales at Forge Digital, needs digital sales intelligence.', 'Launch campaign with digital sales focus.', 'partially_ready');

const prospect35 = quick('Ethan Ward', 'CRO', 'Prism Security', 73, 'high', 71, 'Prism Security — Security Automation Sales', 'multi_touch', 71, 66, 'AI-powered security automation intelligence for enterprise sales', 'How security companies automate sales with AI', 'Ethan Ward, CRO at Prism Security, needs security sales intelligence.', 'Launch campaign with security automation focus.', 'ready');

const prospect36 = quick('Faye Dunn', 'Head of RevOps', 'Catalyst Growth', 74, 'high', 72, 'Catalyst Growth — Growth Platform RevOps', 'multi_touch', 72, 67, 'AI-powered growth platform intelligence for RevOps automation', 'How growth platforms automate RevOps with AI', 'Faye Dunn, Head of RevOps at Catalyst Growth, needs growth RevOps intelligence.', 'Launch campaign with RevOps automation focus.', 'ready');

const prospect37 = quick('Gavin Reed', 'CRO', 'Vantage Point', 66, 'medium', 64, 'Vantage Point — BI Sales Intelligence', 'sequence', 64, 59, 'AI-powered business intelligence for executive dashboards', 'How BI companies accelerate executive sales with AI', 'Gavin Reed, CRO at Vantage Point, needs BI sales intelligence.', 'Launch campaign with executive BI focus.', 'partially_ready');

const prospect38 = quick('Holly Bates', 'VP Sales', 'Stellar Cloud', 79, 'high', 77, 'Stellar Cloud — Multi-Cloud Sales Acceleration', 'multi_touch', 77, 72, 'AI-powered cloud management intelligence for multi-cloud sales', 'How cloud companies accelerate multi-cloud sales', 'Holly Bates, VP Sales at Stellar Cloud, needs cloud sales intelligence.', 'Launch campaign with multi-cloud sales focus.', 'ready');

const prospect39 = quick('Ivan Petrov', 'CRO', 'Orbit Analytics', 65, 'medium', 63, 'Orbit Analytics — Product Analytics Sales', 'sequence', 63, 58, 'AI-powered product analytics intelligence for revenue operations', 'How analytics companies accelerate sales with AI', 'Ivan Petrov, CRO at Orbit Analytics, needs analytics sales intelligence.', 'Launch campaign with analytics sales focus.', 'partially_ready');

const prospect40 = quick('Jade Morrison', 'Head of Growth', 'Nimbus AI', 56, 'low', 54, 'Nimbus AI — SMB Growth Intelligence', 'drip', 54, 49, 'AI-powered platform intelligence for SMB growth', 'How AI startups scale SMB growth', 'Jade Morrison, Head of Growth at Nimbus AI, is early stage. Relationship-building approach.', 'Launch drip campaign with SMB growth focus.', 'partially_ready');

const prospect41 = quick('Karl Schmidt', 'CRO', 'Quantum Labs', 76, 'high', 74, 'Quantum Labs — Quantum Infrastructure Sales', 'multi_touch', 74, 69, 'AI-powered quantum infrastructure intelligence for enterprise revenue', 'How quantum companies scale enterprise revenue with AI', 'Karl Schmidt, CRO at Quantum Labs, needs quantum sales intelligence.', 'Launch campaign with quantum intelligence focus.', 'ready');

const prospect42 = quick('Lena Park', 'VP RevOps', 'Pioneer CRM', 67, 'medium', 65, 'Pioneer CRM — CRM Platform RevOps', 'sequence', 65, 60, 'AI-powered CRM platform intelligence for RevOps automation', 'How CRM companies automate RevOps with AI', 'Lena Park, VP RevOps at Pioneer CRM, needs CRM RevOps intelligence.', 'Launch campaign with RevOps automation focus.', 'partially_ready');

const prospect43 = quick('Mason Cole', 'CRO', 'Vanguard Sales', 71, 'medium', 69, 'Vanguard Sales — Sales Intelligence Platform', 'multi_touch', 69, 64, 'AI-powered sales intelligence for pipeline optimization', 'How sales intelligence companies accelerate revenue', 'Mason Cole, CRO at Vanguard Sales, needs sales intelligence.', 'Launch campaign with sales intelligence focus.', 'partially_ready');

const prospect44 = quick('Nora Fields', 'Head of Growth', 'Cipher Security', 71, 'medium', 69, 'Cipher Security — Security Growth Intelligence', 'multi_touch', 69, 64, 'AI-powered security platform intelligence for growth acceleration', 'How security companies accelerate growth with AI', 'Nora Fields, Head of Growth at Cipher Security, needs security growth intelligence.', 'Launch campaign with security growth focus.', 'partially_ready');

const prospect45 = quick('Owen Hunt', 'CRO', 'Echo Marketing', 64, 'medium', 62, 'Echo Marketing — Marketing Automation Sales', 'sequence', 62, 57, 'AI-powered marketing automation intelligence for revenue operations', 'How marketing companies automate sales with AI', 'Owen Hunt, CRO at Echo Marketing, needs marketing sales intelligence.', 'Launch campaign with marketing automation focus.', 'partially_ready');

const prospect46 = quick('Penny Watts', 'VP RevOps', 'Drift Data', 70, 'medium', 68, 'Drift Data — Data Pipeline RevOps', 'multi_touch', 68, 63, 'AI-powered data pipeline intelligence for RevOps automation', 'How data pipeline companies automate RevOps', 'Penny Watts, VP RevOps at Drift Data, needs data RevOps intelligence.', 'Launch campaign with RevOps automation focus.', 'partially_ready');

const prospect47 = quick('Riley Cooper', 'Head of Sales', 'Flux Analytics', 59, 'low', 56, 'Flux Analytics — Streaming Analytics Growth', 'drip', 56, 51, 'AI-powered streaming analytics intelligence for startup growth', 'How analytics startups scale growth with AI', 'Riley Cooper, Head of Sales at Flux Analytics, is early stage. Relationship-building approach.', 'Launch drip campaign with analytics growth focus.', 'partially_ready');

const prospect48 = quick('Sasha Lee', 'CRO', 'Apex Revenue', 78, 'high', 76, 'Apex Revenue — Revenue Intelligence Platform', 'multi_touch', 76, 71, 'AI-powered revenue intelligence for pipeline forecasting', 'How revenue intelligence companies scale with AI', 'Sasha Lee, CRO at Apex Revenue, needs revenue intelligence.', 'Launch campaign with revenue intelligence focus.', 'ready');

const prospect49 = quick('Tony Stark', 'VP Sales', 'Lumen Technologies', 70, 'medium', 68, 'Lumen Technologies — Enterprise Platform Sales', 'multi_touch', 68, 63, 'AI-powered technology platform intelligence for enterprise sales', 'How technology platforms accelerate enterprise sales', 'Tony Stark, VP Sales at Lumen Technologies, needs enterprise sales intelligence.', 'Launch campaign with enterprise sales focus.', 'partially_ready');

const prospect50 = quick('Ursula Vance', 'Head of RevOps', 'GrowthLoop', 73, 'high', 71, 'GrowthLoop — Growth Marketing RevOps', 'multi_touch', 71, 66, 'AI-powered growth marketing intelligence for RevOps automation', 'How growth marketing companies automate RevOps', 'Ursula Vance, Head of RevOps at GrowthLoop, needs growth RevOps intelligence.', 'Launch campaign with RevOps automation focus.', 'ready');

// ============================================================
// Aggregated Array
// ============================================================

export const MOCK_CAMPAIGNS: MockCampaign[] = [
  prospect1, prospect2, prospect3, prospect4, prospect5, prospect6, prospect7, prospect8, prospect9, prospect10,
  prospect11, prospect12, prospect13, prospect14, prospect15, prospect16, prospect17, prospect18, prospect19, prospect20,
  prospect21, prospect22, prospect23, prospect24, prospect25, prospect26, prospect27, prospect28, prospect29, prospect30,
  prospect31, prospect32, prospect33, prospect34, prospect35, prospect36, prospect37, prospect38, prospect39, prospect40,
  prospect41, prospect42, prospect43, prospect44, prospect45, prospect46, prospect47, prospect48, prospect49, prospect50,
];

// ============================================================
// Shared AI Recommendations (from prospect 1)
// ============================================================

export const MOCK_AI_RECOMMENDATIONS: OutreachAIRecommendations = prospect1.ai_recommendations;
