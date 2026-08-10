import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, meeting_id, confirmed_by } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    // Update meeting status
    await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?id=eq.${meeting_id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ status: "confirmed" }),
    });

    // Record confirmation
    await fetch(`${supabaseUrl}/rest/v1/meeting_confirmations`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, confirmed_by: confirmed_by ?? "ai", confirmation_method: confirmed_by === "human" ? "manual" : "auto" }),
    });

    // Create notification
    await fetch(`${supabaseUrl}/rest/v1/meeting_notifications`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, notification_type: "meeting_confirmed", notification_title: "Meeting Confirmed", notification_message: "Meeting has been confirmed. Calendar invite and preparation materials are ready.", severity: "success" }),
    });

    // Create reminders (24h, 1h, 15m before)
    const meetingRes = await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?id=eq.${meeting_id}&select=scheduled_start`, { headers });
    const meetings = await meetingRes.json();
    if (meetings.length > 0) {
      const startTime = new Date(meetings[0].scheduled_start);
      const reminders = [
        { reminder_type: "email", reminder_timing: "24h", scheduled_for: new Date(startTime.getTime() - 24 * 3600000).toISOString() },
        { reminder_type: "email", reminder_timing: "1h", scheduled_for: new Date(startTime.getTime() - 3600000).toISOString() },
        { reminder_type: "linkedin", reminder_timing: "1h", scheduled_for: new Date(startTime.getTime() - 3600000).toISOString() },
        { reminder_type: "push", reminder_timing: "15m", scheduled_for: new Date(startTime.getTime() - 15 * 60000).toISOString() },
      ];
      await fetch(`${supabaseUrl}/rest/v1/meeting_reminders`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(reminders.map(r => ({ workspace_id, meeting_id, ...r, is_sent: false }))),
      });
    }

    return new Response(JSON.stringify({ confirmed: true, meeting_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
