import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [healthRes, errorsRes, syncRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/integration_health?workspace_id=eq.${workspace_id}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/integration_errors?workspace_id=eq.${workspace_id}&is_resolved=eq.false&select=*&limit=10`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/integration_sync_jobs?workspace_id=eq.${workspace_id}&status=eq.failed&order=created_at.desc&limit=10&select=*`, { headers }),
    ]);
    const [health, errors, failedSyncs] = await Promise.all([healthRes.json(), errorsRes.json(), syncRes.json()]);
    let alerts = 0;
    for (const h of health) { if (h.health_score < 50) { alerts++; await fetch(`${supabaseUrl}/rest/v1/integration_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id: h.connection_id, notification_type: "health_degraded", notification_title: "Integration health critical", notification_message: `Health score: ${h.health_score}`, priority: "critical" }) }); } }
    return new Response(JSON.stringify({ healthy: health.filter((h: any) => h.health_status === "healthy").length, degraded: health.filter((h: any) => h.health_status === "degraded").length, critical: health.filter((h: any) => h.health_status === "critical").length, unresolved_errors: errors.length, failed_syncs: failedSyncs.length, alerts }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
