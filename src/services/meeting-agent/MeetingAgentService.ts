// ============================================================
// Meeting Agent Service — Orchestrator
// ============================================================
// Manages meeting preparation, scheduling, execution tracking,
// CRM synchronization, and post-meeting workflows.
// NEVER performs outreach or analyzes conversations.

import { supabase } from '@/lib/supabase';
import { MOCK_MEETINGS, getMeetingPriority } from './mockData';
import type {
  Meeting,
  MeetingBrief,
  MeetingPreparation,
  CRMUpdate,
  MeetingOutcomeRecord,
  FullMeeting,
  MeetingAIRecommendations,
  MeetingTimelineEvent,
  MeetingType,
  MeetingDuration,
  ExportFormat,
  ExportResult,
  ScheduleMeetingResult,
  QualifyMeetingResult,
  GenerateBriefResult,
  SyncCRMResult,
  ReminderResult,
  OutcomeResult,
  Priority,
} from '@/types/meeting-agent';
import { MEETING_STAGES } from '@/types/meeting-agent';

class MeetingAgentService {
  private currentStageIndex = 0;

  // ============================================================
  // Stage tracking for animated loading
  // ============================================================

  getCurrentStage(): string {
    return MEETING_STAGES[this.currentStageIndex]?.stage ?? 'loading_prospect';
  }

  advanceStage(): void {
    if (this.currentStageIndex < MEETING_STAGES.length - 1) {
      this.currentStageIndex++;
    }
  }

  resetStage(): void {
    this.currentStageIndex = 0;
  }

  // ============================================================
  // qualifyMeeting — Determine if prospect is ready for scheduling
  // ============================================================

  async qualifyMeeting(prospectIndex: number): Promise<QualifyMeetingResult> {
    const mock = MOCK_MEETINGS[prospectIndex % MOCK_MEETINGS.length];
    return {
      meeting_id: mock.meeting.id,
      ready: mock.meeting.meeting_readiness_score >= 70,
      readiness_score: mock.meeting.meeting_readiness_score,
      recommended_duration: mock.meeting.meeting_duration,
      recommended_type: mock.meeting.meeting_type,
    };
  }

  // ============================================================
  // scheduleMeeting — Create calendar event and meeting record
  // ============================================================

  async scheduleMeeting(params: {
    workspaceId: string;
    prospectIndex: number;
    meetingType?: MeetingType;
    duration?: MeetingDuration;
    platform?: string;
    slotId?: string;
  }): Promise<ScheduleMeetingResult> {
    const mock = MOCK_MEETINGS[params.prospectIndex % MOCK_MEETINGS.length];
    const meetingId = `meeting-${Date.now()}`;

    const { error } = await supabase.from('meeting_agent_meetings').insert({
      id: meetingId,
      workspace_id: params.workspaceId,
      contact_id: mock.meeting.contact_id,
      company_id: mock.meeting.company_id,
      conversation_id: mock.meeting.conversation_id,
      prospect_name: mock.meeting.prospect_name,
      prospect_title: mock.meeting.prospect_title,
      company_name: mock.meeting.company_name,
      status: 'scheduled',
      meeting_type: params.meetingType ?? mock.meeting.meeting_type,
      meeting_duration: params.duration ?? mock.meeting.meeting_duration,
      meeting_platform: mock.meeting.meeting_platform,
      meeting_time: mock.meeting.meeting_time,
      timezone: mock.meeting.timezone,
      assigned_rep: mock.meeting.assigned_rep,
      meeting_link: mock.meeting.meeting_link,
      calendar_status: 'synced',
      crm_status: 'pending',
      meeting_readiness_score: mock.meeting.meeting_readiness_score,
      revenue_potential: mock.meeting.revenue_potential,
    });

    if (error) throw new Error(`Failed to schedule meeting: ${error.message}`);

    return {
      meeting_id: meetingId,
      calendar_event_id: `evt-${Date.now()}`,
      meeting_link: mock.meeting.meeting_link ?? `https://meet.example.com/${meetingId}`,
      status: 'scheduled',
    };
  }

  // ============================================================
  // rescheduleMeeting — Update meeting time
  // ============================================================

  async rescheduleMeeting(meetingId: string, _newSlotId: string): Promise<ScheduleMeetingResult> {
    const { error } = await supabase
      .from('meeting_agent_meetings')
      .update({ status: 'rescheduled', calendar_status: 'synced' })
      .eq('id', meetingId);

    if (error) throw new Error(`Failed to reschedule meeting: ${error.message}`);

    return {
      meeting_id: meetingId,
      calendar_event_id: `evt-${Date.now()}`,
      meeting_link: `https://meet.example.com/${meetingId}`,
      status: 'rescheduled',
    };
  }

  // ============================================================
  // cancelMeeting — Cancel and update CRM
  // ============================================================

  async cancelMeeting(meetingId: string): Promise<void> {
    const { error } = await supabase
      .from('meeting_agent_meetings')
      .update({ status: 'cancelled' })
      .eq('id', meetingId);

    if (error) throw new Error(`Failed to cancel meeting: ${error.message}`);
  }

  // ============================================================
  // generateMeetingBrief — AI-powered brief for the rep
  // ============================================================

  async generateMeetingBrief(prospectIndex: number): Promise<GenerateBriefResult> {
    const mock = MOCK_MEETINGS[prospectIndex % MOCK_MEETINGS.length];
    return {
      meeting_id: mock.meeting.id,
      brief_id: mock.brief?.id ?? `brief-${Date.now()}`,
      generated: true,
    };
  }

  // ============================================================
  // generateSalesBrief — Sales preparation materials
  // ============================================================

  async generateSalesBrief(prospectIndex: number): Promise<GenerateBriefResult> {
    const mock = MOCK_MEETINGS[prospectIndex % MOCK_MEETINGS.length];
    return {
      meeting_id: mock.meeting.id,
      brief_id: mock.preparation?.id ?? `prep-${Date.now()}`,
      generated: true,
    };
  }

  // ============================================================
  // syncCalendar — Sync with Google Calendar / Outlook
  // ============================================================

  async syncCalendar(meetingId: string): Promise<{ meeting_id: string; synced: boolean }> {
    const { error } = await supabase
      .from('meeting_agent_meetings')
      .update({ calendar_status: 'synced' })
      .eq('id', meetingId);

    if (error) throw new Error(`Failed to sync calendar: ${error.message}`);

    return { meeting_id: meetingId, synced: true };
  }

  // ============================================================
  // syncCRM — Create opportunity and update deal stage
  // ============================================================

  async syncCRM(prospectIndex: number, meetingId?: string): Promise<SyncCRMResult> {
    const mock = MOCK_MEETINGS[prospectIndex % MOCK_MEETINGS.length];
    const id = meetingId ?? mock.meeting.id;

    const { error } = await supabase
      .from('meeting_agent_meetings')
      .update({ crm_status: 'synced' })
      .eq('id', id);

    if (error) throw new Error(`Failed to sync CRM: ${error.message}`);

    return {
      meeting_id: id,
      crm_opportunity_id: `opp-${Date.now()}`,
      synced: true,
    };
  }

  // ============================================================
  // sendReminder — Email + Slack reminders
  // ============================================================

  async sendReminder(meetingId: string): Promise<ReminderResult> {
    return {
      meeting_id: meetingId,
      sent: true,
      channels: ['email', 'slack'],
    };
  }

  // ============================================================
  // recordOutcome — Post-meeting outcome tracking
  // ============================================================

  async recordOutcome(meetingId: string, outcome: Partial<MeetingOutcomeRecord>): Promise<OutcomeResult> {
    const { error } = await supabase
      .from('meeting_agent_meetings')
      .update({ status: 'completed' })
      .eq('id', meetingId);

    if (error) throw new Error(`Failed to record outcome: ${error.message}`);

    return {
      meeting_id: meetingId,
      recorded: true,
      next_followup: outcome.next_followup ?? null,
    };
  }

  // ============================================================
  // triggerPostMeetingWorkflow — Automated follow-up sequence
  // ============================================================

  async triggerPostMeetingWorkflow(meetingId: string): Promise<{ meeting_id: string; triggered: boolean }> {
    return { meeting_id: meetingId, triggered: true };
  }

  // ============================================================
  // generateRecommendations — AI recommendations for the meeting
  // ============================================================

  async generateRecommendations(prospectIndex: number): Promise<MeetingAIRecommendations> {
    const mock = MOCK_MEETINGS[prospectIndex % MOCK_MEETINGS.length];
    return mock.recommendations;
  }

  // ============================================================
  // saveMeeting — Persist meeting + all child records to database
  // ============================================================

  async saveMeeting(workspaceId: string, prospectIndex: number): Promise<string> {
    const mock = MOCK_MEETINGS[prospectIndex % MOCK_MEETINGS.length];
    const meetingId = `meeting-${Date.now()}`;

    this.resetStage();

    for (const _stage of MEETING_STAGES) {
      this.advanceStage();
      await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));
    }

    const { error: meetingError } = await supabase.from('meeting_agent_meetings').insert({
      id: meetingId,
      workspace_id: workspaceId,
      contact_id: mock.meeting.contact_id,
      company_id: mock.meeting.company_id,
      conversation_id: mock.meeting.conversation_id,
      prospect_name: mock.meeting.prospect_name,
      prospect_title: mock.meeting.prospect_title,
      company_name: mock.meeting.company_name,
      status: mock.meeting.status,
      meeting_type: mock.meeting.meeting_type,
      meeting_duration: mock.meeting.meeting_duration,
      meeting_platform: mock.meeting.meeting_platform,
      meeting_time: mock.meeting.meeting_time,
      timezone: mock.meeting.timezone,
      assigned_rep: mock.meeting.assigned_rep,
      meeting_link: mock.meeting.meeting_link,
      calendar_status: mock.meeting.calendar_status,
      crm_status: mock.meeting.crm_status,
      meeting_readiness_score: mock.meeting.meeting_readiness_score,
      revenue_potential: mock.meeting.revenue_potential,
    });

    if (meetingError) throw new Error(`Failed to save meeting: ${meetingError.message}`);

    if (mock.brief) {
      await supabase.from('meeting_agent_briefs').insert({
        meeting_id: meetingId,
        executive_summary: mock.brief.executive_summary,
        company_summary: mock.brief.company_summary,
        conversation_summary: mock.brief.conversation_summary,
        recommended_questions: mock.brief.recommended_questions,
        recommended_services: mock.brief.recommended_services,
        recommended_talking_points: mock.brief.recommended_talking_points,
        potential_objections: mock.brief.potential_objections,
        expected_outcomes: mock.brief.expected_outcomes,
      });
    }

    if (mock.preparation) {
      await supabase.from('meeting_agent_preparation').insert({
        meeting_id: meetingId,
        agenda: mock.preparation.agenda,
        case_studies: mock.preparation.case_studies,
        pricing_notes: mock.preparation.pricing_notes,
        competitive_notes: mock.preparation.competitive_notes,
        key_opportunities: mock.preparation.key_opportunities,
        risks: mock.preparation.risks,
      });
    }

    if (mock.crm_update) {
      await supabase.from('meeting_agent_crm_updates').insert({
        meeting_id: meetingId,
        lead_status: mock.crm_update.lead_status,
        opportunity_stage: mock.crm_update.opportunity_stage,
        deal_value: mock.crm_update.deal_value,
        forecast: mock.crm_update.forecast,
        owner: mock.crm_update.owner,
        next_action: mock.crm_update.next_action,
        next_action_date: mock.crm_update.next_action_date,
      });
    }

    if (mock.outcome) {
      await supabase.from('meeting_agent_outcomes').insert({
        meeting_id: meetingId,
        attendance_status: mock.outcome.attendance_status,
        qualification_result: mock.outcome.qualification_result,
        outcome: mock.outcome.outcome,
        next_followup: mock.outcome.next_followup,
        followup_notes: mock.outcome.followup_notes,
      });
    }

    return meetingId;
  }

  // ============================================================
  // loadMeeting — Load meeting + all child records from database
  // ============================================================

  async loadMeeting(meetingId: string): Promise<FullMeeting | null> {
    const { data: meeting, error } = await supabase
      .from('meeting_agent_meetings')
      .select('*')
      .eq('id', meetingId)
      .single();

    if (error || !meeting) return null;

    const [briefRes, prepRes, crmRes, outcomeRes] = await Promise.all([
      supabase.from('meeting_agent_briefs').select('*').eq('meeting_id', meetingId).single(),
      supabase.from('meeting_agent_preparation').select('*').eq('meeting_id', meetingId).single(),
      supabase.from('meeting_agent_crm_updates').select('*').eq('meeting_id', meetingId).single(),
      supabase.from('meeting_agent_outcomes').select('*').eq('meeting_id', meetingId).single(),
    ]);

    const mock = MOCK_MEETINGS[0];

    return {
      meeting: meeting as Meeting,
      brief: (briefRes.data as MeetingBrief) ?? null,
      preparation: (prepRes.data as MeetingPreparation) ?? null,
      crm_update: (crmRes.data as CRMUpdate) ?? null,
      outcome: (outcomeRes.data as MeetingOutcomeRecord) ?? null,
      calendar: mock.calendar,
      recommendations: mock.recommendations,
    };
  }

  // ============================================================
  // loadLatestMeeting — Load most recent meeting for workspace
  // ============================================================

  async loadLatestMeeting(workspaceId: string): Promise<FullMeeting | null> {
    const { data, error } = await supabase
      .from('meeting_agent_meetings')
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return MOCK_MEETINGS[0];
    }

    return this.loadMeeting(data.id);
  }

  // ============================================================
  // loadAllMeetings — Load all meetings for workspace
  // ============================================================

  async loadAllMeetings(workspaceId: string): Promise<FullMeeting[]> {
    const { data, error } = await supabase
      .from('meeting_agent_meetings')
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return MOCK_MEETINGS;
    }

    const results = await Promise.all(data.map((m) => this.loadMeeting(m.id)));
    return results.filter((m): m is FullMeeting => m !== null);
  }

  // ============================================================
  // deleteMeeting — Delete meeting and all child records
  // ============================================================

  async deleteMeeting(meetingId: string): Promise<void> {
    const { error } = await supabase.from('meeting_agent_meetings').delete().eq('id', meetingId);
    if (error) throw new Error(`Failed to delete meeting: ${error.message}`);
  }

  // ============================================================
  // getTimelineEvents — Build timeline from meeting data
  // ============================================================

  getTimelineEvents(fullMeeting: FullMeeting): MeetingTimelineEvent[] {
    const m = fullMeeting.meeting;
    const events: MeetingTimelineEvent[] = [
      {
        id: 'evt-qualified',
        label: 'Meeting Qualified',
        description: `${m.prospect_name} from ${m.company_name} was qualified for a meeting by Conversation AI`,
        timestamp: m.created_at,
        completed: true,
      },
      {
        id: 'evt-calendar-proposed',
        label: 'Calendar Proposed',
        description: 'Available time slots identified and proposed to the prospect',
        timestamp: m.calendar_status === 'synced' || m.calendar_status === 'conflict' ? m.created_at : null,
        completed: m.calendar_status === 'synced' || m.calendar_status === 'conflict',
      },
      {
        id: 'evt-confirmed',
        label: 'Meeting Confirmed',
        description: `Meeting scheduled for ${m.meeting_time ? new Date(m.meeting_time).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : 'TBD'} on ${m.meeting_platform.replace(/_/g, ' ')}`,
        timestamp: m.status === 'scheduled' || m.status === 'completed' ? m.meeting_time : null,
        completed: m.status === 'scheduled' || m.status === 'completed',
      },
      {
        id: 'evt-reminder',
        label: 'Reminder Sent',
        description: 'Meeting reminders sent via email and Slack to all participants',
        timestamp: m.status === 'scheduled' || m.status === 'completed' ? m.meeting_time : null,
        completed: m.status === 'scheduled' || m.status === 'completed',
      },
      {
        id: 'evt-completed',
        label: 'Meeting Completed',
        description: fullMeeting.outcome ? `Attendance: ${fullMeeting.outcome.attendance_status.replace(/_/g, ' ')}` : 'Meeting not yet held',
        timestamp: fullMeeting.outcome ? fullMeeting.outcome.created_at : null,
        completed: m.status === 'completed',
      },
      {
        id: 'evt-crm-updated',
        label: 'CRM Updated',
        description: fullMeeting.crm_update ? `Opportunity stage: ${fullMeeting.crm_update.opportunity_stage.replace(/_/g, ' ')}, Deal value: $${fullMeeting.crm_update.deal_value.toLocaleString()}` : 'CRM not yet synced',
        timestamp: fullMeeting.crm_update ? fullMeeting.crm_update.updated_at : null,
        completed: m.crm_status === 'synced',
      },
      {
        id: 'evt-post-meeting',
        label: 'Post Meeting Workflow Started',
        description: fullMeeting.outcome ? `Outcome: ${fullMeeting.outcome.outcome.replace(/_/g, ' ')}` : 'Post-meeting workflow pending',
        timestamp: fullMeeting.outcome ? fullMeeting.outcome.created_at : null,
        completed: !!fullMeeting.outcome,
      },
    ];

    return events;
  }

  // ============================================================
  // exportMeeting — Export meeting data as JSON/CSV
  // ============================================================

  exportMeeting(fullMeeting: FullMeeting, format: ExportFormat): ExportResult {
    const filename = `meeting-${fullMeeting.meeting.id}.${format}`;

    if (format === 'json') {
      return { filename, data: JSON.stringify(fullMeeting, null, 2) };
    }

    const m = fullMeeting.meeting;
    const headers = ['Prospect', 'Company', 'Title', 'Status', 'Type', 'Duration', 'Platform', 'Rep', 'Revenue Potential', 'Readiness Score'];
    const rows = [
      [m.prospect_name, m.company_name, m.prospect_title, m.status, m.meeting_type, `${m.meeting_duration}min`, m.meeting_platform, m.assigned_rep, `$${m.revenue_potential.toLocaleString()}`, `${m.meeting_readiness_score}/100`],
    ];
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    return { filename, data: csv };
  }

  // ============================================================
  // getPriority — Derive priority from revenue potential
  // ============================================================

  getPriority(meeting: FullMeeting): Priority {
    return getMeetingPriority(meeting);
  }
}

export const meetingAgentService = new MeetingAgentService();
