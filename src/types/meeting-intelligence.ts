// ============================================================
// Meeting Intelligence Types — Phase 10
// ============================================================

export type MeetingTypeCode =
  | 'discovery' | 'intro_call' | 'demo' | 'technical_demo' | 'pricing_discussion'
  | 'proposal_review' | 'security_review' | 'compliance_review' | 'pilot_planning'
  | 'implementation_planning' | 'executive_meeting' | 'procurement' | 'negotiation'
  | 'renewal' | 'upsell' | 'cross_sell' | 'customer_success' | 'partner_meeting'
  | 'investor_meeting' | 'custom';

export type MeetingStatus =
  | 'pending_confirmation' | 'confirmed' | 'rescheduled' | 'completed'
  | 'cancelled' | 'no_show' | 'failed';

export type MeetingUrgency = 'low' | 'medium' | 'high' | 'critical';
export type MeetingPriority = 'low' | 'medium' | 'high' | 'critical';
export type DetectedIntent = 'meeting_request' | 'demo_request' | 'pricing_request' | 'follow_up_requested' | 'auto_detected';
export type MeetingPlatform = 'zoom' | 'google_meet' | 'microsoft_teams' | 'in_person' | 'phone';
export type RequestStatus = 'pending' | 'approved' | 'rejected' | 'scheduled' | 'expired';
export type CandidateStatus = 'candidate' | 'scheduled' | 'rejected' | 'expired';
export type SlotResponse = 'pending' | 'accepted' | 'rejected' | 'counter_proposed';
export type AttendanceStatus = 'pending' | 'confirmed' | 'attended' | 'no_show' | 'cancelled';
export type ConfirmedBy = 'prospect' | 'ai' | 'human';
export type MeetingOutcome =
  | 'pending' | 'moved_to_opportunity' | 'followup_scheduled' | 'closed_won'
  | 'closed_lost' | 'no_decision' | 'disqualified' | 'rescheduled';
export type QualificationResult = 'pending' | 'qualified' | 'unqualified' | 'needs_followup';
export type ReminderType = 'email' | 'linkedin' | 'push' | 'sms';
export type ReminderTiming = '24h' | '1h' | '15m' | '5m' | 'now';
export type NotificationType =
  | 'meeting_detected' | 'meeting_scheduled' | 'meeting_confirmed' | 'meeting_reminder'
  | 'meeting_rescheduled' | 'meeting_cancelled' | 'meeting_completed' | 'meeting_no_show'
  | 'preparation_ready' | 'brief_ready' | 'followup_due' | 'human_confirmation_needed';
export type ReasoningType =
  | 'meeting_detection' | 'meeting_type' | 'attendees' | 'timing' | 'agenda'
  | 'questions' | 'competitor_intel' | 'preparation' | 'recommendation' | 'scheduling';
export type QuestionCategory =
  | 'business' | 'technical' | 'budget' | 'timeline' | 'decision_process'
  | 'current_tools' | 'competitors' | 'success_metrics' | 'risks' | 'expansion_opportunities';
export type FollowupType =
  | 'summary' | 'action_item' | 'responsibility' | 'email' | 'linkedin'
  | 'proposal_reminder' | 'demo_reminder' | 'renewal_reminder' | 'next_meeting';

// ============================================================
// Database Record Types
// ============================================================

export interface MeetingTypeRecord {
  id: string;
  workspace_id: string;
  type_code: MeetingTypeCode;
  type_name: string;
  default_duration: number;
  description: string | null;
  required_preparation: string[];
  is_active: boolean;
  created_at: string;
}

export interface MeetingPreferences {
  id: string;
  workspace_id: string;
  default_duration: number;
  default_platform: MeetingPlatform;
  buffer_before_minutes: number;
  buffer_after_minutes: number;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  timezone: string;
  max_meetings_per_day: number;
  auto_generate_brief: boolean;
  auto_generate_agenda: boolean;
  auto_generate_questions: boolean;
  auto_generate_competitor_intel: boolean;
  auto_send_reminders: boolean;
  min_notice_hours: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingRequest {
  id: string;
  workspace_id: string;
  conversation_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  linkedin_account_id: string | null;
  prospect_name: string | null;
  prospect_title: string | null;
  company_name: string | null;
  detected_intent: DetectedIntent;
  meeting_urgency: MeetingUrgency;
  buying_stage: string | null;
  meeting_readiness_level: string | null;
  recommended_meeting_type: string | null;
  estimated_duration: number;
  recommended_attendees: unknown[];
  competitor_discussion_expected: boolean;
  proposal_expected: boolean;
  technical_questions_expected: boolean;
  decision_makers_attending: boolean;
  confidence_score: number;
  reasoning: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
}

export interface MeetingCandidate {
  id: string;
  workspace_id: string;
  meeting_request_id: string;
  contact_id: string | null;
  company_id: string | null;
  conversation_id: string | null;
  prospect_name: string | null;
  company_name: string | null;
  buying_stage: string | null;
  meeting_readiness: string | null;
  intent_score: number;
  engagement_score: number;
  overall_score: number;
  revenue_estimate: number | null;
  likelihood_to_close: number;
  recommended_meeting_type: string | null;
  recommended_duration: number;
  priority: MeetingPriority;
  status: CandidateStatus;
  created_at: string;
}

export interface MeetingSlot {
  id: string;
  workspace_id: string;
  meeting_request_id: string;
  start_time: string;
  end_time: string;
  slot_rank: number;
  timezone: string;
  is_available: boolean;
  is_selected: boolean;
  is_offered: boolean;
  prospect_response: SlotResponse;
  counter_slot_start: string | null;
  counter_slot_end: string | null;
  created_at: string;
}

export interface MeetingSchedulerRecord {
  id: string;
  workspace_id: string;
  meeting_request_id: string | null;
  meeting_candidate_id: string | null;
  conversation_id: string | null;
  contact_id: string | null;
  company_id: string | null;
  meeting_type: MeetingTypeCode;
  meeting_title: string;
  meeting_description: string | null;
  scheduled_start: string;
  scheduled_end: string;
  timezone: string;
  duration_minutes: number;
  platform: MeetingPlatform;
  meeting_link: string | null;
  calendar_event_id: string | null;
  google_meet_link: string | null;
  status: MeetingStatus;
  prospect_name: string | null;
  prospect_title: string | null;
  company_name: string | null;
  revenue_estimate: number | null;
  likelihood_to_close: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingConfirmation {
  id: string;
  workspace_id: string;
  meeting_id: string;
  confirmed_by: ConfirmedBy;
  confirmation_method: string | null;
  confirmed_at: string;
  notes: string | null;
  created_at: string;
}

export interface MeetingReschedule {
  id: string;
  workspace_id: string;
  meeting_id: string;
  previous_start: string;
  previous_end: string;
  new_start: string;
  new_end: string;
  rescheduled_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface MeetingCancellation {
  id: string;
  workspace_id: string;
  meeting_id: string;
  cancelled_by: string | null;
  reason: string | null;
  cancelled_at: string;
  created_at: string;
}

export interface MeetingAttendee {
  id: string;
  workspace_id: string;
  meeting_id: string;
  contact_id: string | null;
  name: string;
  email: string | null;
  role: string | null;
  is_required: boolean;
  is_decision_maker: boolean;
  attendance_status: AttendanceStatus;
  is_internal: boolean;
  created_at: string;
}

export interface MeetingBrief {
  id: string;
  workspace_id: string;
  meeting_id: string;
  executive_summary: string | null;
  company_overview: string | null;
  prospect_overview: string | null;
  timeline: unknown[];
  conversation_summary: string | null;
  pain_points: unknown[];
  goals: unknown[];
  buying_signals: unknown[];
  decision_makers: unknown[];
  objections: unknown[];
  competitors: unknown[];
  technologies: unknown[];
  revenue_estimate: number | null;
  likelihood_to_close: number;
  next_recommendation: string | null;
  confidence: number;
  version: number;
  created_at: string;
}

export interface MeetingAgenda {
  id: string;
  workspace_id: string;
  meeting_id: string;
  agenda_items: unknown[];
  total_duration_minutes: number;
  version: number;
  created_at: string;
}

export interface MeetingPreparation {
  id: string;
  workspace_id: string;
  meeting_id: string;
  proposal_checklist: unknown[];
  roi_data: Record<string, unknown>;
  case_studies: unknown[];
  trust_signals: unknown[];
  testimonials: unknown[];
  relevant_industries: unknown[];
  pricing_recommendation: string | null;
  offer_recommendation: string | null;
  version: number;
  created_at: string;
}

export interface MeetingChecklist {
  id: string;
  workspace_id: string;
  meeting_id: string;
  checklist_items: unknown[];
  completion_percentage: number;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingCompetitorIntel {
  id: string;
  workspace_id: string;
  meeting_id: string;
  competitor_name: string;
  comparison: Record<string, unknown>;
  weaknesses: unknown[];
  differentiators: unknown[];
  battle_cards: unknown[];
  objection_handling: unknown[];
  pricing_comparison: Record<string, unknown>;
  migration_strategy: string | null;
  version: number;
  created_at: string;
}

export interface MeetingQuestion {
  id: string;
  workspace_id: string;
  meeting_id: string;
  question_category: QuestionCategory;
  question_text: string;
  priority: MeetingPriority;
  version: number;
  created_at: string;
}

export interface MeetingFollowup {
  id: string;
  workspace_id: string;
  meeting_id: string;
  followup_type: FollowupType;
  followup_content: string;
  assigned_to: string | null;
  due_date: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface MeetingOutcomeRecord {
  id: string;
  workspace_id: string;
  meeting_id: string;
  outcome: MeetingOutcome;
  attendance_status: AttendanceStatus;
  qualification_result: QualificationResult | null;
  next_followup: string | null;
  followup_notes: string | null;
  deal_value: number | null;
  next_action: string | null;
  next_action_date: string | null;
  version: number;
  created_at: string;
}

export interface MeetingScore {
  id: string;
  workspace_id: string;
  meeting_id: string;
  preparation_score: number;
  qualification_score: number;
  revenue_score: number;
  likelihood_to_close: number;
  risk_score: number;
  overall_score: number;
  score_explanation: Record<string, string>;
  confidence: number;
  version: number;
  created_at: string;
}

export interface MeetingNotification {
  id: string;
  workspace_id: string;
  meeting_id: string | null;
  notification_type: NotificationType;
  notification_title: string;
  notification_message: string;
  severity: 'info' | 'warning' | 'error' | 'success';
  is_read: boolean;
  action_url: string | null;
  created_at: string;
}

export interface MeetingReminder {
  id: string;
  workspace_id: string;
  meeting_id: string;
  reminder_type: ReminderType;
  reminder_timing: ReminderTiming;
  scheduled_for: string;
  sent_at: string | null;
  is_sent: boolean;
  created_at: string;
}

export interface MeetingAIReasoning {
  id: string;
  workspace_id: string;
  meeting_id: string;
  reasoning_type: ReasoningType;
  reasoning_text: string;
  reasoning_data: Record<string, unknown>;
  confidence: number;
  created_at: string;
}

export interface MeetingVersion {
  id: string;
  workspace_id: string;
  meeting_id: string;
  version_number: number;
  changed_by: 'ai' | 'human' | 'system';
  change_type: string;
  change_data: Record<string, unknown>;
  created_at: string;
}

export interface MeetingNote {
  id: string;
  workspace_id: string;
  meeting_id: string;
  note_type: 'general' | 'action_item' | 'decision' | 'question' | 'risk' | 'opportunity';
  note_text: string;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
}

export interface MeetingRecording {
  id: string;
  workspace_id: string;
  meeting_id: string;
  recording_url: string | null;
  recording_duration: number | null;
  recording_status: 'pending' | 'recording' | 'available' | 'failed';
  created_at: string;
}

export interface MeetingTranscript {
  id: string;
  workspace_id: string;
  meeting_id: string;
  transcript_text: string | null;
  transcript_segments: unknown[];
  language: string;
  duration_seconds: number | null;
  created_at: string;
}

// ============================================================
// Composite Meeting with Intelligence
// ============================================================

export interface MeetingWithIntelligence {
  meeting: MeetingSchedulerRecord;
  brief: MeetingBrief | null;
  agenda: MeetingAgenda | null;
  preparation: MeetingPreparation | null;
  checklist: MeetingChecklist | null;
  competitorIntel: MeetingCompetitorIntel[];
  questions: MeetingQuestion[];
  attendees: MeetingAttendee[];
  followups: MeetingFollowup[];
  outcome: MeetingOutcomeRecord | null;
  score: MeetingScore | null;
  reasoning: MeetingAIReasoning[];
  confirmations: MeetingConfirmation[];
  notes: MeetingNote[];
}

// ============================================================
// Dashboard
// ============================================================

export interface MeetingIntelligenceDashboard {
  totalMeetings: number;
  meetingsToday: number;
  pendingScheduling: number;
  awaitingConfirmation: number;
  preparationNeeded: number;
  avgMeetingScore: number;
  forecastRevenue: number;
  meetings: MeetingWithIntelligence[];
  pendingRequests: MeetingRequest[];
  candidates: MeetingCandidate[];
  slots: MeetingSlot[];
  notifications: MeetingNotification[];
  preferences: MeetingPreferences | null;
  topMeetings: MeetingWithIntelligence[];
}
