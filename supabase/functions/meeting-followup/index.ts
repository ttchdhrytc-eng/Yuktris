import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, meeting_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    // Load meeting
    const meetingRes = await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?id=eq.${meeting_id}&select=*`, { headers });
    const meetings = await meetingRes.json();
    const meeting = meetings[0];
    if (!meeting) return new Response(JSON.stringify({ error: "Meeting not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Generate follow-ups
    const followups = [
      { workspace_id, meeting_id, followup_type: "summary", followup_content: "Generate meeting summary and send to prospect", due_date: new Date(Date.now() + 2 * 3600000).toISOString(), is_completed: false },
      { workspace_id, meeting_id, followup_type: "email", followup_content: "Send thank-you email with meeting notes", due_date: new Date(Date.now() + 2 * 3600000).toISOString(), is_completed: false },
      { workspace_id, meeting_id, followup_type: "linkedin", followup_content: "Send LinkedIn follow-up message to prospect", due_date: new Date(Date.now() + 4 * 3600000).toISOString(), is_completed: false },
      { workspace_id, meeting_id, followup_type: "action_item", followup_content: "Review and assign action items from meeting", due_date: new Date(Date.now() + 24 * 3600000).toISOString(), is_completed: false },
    ];

    await fetch(`${supabaseUrl}/rest/v1/meeting_followups`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify(followups),
    });

    // Update meeting status to completed
    await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?id=eq.${meeting_id}`, {
      method: "PATCH", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ status: "completed" }),
    });

    // Create notification
    await fetch(`${supabaseUrl}/rest/v1/meeting_notifications`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, notification_type: "followup_due", notification_title: "Follow-ups Generated", notification_message: "Post-meeting follow-ups have been generated including summary, email, and LinkedIn message.", severity: "info" }),
    });

    return new Response(JSON.stringify({ generated: followups.length, meeting_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
