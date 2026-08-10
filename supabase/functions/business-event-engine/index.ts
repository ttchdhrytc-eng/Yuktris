import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'emit') {
      const { event_type, event_source, entity_type, entity_id, severity, event_data } = await req.json();
      const evRes = await fetch(`${url}/rest/v1/business_events`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, event_type, event_source, entity_type: entity_type ?? null, entity_id: entity_id ?? null, event_severity: severity ?? 'info', event_data: event_data ?? {} }) }).then(r => r.json());
      const ev = evRes[0];
      await fetch(`${url}/rest/v1/business_event_queue`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, event_id: ev.id, queue_status: 'pending', priority: 5 }) });
      return new Response(JSON.stringify({ event_id: ev.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'process') {
      const queueRes = await fetch(`${url}/rest/v1/business_event_queue?workspace_id=eq.${workspace_id}&queue_status=eq.pending&order=priority.desc,created_at.asc&limit=10&select=*`, { headers: h }).then(r => r.json());
      let processed = 0;
      for (const q of queueRes) {
        await fetch(`${url}/rest/v1/business_event_queue?id=eq.${q.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ queue_status: 'processing' }) });
        const rulesRes = await fetch(`${url}/rest/v1/business_event_rules?workspace_id=eq.${workspace_id}&trigger_event_type=eq.${q.event_id ? 'all' : 'all'}&is_active=eq.true&select=*`, { headers: h }).then(r => r.json());
        const eventRes = await fetch(`${url}/rest/v1/business_events?id=eq.${q.event_id}&select=*`, { headers: h }).then(r => r.json());
        const event = eventRes[0];
        const matchingRules = (rulesRes as any[]).filter(r => r.trigger_event_type === event?.event_type);
        for (const rule of matchingRules) {
          await fetch(`${url}/rest/v1/business_event_actions`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, event_id: event.id, rule_id: rule.id, action_type: rule.action_type, action_payload: rule.action_config, action_status: 'pending' }) });
          await fetch(`${url}/rest/v1/business_events?id=eq.${event.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ triggered_actions: (event.triggered_actions ?? 0) + 1 }) });
        }
        await fetch(`${url}/rest/v1/business_events?id=eq.${event.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ is_processed: true, processed_at: new Date().toISOString() }) });
        await fetch(`${url}/rest/v1/business_event_queue?id=eq.${q.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ queue_status: 'completed', processed_at: new Date().toISOString() }) });
        processed++;
      }
      return new Response(JSON.stringify({ processed }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
