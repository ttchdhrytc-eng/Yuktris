import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'run_cycle') {
      const settingsRes = await fetch(`${url}/rest/v1/autopilot_settings?workspace_id=eq.${workspace_id}&select=*`, { headers: h }).then(r => r.json());
      const settings = settingsRes[0];
      if (!settings || settings.autopilot_mode === 'off' || !settings.is_active) return new Response(JSON.stringify({ skipped: true, reason: 'Autopilot is off' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const execRes = await fetch(`${url}/functions/v1/execution-engine`, { method: 'POST', headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ workspace_id, action: 'start_cycle' }) }).then(r => r.json());
      const cycleId = execRes.cycle_id;
      const eventsRes = await fetch(`${url}/functions/v1/business-event-engine`, { method: 'POST', headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ workspace_id, action: 'process' }) }).then(r => r.json());
      const optRes = await fetch(`${url}/functions/v1/optimization-engine`, { method: 'POST', headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ workspace_id, action: 'identify_opportunities' }) }).then(r => r.json());
      const learnRes = await fetch(`${url}/functions/v1/learning-engine-v2`, { method: 'POST', headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ workspace_id, action: 'snapshot' }) }).then(r => r.json());
      await fetch(`${url}/functions/v1/execution-engine`, { method: 'POST', headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` }, body: JSON.stringify({ workspace_id, action: 'complete_cycle', cycle_id: cycleId }) });
      await fetch(`${url}/rest/v1/autopilot_settings?workspace_id=eq.${workspace_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ last_cycle_at: new Date().toISOString(), total_cycles: (settings?.total_cycles ?? 0) + 1 }) });
      return new Response(JSON.stringify({ cycle_id: cycleId, events_processed: eventsRes.processed, opportunities: optRes.identified, learnings: learnRes.patterns }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'update_mode') {
      const { mode, is_active } = await req.json();
      const existing = await fetch(`${url}/rest/v1/autopilot_settings?workspace_id=eq.${workspace_id}&select=*`, { headers: h }).then(r => r.json());
      if (existing[0]) {
        await fetch(`${url}/rest/v1/autopilot_settings?id=eq.${existing[0].id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ autopilot_mode: mode, is_active: is_active ?? mode !== 'off', updated_at: new Date().toISOString() }) });
      } else {
        await fetch(`${url}/rest/v1/autopilot_settings`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, autopilot_mode: mode, is_active: is_active ?? mode !== 'off' }) });
      }
      return new Response(JSON.stringify({ updated: true, mode }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
