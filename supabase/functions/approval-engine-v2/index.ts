import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, approval_id, decision } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'request') {
      const { approval_type, plan_id, action_id, reason, expires_hours } = await req.json();
      const apRes = await fetch(`${url}/rest/v1/execution_approvals`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, plan_id: plan_id ?? null, action_id: action_id ?? null, approval_type, approval_status: 'pending', approval_reason: reason ?? null, requested_by: 'ai_ceo', expires_at: expires_hours ? new Date(Date.now() + expires_hours * 3600000).toISOString() : null }) }).then(r => r.json());
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, plan_id: plan_id ?? null, action_id: action_id ?? null, event_type: 'approval_requested', event_description: `Approval requested: ${approval_type}` }) });
      return new Response(JSON.stringify({ approval_id: apRes[0].id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'approve') {
      await fetch(`${url}/rest/v1/execution_approvals?id=eq.${approval_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ approval_status: 'approved', reviewed_at: new Date().toISOString() }) });
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, event_type: 'approval_granted', event_description: `Approval granted for ${approval_id}` }) });
      return new Response(JSON.stringify({ approved: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'deny') {
      await fetch(`${url}/rest/v1/execution_approvals?id=eq.${approval_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ approval_status: 'denied', reviewed_at: new Date().toISOString() }) });
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, event_type: 'approval_denied', event_description: `Approval denied for ${approval_id}` }) });
      return new Response(JSON.stringify({ denied: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'auto_approve') {
      const settingsRes = await fetch(`${url}/rest/v1/autopilot_settings?workspace_id=eq.${workspace_id}&select=*`, { headers: h }).then(r => r.json());
      const settings = settingsRes[0];
      if (!settings) return new Response(JSON.stringify({ auto_approved: false, reason: 'No settings' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const pendingRes = await fetch(`${url}/rest/v1/execution_approvals?workspace_id=eq.${workspace_id}&approval_status=eq.pending&select=*`, { headers: h }).then(r => r.json());
      let autoApproved = 0;
      for (const ap of pendingRes) {
        const confRes = await fetch(`${url}/rest/v1/execution_confidence?workspace_id=eq.${workspace_id}&entity_id=eq.${ap.action_id ?? ap.plan_id}&select=*`, { headers: h }).then(r => r.json());
        const conf = confRes[0];
        if (conf && conf.confidence_score >= settings.auto_approval_confidence_threshold && conf.risk_score <= settings.auto_approval_risk_threshold) {
          await fetch(`${url}/rest/v1/execution_approvals?id=eq.${ap.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ approval_status: 'auto_approved', reviewed_at: new Date().toISOString() }) });
          autoApproved++;
        }
      }
      return new Response(JSON.stringify({ auto_approved: autoApproved }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
