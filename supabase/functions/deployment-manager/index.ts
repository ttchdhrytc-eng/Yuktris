import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, version, environment, deployment_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === 'deploy') {
      const depRes = await fetch(`${supabaseUrl}/rest/v1/deployment_history`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, environment, deployment_status: 'in_progress', deployment_strategy: 'rolling', started_at: new Date().toISOString() }) }).then(r => r.json());
      const dep = depRes[0];
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetch(`${supabaseUrl}/rest/v1/deployment_history?id=eq.${dep.id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ deployment_status: 'succeeded', completed_at: new Date().toISOString(), duration_seconds: 1, health_check_status: 'passing' }) });
      await fetch(`${supabaseUrl}/rest/v1/system_logs`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, log_level: 'info', log_source: 'deployment-manager', log_message: `Deployment to ${environment} succeeded`, log_metadata: { deployment_id: dep.id } }) });
      return new Response(JSON.stringify({ deployed: true, deployment_id: dep.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'rollback') {
      await fetch(`${supabaseUrl}/rest/v1/deployment_history?id=eq.${deployment_id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ deployment_status: 'rolled_back', completed_at: new Date().toISOString() }) });
      await fetch(`${supabaseUrl}/rest/v1/system_logs`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, log_level: 'warn', log_source: 'deployment-manager', log_message: `Deployment ${deployment_id} rolled back`, log_metadata: { deployment_id } }) });
      return new Response(JSON.stringify({ rolled_back: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'create_version') {
      const verRes = await fetch(`${supabaseUrl}/rest/v1/release_versions`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, version_number: version, release_channel: 'stable', is_deployed: false }) }).then(r => r.json());
      return new Response(JSON.stringify({ created: true, version_id: verRes[0]?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
