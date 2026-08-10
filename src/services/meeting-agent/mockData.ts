// ============================================================
// Meeting Agent — Mock Data (50 prospects)
// ============================================================

import type {
  Meeting,
  MeetingBrief,
  MeetingPreparation,
  CRMUpdate,
  MeetingOutcomeRecord,
  CalendarInfo,
  MeetingAIRecommendations,
  FullMeeting,
  TimeSlot,
  Participant,
  MeetingStatus,
  MeetingType,
  MeetingDuration,
  MeetingPlatform,
  CalendarStatus,
  CRMStatus,
  LeadStatus,
  OpportunityStage,
  ForecastCategory,
  AttendanceStatus,
  QualificationResult,
  MeetingOutcome,
  Priority,
} from '@/types/meeting-agent';
// ============================================================
// Prospect name pools
// ============================================================

const firstNames = ['Sarah', 'Michael', 'Jennifer', 'David', 'Emily', 'Robert', 'Amanda', 'Christopher', 'Lisa', 'James', 'Karen', 'Daniel', 'Nicole', 'Matthew', 'Stephanie', 'Andrew', 'Rachel', 'Tyler', 'Megan', 'Brandon', 'Lauren', 'Justin', 'Christina', 'Kevin', 'Brittany', 'Jason', 'Samantha', 'Eric', 'Ashley', 'Ryan', 'Melissa', 'Brian', 'Danielle', 'Jonathan', 'Hannah', 'Nicholas', 'Victoria', 'Thomas', 'Olivia', 'Anthony', 'Madison', 'William', 'Abigail', 'Alexander', 'Sophia', 'Benjamin', 'Isabella', 'Nathan', 'Grace', 'Samuel'];
const lastNames = ['Chen', 'Rodriguez', 'Johnson', 'Patel', 'Williams', 'Garcia', 'Thompson', 'Anderson', 'Martinez', 'Davis', 'Lopez', 'Wilson', 'Lee', 'Taylor', 'Brown', 'Jackson', 'White', 'Harris', 'Clark', 'Lewis', 'Walker', 'Hall', 'Allen', 'Young', 'King', 'Wright', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson', 'Hill', 'Carter', 'Mitchell', 'Roberts', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Evans', 'Edwards', 'Collins', 'Stewart', 'Sanchez', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell'];
const companies = ['CloudFlow Inc', 'DataSync Labs', 'Nexus Systems', 'Quantum Leap', 'Vertex Solutions', 'Apex Dynamics', 'BrightWave', 'CoreStack', 'MetaForge', 'Zenith Group', 'InnoTech', 'ScaleUp Co', 'FlowState', 'PulseGrid', 'NimbusAI', 'StratoCloud', 'DataMiner', 'OpsEngine', 'RevScale', 'GrowthForge', 'CloudPeak', 'SyncFlow', 'DataForge', 'ScaleIQ', 'NexusOps', 'FlowMetrics', 'GridWorks', 'CloudShift', 'DataPulse', 'OpsFlow', 'RevForge', 'GrowthStack', 'CloudMetrics', 'SyncStack', 'DataOps', 'ScaleFlow', 'NexusGrid', 'FlowOps', 'GridScale', 'CloudForge', 'PulseStack', 'SyncGrid', 'DataScale', 'OpsGrid', 'RevPulse', 'GrowthFlow', 'CloudOps', 'SyncScale', 'DataFlow', 'ScaleForge'];
const titles = ['VP of Sales', 'Head of Revenue Operations', 'Chief Revenue Officer', 'VP of Marketing', 'Director of Growth', 'Head of Sales Operations', 'VP of RevOps', 'Chief Marketing Officer', 'Director of Sales', 'Head of Demand Gen', 'VP of Business Development', 'Chief Executive Officer', 'Director of RevOps', 'VP of Customer Success', 'Head of Sales Enablement'];
const reps = ['Alex Morgan', 'Jordan Blake', 'Taylor Quinn', 'Casey Reed', 'Morgan Hayes', 'Riley Cohen', 'Drew Parker', 'Sam Bennett', 'Jamie Lee', 'Avery Stone'];

// ============================================================
// Meeting patterns (5 patterns cycled across 50 prospects)
// ============================================================

type MeetingPattern = {
  status: MeetingStatus;
  meeting_type: MeetingType;
  duration: MeetingDuration;
  platform: MeetingPlatform;
  calendar_status: CalendarStatus;
  crm_status: CRMStatus;
  readiness_score: number;
  revenue_potential: number;
  priority: Priority;
  attendance: AttendanceStatus;
  qualification: QualificationResult;
  outcome: MeetingOutcome;
  lead_status: LeadStatus;
  opportunity_stage: OpportunityStage;
  forecast: ForecastCategory;
  deal_value: number;
};

const patterns: MeetingPattern[] = [
  {
    status: 'completed',
    meeting_type: 'discovery',
    duration: 30,
    platform: 'zoom',
    calendar_status: 'synced',
    crm_status: 'synced',
    readiness_score: 92,
    revenue_potential: 48000,
    priority: 'high',
    attendance: 'attended',
    qualification: 'qualified',
    outcome: 'moved_to_opportunity',
    lead_status: 'opportunity',
    opportunity_stage: 'needs_analysis',
    forecast: 'best_case',
    deal_value: 48000,
  },
  {
    status: 'scheduled',
    meeting_type: 'demo',
    duration: 45,
    platform: 'google_meet',
    calendar_status: 'synced',
    crm_status: 'synced',
    readiness_score: 88,
    revenue_potential: 75000,
    priority: 'high',
    attendance: 'pending',
    qualification: 'pending',
    outcome: 'pending',
    lead_status: 'qualified',
    opportunity_stage: 'qualification',
    forecast: 'pipeline',
    deal_value: 75000,
  },
  {
    status: 'scheduling',
    meeting_type: 'discovery',
    duration: 30,
    platform: 'zoom',
    calendar_status: 'pending',
    crm_status: 'pending',
    readiness_score: 75,
    revenue_potential: 36000,
    priority: 'medium',
    attendance: 'pending',
    qualification: 'pending',
    outcome: 'pending',
    lead_status: 'qualified',
    opportunity_stage: 'prospecting',
    forecast: 'pipeline',
    deal_value: 36000,
  },
  {
    status: 'completed',
    meeting_type: 'technical',
    duration: 60,
    platform: 'microsoft_teams',
    calendar_status: 'synced',
    crm_status: 'synced',
    readiness_score: 85,
    revenue_potential: 120000,
    priority: 'critical',
    attendance: 'attended',
    qualification: 'qualified',
    outcome: 'closed_won',
    lead_status: 'customer',
    opportunity_stage: 'closed_won',
    forecast: 'closed',
    deal_value: 120000,
  },
  {
    status: 'rescheduled',
    meeting_type: 'follow_up',
    duration: 30,
    platform: 'zoom',
    calendar_status: 'conflict',
    crm_status: 'synced',
    readiness_score: 68,
    revenue_potential: 24000,
    priority: 'medium',
    attendance: 'rescheduled',
    qualification: 'needs_followup',
    outcome: 'followup_scheduled',
    lead_status: 'qualified',
    opportunity_stage: 'proposal',
    forecast: 'pipeline',
    deal_value: 24000,
  },
];

// ============================================================
// Calendar slot generator
// ============================================================

function generateSlots(baseDate: Date): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const labels = ['9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM'];
  labels.forEach((label, i) => {
    const start = new Date(baseDate);
    start.setHours(9 + i + (i >= 3 ? 2 : 0), 0, 0, 0);
    const end = new Date(start);
    end.setMinutes(start.getMinutes() + 30);
    slots.push({
      id: `slot-${i}`,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      available: i !== 2 && i !== 5,
      label,
    });
  });
  return slots;
}

function generateParticipants(prospectName: string, rep: string): Participant[] {
  return [
    { name: prospectName, email: `${prospectName.toLowerCase().replace(/\s+/g, '.')}@company.com`, role: 'Prospect', required: true },
    { name: rep, email: `${rep.toLowerCase().replace(/\s+/g, '.')}@revenueai.com`, role: 'Sales Rep', required: true },
    { name: 'Sarah Chen', email: 'sarah.chen@revenueai.com', role: 'Sales Engineer', required: false },
  ];
}

// ============================================================
// Brief content templates
// ============================================================

const briefTemplates = [
  {
    executive_summary: 'Prospect has been qualified through LinkedIn outreach with strong engagement signals. Company recently raised Series B funding and is actively scaling their revenue team. They have expressed interest in automating pipeline operations and reducing manual data entry.',
    company_summary: 'Mid-market SaaS company in the revenue operations space with 200-500 employees. Recently raised Series B funding of $25M. Currently using Salesforce and Outreach.io but struggling with data synchronization and pipeline visibility.',
    conversation_summary: 'Initial contact via LinkedIn connection request was accepted within 24 hours. Prospect responded positively to first message, expressing pain with manual CRM updates. Two follow-up exchanges confirmed interest in a discovery call to explore automation capabilities.',
    recommended_questions: [
      'What does your current revenue operations workflow look like?',
      'How much time does your team spend on manual CRM data entry each week?',
      'What tools are you currently using to manage your sales pipeline?',
      'How are you measuring pipeline accuracy and forecast reliability today?',
      'What would a successful implementation look like for your team in the first 90 days?',
    ],
    recommended_services: ['Revenue Intelligence Platform', 'Pipeline Automation Suite', 'CRM Sync Engine', 'Forecasting Dashboard'],
    recommended_talking_points: [
      'Highlight how our platform reduces manual CRM updates by 80%',
      'Discuss the $25M Series B funding and their scaling challenges',
      'Reference similar companies in their space who have seen 3x pipeline accuracy improvements',
      'Address their current Salesforce integration pain points',
    ],
    potential_objections: [
      'We just invested in Outreach.io, not sure we need another tool',
      'Our team is small, might not justify the cost right now',
      'We need to finish our current Salesforce migration first',
    ],
    expected_outcomes: [
      'Schedule a technical demo with the sales engineering team',
      'Identify key stakeholders for the buying committee',
      'Agree on a pilot program with 3-5 reps',
      'Set timeline for Q3 implementation decision',
    ],
  },
  {
    executive_summary: 'Prospect is a high-intent buyer who has been actively researching revenue intelligence platforms. Company is in hyper-growth mode post-IPO and needs to scale their sales operations quickly. Multiple stakeholders have been identified in the buying committee.',
    company_summary: 'Enterprise SaaS company that recently went public. 1000+ employees with a complex multi-product revenue model. Using a mix of Salesforce, Gong, and custom internal tools. Experiencing significant growing pains with pipeline visibility and cross-team alignment.',
    conversation_summary: 'Prospect proactively responded to outreach with detailed questions about integrations and pricing. Has been researching competitors and has a clear understanding of the market. Expressed urgency around Q3 budget allocation and implementation timeline.',
    recommended_questions: [
      'How are you currently handling pipeline visibility across multiple product lines?',
      'What gaps have you identified in your current Gong + Salesforce setup?',
      'Who else is involved in the evaluation process for new revenue tools?',
      'What is your Q3 budget allocation process and timeline?',
      'How are you measuring the ROI of your current revenue stack?',
    ],
    recommended_services: ['Enterprise Revenue Intelligence', 'Multi-Product Pipeline Manager', 'Advanced Forecasting Suite', 'Custom Integration Package'],
    recommended_talking_points: [
      'Focus on enterprise-grade multi-product pipeline management',
      'Reference our public company customers who scaled from $50M to $200M ARR',
      'Address their post-IPO compliance and reporting requirements',
      'Discuss dedicated implementation team and success manager',
    ],
    potential_objections: [
      'We need to involve our IT security team for any new vendor',
      'Our procurement process for public companies is lengthy',
      'We have budget allocated but need board approval for new spend',
    ],
    expected_outcomes: [
      'Schedule technical evaluation with IT security team',
      'Identify budget approval timeline and process',
      'Map out the complete buying committee',
      'Agree on a 60-day enterprise pilot with dedicated support',
    ],
  },
  {
    executive_summary: 'Prospect is in the early evaluation stage but has shown consistent interest. Company is a fast-growing startup that needs to establish proper revenue operations before scaling their sales team. Currently using basic tools and looking to professionalize their stack.',
    company_summary: 'Early-stage startup with 50-100 employees, pre-Series A. Currently using HubSpot Starter and manual spreadsheets for pipeline management. Looking to build a scalable revenue operations foundation before their next funding round.',
    conversation_summary: 'Prospect has been responsive but cautious. Asked about pricing tiers and implementation complexity. Has expressed concern about being too early for a full platform but is interested in starting with core features and expanding over time.',
    recommended_questions: [
      'What does your current sales process look like from lead to close?',
      'How are you tracking pipeline health today?',
      'What are your plans for scaling the sales team in the next 6-12 months?',
      'What would you need to see to justify the investment before your next funding round?',
      'How are you currently forecasting revenue for your board?',
    ],
    recommended_services: ['Starter Revenue Intelligence', 'Pipeline Builder', 'CRM Foundation Setup', 'Growth Forecasting Tool'],
    recommended_talking_points: [
      'Emphasize the starter plan designed for early-stage companies',
      'Discuss how proper RevOps foundation helps with fundraising',
      'Reference startups that scaled from $1M to $10M ARR with our platform',
      'Address their concern about being too early — highlight flexible pricing',
    ],
    potential_objections: [
      'We might be too early for a full platform',
      'Budget is tight before our next funding round',
      'We need something simple, not a complex enterprise tool',
    ],
    expected_outcomes: [
      'Start with the starter plan and a 30-day pilot',
      'Identify key metrics they want to track for their next funding round',
      'Set up a check-in after 30 days to evaluate expanding to the growth plan',
    ],
  },
  {
    executive_summary: 'High-value prospect with a clear and urgent need. Company is losing deals due to poor pipeline visibility and inaccurate forecasting. Decision maker is the CRO who has budget authority and a mandate to fix revenue operations within the quarter.',
    company_summary: 'Mid-market B2B SaaS company, 500-1000 employees, $50M+ ARR. Recently hired a new CRO who is evaluating the entire revenue stack. Current tools include Salesforce, Salesloft, and Clari but data is fragmented across systems. Losing 15% of deals to poor follow-up.',
    conversation_summary: 'CRO responded quickly to outreach and has been highly engaged. Shared specific pain points around forecast accuracy (currently 60% accuracy) and deal slippage. Has budget approved for Q3 and wants to implement before end of quarter.',
    recommended_questions: [
      'What is your current forecast accuracy and where are the biggest gaps?',
      'How are you currently tracking deal velocity across your pipeline?',
      'What is the financial impact of the 15% deal loss rate?',
      'Who needs to be involved in the implementation process?',
      'What is your ideal timeline for go-live?',
    ],
    recommended_services: ['Revenue Intelligence Platform', 'Forecast Accuracy Suite', 'Deal Velocity Tracker', 'Pipeline Rescue Package'],
    recommended_talking_points: [
      'Address the 15% deal loss rate directly with specific solutions',
      'Reference case studies of companies that improved forecast accuracy from 60% to 95%',
      'Discuss rapid implementation (2-3 weeks) to hit their end-of-quarter deadline',
      'Highlight ROI: recovering even 5% of lost deals pays for the platform 10x over',
    ],
    potential_objections: [
      'We already have Clari for forecasting, why do we need another tool?',
      'End of quarter is tight for implementation',
      'We need to get buy-in from the sales ops team',
    ],
    expected_outcomes: [
      'Move directly to a proposal with pricing for an annual contract',
      'Schedule implementation kickoff meeting within 1 week',
      'Identify the 3-5 deals at risk that we can help save immediately',
      'Set up weekly check-ins during the implementation period',
    ],
  },
  {
    executive_summary: 'Prospect meeting was rescheduled due to a calendar conflict on their end. They remain interested but the delay requires careful follow-up to maintain momentum. The buying window is still open but narrowing.',
    company_summary: 'Growing B2B company with 100-200 employees. Using Pipedrive and considering upgrading to a more robust revenue operations platform. The VP of Sales is the key decision maker but has been busy with their own quarter-end activities.',
    conversation_summary: 'Prospect was initially very responsive and agreed to a meeting. However, the meeting was rescheduled twice due to conflicts on their end. They have apologized and confirmed they are still interested but need flexibility in scheduling.',
    recommended_questions: [
      'I understand you have been busy with quarter-end — how did things wrap up?',
      'Are you still looking to improve your pipeline visibility before next quarter?',
      'Would it be easier to do a shorter 15-minute intro call first?',
      'What does your availability look like for next week?',
    ],
    recommended_services: ['Revenue Intelligence Platform', 'Pipeline Automation Suite', 'Pipedrive Integration Package'],
    recommended_talking_points: [
      'Acknowledge their busy schedule and offer flexible meeting options',
      'Suggest a shorter 15-minute call to keep momentum without a big time commitment',
      'Share a brief ROI calculator they can review on their own time',
      'Offer to send a recorded demo they can watch at their convenience',
    ],
    potential_objections: [
      'Things are still busy, can we push this to next month?',
      'I am not sure I can justify the time for a full demo right now',
      'Let me check with my team and get back to you',
    ],
    expected_outcomes: [
      'Schedule a shorter 15-minute intro call to re-engage',
      'Send a pre-recorded demo and ROI calculator for async review',
      'Agree on a specific date for the full discovery call',
    ],
  },
];

// ============================================================
// Preparation templates
// ============================================================

const preparationTemplates: Omit<MeetingPreparation, 'id' | 'meeting_id' | 'created_at'>[] = [
  {
    agenda: [
      'Introductions and rapport building (5 min)',
      'Company overview and current challenges (10 min)',
      'Platform demo tailored to their use case (10 min)',
      'Q&A and next steps (5 min)',
    ],
    case_studies: [
      { name: 'TechFlow Inc', industry: 'SaaS', result: 'Reduced manual CRM updates by 80%', relevance: 'Similar company size and pain points' },
      { name: 'GrowthLabs', industry: 'B2B Services', result: 'Improved forecast accuracy from 60% to 95%', relevance: 'Same CRM stack (Salesforce)' },
    ],
    pricing_notes: 'Start with Growth tier at $1,500/mo. If they push back, offer Starter at $800/mo with upgrade path. Annual billing gets 15% discount.',
    competitive_notes: 'Main competitors: Clari (more expensive, enterprise-only), InsightSquared (less automation). Key differentiator: our AI-powered automation and ease of implementation.',
    key_opportunities: [
      'Series B funding means they have budget and urgency',
      'Currently using 3+ tools that we can replace with one platform',
      'VP of Sales is the decision maker and is directly engaged',
    ],
    risks: [
      'They may be in the middle of a Salesforce migration',
      'Outreach.io investment might create lock-in concern',
      'Timeline may slip if stakeholders are not aligned',
    ],
  },
  {
    agenda: [
      'Strategic overview and market positioning (10 min)',
      'Enterprise capabilities deep dive (20 min)',
      'Integration architecture discussion (15 min)',
      'Implementation timeline and next steps (15 min)',
    ],
    case_studies: [
      { name: 'GlobalTech Corp', industry: 'Enterprise SaaS', result: 'Scaled pipeline from $50M to $200M ARR', relevance: 'Post-IPO company with similar complexity' },
      { name: 'MegaScale Inc', industry: 'B2B Platform', result: 'Reduced deal cycle by 35% with multi-product pipeline', relevance: 'Multi-product revenue model' },
    ],
    pricing_notes: 'Enterprise tier at $5,000/mo with custom integration package. Include dedicated CSM and implementation team. Multi-year contract for 20% discount.',
    competitive_notes: 'Competitors: Gong (no pipeline management), Salesloft (no intelligence layer). Key differentiator: unified revenue intelligence across the entire stack.',
    key_opportunities: [
      'Post-IPO company with approved Q3 budget',
      'Multiple stakeholders already identified',
      'Clear urgency around Q3 implementation deadline',
    ],
    risks: [
      'IT security review may delay implementation',
      'Procurement process for public companies can take 60+ days',
      'Board approval may be required for new spend',
    ],
  },
  {
    agenda: [
      'Quick introductions (3 min)',
      'Current process walkthrough (7 min)',
      'Starter plan overview (10 min)',
      'Q&A and pilot discussion (10 min)',
    ],
    case_studies: [
      { name: 'EarlyStage Co', industry: 'Startup', result: 'Built RevOps foundation before Series A', relevance: 'Similar stage and team size' },
      { name: 'LaunchPad Labs', industry: 'B2B SaaS', result: 'Raised Series A with clean pipeline data', relevance: 'Pre-funding company' },
    ],
    pricing_notes: 'Starter tier at $500/mo, designed for early-stage. Highlight flexible month-to-month billing. Growth plan at $1,500/mo available when they scale.',
    competitive_notes: 'Competitors: HubSpot (good starter but limited automation), Pipedrive (simple but no intelligence). Key differentiator: AI-powered insights at startup-friendly pricing.',
    key_opportunities: [
      'Pre-Series A companies need RevOps foundation for fundraising',
      'Flexible pricing model fits their budget constraints',
      'Can grow with them as they scale',
    ],
    risks: [
      'May be too early and not ready to commit',
      'Budget constraints before next funding round',
      'Simple needs may not justify full platform',
    ],
  },
  {
    agenda: [
      'Executive alignment on goals (10 min)',
      'Current state assessment (15 min)',
      'Solution deep dive with focus on forecast accuracy (20 min)',
      'Implementation plan and timeline (10 min)',
      'Commercial discussion and next steps (5 min)',
    ],
    case_studies: [
      { name: 'RapidScale Inc', industry: 'B2B SaaS', result: 'Improved forecast accuracy from 60% to 95% in 30 days', relevance: 'Exact pain point match' },
      { name: 'Velocity Corp', industry: 'Enterprise SaaS', result: 'Recovered $2.4M in lost deals with pipeline rescue', relevance: '15% deal loss rate scenario' },
    ],
    pricing_notes: 'Enterprise tier at $4,000/mo with Pipeline Rescue Package add-on. ROI: recovering 5% of lost deals = $2.5M value vs $48K annual cost. Offer 60-day money-back guarantee.',
    competitive_notes: 'Competitors: Clari (forecasting only, no deal rescue), InsightSquared (reporting only). Key differentiator: AI-powered deal rescue and 2-week implementation.',
    key_opportunities: [
      'CRO has budget authority and a mandate to fix this quarter',
      'Clear, quantifiable pain (15% deal loss, 60% forecast accuracy)',
      'End-of-quarter deadline creates urgency',
    ],
    risks: [
      'Clari investment may create perceived redundancy',
      'Tight implementation timeline before quarter-end',
      'Sales ops team buy-in needed but not yet engaged',
    ],
  },
  {
    agenda: [
      'Re-engagement and rapport rebuilding (5 min)',
      'Quick recap of previous interest (5 min)',
      'Short platform overview (15 min)',
      'Flexible next steps (5 min)',
    ],
    case_studies: [
      { name: 'FlexGrowth Co', industry: 'B2B Services', result: 'Started with 15-min call, became $60K deal', relevance: 'Rescheduled meeting scenario' },
      { name: 'AdaptScale Inc', industry: 'SaaS', result: 'Async demo led to full evaluation', relevance: 'Busy prospect pattern' },
    ],
    pricing_notes: 'Start with Growth tier at $1,200/mo. Offer flexible pilot terms. If they need more time, suggest a 30-day free trial to reduce commitment pressure.',
    competitive_notes: 'Competitors: Pipedrive (current tool), HubSpot. Key differentiator: easier migration from Pipedrive and superior automation.',
    key_opportunities: [
      'Still interested despite rescheduling — intent is real',
      'Pipedrive user looking to upgrade — clear migration path',
      'Can offer flexible options to accommodate their schedule',
    ],
    risks: [
      'Momentum may be lost with continued delays',
      'Prospect may deprioritize if not re-engaged quickly',
      'Competitors may engage during the delay',
    ],
  },
];

// ============================================================
// AI Recommendation templates
// ============================================================

const recommendationTemplates: Omit<MeetingAIRecommendations, 'confidence_score'>[] = [
  {
    executive_summary: 'This prospect is a strong fit with high readiness (92/100). They have budget, urgency, and a clear pain point. Recommend proceeding directly to a discovery call focused on their Salesforce integration challenges. The VP of Sales is engaged and has decision-making authority.',
    meeting_strategy: 'Focus the discovery call on their current manual CRM update process. Quantify the time savings (80% reduction) and tie it to their Series B scaling goals. Bring a sales engineer to address technical integration questions. Have pricing options ready for both Growth and Enterprise tiers.',
    recommended_attendees: ['Alex Morgan (Account Executive)', 'Sarah Chen (Sales Engineer)', 'VP of Sales (Prospect)', 'Sales Ops Manager (Prospect)'],
    next_best_action: 'Send a calendar invite with a pre-read brief containing the company summary and recommended questions. Follow up 24 hours before the meeting to confirm attendance.',
    post_meeting_recommendations: [
      'Send a personalized follow-up email within 2 hours summarizing key discussion points',
      'Create a CRM opportunity with the discussed deal value and next steps',
      'Schedule a technical demo with the sales engineering team within 5 business days',
      'Share 2-3 relevant case studies matching their industry and use case',
    ],
    meeting_readiness: 'ready',
  },
  {
    executive_summary: 'High-value enterprise prospect with approved Q3 budget. Multiple stakeholders identified. The post-IPO company has complex requirements but clear urgency. Recommend a strategic demo showcasing enterprise capabilities and integration architecture.',
    meeting_strategy: 'Position this as a strategic partnership, not just a tool purchase. Focus on multi-product pipeline management and post-IPO compliance requirements. Bring a solutions architect to address enterprise integration questions. Prepare a custom ROI model based on their ARR and deal loss rate.',
    recommended_attendees: ['Jordan Blake (Enterprise AE)', 'Taylor Quinn (Solutions Architect)', 'CRO (Prospect)', 'VP RevOps (Prospect)', 'IT Security Lead (Prospect)'],
    next_best_action: 'Send an executive brief with enterprise case studies and a custom ROI analysis. Coordinate with their IT security team for a pre-evaluation security review.',
    post_meeting_recommendations: [
      'Schedule a technical evaluation session with their IT security team',
      'Prepare a custom implementation plan with timeline and resource requirements',
      'Connect them with 2-3 reference customers of similar size and complexity',
      'Develop a business case document for their board approval process',
    ],
    meeting_readiness: 'ready',
  },
  {
    executive_summary: 'Early-stage prospect with genuine interest but budget constraints. They need a RevOps foundation before their next funding round. Recommend starting with the Starter plan and a flexible pilot to prove value before committing to a larger package.',
    meeting_strategy: 'Keep the meeting concise and focused on immediate value. Emphasize how a proper RevOps foundation helps with fundraising. Show how they can start small and scale. Avoid overwhelming them with enterprise features — focus on core pipeline visibility and CRM sync.',
    recommended_attendees: ['Casey Reed (Account Executive)', 'Founder/CEO (Prospect)', 'Head of Sales (Prospect)'],
    next_best_action: 'Send a starter plan proposal with month-to-month pricing. Include a one-page ROI summary showing how clean pipeline data helps with Series A fundraising.',
    post_meeting_recommendations: [
      'Set up a 30-day pilot with the Starter plan',
      'Schedule a check-in at day 15 to ensure they are getting value',
      'Provide templates for board reporting using our platform data',
      'Plan a growth plan upgrade discussion for after their next funding round',
    ],
    meeting_readiness: 'almost_ready',
  },
  {
    executive_summary: 'Critical opportunity with a CRO who has budget and urgency. The 15% deal loss rate and 60% forecast accuracy are quantifiable pain points with clear ROI. Recommend moving directly to a proposal with a rapid implementation plan to hit their end-of-quarter deadline.',
    meeting_strategy: 'Lead with the pain: 15% deal loss rate is costing them millions. Show the Pipeline Rescue Package and how it can recover at-risk deals immediately. Bring implementation lead to discuss 2-week deployment. Have contract ready with annual billing and money-back guarantee.',
    recommended_attendees: ['Morgan Hayes (Senior AE)', 'Riley Cohen (Implementation Lead)', 'CRO (Prospect)', 'Sales Ops Director (Prospect)'],
    next_best_action: 'Prepare a custom proposal with ROI analysis ($2.5M value vs $48K cost). Schedule an implementation kickoff meeting within 1 week. Identify 3-5 at-risk deals to showcase immediate value.',
    post_meeting_recommendations: [
      'Send the proposal within 24 hours with the ROI analysis',
      'Schedule the implementation kickoff meeting for next week',
      'Identify and share recovery strategies for 3-5 at-risk deals',
      'Set up weekly check-ins during the implementation period',
      'Connect the CRO with a reference customer who solved similar challenges',
    ],
    meeting_readiness: 'ready',
  },
  {
    executive_summary: 'Prospect interest remains but momentum has slowed due to rescheduling. Recommend a shorter, lower-commitment re-engagement approach. A 15-minute call or async demo can rebuild momentum without requiring a full meeting commitment.',
    meeting_strategy: 'Acknowledge their busy schedule and offer maximum flexibility. Suggest a 15-minute intro call or a pre-recorded demo they can watch async. Keep follow-up light but consistent. The goal is to maintain the relationship without being pushy.',
    recommended_attendees: ['Drew Parker (Account Executive)', 'VP of Sales (Prospect)'],
    next_best_action: 'Send a brief email offering two options: a 15-minute call this week or a pre-recorded demo to watch at their convenience. Include a one-page ROI summary.',
    post_meeting_recommendations: [
      'Send a personalized follow-up within 4 hours of the rescheduled meeting',
      'Offer flexible scheduling options including async demo review',
      'Share a brief ROI calculator they can review on their own time',
      'Set a reminder to follow up in 1 week if no response',
    ],
    meeting_readiness: 'warming_up',
  },
];

// ============================================================
// Generate 50 mock meetings
// ============================================================

function generateMeetings(): FullMeeting[] {
  const meetings: FullMeeting[] = [];

  for (let i = 0; i < 50; i++) {
    const pattern = patterns[i % patterns.length];
    const briefTemplate = briefTemplates[i % briefTemplates.length];
    const prepTemplate = preparationTemplates[i % preparationTemplates.length];
    const recTemplate = recommendationTemplates[i % recommendationTemplates.length];

    const prospectName = `${firstNames[i % firstNames.length]} ${lastNames[i % lastNames.length]}`;
    const company = companies[i % companies.length];
    const title = titles[i % titles.length];
    const rep = reps[i % reps.length];

    const meetingDate = new Date();
    meetingDate.setDate(meetingDate.getDate() + (i % 14) - 3);
    meetingDate.setHours(10 + (i % 6), 0, 0, 0);

    const meetingId = `meeting-${i + 1}`;
    const briefId = `brief-${i + 1}`;
    const prepId = `prep-${i + 1}`;
    const crmId = `crm-${i + 1}`;
    const outcomeId = `outcome-${i + 1}`;

    const meeting: Meeting = {
      id: meetingId,
      workspace_id: 'ws-demo',
      contact_id: `contact-${i + 1}`,
      company_id: `company-${i + 1}`,
      conversation_id: `conv-${i + 1}`,
      prospect_name: prospectName,
      prospect_title: title,
      company_name: company,
      status: pattern.status,
      meeting_type: pattern.meeting_type,
      meeting_duration: pattern.duration,
      meeting_platform: pattern.platform,
      meeting_time: pattern.status === 'completed' || pattern.status === 'scheduled' ? meetingDate.toISOString() : null,
      timezone: 'America/New_York',
      assigned_rep: rep,
      meeting_link: pattern.status === 'scheduled' || pattern.status === 'completed' ? `https://meet.example.com/${meetingId}` : null,
      calendar_status: pattern.calendar_status,
      crm_status: pattern.crm_status,
      meeting_readiness_score: pattern.readiness_score,
      revenue_potential: pattern.revenue_potential,
      error_message: null,
      created_at: new Date(Date.now() - (i + 5) * 86400000).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
    };

    const brief: MeetingBrief = {
      id: briefId,
      meeting_id: meetingId,
      executive_summary: briefTemplate.executive_summary,
      company_summary: briefTemplate.company_summary,
      conversation_summary: briefTemplate.conversation_summary,
      recommended_questions: briefTemplate.recommended_questions,
      recommended_services: briefTemplate.recommended_services,
      recommended_talking_points: briefTemplate.recommended_talking_points,
      potential_objections: briefTemplate.potential_objections,
      expected_outcomes: briefTemplate.expected_outcomes,
      created_at: new Date(Date.now() - (i + 3) * 86400000).toISOString(),
    };

    const preparation: MeetingPreparation = {
      id: prepId,
      meeting_id: meetingId,
      agenda: prepTemplate.agenda,
      case_studies: prepTemplate.case_studies,
      pricing_notes: prepTemplate.pricing_notes,
      competitive_notes: prepTemplate.competitive_notes,
      key_opportunities: prepTemplate.key_opportunities,
      risks: prepTemplate.risks,
      created_at: new Date(Date.now() - (i + 2) * 86400000).toISOString(),
    };

    const crmUpdate: CRMUpdate = {
      id: crmId,
      meeting_id: meetingId,
      lead_status: pattern.lead_status,
      opportunity_stage: pattern.opportunity_stage,
      deal_value: pattern.deal_value,
      forecast: pattern.forecast,
      owner: rep,
      next_action: pattern.status === 'completed' ? 'Send follow-up proposal within 48 hours' : 'Confirm meeting attendance and send brief',
      next_action_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      created_at: new Date(Date.now() - (i + 1) * 86400000).toISOString(),
      updated_at: new Date(Date.now() - i * 3600000).toISOString(),
    };

    const outcome: MeetingOutcomeRecord | null =
      pattern.status === 'completed' || pattern.status === 'rescheduled'
        ? {
            id: outcomeId,
            meeting_id: meetingId,
            attendance_status: pattern.attendance,
            qualification_result: pattern.qualification,
            outcome: pattern.outcome,
            next_followup: pattern.outcome === 'followup_scheduled' ? new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0] : null,
            followup_notes: pattern.outcome === 'moved_to_opportunity' ? 'Prospect qualified and moved to opportunity stage. Technical demo scheduled for next week.' : pattern.outcome === 'closed_won' ? 'Deal closed successfully. Contract signed for annual plan. Implementation kickoff scheduled.' : pattern.outcome === 'followup_scheduled' ? 'Meeting rescheduled due to prospect conflict. Follow-up call set for next week.' : 'No specific notes.',
            created_at: new Date(Date.now() - i * 3600000).toISOString(),
          }
        : null;

    const slots = generateSlots(meetingDate);
    const selectedSlot = pattern.status === 'scheduled' || pattern.status === 'completed' ? slots[0] : null;

    const calendar: CalendarInfo = {
      available_slots: slots,
      selected_slot: selectedSlot,
      participants: generateParticipants(prospectName, rep),
      meeting_link: meeting.meeting_link,
      timezone: meeting.timezone,
      calendar_synced: pattern.calendar_status === 'synced',
    };

    const recommendations: MeetingAIRecommendations = {
      ...recTemplate,
      confidence_score: pattern.readiness_score,
    };

    meetings.push({
      meeting,
      brief,
      preparation,
      crm_update: crmUpdate,
      outcome,
      calendar,
      recommendations,
    });
  }

  return meetings;
}

export const MOCK_MEETINGS: FullMeeting[] = generateMeetings();

export const MOCK_MEETING_RECOMMENDATIONS: MeetingAIRecommendations = MOCK_MEETINGS[0].recommendations;

export function getMeetingPriority(meeting: FullMeeting): Priority {
  if (meeting.meeting.revenue_potential >= 100000) return 'critical';
  if (meeting.meeting.revenue_potential >= 50000) return 'high';
  if (meeting.meeting.revenue_potential >= 25000) return 'medium';
  return 'low';
}
