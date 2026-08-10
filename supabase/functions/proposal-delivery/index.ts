import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, project_id, delivery_method, recipient_email, recipient_name } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    await fetch(`${supabaseUrl}/rest/v1/proposal_delivery`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id, delivery_method: delivery_method ?? "email", delivery_url: `/proposals/${project_id}`, recipient_email, recipient_name, sent_at: new Date().toISOString() }) });
    await fetch(`${supabaseUrl}/rest/v1/proposal_projects?id=eq.${project_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "sent" }) });
    await fetch(`${supabaseUrl}/rest/v1/proposal_status`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id, status: "sent", status_reason: "Proposal sent to prospect", changed_by: "ai" }) });
    await fetch(`${supabaseUrl}/rest/v1/proposal_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id, notification_type: "proposal_sent", notification_title: "Proposal Sent", notification_message: `Proposal sent to ${recipient_name ?? recipient_email}.`, severity: "success" }) });
    return new Response(JSON.stringify({ sent: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
