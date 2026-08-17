// linkedin-meeting-engine — Meeting booking & Google Calendar sync
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getWorkspaceGoogleCalendarContext,
  queryFreeBusy,
  updateGoogleCalendarEvent,
} from "../_shared/googleCalendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Json = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json() as Json;
    const action = typeof body.action === "string" ? body.action : "";
    const workspaceId = requireString(body.workspace_id, "workspace_id");
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, { allowServiceRole: true });

    switch (action) {
      case "generate_slots": {
        const meetingRequestId = requireString(body.meeting_request_id, "meeting_request_id");
        const startDate = requireString(body.start_date, "start_date");
        const endDate = requireString(body.end_date, "end_date");
        const duration = typeof body.duration_minutes === "number" ? Math.max(15, Math.min(120, body.duration_minutes)) : 30;
        const timezone = optionalString(body.timezone) ?? "UTC";
        const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
        const busy = await queryFreeBusy({ context, timeMin: new Date(startDate).toISOString(), timeMax: new Date(endDate).toISOString(), timezone });
        const slots: Json[] = [];
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return jsonError("Invalid date range", 400);

        await admin.from("linkedin_meeting_slots").delete()
          .eq("workspace_id", workspaceId)
          .eq("meeting_request_id", meetingRequestId)
          .in("status", ["available", "proposed", "expired"]);

        for (let day = new Date(start); day <= end && slots.length < 12; day.setUTCDate(day.getUTCDate() + 1)) {
          const dow = day.getUTCDay();
          if (dow === 0 || dow === 6) continue;
          for (const hour of [9, 10, 11, 13, 14, 15, 16]) {
            const slotStart = new Date(day);
            slotStart.setUTCHours(hour, 0, 0, 0);
            if (slotStart.getTime() <= Date.now()) continue;
            const slotEnd = new Date(slotStart.getTime() + duration * 60_000);
            const conflict = busy.some((b) => new Date(b.start).getTime() < slotEnd.getTime() && new Date(b.end).getTime() > slotStart.getTime());
            if (conflict) continue;
            const { data, error } = await admin.from("linkedin_meeting_slots").insert({
              workspace_id: workspaceId,
              meeting_request_id: meetingRequestId,
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              timezone,
              status: "available",
              conflict_detected: false,
              conflict_details: null,
              metadata: { source: "google_freebusy" },
            }).select("*").maybeSingle();
            if (error) throw new Error(error.message);
            if (data) slots.push(data as Json);
          }
        }
        await admin.from("linkedin_meeting_requests").update({ status: "slots_generated" })
          .eq("id", meetingRequestId).eq("workspace_id", workspaceId);
        return jsonResponse({ slots, count: slots.length, calendar_verified: true });
      }

      case "confirm_meeting": {
        const slotId = requireString(body.slot_id, "slot_id");
        const { data: slot, error: slotError } = await admin.from("linkedin_meeting_slots").select("*")
          .eq("id", slotId).eq("workspace_id", workspaceId).maybeSingle();
        if (slotError) throw new Error(slotError.message);
        if (!slot) return jsonError("Slot not found", 404);
        const s = slot as Json;

        const requestId = requireString(s.meeting_request_id, "meeting_request_id");
        const { data: request, error: requestError } = await admin.from("linkedin_meeting_requests").select("*")
          .eq("id", requestId).eq("workspace_id", workspaceId).maybeSingle();
        if (requestError) throw new Error(requestError.message);
        if (!request) return jsonError("Meeting request not found", 404);
        const r = request as Json;

        const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
        const connection = await ensureCalendarConnection(admin, workspaceId, context.email);
        const title = `${humanize(optionalString(r.meeting_type) ?? "discovery")} with ${optionalString(r.prospect_name) ?? "Prospect"}`;
        const attendeeEmails = optionalString(r.prospect_email) ? [r.prospect_email as string] : [];
        const event = await createGoogleCalendarEvent({
          context,
          summary: title,
          description: optionalString(r.notes) ?? "Meeting scheduled by Yuktris",
          start: requireString(s.start_time, "start_time"),
          end: requireString(s.end_time, "end_time"),
          timezone: optionalString(s.timezone) ?? "UTC",
          attendeeEmails,
          requestId: `yuktris-${requestId}-${slotId}`,
        });

        const { data: calendarEvent, error: calendarError } = await admin.from("linkedin_calendar_events").upsert({
          workspace_id: workspaceId,
          connection_id: connection.id,
          external_event_id: event.externalEventId,
          title,
          description: optionalString(r.notes) ?? "Meeting scheduled by Yuktris",
          start_time: s.start_time,
          end_time: s.end_time,
          timezone: s.timezone ?? "UTC",
          attendees: attendeeEmails.map((email) => ({ email })),
          meeting_url: event.meetLink,
          status: event.status,
          metadata: { html_link: event.htmlLink, google_account_id: context.accountId },
        }, { onConflict: "connection_id,external_event_id" }).select("*").maybeSingle();
        if (calendarError) throw new Error(calendarError.message);

        const { data: existingConfirmation } = await admin.from("linkedin_meeting_confirmations").select("id")
          .eq("workspace_id", workspaceId).eq("meeting_request_id", requestId).eq("slot_id", slotId).maybeSingle();
        let confirmation: Json | null = null;
        if (existingConfirmation) {
          const { data, error } = await admin.from("linkedin_meeting_confirmations").update({
            confirmed_start: s.start_time,
            confirmed_end: s.end_time,
            timezone: s.timezone ?? "UTC",
            meeting_url: event.meetLink,
            meeting_provider: "google_meet",
            calendar_event_id: calendarEvent?.id ?? null,
            prospect_confirmed: true,
            prospect_confirmed_at: new Date().toISOString(),
            metadata: { external_event_id: event.externalEventId },
          }).eq("id", existingConfirmation.id).select("*").maybeSingle();
          if (error) throw new Error(error.message);
          confirmation = data as Json | null;
        } else {
          const { data, error } = await admin.from("linkedin_meeting_confirmations").insert({
            workspace_id: workspaceId,
            meeting_request_id: requestId,
            slot_id: slotId,
            confirmed_start: s.start_time,
            confirmed_end: s.end_time,
            timezone: s.timezone ?? "UTC",
            meeting_url: event.meetLink,
            meeting_provider: "google_meet",
            calendar_event_id: calendarEvent?.id ?? null,
            prospect_confirmed: true,
            prospect_confirmed_at: new Date().toISOString(),
            metadata: { external_event_id: event.externalEventId },
          }).select("*").maybeSingle();
          if (error) throw new Error(error.message);
          confirmation = data as Json | null;
        }
        await admin.from("linkedin_meeting_slots").update({ status: "confirmed" }).eq("id", slotId).eq("workspace_id", workspaceId);
        await admin.from("linkedin_meeting_requests").update({ status: "confirmed" }).eq("id", requestId).eq("workspace_id", workspaceId);
        await createMeetingNotification(admin, workspaceId, title, event.meetLink, s.start_time as string);
        return jsonResponse({ confirmation, meeting_url: event.meetLink, external_event_id: event.externalEventId, calendar_event_id: calendarEvent?.id ?? null });
      }

      case "reschedule_meeting": {
        const confirmationId = requireString(body.confirmation_id, "confirmation_id");
        const start = requireString(body.start, "start");
        const end = requireString(body.end, "end");
        const { data: confirmation } = await admin.from("linkedin_meeting_confirmations")
          .select("*, linkedin_calendar_events(external_event_id)")
          .eq("id", confirmationId).eq("workspace_id", workspaceId).maybeSingle();
        if (!confirmation) return jsonError("Confirmation not found", 404);
        const c = confirmation as Json;
        const eventId = ((c.linkedin_calendar_events as Json | null)?.external_event_id as string | undefined) ?? optionalString((c.metadata as Json | null)?.external_event_id);
        if (!eventId) return jsonError("Calendar event id is missing", 409);
        const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
        const event = await updateGoogleCalendarEvent({ context, eventId, start, end, timezone: optionalString(body.timezone) ?? optionalString(c.timezone) });
        await admin.from("linkedin_meeting_confirmations").update({ confirmed_start: start, confirmed_end: end, meeting_url: event.meetLink ?? c.meeting_url }).eq("id", confirmationId);
        return jsonResponse({ updated: true, meeting_url: event.meetLink ?? c.meeting_url });
      }

      case "cancel_meeting": {
        const confirmationId = requireString(body.confirmation_id, "confirmation_id");
        const { data: confirmation } = await admin.from("linkedin_meeting_confirmations")
          .select("*, linkedin_calendar_events(external_event_id)")
          .eq("id", confirmationId).eq("workspace_id", workspaceId).maybeSingle();
        if (!confirmation) return jsonError("Confirmation not found", 404);
        const c = confirmation as Json;
        const eventId = ((c.linkedin_calendar_events as Json | null)?.external_event_id as string | undefined) ?? optionalString((c.metadata as Json | null)?.external_event_id);
        if (eventId) {
          const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
          await deleteGoogleCalendarEvent(context, eventId);
        }
        await admin.from("linkedin_meeting_requests").update({ status: "cancelled" }).eq("id", c.meeting_request_id as string).eq("workspace_id", workspaceId);
        return jsonResponse({ cancelled: true });
      }

      case "list_requests": {
        const { data, error } = await admin.from("linkedin_meeting_requests").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false });
        if (error) throw new Error(error.message);
        return jsonResponse({ requests: data ?? [] });
      }

      case "list_connections": {
        const { data, error } = await admin.from("google_accounts").select("id,email,status,is_primary,connected_at,last_synced_at")
          .eq("workspace_id", workspaceId).in("status", ["connected", "expired"]).order("is_primary", { ascending: false });
        if (error) throw new Error(error.message);
        return jsonResponse({ connections: (data ?? []).map((a: Json) => ({ ...a, provider: "google", calendar_id: "primary" })) });
      }

      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (error) {
    const authStatus = authorizationStatus(error);
    const message = error instanceof Error ? error.message : "Meeting engine failed";
    return jsonError(message, authStatus === 500 ? 400 : authStatus);
  }
});

async function ensureCalendarConnection(admin: any, workspaceId: string, email: string): Promise<Json> {
  const { data: existing } = await admin.from("linkedin_calendar_connections").select("*")
    .eq("workspace_id", workspaceId).eq("provider", "google").eq("email", email).maybeSingle();
  if (existing) {
    await admin.from("linkedin_calendar_connections").update({ status: "active", calendar_id: "primary", last_synced_at: new Date().toISOString() }).eq("id", existing.id);
    return existing as Json;
  }
  const { data, error } = await admin.from("linkedin_calendar_connections").insert({
    workspace_id: workspaceId,
    provider: "google",
    email,
    calendar_id: "primary",
    status: "active",
    last_synced_at: new Date().toISOString(),
    metadata: { source: "google_oauth" },
  }).select("*").single();
  if (error) throw new Error(error.message);
  return data as Json;
}

async function createMeetingNotification(admin: any, workspaceId: string, title: string, meetingUrl: string | null, start: string): Promise<void> {
  const payload = {
    workspace_id: workspaceId,
    type: "meeting_booked",
    title: "Meeting booked",
    body: `${title} is booked for ${new Date(start).toISOString()}`,
    action_url: "/app/meetings",
    event_key: `linkedin-meeting:${workspaceId}:${start}`,
    metadata: { meeting_url: meetingUrl, scheduled_start: start },
  };
  const { error } = await admin.from("notifications").insert(payload);
  if (error && !String(error.message).includes("relation \"notifications\" does not exist")) {
    console.warn("meeting_notification_failed", { code: error.code });
  }
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}
function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}
function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
