// ============================================================
// MeetingBookingEngine — Calendar integration & meeting booking
// ============================================================
//
// Finds free slots, generates Google Meet / Outlook meeting
// links, sends LinkedIn messages, and manages reminders.

import { supabase } from '@/lib/supabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CalendarConnection, CalendarEvent,
  LinkedInMeetingRequest, LinkedInMeetingSlot,
  LinkedInMeetingConfirmation, MeetingType,
} from '@/types/linkedin-browser-automation';

export interface AvailableSlot {
  start: string;
  end: string;
  available: boolean;
  conflict: boolean;
}

export class MeetingBookingEngine {
  private client: SupabaseClient;
  private workspaceId: string;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
    this.client = supabase;
  }

  // ── Calendar Connections ────────────────────────────────────

  async listConnections(): Promise<CalendarConnection[]> {
    const { data, error } = await this.client
      .from('google_accounts')
      .select('id,workspace_id,email,status,connected_at,last_synced_at,is_primary')
      .eq('workspace_id', this.workspaceId)
      .in('status', ['connected', 'expired'])
      .order('is_primary', { ascending: false })
      .order('connected_at', { ascending: true });
    if (error) return [];
    return (data ?? []).map((row) => ({
      id: row.id,
      workspace_id: row.workspace_id,
      provider: 'google' as const,
      email: row.email,
      status: row.status === 'expired' ? 'expired' as const : 'active' as const,
      calendar_id: 'primary',
      last_synced_at: row.last_synced_at,
      metadata: { google_account_id: row.id, is_primary: row.is_primary },
      created_at: row.connected_at,
      updated_at: row.last_synced_at ?? row.connected_at,
    }));
  }

  async createConnection(_params: { provider: 'google' | 'outlook'; email: string; calendarId?: string }): Promise<CalendarConnection | null> {
    throw new Error('Calendar connections are created through Google OAuth. Connect Google Calendar from Integrations.');
  }

  async deleteConnection(connectionId: string): Promise<void> {
    await this.client.from('linkedin_calendar_connections').delete().eq('id', connectionId).eq('workspace_id', this.workspaceId);
  }

  // ── Meeting Requests ────────────────────────────────────────

  async createMeetingRequest(params: {
    conversationId?: string;
    accountId?: string;
    prospectName: string;
    prospectEmail?: string;
    prospectTimezone?: string;
    meetingType?: MeetingType;
    durationMinutes?: number;
    notes?: string;
  }): Promise<LinkedInMeetingRequest | null> {
    const { data, error } = await this.client
      .from('linkedin_meeting_requests')
      .insert({
        workspace_id: this.workspaceId,
        conversation_id: params.conversationId ?? null,
        account_id: params.accountId ?? null,
        prospect_name: params.prospectName,
        prospect_email: params.prospectEmail ?? null,
        prospect_timezone: params.prospectTimezone ?? null,
        meeting_type: params.meetingType ?? 'discovery',
        duration_minutes: params.durationMinutes ?? 30,
        status: 'pending',
        notes: params.notes ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) { console.error('Create meeting request failed:', error.message); return null; }
    return data as LinkedInMeetingRequest;
  }

  async listMeetingRequests(): Promise<LinkedInMeetingRequest[]> {
    const { data, error } = await this.client
      .from('linkedin_meeting_requests')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as LinkedInMeetingRequest[];
  }

  // ── Slot Generation ────────────────────────────────────────

  async generateSlots(
    meetingRequestId: string,
    options: { startDate: string; endDate: string; durationMinutes: number; workingHoursStart?: number; workingHoursEnd?: number; timezone?: string }
  ): Promise<LinkedInMeetingSlot[]> {
    const { data, error } = await supabase.functions.invoke('linkedin-meeting-engine', {
      body: {
        action: 'generate_slots',
        workspace_id: this.workspaceId,
        meeting_request_id: meetingRequestId,
        start_date: options.startDate,
        end_date: options.endDate,
        duration_minutes: options.durationMinutes,
        timezone: options.timezone ?? 'UTC',
      },
    });
    if (error) throw new Error(`Unable to generate calendar-backed slots: ${error.message}`);
    return (data?.slots ?? []) as LinkedInMeetingSlot[];
  }

  async listSlots(meetingRequestId: string): Promise<LinkedInMeetingSlot[]> {
    const { data, error } = await this.client
      .from('linkedin_meeting_slots')
      .select('*')
      .eq('meeting_request_id', meetingRequestId)
      .order('start_time', { ascending: true });
    if (error) return [];
    return (data ?? []) as LinkedInMeetingSlot[];
  }

  // ── Conflict Detection ──────────────────────────────────────

  async checkConflict(startTime: string, endTime: string): Promise<boolean> {
    const { data, error } = await this.client
      .from('linkedin_calendar_events')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .or(`and(start_time.lt.${endTime},end_time.gt.${startTime})`)
      .limit(1);
    if (error) return false;
    return (data ?? []).length > 0;
  }

  async getCalendarEvents(startDate: string, endDate: string): Promise<CalendarEvent[]> {
    const { data, error } = await this.client
      .from('linkedin_calendar_events')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .gte('start_time', startDate)
      .lte('end_time', endDate)
      .order('start_time', { ascending: true });
    if (error) return [];
    return (data ?? []) as CalendarEvent[];
  }

  async syncCalendarEvents(connectionId: string, events: Array<Record<string, unknown>>): Promise<number> {
    let synced = 0;
    for (const event of events) {
      const { error } = await this.client.from('linkedin_calendar_events').upsert({
        workspace_id: this.workspaceId,
        connection_id: connectionId,
        external_event_id: event.external_event_id as string,
        title: event.title as string,
        description: event.description as string ?? null,
        start_time: event.start_time as string,
        end_time: event.end_time as string,
        timezone: event.timezone as string ?? null,
        attendees: event.attendees ?? [],
        location: event.location as string ?? null,
        meeting_url: event.meeting_url as string ?? null,
        status: event.status as string ?? 'confirmed',
      }, { onConflict: 'connection_id,external_event_id' });
      if (!error) synced++;
    }
    await this.client.from('linkedin_calendar_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', connectionId);
    return synced;
  }

  // ── Meeting Confirmation ────────────────────────────────────

  async confirmMeeting(slotId: string, _options: { meetingProvider?: string; meetingUrl?: string } = {}): Promise<LinkedInMeetingConfirmation | null> {
    const { data, error } = await supabase.functions.invoke('linkedin-meeting-engine', {
      body: {
        action: 'confirm_meeting',
        workspace_id: this.workspaceId,
        slot_id: slotId,
      },
    });
    if (error) throw new Error(`Meeting confirmation failed: ${error.message}`);
    const confirmation = (data?.confirmation ?? null) as LinkedInMeetingConfirmation | null;
    if (confirmation) await this.scheduleReminders(confirmation.id, confirmation.confirmed_start);
    return confirmation;
  }

  async listConfirmations(): Promise<LinkedInMeetingConfirmation[]> {
    const { data, error } = await this.client
      .from('linkedin_meeting_confirmations')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: false });
    if (error) return [];
    return (data ?? []) as LinkedInMeetingConfirmation[];
  }

  // ── Reminders ──────────────────────────────────────────────

  async scheduleReminders(confirmationId: string, meetingStart: string): Promise<void> {
    const start = new Date(meetingStart);
    const reminderTypes: Array<{ type: '24h' | '1h' | '15m' | '5m'; offsetMs: number }> = [
      { type: '24h', offsetMs: 24 * 3600 * 1000 },
      { type: '1h', offsetMs: 3600 * 1000 },
      { type: '15m', offsetMs: 15 * 60 * 1000 },
      { type: '5m', offsetMs: 5 * 60 * 1000 },
    ];

    for (const r of reminderTypes) {
      const reminderTime = new Date(start.getTime() - r.offsetMs);
      if (reminderTime > new Date()) {
        await this.client.from('linkedin_meeting_reminders').insert({
          workspace_id: this.workspaceId,
          meeting_confirmation_id: confirmationId,
          reminder_type: r.type,
          scheduled_for: reminderTime.toISOString(),
          channel: 'linkedin',
          status: 'pending',
        });
      }
    }
  }

  async listReminders(): Promise<Array<{ id: string; reminder_type: string; scheduled_for: string; status: string }>> {
    const { data, error } = await this.client
      .from('linkedin_meeting_reminders')
      .select('id, reminder_type, scheduled_for, status')
      .eq('workspace_id', this.workspaceId)
      .order('scheduled_for', { ascending: true });
    if (error) return [];
    return (data ?? []) as Array<{ id: string; reminder_type: string; scheduled_for: string; status: string }>;
  }

  // ── Google Meet Link Generation ──────────────────────────────

  generateGoogleMeetLink(_meetingTitle: string): never {
    throw new Error('Google Meet links are created only by the Google Calendar API when a meeting is confirmed.');
  }
}
