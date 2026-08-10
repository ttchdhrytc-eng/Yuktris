import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, flag_key, flag_id, enabled, rollout_percentage, strategy } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === 'evaluate') {
      const flagsRes = await fetch(`${supabaseUrl}/rest/v1/feature_flags?workspace_id=eq.${workspace_id}&flag_key=eq.${flag_key}&is_enabled=eq.true&select=*`, { headers }).then(r => r.json());
      const flag = flagsRes[0];
      if (!flag) return new Response(JSON.stringify({ enabled: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      let result = true;
      if (flag.rollout_strategy === 'percentage') { result = Math.random() * 100 < flag.rollout_percentage; }
      return new Response(JSON.stringify({ enabled: result, flag }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'toggle') {
      await fetch(`${supabaseUrl}/rest/v1/feature_flags?id=eq.${flag_id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ is_enabled: enabled, updated_at: new Date().toISOString() }) });
      return new Response(JSON.stringify({ toggled: true, enabled }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'update_rollout') {
      await fetch(`${supabaseUrl}/rest/v1/feature_flags?id=eq.${flag_id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ rollout_percentage, rollout_strategy: strategy ?? 'percentage', updated_at: new Date().toISOString() }) });
      await fetch(`${supabaseUrl}/rest/v1/feature_rollouts`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, flag_id, rollout_status: 'in_progress', rollout_percentage, started_at: new Date().toISOString() }) });
      return new Response(JSON.stringify({ updated: true, rollout_percentage }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'kill_switch') {
      await fetch(`${supabaseUrl}/rest/v1/feature_flags?workspace_id=eq.${workspace_id}&is_kill_switch=eq.true`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ is_enabled: false, updated_at: new Date().toISOString() }) });
      return new Response(JSON.stringify({ kill_switch: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
