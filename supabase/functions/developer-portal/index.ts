import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === "stats") {
      const [connsRes, installsRes, syncRes, errorsRes, healthRes] = await Promise.all([
        fetch(`${supabaseUrl}/rest/v1/integration_connections?workspace_id=eq.${workspace_id}&select=id,connection_status`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/integration_installs?workspace_id=eq.${workspace_id}&select=id,install_status`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/integration_sync_jobs?workspace_id=eq.${workspace_id}&select=id,status`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/integration_errors?workspace_id=eq.${workspace_id}&is_resolved=eq.false&select=id`, { headers }),
        fetch(`${supabaseUrl}/rest/v1/integration_health?workspace_id=eq.${workspace_id}&select=health_score,health_status`, { headers }),
      ]);
      const [conns, installs, syncs, errors, health] = await Promise.all([connsRes.json(), installsRes.json(), syncRes.json(), errorsRes.json(), healthRes.json()]);
      return new Response(JSON.stringify({ connections: conns.length, active_connections: conns.filter((c: any) => c.connection_status === 'connected').length, installs: installs.length, sync_jobs: syncs.length, failed_syncs: syncs.filter((s: any) => s.status === 'failed').length, unresolved_errors: errors.length, avg_health: health.length > 0 ? health.reduce((s: number, h: any) => s + h.health_score, 0) / health.length : 100 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "openapi") {
      const openapi = { openapi: "3.0.0", info: { title: "AI Revenue OS API", version: "1.0.0" }, paths: { "/api/v1/integrations": { get: { summary: "List integrations" } }, "/api/v1/integrations/connect": { post: { summary: "Connect provider" } }, "/api/v1/integrations/sync": { post: { summary: "Sync data" } }, "/api/v1/integrations/health": { get: { summary: "Health check" } }, "/api/v1/webhooks/subscribe": { post: { summary: "Subscribe webhook" } }, "/api/v1/metrics": { get: { summary: "Usage metrics" } } } };
      return new Response(JSON.stringify(openapi), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
