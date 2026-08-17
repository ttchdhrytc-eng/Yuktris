// meeting-scheduler — authenticated meeting intent + real Google Calendar scheduling
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
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

type Json = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json() as Json;
    const workspaceId = requireString(body.workspace_id, "workspace_id");
    const action = requireString(body.action, "action");
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, { allowServiceRole: true });

    if (action === "detect") {
      const { data: conversations, error } = await admin.from("conversations")
        .select("id,contact_id,company_id,prospect_name,prospect_title,company_name,buying_stage,meeting_readiness_level,status")
        .eq("workspace_id", workspaceId)
        .eq("status", "active")
        .order("last_analyzed_at", { ascending: false })
        .limit(30);
      if (error) throw new Error(error.message);
      let detected = 0;
      for (const conversation of conversations ?? []) {
        const { data: intent } = await admin.from("conversation_intents").select("*")
          .eq("workspace_id", workspaceId).eq("conversation_id", conversation.id)
          .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (!intent) continue;
        const primary = String(intent.primary_intent ?? "unknown");
        const likelihood = Number(intent.meeting_likelihood ?? 0);
        const ready = ["ready", "almost_ready"].includes(String(conversation.meeting_readiness_level ?? ""));
        if (!["meeting_request", "demo_request", "pricing_request"].includes(primary) && !ready && likelihood < 0.6) continue;

        const { data: existing } = await admin.from("meeting_requests").select("id")
          .eq("workspace_id", workspaceId).eq("conversation_id", conversation.id)
          .in("status", ["pending", "approved", "scheduled"]).limit(1).maybeSingle();
        if (existing) continue;

        const meetingType = primary === "demo_request" ? "demo" : primary === "pricing_request" ? "pricing_discussion" : "discovery";
        const duration = meetingType === "demo" ? 45 : 30;
        const { data: meetingRequest, error: requestError } = await admin.from("meeting_requests").insert({
          workspace_id: workspaceId,
          conversation_id: conversation.id,
          contact_id: conversation.contact_id,
          company_id: conversation.company_id,
          prospect_name: conversation.prospect_name,
          prospect_title: conversation.prospect_title,
          company_name: conversation.company_name,
          detected_intent: ["meeting_request", "demo_request", "pricing_request"].includes(primary) ? primary : "auto_detected",
          meeting_urgency: intent.urgency ?? "medium",
          buying_stage: conversation.buying_stage,
          meeting_readiness_level: conversation.meeting_readiness_level,
          recommended_meeting_type: meetingType,
          estimated_duration: duration,
          confidence_score: intent.confidence ?? 0.5,
          reasoning: `Detected ${primary} with ${Math.round(likelihood * 100)}% meeting likelihood`,
          status: "pending",
        }).select("*").single();
        if (requestError) throw new Error(requestError.message);
        await createAvailableSlots(admin, workspaceId, meetingRequest.id, duration, "America/New_York");
        await admin.from("meeting_candidates").insert({
          workspace_id: workspaceId,
          meeting_request_id: meetingRequest.id,
          contact_id: conversation.contact_id,
          company_id: conversation.company_id,
          conversation_id: conversation.id,
          prospect_name: conversation.prospect_name,
          company_name: conversation.company_name,
          buying_stage: conversation.buying_stage,
          meeting_readiness: conversation.meeting_readiness_level,
          intent_score: Math.round(Number(intent.likelihood_to_buy ?? 0.5) * 100),
          engagement_score: 50,
          overall_score: Math.round(Math.max(likelihood, Number(intent.likelihood_to_buy ?? 0.5)) * 100),
          recommended_meeting_type: meetingType,
          recommended_duration: duration,
          priority: intent.urgency === "critical" ? "critical" : intent.urgency === "high" ? "high" : "medium",
          status: "candidate",
        });
        await upsertNotification(admin, workspaceId, `meeting-detected:${meetingRequest.id}`, "meeting_detected", "Meeting intent detected", `${conversation.prospect_name ?? "A prospect"} is ready for a ${meetingType.replaceAll("_", " ")} meeting.`, "/app/meeting-intelligence");
        detected++;
      }
      return jsonResponse({ detected, total_conversations: (conversations ?? []).length });
    }

    if (action === "schedule") {
      const requestId = requireString(body.request_id, "request_id");
      const slotId = optionalString(body.slot_id);
      const { data: request, error: requestError } = await admin.from("meeting_requests").select("*")
        .eq("id", requestId).eq("workspace_id", workspaceId).maybeSingle();
      if (requestError) throw new Error(requestError.message);
      if (!request) return jsonError("Meeting request not found", 404);

      let slotQuery = admin.from("meeting_slots").select("*").eq("workspace_id", workspaceId).eq("meeting_request_id", requestId).eq("is_available", true);
      if (slotId) slotQuery = slotQuery.eq("id", slotId);
      else slotQuery = slotQuery.in("prospect_response", ["accepted", "pending"]).order("prospect_response", { ascending: true }).order("slot_rank", { ascending: true }).limit(1);
      const { data: slots, error: slotError } = await slotQuery;
      if (slotError) throw new Error(slotError.message);
      const slot = slots?.[0];
      if (!slot) return jsonError("No available meeting slot", 409);

      let attendeeEmail: string | null = null;
      if (request.contact_id) {
        const { data: contact } = await admin.from("contacts").select("email").eq("id", request.contact_id).eq("workspace_id", workspaceId).maybeSingle();
        attendeeEmail = contact?.email ?? null;
      }
      if (!attendeeEmail) return jsonError("Prospect email is required for calendar booking", 409);

      const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
      const busy = await queryFreeBusy({ context, timeMin: slot.start_time, timeMax: slot.end_time, timezone: slot.timezone ?? "UTC" });
      if (busy.length) return jsonError("Selected slot is no longer available", 409);

      const meetingType = String(request.recommended_meeting_type ?? "discovery");
      const title = `${meetingType.replaceAll("_", " ")}: ${request.prospect_name ?? "Prospect"}${request.company_name ? ` — ${request.company_name}` : ""}`;
      const event = await createGoogleCalendarEvent({
        context,
        summary: title,
        description: "Meeting booked automatically by Yuktris after prospect qualification.",
        start: slot.start_time,
        end: slot.end_time,
        timezone: slot.timezone ?? "UTC",
        attendeeEmails: [attendeeEmail],
        requestId: `yuktris-${requestId}-${slot.id}`,
      });

      const { data: meeting, error: meetingError } = await admin.from("meeting_scheduler").insert({
        workspace_id: workspaceId,
        meeting_request_id: requestId,
        conversation_id: request.conversation_id,
        contact_id: request.contact_id,
        company_id: request.company_id,
        meeting_type: meetingType,
        meeting_title: title,
        meeting_description: "AI-qualified meeting booked by Yuktris",
        scheduled_start: slot.start_time,
        scheduled_end: slot.end_time,
        timezone: slot.timezone ?? "UTC",
        duration_minutes: request.estimated_duration ?? 30,
        platform: "google_meet",
        meeting_link: event.meetLink ?? event.htmlLink,
        google_meet_link: event.meetLink,
        calendar_event_id: event.externalEventId,
        status: "confirmed",
        prospect_name: request.prospect_name,
        prospect_title: request.prospect_title,
        company_name: request.company_name,
      }).select("*").single();
      if (meetingError) {
        await deleteGoogleCalendarEvent(context, event.externalEventId).catch(() => undefined);
        throw new Error(meetingError.message);
      }

      await admin.from("meeting_slots").update({ is_selected: true, prospect_response: "accepted" }).eq("id", slot.id).eq("workspace_id", workspaceId);
      await admin.from("meeting_requests").update({ status: "scheduled" }).eq("id", requestId).eq("workspace_id", workspaceId);
      await admin.from("meeting_candidates").update({ status: "scheduled" }).eq("meeting_request_id", requestId).eq("workspace_id", workspaceId);
      await admin.from("meeting_confirmations").insert({ workspace_id: workspaceId, meeting_id: meeting.id, confirmed_by: "ai", confirmation_method: "auto", notes: "Google Calendar invite created and sent." });
      await upsertNotification(admin, workspaceId, `meeting-booked:${meeting.id}`, "meeting_booked", "Meeting booked", `${title} is booked for ${new Date(slot.start_time).toISOString()}.`, "/app/meetings", { meeting_id: meeting.id, meeting_url: event.meetLink, calendar_event_id: event.externalEventId });
      return jsonResponse({ scheduled: true, meeting_id: meeting.id, meeting_url: event.meetLink, calendar_event_id: event.externalEventId });
    }

    if (action === "reschedule") {
      const meetingId = requireString(body.meeting_id, "meeting_id");
      const start = requireString(body.start, "start");
      const end = requireString(body.end, "end");
      const { data: meeting } = await admin.from("meeting_scheduler").select("*").eq("id", meetingId).eq("workspace_id", workspaceId).maybeSingle();
      if (!meeting) return jsonError("Meeting not found", 404);
      if (!meeting.calendar_event_id) return jsonError("Google Calendar event id missing", 409);
      const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
      const event = await updateGoogleCalendarEvent({ context, eventId: meeting.calendar_event_id, start, end, timezone: optionalString(body.timezone) ?? meeting.timezone });
      await admin.from("meeting_scheduler").update({ scheduled_start: start, scheduled_end: end, meeting_link: event.meetLink ?? meeting.meeting_link, google_meet_link: event.meetLink ?? meeting.google_meet_link, status: "rescheduled", version: Number(meeting.version ?? 1) + 1 }).eq("id", meetingId);
      return jsonResponse({ rescheduled: true, meeting_url: event.meetLink ?? meeting.meeting_link });
    }

    if (action === "cancel") {
      const meetingId = requireString(body.meeting_id, "meeting_id");
      const { data: meeting } = await admin.from("meeting_scheduler").select("calendar_event_id").eq("id", meetingId).eq("workspace_id", workspaceId).maybeSingle();
      if (!meeting) return jsonError("Meeting not found", 404);
      if (meeting.calendar_event_id) {
        const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
        await deleteGoogleCalendarEvent(context, meeting.calendar_event_id);
      }
      await admin.from("meeting_scheduler").update({ status: "cancelled" }).eq("id", meetingId).eq("workspace_id", workspaceId);
      await upsertNotification(admin, workspaceId, `meeting-cancelled:${meetingId}`, "meeting_cancelled", "Meeting cancelled", "The meeting was cancelled and the calendar invite was removed.", "/app/meetings");
      return jsonResponse({ cancelled: true });
    }

    return jsonError(`Unknown action: ${action}`, 400);
  } catch (error) {
    const status = authorizationStatus(error);
    const message = error instanceof Error ? error.message : "Meeting scheduling failed";
    return jsonError(message, status === 500 ? 400 : status);
  }
});

async function createAvailableSlots(admin: any, workspaceId: string, requestId: string, durationMinutes: number, timezone: string): Promise<void> {
  const context = await getWorkspaceGoogleCalendarContext(admin, workspaceId);
  const now = new Date();
  const endWindow = new Date(now.getTime() + 14 * 86_400_000);
  const busy = await queryFreeBusy({ context, timeMin: now.toISOString(), timeMax: endWindow.toISOString(), timezone });
  const rows: Json[] = [];
  for (let offset = 1; offset <= 14 && rows.length < 5; offset++) {
    const date = new Date(now.getTime() + offset * 86_400_000);
    if ([0, 6].includes(date.getUTCDay())) continue;
    for (const hour of [10, 13, 15]) {
      const start = new Date(date); start.setUTCHours(hour, 0, 0, 0);
      const end = new Date(start.getTime() + durationMinutes * 60_000);
      const conflict = busy.some((b) => new Date(b.start).getTime() < end.getTime() && new Date(b.end).getTime() > start.getTime());
      if (!conflict) rows.push({ workspace_id: workspaceId, meeting_request_id: requestId, start_time: start.toISOString(), end_time: end.toISOString(), slot_rank: rows.length + 1, timezone, is_available: true, is_offered: true, prospect_response: "pending" });
      if (rows.length >= 5) break;
    }
  }
  if (rows.length) {
    const { error } = await admin.from("meeting_slots").insert(rows);
    if (error) throw new Error(error.message);
  }
}

async function upsertNotification(admin: any, workspaceId: string, eventKey: string, type: string, title: string, body: string, actionUrl: string, metadata: Json = {}): Promise<void> {
  const { error } = await admin.from("notifications").upsert({ workspace_id: workspaceId, event_key: eventKey, type, title, body, action_url: actionUrl, metadata }, { onConflict: "workspace_id,event_key" });
  if (error) console.warn("notification_write_failed", { code: error.code });
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}
function optionalString(value: unknown): string | undefined { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function jsonResponse(data: Json): Response { return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(message: string, status: number): Response { return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
