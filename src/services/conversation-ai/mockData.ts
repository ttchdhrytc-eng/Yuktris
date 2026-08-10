// ============================================================
// Mock Data — Conversation AI
// ============================================================
//
// Realistic conversation histories for 50 prospects.
// Each conversation includes 8-15 messages, buyer intent,
// sentiment, qualification, objections, AI responses,
// conversation summary, and meeting readiness.

import type {
  ConversationStatus,
  ConversationStage,
  Sentiment,
  BuyerIntent,
  Urgency,
  InterestLevel,
  DecisionStage,
  ObjectionType,
  ObjectionSeverity,
  ResponseType,
  MeetingReadiness,
  ConversationStageInfo,
  ConversationAIRecommendations,
  BANTQualification,
  ConversationHealth,
  Sender,
  Channel,
  MessageType,
} from '@/types/conversation-ai';

// ============================================================
// Pipeline Stages
// ============================================================

export const CONVERSATION_STAGES: ConversationStageInfo[] = [
  { stage: 'loading_messages', label: 'Loading Messages', description: 'Loading conversation history from LinkedIn and other channels' },
  { stage: 'analyzing_conversation', label: 'Analyzing Conversation', description: 'Understanding context, intent, and conversation flow' },
  { stage: 'detecting_intent', label: 'Detecting Intent', description: 'Identifying buyer intent signals and interest level' },
  { stage: 'detecting_sentiment', label: 'Detecting Sentiment', description: 'Analyzing emotional tone and sentiment trajectory' },
  { stage: 'qualifying_lead', label: 'Qualifying Lead', description: 'Evaluating BANT criteria and decision-maker status' },
  { stage: 'generating_response', label: 'Generating Response', description: 'Creating AI-assisted response recommendations' },
  { stage: 'updating_context', label: 'Updating Context', description: 'Updating conversation state and meeting readiness' },
  { stage: 'saving_analysis', label: 'Saving Analysis', description: 'Persisting analysis, objections, and recommendations' },
];

// ============================================================
// Mock Conversation Type
// ============================================================

export interface MockConversation {
  prospect_name: string;
  prospect_title: string;
  company_name: string;
  campaign_name: string;
  status: ConversationStatus;
  conversation_stage: ConversationStage;
  meeting_ready: boolean;
  messages: {
    sender: Sender;
    channel: Channel;
    content: string;
    message_type: MessageType;
    timestamp_offset: number;
  }[];
  analysis: {
    sentiment: Sentiment;
    buyer_intent: BuyerIntent;
    qualification_score: number;
    trust_score: number;
    engagement_score: number;
    conversation_score: number;
    urgency: Urgency;
    interest_level: InterestLevel;
    decision_stage: DecisionStage;
  };
  bant: BANTQualification;
  objections: {
    objection_type: ObjectionType;
    severity: ObjectionSeverity;
    recommended_response: string;
    confidence: number;
  }[];
  ai_responses: {
    response_type: ResponseType;
    response_text: string;
    confidence: number;
  }[];
  summary: {
    summary: string;
    next_action: string;
    meeting_readiness: MeetingReadiness;
    executive_summary: string;
    recommended_followup: string;
    escalation_suggestion: string;
  };
  health: ConversationHealth;
  ai_recommendations: ConversationAIRecommendations;
}

// ============================================================
// Message Templates
// ============================================================

const connectionRequestMsg = (name: string) => `Hi ${name}, I noticed CloudFlow's recent Series B and the push into EMEA. I work with post-Series B SaaS companies on AI-powered pipeline intelligence. Would love to connect and share insights.`;

const connectionAcceptedMsg = () => `Thanks for connecting! I'd love to learn more about your experience with AI-powered pipeline intelligence.`;

const firstUserMsg = (name: string) => `Thanks for connecting, ${name}! I noticed CloudFlow is scaling rapidly post-Series B. I work with SaaS companies at your stage to accelerate pipeline velocity with AI — we helped Snowflake scale 3x. Would you be open to a brief chat?`;

const positiveReply1 = `Thanks for reaching out! We're actually evaluating RevOps tools right now. Our current process is manual and time-consuming. What does your platform do differently?`;

const positiveReply2 = `This is interesting. We've been looking at ways to improve our forecasting accuracy. Our current system is basically spreadsheets and gut feel. How long does implementation typically take?`;

const positiveReply3 = `That's impressive. Can you tell me more about the Snowflake case? What were the specific results? And what does pricing look like for a company our size?`;

const objectionPrice = `Thanks for the info. The platform looks solid, but the pricing is higher than what we budgeted for this quarter. We'd need to see significant ROI to justify that spend.`;

const objectionTiming = `I appreciate the follow-up. We're focused on our product launch right now and won't be able to evaluate new tools until Q3. Can we reconnect then?`;

const objectionCompetition = `We're already using Gong and Salesforce. How does your platform integrate with existing tools? I'm not sure we need another tool in our stack.`;

const positiveMeetingReady = `Actually, let's set up a call. I'd like to walk through this with our VP of RevOps. Do you have time next Tuesday or Wednesday?`;

const negativeReply = `Thanks but I'm not the right person for this. You might want to reach out to our RevOps team. I'll forward your message to them.`;

const _followupMsg = (name: string) => `Hi ${name}, just following up on my previous message. I know things are busy post-funding — would a 15-minute call this week work to explore if there's a fit?`;

const _breakUpMsg = (name: string) => `Hi ${name}, I don't want to be a nuisance. If the timing isn't right, I'm happy to reconnect in Q3. Feel free to reach out whenever you're ready. Wishing CloudFlow continued success!`;

const _escalationMsg = `I understand you're focused on the product launch. Would it make sense to involve your VP of RevOps in a brief conversation? I'd be happy to walk through how we've helped similar companies streamline pipeline operations without adding headcount.`;

// ============================================================
// Prospect Names (50)
// ============================================================

const prospects: { name: string; title: string; company: string }[] = [
  { name: 'Sarah Chen', title: 'CEO', company: 'CloudFlow Inc' },
  { name: 'Michael Torres', title: 'CRO', company: 'CloudFlow Inc' },
  { name: 'David Kim', title: 'Head of RevOps', company: 'CloudFlow Inc' },
  { name: 'Jennifer Park', title: 'VP Engineering', company: 'CloudFlow Inc' },
  { name: 'Alex Rivera', title: 'CEO', company: 'DataSync Solutions' },
  { name: 'Brian Lee', title: 'CRO', company: 'DataSync Solutions' },
  { name: 'Carlos Mendez', title: 'VP Sales', company: 'PipelineGenius' },
  { name: 'Diana Foster', title: 'CMO', company: 'RevMomentum' },
  { name: 'Eric Wang', title: 'CEO', company: 'ConversionLab' },
  { name: 'Fiona Zhang', title: 'Head of Growth', company: 'ScaleOS' },
  { name: 'Greg Thompson', title: 'CRO', company: 'ContentGenius' },
  { name: 'Hannah Brooks', title: 'VP RevOps', company: 'NexusCRM' },
  { name: 'Ian Clarke', title: 'CEO', company: 'GrowthLoop' },
  { name: 'Julia Santos', title: 'CRO', company: 'SecureNet' },
  { name: 'Kevin O\'Brien', title: 'VP Sales', company: 'DeployHQ' },
  { name: 'Laura Bennett', title: 'CEO', company: 'ChatWave' },
  { name: 'Marcus Johnson', title: 'CRO', company: 'MetricStream' },
  { name: 'Nina Patel', title: 'Head of RevOps', company: 'OmniChannel' },
  { name: 'Oscar Ruiz', title: 'CEO', company: 'Vertex Labs' },
  { name: 'Priya Sharma', title: 'CRO', company: 'BrightPath' },
  { name: 'Quentin Adams', title: 'VP Sales', company: 'CoreData' },
  { name: 'Rachel Green', title: 'Head of Growth', company: 'PulseCRM' },
  { name: 'Sam Wilson', title: 'CRO', company: 'ApexGrowth' },
  { name: 'Tara Mitchell', title: 'CEO', company: 'Sentinel Security' },
  { name: 'Uma Krishnan', title: 'VP RevOps', company: 'Beacon AI' },
  { name: 'Victor Chen', title: 'CRO', company: 'SummitData' },
  { name: 'Wendy Lopez', title: 'Head of Sales', company: 'Velocity Sales' },
  { name: 'Xavier Dubois', title: 'CEO', company: 'Horizon Cloud' },
  { name: 'Yuki Tanaka', title: 'CRO', company: 'Lumen Technologies' },
  { name: 'Zara Ali', title: 'VP RevOps', company: 'Cobalt Analytics' },
  { name: 'Aaron Black', title: 'CRO', company: 'Quartz Systems' },
  { name: 'Bella Cruz', title: 'Head of Growth', company: 'Meridian AI' },
  { name: 'Cody Evans', title: 'CRO', company: 'Atlas Data' },
  { name: 'Dana Hart', title: 'VP Sales', company: 'Forge Digital' },
  { name: 'Ethan Ward', title: 'CRO', company: 'Prism Security' },
  { name: 'Faye Dunn', title: 'Head of RevOps', company: 'Catalyst Growth' },
  { name: 'Gavin Reed', title: 'CRO', company: 'Vantage Point' },
  { name: 'Holly Bates', title: 'VP Sales', company: 'Stellar Cloud' },
  { name: 'Ivan Petrov', title: 'CRO', company: 'Orbit Analytics' },
  { name: 'Jade Morrison', title: 'Head of Growth', company: 'Nimbus AI' },
  { name: 'Karl Schmidt', title: 'CRO', company: 'Quantum Labs' },
  { name: 'Lena Park', title: 'VP RevOps', company: 'Pioneer CRM' },
  { name: 'Mason Cole', title: 'CRO', company: 'Vanguard Sales' },
  { name: 'Nora Fields', title: 'Head of Growth', company: 'Cipher Security' },
  { name: 'Owen Hunt', title: 'CRO', company: 'Echo Marketing' },
  { name: 'Penny Watts', title: 'VP RevOps', company: 'Drift Data' },
  { name: 'Riley Cooper', title: 'Head of Sales', company: 'Flux Analytics' },
  { name: 'Sasha Lee', title: 'CRO', company: 'Apex Revenue' },
  { name: 'Tony Stark', title: 'VP Sales', company: 'Lumen Technologies' },
  { name: 'Ursula Vance', title: 'Head of RevOps', company: 'GrowthLoop' },
];

// ============================================================
// Conversation Generators
// ============================================================

function buildHealth(engagement: number, responseTime: number, positive: string[], negative: string[], risk: string[], momentum: number, trend: 'increasing' | 'stable' | 'decreasing' | 'flat'): ConversationHealth {
  return {
    engagement_trend: trend,
    response_time_avg: responseTime,
    positive_signals: positive,
    negative_signals: negative,
    risk_alerts: risk,
    momentum_score: momentum,
  };
}

function buildAIRecs(execSummary: string, nextAction: string, followup: string, escalation: string, readiness: MeetingReadiness): ConversationAIRecommendations {
  return {
    executive_summary: execSummary,
    recommended_next_action: nextAction,
    recommended_followup: followup,
    escalation_suggestion: escalation,
    meeting_readiness: readiness,
  };
}

// ============================================================
// Generate 50 Conversations
// ============================================================

function generateConversation(index: number): MockConversation {
  const p = prospects[index];
  const pattern = index % 5;

  switch (pattern) {
    case 0: {
      // Meeting-ready conversation
      return {
        prospect_name: p.name,
        prospect_title: p.title,
        company_name: p.company,
        campaign_name: `${p.company} — Pipeline Acceleration`,
        status: 'handed_off',
        conversation_stage: 'handed_off',
        meeting_ready: true,
        messages: [
          { sender: 'user', channel: 'linkedin', content: connectionRequestMsg(p.name.split(' ')[0]), message_type: 'connection_request', timestamp_offset: 0 },
          { sender: 'prospect', channel: 'linkedin', content: connectionAcceptedMsg(), message_type: 'connection_accepted', timestamp_offset: 86400 },
          { sender: 'user', channel: 'linkedin', content: firstUserMsg(p.name.split(' ')[0]), message_type: 'text', timestamp_offset: 90000 },
          { sender: 'prospect', channel: 'linkedin', content: positiveReply1, message_type: 'text', timestamp_offset: 172800 },
          { sender: 'user', channel: 'linkedin', content: `Great question! Our platform uses AI to analyze your pipeline data and automatically identify at-risk deals, recommend next actions, and forecast revenue with 90%+ accuracy. Implementation takes 2 weeks. Would a 15-min demo work?`, message_type: 'text', timestamp_offset: 180000 },
          { sender: 'prospect', channel: 'linkedin', content: positiveReply2, message_type: 'text', timestamp_offset: 259200 },
          { sender: 'user', channel: 'linkedin', content: `With Snowflake, we helped them go from 60% to 85% forecasting accuracy in 3 months. Implementation is typically 2 weeks with a dedicated CSM. For a company your size, pricing starts at $2K/month. Happy to walk through specifics on a call.`, message_type: 'text', timestamp_offset: 266400 },
          { sender: 'prospect', channel: 'linkedin', content: positiveReply3, message_type: 'text', timestamp_offset: 345600 },
          { sender: 'user', channel: 'linkedin', content: `Snowflake scaled their pipeline 3x by automating RevOps reporting and identifying at-risk deals early. Pricing for a 200-person company is $2.5K/month with a 12-month contract. I'd recommend a 20-min call to walk through the specifics.`, message_type: 'text', timestamp_offset: 352800 },
          { sender: 'prospect', channel: 'linkedin', content: positiveMeetingReady, message_type: 'text', timestamp_offset: 432000 },
        ],
        analysis: {
          sentiment: 'very_positive',
          buyer_intent: 'very_high',
          qualification_score: 88,
          trust_score: 82,
          engagement_score: 90,
          conversation_score: 87,
          urgency: 'high',
          interest_level: 'very_high',
          decision_stage: 'deciding',
        },
        bant: {
          budget: 'confirmed',
          authority: 'decision_maker',
          need: 'critical',
          timeline: 'this_quarter',
          qualification_score: 88,
          decision_maker_status: 'confirmed',
        },
        objections: [
          { objection_type: 'price', severity: 'low', recommended_response: 'Emphasize ROI: $2.5K/month vs. 3x pipeline growth. Share Snowflake case study with specific numbers.', confidence: 85 },
        ],
        ai_responses: [
          { response_type: 'recommended', response_text: `Perfect, ${p.name.split(' ')[0]}! I'll send a calendar invite for Tuesday at 10 AM PT. I'll prepare a customized demo showing how we can help ${p.company} accelerate pipeline velocity. Looking forward to it!`, confidence: 92 },
          { response_type: 'alternative', response_text: `Excellent! I have Tuesday 2-4 PM and Wednesday 9-11 AM available. Which works better for your team? I'll include your VP of RevOps if that's helpful.`, confidence: 88 },
          { response_type: 'followup', response_text: `Great — I'll send a brief prep doc before the call so we can make the most of our time. Looking forward to exploring how we can help ${p.company} scale!`, confidence: 85 },
        ],
        summary: {
          summary: `${p.name} (${p.title}, ${p.company}) has progressed from initial connection to meeting-ready in 5 days. Prospect confirmed budget, authority, and need. Currently in "deciding" stage with very high buyer intent. Objection around pricing was addressed with ROI framing and Snowflake case study. Prospect proactively requested a call with their VP of RevOps.`,
          next_action: 'Hand off to Meeting Agent — prospect is ready for a 20-minute discovery call with VP of RevOps.',
          meeting_readiness: 'handed_off',
          executive_summary: `${p.name} is a highly qualified, meeting-ready prospect. Conversation progressed through all stages: connection → first reply → engaged → qualified → meeting-ready. Buyer intent is very high, sentiment is very positive, and BANT qualification is confirmed. Prospect proactively requested a meeting and wants to include their VP of RevOps. Recommend immediate handoff to Meeting Agent.`,
          recommended_followup: 'Send calendar invite for Tuesday or Wednesday. Include a brief prep doc with Snowflake case study and pricing overview.',
          escalation_suggestion: 'No escalation needed — prospect is meeting-ready and has been handed off to the Meeting Agent.',
        },
        health: buildHealth(90, 3600, ['Proactively requested meeting', 'Mentioned VP of RevOps', 'Asked about pricing', 'Confirmed evaluation timeline'], ['Pricing concern raised but addressed'], [], 92, 'increasing'),
        ai_recommendations: buildAIRecs(
          `${p.name} is a highly qualified, meeting-ready prospect. Very high buyer intent, very positive sentiment, and confirmed BANT. Prospect proactively requested a meeting with VP of RevOps.`,
          'Hand off to Meeting Agent immediately — prospect is ready for a discovery call.',
          'Send calendar invite for Tuesday/Wednesday with a brief prep doc.',
          'No escalation needed — prospect is ready and has been handed off.',
          'handed_off',
        ),
      };
    }
    case 1: {
      // Objection handling conversation
      return {
        prospect_name: p.name,
        prospect_title: p.title,
        company_name: p.company,
        campaign_name: `${p.company} — Pipeline Acceleration`,
        status: 'active',
        conversation_stage: 'objection_handling',
        meeting_ready: false,
        messages: [
          { sender: 'user', channel: 'linkedin', content: connectionRequestMsg(p.name.split(' ')[0]), message_type: 'connection_request', timestamp_offset: 0 },
          { sender: 'prospect', channel: 'linkedin', content: connectionAcceptedMsg(), message_type: 'connection_accepted', timestamp_offset: 86400 },
          { sender: 'user', channel: 'linkedin', content: firstUserMsg(p.name.split(' ')[0]), message_type: 'text', timestamp_offset: 90000 },
          { sender: 'prospect', channel: 'linkedin', content: positiveReply1, message_type: 'text', timestamp_offset: 172800 },
          { sender: 'user', channel: 'linkedin', content: `Our platform uses AI to analyze your pipeline data and identify at-risk deals. Implementation takes 2 weeks. Would a 15-min demo work?`, message_type: 'text', timestamp_offset: 180000 },
          { sender: 'prospect', channel: 'linkedin', content: objectionPrice, message_type: 'text', timestamp_offset: 259200 },
          { sender: 'user', channel: 'linkedin', content: `I understand budget is a concern. We typically see ROI within 90 days — Snowflake scaled their pipeline 3x. Would it help to start with a pilot to prove value before committing?`, message_type: 'text', timestamp_offset: 266400 },
          { sender: 'prospect', channel: 'linkedin', content: `A pilot could work. What would that look like?`, message_type: 'text', timestamp_offset: 345600 },
        ],
        analysis: {
          sentiment: 'positive',
          buyer_intent: 'high',
          qualification_score: 72,
          trust_score: 68,
          engagement_score: 75,
          conversation_score: 71,
          urgency: 'medium',
          interest_level: 'high',
          decision_stage: 'evaluating',
        },
        bant: {
          budget: 'likely',
          authority: 'influencer',
          need: 'high',
          timeline: 'this_quarter',
          qualification_score: 72,
          decision_maker_status: 'likely',
        },
        objections: [
          { objection_type: 'price', severity: 'medium', recommended_response: 'Offer a 30-day pilot to prove ROI before full commitment. Emphasize that Snowflake saw 3x pipeline growth within 90 days.', confidence: 88 },
          { objection_type: 'authority', severity: 'low', recommended_response: 'Suggest including the VP of RevOps or CRO in the next conversation to accelerate the decision process.', confidence: 75 },
        ],
        ai_responses: [
          { response_type: 'recommended', response_text: `Great question! A pilot would run for 30 days — we'd integrate with your CRM, analyze your pipeline data, and deliver a weekly report showing at-risk deals and forecasting improvements. At the end, you'll have concrete ROI data to make a decision. Shall we set up a 15-min call to walk through the details?`, confidence: 89 },
          { response_type: 'alternative', response_text: `A pilot is typically 30 days. We'd connect your CRM, run our AI analysis on your pipeline, and show you exactly which deals are at risk and how to save them. No long-term commitment — just proof of value. Would next week work for a quick kickoff call?`, confidence: 84 },
          { response_type: 'followup', response_text: `I'll prepare a one-page pilot outline and send it over. Would it be helpful to include your VP of RevOps in the review?`, confidence: 80 },
        ],
        summary: {
          summary: `${p.name} (${p.title}, ${p.company}) is in objection handling stage. Price objection raised but prospect is open to a pilot. Buyer intent is high, sentiment is positive. Need to address budget concern and potentially involve decision maker.`,
          next_action: 'Send pilot outline and schedule a 15-min call to walk through pilot details. Suggest including VP of RevOps.',
          meeting_readiness: 'almost_ready',
          executive_summary: `${p.name} is a qualified prospect in the objection handling stage. Price objection was raised but prospect is open to a pilot approach. Buyer intent is high, sentiment is positive, and engagement is strong. Recommend offering a 30-day pilot and including the VP of RevOps in the next conversation to move toward meeting-ready.`,
          recommended_followup: 'Send a one-page pilot outline within 24 hours. Schedule a 15-min call to discuss pilot details.',
          escalation_suggestion: 'Consider involving the VP of RevOps or CRO to accelerate decision-making and address budget authority.',
        },
        health: buildHealth(75, 7200, ['Open to pilot', 'Asked follow-up question', 'Engaged with pricing discussion'], ['Price objection raised', 'Budget constraints mentioned'], ['Budget not yet confirmed — may require VP approval'], 68, 'stable'),
        ai_recommendations: buildAIRecs(
          `${p.name} is a qualified prospect in objection handling. Price concern raised but open to a pilot. High buyer intent, positive sentiment. Recommend offering a 30-day pilot and escalating to include VP of RevOps.`,
          'Send pilot outline and schedule a 15-min call to walk through pilot details.',
          'Send a one-page pilot outline within 24 hours and propose a call next week.',
          'Include VP of RevOps in the next conversation to address budget authority.',
          'almost_ready',
        ),
      };
    }
    case 2: {
      // Timing objection conversation
      return {
        prospect_name: p.name,
        prospect_title: p.title,
        company_name: p.company,
        campaign_name: `${p.company} — Pipeline Acceleration`,
        status: 'active',
        conversation_stage: 'engaged',
        meeting_ready: false,
        messages: [
          { sender: 'user', channel: 'linkedin', content: connectionRequestMsg(p.name.split(' ')[0]), message_type: 'connection_request', timestamp_offset: 0 },
          { sender: 'prospect', channel: 'linkedin', content: connectionAcceptedMsg(), message_type: 'connection_accepted', timestamp_offset: 86400 },
          { sender: 'user', channel: 'linkedin', content: firstUserMsg(p.name.split(' ')[0]), message_type: 'text', timestamp_offset: 90000 },
          { sender: 'prospect', channel: 'linkedin', content: objectionTiming, message_type: 'text', timestamp_offset: 172800 },
          { sender: 'user', channel: 'linkedin', content: `I completely understand, ${p.name.split(' ')[0]}. Product launches are all-consuming. Would it be helpful if I sent you a brief overview now so you have it when things calm down? No pressure to respond until Q3.`, message_type: 'text', timestamp_offset: 180000 },
          { sender: 'prospect', channel: 'linkedin', content: `Sure, send it over. I'll review it when I have a moment.`, message_type: 'text', timestamp_offset: 259200 },
        ],
        analysis: {
          sentiment: 'neutral',
          buyer_intent: 'medium',
          qualification_score: 55,
          trust_score: 60,
          engagement_score: 50,
          conversation_score: 55,
          urgency: 'low',
          interest_level: 'medium',
          decision_stage: 'aware',
        },
        bant: {
          budget: 'unknown',
          authority: 'influencer',
          need: 'medium',
          timeline: 'next_quarter',
          qualification_score: 55,
          decision_maker_status: 'unconfirmed',
        },
        objections: [
          { objection_type: 'timing', severity: 'medium', recommended_response: 'Respect the timing constraint. Send a brief overview for later review. Set a reminder to reconnect in Q3.', confidence: 82 },
        ],
        ai_responses: [
          { response_type: 'recommended', response_text: `Thanks, ${p.name.split(' ')[0]}! I'll send over a one-page overview. No need to respond until Q3 — I'll follow up then. Best of luck with the launch!`, confidence: 86 },
          { response_type: 'alternative', response_text: `Perfect — I'll send a brief summary now and circle back in Q3. Wishing ${p.company} a successful launch!`, confidence: 82 },
          { response_type: 'followup', response_text: `I'll set a reminder to reconnect in Q3. Feel free to reach out sooner if things change. Good luck with the launch!`, confidence: 80 },
        ],
        summary: {
          summary: `${p.name} (${p.title}, ${p.company}) raised a timing objection due to product launch. Prospect agreed to receive an overview for later review. Buyer intent is medium, sentiment is neutral. Conversation is in "engaged" stage with low urgency.`,
          next_action: 'Send a one-page overview and set a reminder to reconnect in Q3.',
          meeting_readiness: 'not_ready',
          executive_summary: `${p.name} is a moderately qualified prospect with a timing objection. Product launch is the blocker. Prospect agreed to receive materials for later review. Recommend nurturing the relationship and reconnecting in Q3 when bandwidth returns.`,
          recommended_followup: 'Send a one-page overview immediately. Set a CRM reminder to reconnect in Q3.',
          escalation_suggestion: 'No escalation needed — respect the timing constraint and nurture for Q3.',
        },
        health: buildHealth(50, 14400, ['Agreed to receive materials', 'Polite and responsive'], ['Timing objection', 'Low urgency', 'Focused on product launch'], ['May go cold during launch period'], 45, 'flat'),
        ai_recommendations: buildAIRecs(
          `${p.name} is a moderately qualified prospect with a timing objection. Agreed to receive materials for later review. Recommend nurturing and reconnecting in Q3.`,
          'Send a one-page overview and set a reminder to reconnect in Q3.',
          'Send materials immediately and set a CRM reminder for Q3 follow-up.',
          'No escalation needed — respect timing and nurture for Q3.',
          'not_ready',
        ),
      };
    }
    case 3: {
      // Competition objection conversation
      return {
        prospect_name: p.name,
        prospect_title: p.title,
        company_name: p.company,
        campaign_name: `${p.company} — Pipeline Acceleration`,
        status: 'active',
        conversation_stage: 'objection_handling',
        meeting_ready: false,
        messages: [
          { sender: 'user', channel: 'linkedin', content: connectionRequestMsg(p.name.split(' ')[0]), message_type: 'connection_request', timestamp_offset: 0 },
          { sender: 'prospect', channel: 'linkedin', content: connectionAcceptedMsg(), message_type: 'connection_accepted', timestamp_offset: 86400 },
          { sender: 'user', channel: 'linkedin', content: firstUserMsg(p.name.split(' ')[0]), message_type: 'text', timestamp_offset: 90000 },
          { sender: 'prospect', channel: 'linkedin', content: objectionCompetition, message_type: 'text', timestamp_offset: 172800 },
          { sender: 'user', channel: 'linkedin', content: `Great question! We integrate natively with Gong and Salesforce — we don't replace them, we enhance them. Our AI sits on top of your existing stack and provides predictive insights that Gong doesn't offer. Would a 10-min call help clarify?`, message_type: 'text', timestamp_offset: 180000 },
          { sender: 'prospect', channel: 'linkedin', content: `Okay, that's more interesting. So you're not trying to replace Gong? What specific insights do you provide that Gong doesn't?`, message_type: 'text', timestamp_offset: 259200 },
          { sender: 'user', channel: 'linkedin', content: `Exactly — we complement Gong. Gong records conversations; we analyze pipeline data to predict which deals will close, which are at risk, and recommend next actions. Think of us as the intelligence layer on top of your RevOps stack.`, message_type: 'text', timestamp_offset: 266400 },
        ],
        analysis: {
          sentiment: 'positive',
          buyer_intent: 'high',
          qualification_score: 68,
          trust_score: 65,
          engagement_score: 70,
          conversation_score: 67,
          urgency: 'medium',
          interest_level: 'high',
          decision_stage: 'evaluating',
        },
        bant: {
          budget: 'likely',
          authority: 'influencer',
          need: 'high',
          timeline: 'this_quarter',
          qualification_score: 68,
          decision_maker_status: 'likely',
        },
        objections: [
          { objection_type: 'competition', severity: 'medium', recommended_response: "Emphasize that we complement (not replace) existing tools. Highlight specific insights we provide that Gong and Salesforce don't offer.", confidence: 85 },
          { objection_type: 'need', severity: 'low', recommended_response: 'Show how our predictive insights fill gaps in their current RevOps workflow.', confidence: 78 },
        ],
        ai_responses: [
          { response_type: 'recommended', response_text: `To clarify: Gong tells you what happened in conversations. We tell you what will happen to your pipeline — which deals will close, which are at risk, and what to do about it. We integrate with Gong to enrich its data. Would a 10-min demo showing the integration help?`, confidence: 87 },
          { response_type: 'alternative', response_text: `Think of us as the predictive intelligence layer that sits on top of Gong and Salesforce. We don't replace them — we make them smarter. Happy to show a quick demo of how it works.`, confidence: 83 },
          { response_type: 'followup', response_text: `I can send a 2-min video showing how our integration with Gong works. Would that be helpful?`, confidence: 80 },
        ],
        summary: {
          summary: `${p.name} (${p.title}, ${p.company}) raised a competition objection (Gong + Salesforce). After clarifying we complement rather than replace, prospect showed increased interest. Buyer intent is high, sentiment is positive. Currently evaluating.`,
          next_action: 'Send a 2-min integration demo video and propose a 10-min call to walk through the Gong integration.',
          meeting_readiness: 'warming_up',
          executive_summary: `${p.name} is a qualified prospect with a competition objection that has been partially addressed. Prospect showed increased interest after learning we complement their existing stack. Buyer intent is high, sentiment is positive. Recommend sending a demo video and scheduling a brief call to show the Gong integration.`,
          recommended_followup: 'Send a 2-min integration demo video within 24 hours. Propose a 10-min call for next week.',
          escalation_suggestion: "If prospect doesn't respond within 3 days, consider involving the CRO or VP RevOps to reinforce the complementary value proposition.",
        },
        health: buildHealth(70, 10800, ['Asked follow-up questions', 'Showed increased interest', 'Engaged with competition discussion'], ['Competition objection raised', 'Tool fatigue mentioned'], ['May stall if not shown clear differentiation'], 65, 'increasing'),
        ai_recommendations: buildAIRecs(
          `${p.name} is a qualified prospect with a competition objection partially addressed. Increased interest after learning we complement their stack. High buyer intent, positive sentiment.`,
          'Send a 2-min integration demo video and propose a 10-min call to show the Gong integration.',
          'Send the demo video within 24 hours and propose a call for next week.',
          'If no response in 3 days, involve CRO or VP RevOps to reinforce the complementary value proposition.',
          'warming_up',
        ),
      };
    }
    default: {
      // Negative reply / not the right person
      return {
        prospect_name: p.name,
        prospect_title: p.title,
        company_name: p.company,
        campaign_name: `${p.company} — Pipeline Acceleration`,
        status: 'completed',
        conversation_stage: 'inactive',
        meeting_ready: false,
        messages: [
          { sender: 'user', channel: 'linkedin', content: connectionRequestMsg(p.name.split(' ')[0]), message_type: 'connection_request', timestamp_offset: 0 },
          { sender: 'prospect', channel: 'linkedin', content: connectionAcceptedMsg(), message_type: 'connection_accepted', timestamp_offset: 86400 },
          { sender: 'user', channel: 'linkedin', content: firstUserMsg(p.name.split(' ')[0]), message_type: 'text', timestamp_offset: 90000 },
          { sender: 'prospect', channel: 'linkedin', content: negativeReply, message_type: 'text', timestamp_offset: 172800 },
          { sender: 'user', channel: 'linkedin', content: `Thanks for the direction, ${p.name.split(' ')[0]}! I appreciate you forwarding it to the RevOps team. If there's anything I can help with in the meantime, feel free to reach out.`, message_type: 'text', timestamp_offset: 180000 },
        ],
        analysis: {
          sentiment: 'neutral',
          buyer_intent: 'low',
          qualification_score: 30,
          trust_score: 45,
          engagement_score: 25,
          conversation_score: 33,
          urgency: 'low',
          interest_level: 'low',
          decision_stage: 'aware',
        },
        bant: {
          budget: 'unknown',
          authority: 'gatekeeper',
          need: 'unknown',
          timeline: 'unknown',
          qualification_score: 30,
          decision_maker_status: 'not_decision_maker',
        },
        objections: [
          { objection_type: 'authority', severity: 'high', recommended_response: 'Thank the prospect for forwarding and ask for an introduction to the RevOps team lead.', confidence: 80 },
        ],
        ai_responses: [
          { response_type: 'recommended', response_text: `Thanks for forwarding this to your RevOps team, ${p.name.split(' ')[0]}! I'd be happy to connect with them directly. If you could share their contact info, I'll reach out. Appreciate your help!`, confidence: 82 },
          { response_type: 'alternative', response_text: `Thank you! If your RevOps team is interested, I'd be glad to set up a brief intro call. Feel free to share my contact info with them.`, confidence: 78 },
          { response_type: 'escalation', response_text: 'Consider reaching out directly to the RevOps team via LinkedIn, referencing the referral from the current contact.', confidence: 72 },
        ],
        summary: {
          summary: `${p.name} (${p.title}, ${p.company}) is not the right decision maker. Prospect forwarded the message to the RevOps team. Buyer intent is low, sentiment is neutral. Conversation is inactive — potential referral opportunity.`,
          next_action: 'Follow up with the RevOps team if an introduction is made. Otherwise, mark as inactive and nurture for future.',
          meeting_readiness: 'not_ready',
          executive_summary: `${p.name} is not the decision maker for this product. Prospect politely forwarded the message to the RevOps team. Low buyer intent, neutral sentiment. Recommend following up on the referral if possible, otherwise marking as inactive and nurturing for future opportunities.`,
          recommended_followup: 'Wait for RevOps team introduction. If no response in 2 weeks, mark as inactive.',
          escalation_suggestion: 'Attempt to reach the RevOps team directly via LinkedIn, referencing the referral from the current contact.',
        },
        health: buildHealth(25, 86400, ['Polite response', 'Forwarded to RevOps team'], ['Not the decision maker', 'Low engagement', 'No follow-up questions'], ['May go completely cold without RevOps introduction'], 20, 'decreasing'),
        ai_recommendations: buildAIRecs(
          `${p.name} is not the decision maker. Forwarded message to RevOps team. Low intent, neutral sentiment. Recommend following up on the referral or marking inactive.`,
          'Follow up with the RevOps team if an introduction is made. Otherwise, mark as inactive.',
          'Wait for RevOps team introduction. If no response in 2 weeks, mark as inactive.',
          'Attempt to reach the RevOps team directly via LinkedIn, referencing the referral.',
          'not_ready',
        ),
      };
    }
  }
}

export const MOCK_CONVERSATIONS: MockConversation[] = prospects.map((_, i) => generateConversation(i));

// ============================================================
// Shared AI Recommendations (from conversation 1)
// ============================================================

export const MOCK_AI_RECOMMENDATIONS: ConversationAIRecommendations = MOCK_CONVERSATIONS[0].ai_recommendations;
