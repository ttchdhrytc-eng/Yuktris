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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);
  try {
    const body = await req.json() as Record<string, unknown>;
    const workspaceId = body.workspace_id;
    const action = typeof body.action === "string" ? body.action : "create";
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, { allowServiceRole: true });
    const workspace = workspaceId as string;
    const context = await getWorkspaceGoogleCalendarContext(admin, workspace);

    if (action === "connection") {
      return jsonResponse({ connected: true, account_id: context.accountId, email: context.email });
    }

    if (action === "freebusy") {
      const timeMin = requireString(body.time_min, "time_min");
      const timeMax = requireString(body.time_max, "time_max");
      const busy = await queryFreeBusy({ context, timeMin, timeMax, timezone: optionalString(body.timezone) });
      return jsonResponse({ busy });
    }

    if (action === "create") {
      const summary = requireString(body.summary, "summary");
      const start = requireString(body.start, "start");
      const end = requireString(body.end, "end");
      const attendees = Array.isArray(body.attendees) ? body.attendees.filter((v): v is string => typeof v === "string" && !!v) : [];
      const event = await createGoogleCalendarEvent({
        context,
        summary,
        description: optionalString(body.description),
        start,
        end,
        timezone: optionalString(body.timezone),
        attendeeEmails: attendees,
        requestId: optionalString(body.idempotency_key) ?? crypto.randomUUID(),
      });
      return jsonResponse({ ...event, host_email: context.email });
    }

    if (action === "update") {
      const eventId = requireString(body.event_id, "event_id");
      const event = await updateGoogleCalendarEvent({
        context,
        eventId,
        start: optionalString(body.start),
        end: optionalString(body.end),
        timezone: optionalString(body.timezone),
        summary: optionalString(body.summary),
        description: optionalString(body.description),
      });
      return jsonResponse(event);
    }

    if (action === "delete") {
      const eventId = requireString(body.event_id, "event_id");
      await deleteGoogleCalendarEvent(context, eventId);
      return jsonResponse({ deleted: true });
    }

    return jsonError(`Unknown action: ${action}`, 400);
  } catch (error) {
    const status = authorizationStatus(error);
    return jsonError(error instanceof Error ? error.message : "Google Calendar operation failed", status === 500 ? 400 : status);
  }
});

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
