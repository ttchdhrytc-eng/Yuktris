import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    // Sync deals from proposal projects
    const proposalsRes = await fetch(`${supabaseUrl}/rest/v1/proposal_projects?workspace_id=eq.${workspace_id}&status=in.(review,approved,sent,negotiating,accepted)&select=id,workspace_id,company_id,project_name,status,priority&order=updated_at.desc&limit=50`, { headers });
    const proposals = await proposalsRes.json();
    for (const proposal of proposals) {
      const existingRes = await fetch(`${supabaseUrl}/rest/v1/pipeline_deals?proposal_project_id=eq.${proposal.id}&select=id&limit=1`, { headers });
      const existing = await existingRes.json();
      if (existing.length > 0) continue;
      const stageMap = { review: "proposal", approved: "proposal", sent: "negotiation", negotiating: "negotiation", accepted: "closed_won" };
      const stage = stageMap[proposal.status] ?? "qualification";
      await fetch(`${supabaseUrl}/rest/v1/pipeline_deals`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, company_id: proposal.company_id, proposal_project_id: proposal.id, deal_name: proposal.project_name, current_stage: stage, deal_value: 0, weighted_value: 0, probability_to_close: 50, expected_close_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0], ai_confidence: 0.7, ai_reasoning: "Auto-synced from proposal intelligence", health_score: 60, last_activity_at: new Date().toISOString(), deal_type: "new_business" }) });
    }
    // Sync from meetings
    const meetingsRes = await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?workspace_id=eq.${workspace_id}&status=eq.completed&order=updated_at.desc&limit=20&select=id,workspace_id,company_id,prospect_name,company_name,revenue_estimate`, { headers });
    const meetings = await meetingsRes.json();
    for (const meeting of meetings) {
      const outcomesRes = await fetch(`${supabaseUrl}/rest/v1/meeting_outcomes?meeting_id=eq.${meeting.id}&select=*`, { headers });
      const outcomes = await outcomesRes.json();
      if (!outcomes.length || outcomes[0].outcome !== "moved_to_opportunity") continue;
      const existingRes = await fetch(`${supabaseUrl}/rest/v1/pipeline_deals?meeting_id=eq.${meeting.id}&select=id&limit=1`, { headers });
      const existing = await existingRes.json();
      if (existing.length > 0) continue;
      const dealValue = outcomes[0].deal_value ?? meeting.revenue_estimate ?? 0;
      await fetch(`${supabaseUrl}/rest/v1/pipeline_deals`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, meeting_id: meeting.id, company_id: meeting.company_id, deal_name: `Deal: ${meeting.prospect_name ?? "Unknown"} — ${meeting.company_name ?? ""}`, company_name: meeting.company_name, current_stage: "discovery", deal_value: dealValue, weighted_value: dealValue * 0.35, probability_to_close: 35, expected_close_date: new Date(Date.now() + 60 * 86400000).toISOString().split("T")[0], ai_confidence: 0.7, ai_reasoning: "Auto-synced from meeting outcome", health_score: 60, last_activity_at: new Date().toISOString(), deal_type: "new_business" }) });
    }
    return new Response(JSON.stringify({ synced: true, proposals: proposals.length, meetings: meetings.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
