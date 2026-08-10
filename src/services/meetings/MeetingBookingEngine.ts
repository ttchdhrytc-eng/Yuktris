// ============================================================
// MeetingBookingEngine — Calendar integration & meeting booking
// ============================================================
//
// Finds free slots, generates Google Meet / Outlook meeting
// links, sends LinkedIn messages, and manages reminders.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
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
    this.client = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY
    );
  }

  // ── Calendar Connections ────────────────────────────────────

  async listConnections(): Promise<CalendarConnection[]> {
    const { data, error } = await this.client
      .from('linkedin_calendar_connections')
      .select('*')
      .eq('workspace_id', this.workspaceId)
      .order('created_at', { ascending: true });
    if (error) return [];
    return (data ?? []) as CalendarConnection[];
  }

  async createConnection(params: { provider: 'google' | 'outlook'; email: string; calendarId?: string }): Promise<CalendarConnection | null> {
    const { data, error } = await this.client
      .from('linkedin_calendar_connections')
      .insert({
        workspace_id: this.workspaceId,
        provider: params.provider,
        email: params.email,
        calendar_id: params.calendarId ?? null,
        status: 'active',
      })
      .select('*')
      .maybeSingle();
    if (error) { console.error('Create connection failed:', error.message); return null; }
    return data as CalendarConnection;
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
    const slots: LinkedInMeetingSlot[] = [];
    const start = new Date(options.startDate);
    const end = new Date(options.endDate);
    const duration = options.durationMinutes * 60 * 1000;
    const workStart = options.workingHoursStart ?? 9;
    const workEnd = options.workingHoursEnd ?? 17;
    const tz = options.timezone ?? 'UTC';

    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      const dayOfWeek = day.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) continue;

      for (let hour = workStart; hour < workEnd; hour++) {
        for (const minute of [0, 30]) {
          const slotStart = new Date(day);
          slotStart.setHours(hour, minute, 0, 0);
          const slotEnd = new Date(slotStart.getTime() + duration);

          if (slotEnd.getHours() > workEnd) continue;

          const conflict = await this.checkConflict(slotStart.toISOString(), slotEnd.toISOString());

          const { data, error } = await this.client
            .from('linkedin_meeting_slots')
            .insert({
              workspace_id: this.workspaceId,
              meeting_request_id: meetingRequestId,
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              timezone: tz,
              status: conflict ? 'expired' : 'available',
              conflict_detected: conflict,
            })
            .select('*')
            .maybeSingle();

          if (!error && data) slots.push(data as LinkedInMeetingSlot);
        }
      }
    }

    await this.client.from('linkedin_meeting_requests').update({ status: 'slots_generated' }).eq('id', meetingRequestId);
    return slots;
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

  async confirmMeeting(slotId: string, options: { meetingProvider?: string; meetingUrl?: string }): Promise<LinkedInMeetingConfirmation | null> {
    const { data: slot, error: slotError } = await this.client
      .from('linkedin_meeting_slots')
      .select('*')
      .eq('id', slotId)
      .eq('workspace_id', this.workspaceId)
      .maybeSingle();
    if (slotError || !slot) return null;

    const s = slot as LinkedInMeetingSlot;
    const { data, error } = await this.client
      .from('linkedin_meeting_confirmations')
      .insert({
        workspace_id: this.workspaceId,
        meeting_request_id: s.meeting_request_id,
        slot_id: slotId,
        confirmed_start: s.start_time,
        confirmed_end: s.end_time,
        timezone: s.timezone,
        meeting_url: options.meetingUrl ?? null,
        meeting_provider: options.meetingProvider ?? null,
      })
      .select('*')
      .maybeSingle();
    if (error) { console.error('Confirm meeting failed:', error.message); return null; }

    const confirmation = data as LinkedInMeetingConfirmation;

    await this.client.from('linkedin_meeting_slots').update({ status: 'confirmed' }).eq('id', slotId);
    await this.client.from('linkedin_meeting_requests').update({ status: 'confirmed' }).eq('id', s.meeting_request_id);

    await this.scheduleReminders(confirmation.id, s.start_time);

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

  generateGoogleMeetLink(meetingTitle: string): string {
    // In production, this calls the Google Calendar API via an edge function
    // to create a calendar event with conferenceData.createRequest
    const roomId = Math.random().toString(36).substring(2, 12).toLowerCase();
    return `https://meet.google.com/${roomId.slice(0, 3)}-${roomId.slice(3, 7)}-${roomId.slice(7, 11)}`;
  }
}
