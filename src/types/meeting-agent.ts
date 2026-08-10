// ============================================================
// Meeting Agent — Type Definitions
// ============================================================

// ============================================================
// Enums / Union Types
// ============================================================

export type MeetingStatus =
  | 'qualified'
  | 'scheduling'
  | 'scheduled'
  | 'completed'
  | 'cancelled'
  | 'rescheduled'
  | 'no_show'
  | 'failed';

export type MeetingType =
  | 'discovery'
  | 'demo'
  | 'follow_up'
  | 'technical'
  | 'proposal'
  | 'closing'
  | 'check_in';

export type MeetingDuration = 15 | 30 | 45 | 60 | 90;

export type MeetingPlatform =
  | 'zoom'
  | 'google_meet'
  | 'microsoft_teams'
  | 'in_person'
  | 'phone';

export type CalendarStatus = 'pending' | 'synced' | 'conflict' | 'failed';

export type CRMStatus = 'pending' | 'synced' | 'failed';

export type LeadStatus =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'opportunity'
  | 'customer'
  | 'disqualified';

export type OpportunityStage =
  | 'prospecting'
  | 'qualification'
  | 'needs_analysis'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export type ForecastCategory = 'pipeline' | 'best_case' | 'commit' | 'closed';

export type AttendanceStatus =
  | 'pending'
  | 'attended'
  | 'no_show'
  | 'rescheduled'
  | 'cancelled';

export type QualificationResult =
  | 'pending'
  | 'qualified'
  | 'unqualified'
  | 'needs_followup';

export type MeetingOutcome =
  | 'pending'
  | 'moved_to_opportunity'
  | 'followup_scheduled'
  | 'closed_won'
  | 'closed_lost'
  | 'no_decision'
  | 'disqualified';

export type Priority = 'low' | 'medium' | 'high' | 'critical';

export type ExportFormat = 'json' | 'csv' | 'pdf';

// ============================================================
// Pipeline Stages
// ============================================================

export interface MeetingPipelineStage {
  stage: string;
  label: string;
  description: string;
}

export const MEETING_STAGES: MeetingPipelineStage[] = [
  { stage: 'loading_prospect', label: 'Loading Prospect', description: 'Loading meeting-ready prospect from Conversation AI' },
  { stage: 'checking_calendar', label: 'Checking Calendar', description: 'Finding available time slots across calendars' },
  { stage: 'generating_brief', label: 'Generating Meeting Brief', description: 'Creating AI-powered meeting brief with talking points' },
  { stage: 'preparing_sales', label: 'Preparing Sales Team', description: 'Generating sales preparation materials and case studies' },
  { stage: 'syncing_crm', label: 'Syncing CRM', description: 'Creating opportunity and updating deal stage in CRM' },
  { stage: 'scheduling', label: 'Scheduling Meeting', description: 'Sending calendar invite and confirming meeting time' },
  { stage: 'sending_reminder', label: 'Sending Reminder', description: 'Sending meeting reminders to all participants' },
  { stage: 'saving', label: 'Saving Meeting', description: 'Persisting meeting record and all associated data' },
];

// ============================================================
// Entity Types (Database Models)
// ============================================================

export interface Meeting {
  id: string;
  workspace_id: string;
  contact_id: string | null;
  company_id: string | null;
  conversation_id: string | null;
  prospect_name: string;
  prospect_title: string;
  company_name: string;
  status: MeetingStatus;
  meeting_type: MeetingType;
  meeting_duration: MeetingDuration;
  meeting_platform: MeetingPlatform;
  meeting_time: string | null;
  timezone: string;
  assigned_rep: string;
  meeting_link: string | null;
  calendar_status: CalendarStatus;
  crm_status: CRMStatus;
  meeting_readiness_score: number;
  revenue_potential: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingBrief {
  id: string;
  meeting_id: string;
  executive_summary: string;
  company_summary: string;
  conversation_summary: string;
  recommended_questions: string[];
  recommended_services: string[];
  recommended_talking_points: string[];
  potential_objections: string[];
  expected_outcomes: string[];
  created_at: string;
}

export interface CaseStudy {
  name: string;
  industry: string;
  result: string;
  relevance: string;
}

export interface MeetingPreparation {
  id: string;
  meeting_id: string;
  agenda: string[];
  case_studies: CaseStudy[];
  pricing_notes: string;
  competitive_notes: string;
  key_opportunities: string[];
  risks: string[];
  created_at: string;
}

export interface CRMUpdate {
  id: string;
  meeting_id: string;
  lead_status: LeadStatus;
  opportunity_stage: OpportunityStage;
  deal_value: number;
  forecast: ForecastCategory;
  owner: string;
  next_action: string;
  next_action_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeetingOutcomeRecord {
  id: string;
  meeting_id: string;
  attendance_status: AttendanceStatus;
  qualification_result: QualificationResult;
  outcome: MeetingOutcome;
  next_followup: string | null;
  followup_notes: string;
  created_at: string;
}

// ============================================================
// Calendar Types
// ============================================================

export interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  available: boolean;
  label: string;
}

export interface Participant {
  name: string;
  email: string;
  role: string;
  required: boolean;
}

export interface CalendarInfo {
  available_slots: TimeSlot[];
  selected_slot: TimeSlot | null;
  participants: Participant[];
  meeting_link: string | null;
  timezone: string;
  calendar_synced: boolean;
}

// ============================================================
// AI Recommendations
// ============================================================

export interface MeetingAIRecommendations {
  executive_summary: string;
  meeting_strategy: string;
  recommended_attendees: string[];
  next_best_action: string;
  post_meeting_recommendations: string[];
  meeting_readiness: 'not_ready' | 'warming_up' | 'almost_ready' | 'ready' | 'handed_off';
  confidence_score: number;
}

// ============================================================
// Timeline
// ============================================================

export interface MeetingTimelineEvent {
  id: string;
  label: string;
  description: string;
  timestamp: string | null;
  completed: boolean;
}

// ============================================================
// Composite Types
// ============================================================

export interface FullMeeting {
  meeting: Meeting;
  brief: MeetingBrief | null;
  preparation: MeetingPreparation | null;
  crm_update: CRMUpdate | null;
  outcome: MeetingOutcomeRecord | null;
  calendar: CalendarInfo;
  recommendations: MeetingAIRecommendations;
}

// ============================================================
// Service Result Types
// ============================================================

export interface ScheduleMeetingResult {
  meeting_id: string;
  calendar_event_id: string;
  meeting_link: string;
  status: MeetingStatus;
}

export interface QualifyMeetingResult {
  meeting_id: string;
  ready: boolean;
  readiness_score: number;
  recommended_duration: MeetingDuration;
  recommended_type: MeetingType;
}

export interface GenerateBriefResult {
  meeting_id: string;
  brief_id: string;
  generated: boolean;
}

export interface SyncCRMResult {
  meeting_id: string;
  crm_opportunity_id: string;
  synced: boolean;
}

export interface ReminderResult {
  meeting_id: string;
  sent: boolean;
  channels: string[];
}

export interface OutcomeResult {
  meeting_id: string;
  recorded: boolean;
  next_followup: string | null;
}

export interface ExportResult {
  filename: string;
  data: string;
}
