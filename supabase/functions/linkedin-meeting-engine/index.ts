// linkedin-meeting-engine — Meeting booking & calendar sync
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, workspace_id } = body as Record<string, unknown>;

    if (!workspace_id) return jsonError("workspace_id is required", 400);
    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id);

    switch (action) {
      case "generate_slots": {
        const { meeting_request_id, start_date, end_date, duration_minutes } = body as Record<string, unknown>;
        if (!meeting_request_id) return jsonError("meeting_request_id is required", 400);
        const duration = (duration_minutes as number) ?? 30;
        const slots: unknown[] = [];
        const start = new Date(start_date as string);
        const end = new Date(end_date as string);

        for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
          const dow = day.getDay();
          if (dow === 0 || dow === 6) continue;
          for (let hour = 9; hour < 17; hour++) {
            for (const minute of [0, 30]) {
              const slotStart = new Date(day); slotStart.setHours(hour, minute, 0, 0);
              const slotEnd = new Date(slotStart.getTime() + duration * 60 * 1000);
              if (slotEnd.getHours() > 17) continue;
              const { data } = await supabase.from("linkedin_meeting_slots").insert({
                workspace_id, meeting_request_id: meeting_request_id as string,
                start_time: slotStart.toISOString(), end_time: slotEnd.toISOString(),
                timezone: "UTC", status: "available", conflict_detected: false,
              }).select("*").maybeSingle();
              if (data) slots.push(data);
            }
          }
        }
        await supabase.from("linkedin_meeting_requests").update({ status: "slots_generated" }).eq("id", meeting_request_id as string).eq("workspace_id", workspace_id);
        return jsonResponse({ slots, count: slots.length });
      }
      case "confirm_meeting": {
        const { slot_id } = body as Record<string, string>;
        if (!slot_id) return jsonError("slot_id is required", 400);
        const { data: slot } = await supabase.from("linkedin_meeting_slots").select("*").eq("id", slot_id).eq("workspace_id", workspace_id).maybeSingle();
        if (!slot) return jsonError("Slot not found", 404);
        const s = slot as Record<string, unknown>;
        const meetLink = `https://meet.google.com/${Math.random().toString(36).substring(2, 12)}`;
        const { data: confirmation, error } = await supabase.from("linkedin_meeting_confirmations").insert({
          workspace_id, meeting_request_id: s.meeting_request_id, slot_id,
          confirmed_start: s.start_time, confirmed_end: s.end_time, timezone: s.timezone,
          meeting_url: meetLink, meeting_provider: "google_meet",
        }).select("*").maybeSingle();
        if (error) return jsonError(error.message, 400);
        await supabase.from("linkedin_meeting_slots").update({ status: "confirmed" }).eq("id", slot_id).eq("workspace_id", workspace_id);
        await supabase.from("linkedin_meeting_requests").update({ status: "confirmed" }).eq("id", s.meeting_request_id as string).eq("workspace_id", workspace_id);
        return jsonResponse({ confirmation, meeting_url: meetLink });
      }
      case "list_requests": {
        const { data, error } = await supabase.from("linkedin_meeting_requests").select("*").eq("workspace_id", workspace_id).order("created_at", { ascending: false });
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ requests: data });
      }
      case "list_connections": {
        const { data, error } = await supabase.from("linkedin_calendar_connections").select("*").eq("workspace_id", workspace_id);
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ connections: data });
      }
      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Meeting engine failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
