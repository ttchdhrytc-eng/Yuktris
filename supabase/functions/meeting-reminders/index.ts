import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    const now = new Date().toISOString();

    // Find unsent reminders that are due
    const remindersRes = await fetch(`${supabaseUrl}/rest/v1/meeting_reminders?workspace_id=eq.${workspace_id}&is_sent=eq.false&scheduled_for=lte.${now}&select=*,meeting_scheduler!inner(id,prospect_name,company_name,meeting_title,scheduled_start,meeting_link)`, { headers });
    const reminders = await remindersRes.json();

    let sent = 0;
    for (const reminder of reminders) {
      const meeting = reminder.meeting_scheduler;
      // Create notification
      await fetch(`${supabaseUrl}/rest/v1/meeting_notifications`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ workspace_id, meeting_id: meeting.id, notification_type: "meeting_reminder", notification_title: `Meeting Reminder: ${reminder.reminder_timing}`, notification_message: `${meeting.meeting_title} with ${meeting.prospect_name ?? "prospect"} at ${new Date(meeting.scheduled_start).toLocaleString()}.`, severity: "info" }),
      });
      // Mark as sent
      await fetch(`${supabaseUrl}/rest/v1/meeting_reminders?id=eq.${reminder.id}`, {
        method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({ is_sent: true, sent_at: now }),
      });
      sent++;
    }

    return new Response(JSON.stringify({ sent, total: reminders.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
