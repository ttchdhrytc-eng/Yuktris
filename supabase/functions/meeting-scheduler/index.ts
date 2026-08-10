import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    if (action === "detect") {
      // Find conversations with meeting intent
      const convsRes = await fetch(`${supabaseUrl}/rest/v1/conversations?workspace_id=eq.${workspace_id}&status=eq.active&select=id,contact_id,company_id,prospect_name,prospect_title,company_name,buying_stage,meeting_readiness_level&order=last_analyzed_at.desc&limit=30`, { headers });
      const conversations = await convsRes.json();

      let detected = 0;
      for (const conv of conversations) {
        const intentsRes = await fetch(`${supabaseUrl}/rest/v1/conversation_intents?conversation_id=eq.${conv.id}&order=created_at.desc&limit=1&select=*`, { headers });
        const intents = await intentsRes.json();
        if (!intents.length) continue;

        const intent = intents[0];
        const hasMeetingIntent = ["meeting_request", "demo_request", "pricing_request"].includes(intent.primary_intent);
        const isReady = conv.meeting_readiness_level === "ready" || conv.meeting_readiness_level === "almost_ready";
        if (!hasMeetingIntent && !isReady && (intent.meeting_likelihood ?? 0) < 0.6) continue;

        // Check if request already exists
        const existingRes = await fetch(`${supabaseUrl}/rest/v1/meeting_requests?conversation_id=eq.${conv.id}&status=in.(pending,approved,scheduled)&select=id&limit=1`, { headers });
        const existing = await existingRes.json();
        if (existing.length > 0) continue;

        const meetingType = intent.primary_intent === "demo_request" ? "demo" : intent.primary_intent === "pricing_request" ? "pricing_discussion" : conv.buying_stage === "evaluating" ? "demo" : "discovery";
        const duration = meetingType === "demo" ? 45 : meetingType === "discovery" ? 30 : 30;

        // Create meeting request
        const reqRes = await fetch(`${supabaseUrl}/rest/v1/meeting_requests`, {
          method: "POST", headers: { ...headers, Prefer: "return=representation" },
          body: JSON.stringify({ workspace_id, conversation_id: conv.id, contact_id: conv.contact_id, company_id: conv.company_id, prospect_name: conv.prospect_name, prospect_title: conv.prospect_title, company_name: conv.company_name, detected_intent: intent.primary_intent, meeting_urgency: intent.urgency ?? "medium", buying_stage: conv.buying_stage, meeting_readiness_level: conv.meeting_readiness_level, recommended_meeting_type: meetingType, estimated_duration: duration, confidence_score: intent.confidence ?? 0.5, reasoning: `Detected ${intent.primary_intent} with ${Math.round((intent.meeting_likelihood ?? 0) * 100)}% meeting likelihood.`, status: "pending" }),
        });
        const reqData = await reqRes.json();
        if (reqData.length > 0) {
          detected++;
          // Generate slots
          const now = new Date();
          const slots = [];
          for (let d = 1; d <= 14 && slots.length < 5; d++) {
            const date = new Date(now.getTime() + d * 86400000);
            const dayName = date.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
            if (!["monday","tuesday","wednesday","thursday","friday"].includes(dayName)) continue;
            for (const h of [10, 13, 15]) {
              const start = new Date(date); start.setHours(h, 0, 0, 0);
              const end = new Date(start.getTime() + duration * 60000);
              slots.push({ workspace_id, meeting_request_id: reqData[0].id, start_time: start.toISOString(), end_time: end.toISOString(), slot_rank: slots.length + 1, timezone: "America/New_York", is_available: true, is_offered: true, prospect_response: "pending" });
            }
          }
          if (slots.length > 0) {
            await fetch(`${supabaseUrl}/rest/v1/meeting_slots`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(slots) });
          }
          // Create candidate
          await fetch(`${supabaseUrl}/rest/v1/meeting_candidates`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, meeting_request_id: reqData[0].id, contact_id: conv.contact_id, company_id: conv.company_id, conversation_id: conv.id, prospect_name: conv.prospect_name, company_name: conv.company_name, buying_stage: conv.buying_stage, meeting_readiness: conv.meeting_readiness_level, intent_score: 50, engagement_score: 50, overall_score: 50, recommended_meeting_type: meetingType, recommended_duration: duration, priority: intent.urgency === "critical" ? "critical" : intent.urgency === "high" ? "high" : "medium", status: "candidate" }) });
          // Create notification
          await fetch(`${supabaseUrl}/rest/v1/meeting_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, notification_type: "meeting_detected", notification_title: "Meeting Intent Detected", notification_message: `${conv.prospect_name ?? "A prospect"} is ready for a ${meetingType.replace(/_/g, " ")} meeting.`, severity: "success" }) });
        }
      }
      return new Response(JSON.stringify({ detected, total_conversations: conversations.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "schedule") {
      const { request_id } = await req.json();
      // Load best slot
      const slotsRes = await fetch(`${supabaseUrl}/rest/v1/meeting_slots?meeting_request_id=eq.${request_id}&is_available=eq.true&prospect_response=eq.pending&order=slot_rank.asc&limit=1&select=*`, { headers });
      const slots = await slotsRes.json();
      if (!slots.length) return new Response(JSON.stringify({ error: "No available slots" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const slot = slots[0];

      // Load request
      const reqRes = await fetch(`${supabaseUrl}/rest/v1/meeting_requests?id=eq.${request_id}&select=*`, { headers });
      const reqs = await reqRes.json();
      const request = reqs[0];

      // Create meeting
      const meetingRes = await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler`, {
        method: "POST", headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ workspace_id, meeting_request_id: request_id, conversation_id: request.conversation_id, contact_id: request.contact_id, company_id: request.company_id, meeting_type: request.recommended_meeting_type ?? "discovery", meeting_title: `${(request.recommended_meeting_type ?? "discovery").replace(/_/g, " ")}: ${request.prospect_name ?? "Prospect"}`, meeting_description: "AI-scheduled meeting", scheduled_start: slot.start_time, scheduled_end: slot.end_time, timezone: slot.timezone, duration_minutes: request.estimated_duration ?? 30, platform: "google_meet", status: "pending_confirmation", prospect_name: request.prospect_name, prospect_title: request.prospect_title, company_name: request.company_name }),
      });
      const meetings = await meetingRes.json();
      const meetingId = meetings[0]?.id;

      // Update slot
      await fetch(`${supabaseUrl}/rest/v1/meeting_slots?id=eq.${slot.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ is_selected: true, prospect_response: "accepted" }) });
      // Update request
      await fetch(`${supabaseUrl}/rest/v1/meeting_requests?id=eq.${request_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "scheduled" }) });
      // Update candidate
      await fetch(`${supabaseUrl}/rest/v1/meeting_candidates?meeting_request_id=eq.${request_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "scheduled" }) });
      // Create notification
      await fetch(`${supabaseUrl}/rest/v1/meeting_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, meeting_id: meetingId, notification_type: "meeting_scheduled", notification_title: "Meeting Scheduled", notification_message: `Meeting scheduled for ${new Date(slot.start_time).toLocaleString()}.`, severity: "success" }) });

      return new Response(JSON.stringify({ scheduled: true, meeting_id: meetingId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
