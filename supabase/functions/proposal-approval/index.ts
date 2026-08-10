import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, project_id, approval_type, approver_name, approval_status, approval_notes } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    await fetch(`${supabaseUrl}/rest/v1/proposal_approvals`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id, approval_type: approval_type ?? "internal", approver_name, approval_status: approval_status ?? "approved", approval_notes, approved_at: new Date().toISOString() }) });
    await fetch(`${supabaseUrl}/rest/v1/proposal_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id, notification_type: approval_status === "approved" ? "pricing_approved" : "revision_requested", notification_title: `Approval ${approval_status}`, notification_message: `${approver_name} ${approval_status} the proposal (${approval_type}).`, severity: approval_status === "approved" ? "success" : "warning" }) });
    return new Response(JSON.stringify({ recorded: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
