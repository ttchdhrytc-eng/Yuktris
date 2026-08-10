import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, incident_id, title, description, severity, type, affected_components, status, root_cause, event_type, event_message } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === 'create') {
      const incRes = await fetch(`${supabaseUrl}/rest/v1/system_incidents`, { method: 'POST', headers: { ...headers, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, incident_title: title, incident_description: description ?? null, incident_severity: severity ?? 'minor', incident_status: 'investigating', incident_type: type ?? 'outage', affected_components: affected_components ?? [] }) }).then(r => r.json());
      const inc = incRes[0];
      await fetch(`${supabaseUrl}/rest/v1/incident_timelines`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, incident_id: inc.id, event_type: 'created', event_message: `Incident created: ${title}` }) });
      return new Response(JSON.stringify({ created: true, incident_id: inc.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'update_status') {
      const update: Record<string, unknown> = { incident_status: status, updated_at: new Date().toISOString() };
      if (status === 'resolved') update.resolved_at = new Date().toISOString();
      if (root_cause) update.root_cause = root_cause;
      await fetch(`${supabaseUrl}/rest/v1/system_incidents?id=eq.${incident_id}`, { method: 'PATCH', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(update) });
      await fetch(`${supabaseUrl}/rest/v1/incident_timelines`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, incident_id, event_type: event_type ?? 'update', event_message: event_message ?? `Status updated to ${status}` }) });
      return new Response(JSON.stringify({ updated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'add_timeline') {
      await fetch(`${supabaseUrl}/rest/v1/incident_timelines`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, incident_id, event_type: event_type ?? 'update', event_message }) });
      return new Response(JSON.stringify({ added: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'list_active') {
      const active = await fetch(`${supabaseUrl}/rest/v1/system_incidents?workspace_id=eq.${workspace_id}&incident_status=not.in.(resolved,closed)&order=created_at.desc&select=*`, { headers }).then(r => r.json());
      return new Response(JSON.stringify({ incidents: active }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
