import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'status') {
      const cyclesRes = await fetch(`${url}/rest/v1/autonomous_execution_cycles?workspace_id=eq.${workspace_id}&cycle_status=eq.running&select=*`, { headers: h }).then(r => r.json());
      const plansRes = await fetch(`${url}/rest/v1/execution_plans?workspace_id=eq.${workspace_id}&plan_status=eq.executing&select=*`, { headers: h }).then(r => r.json());
      const sessionsRes = await fetch(`${url}/rest/v1/execution_sessions?workspace_id=eq.${workspace_id}&session_status=eq.running&select=*`, { headers: h }).then(r => r.json());
      const pendingActionsRes = await fetch(`${url}/rest/v1/execution_actions?workspace_id=eq.${workspace_id}&action_status=eq.pending&select=*`, { headers: h }).then(r => r.json());
      const failedActionsRes = await fetch(`${url}/rest/v1/execution_actions?workspace_id=eq.${workspace_id}&action_status=eq.failed&select=*`, { headers: h }).then(r => r.json());
      const pendingApprovalsRes = await fetch(`${url}/rest/v1/execution_approvals?workspace_id=eq.${workspace_id}&approval_status=eq.pending&select=*`, { headers: h }).then(r => r.json());
      const unprocessedEventsRes = await fetch(`${url}/rest/v1/business_events?workspace_id=eq.${workspace_id}&is_processed=eq.false&select=*`, { headers: h }).then(r => r.json());
      return new Response(JSON.stringify({ running_cycles: cyclesRes.length, executing_plans: plansRes.length, running_sessions: sessionsRes.length, pending_actions: pendingActionsRes.length, failed_actions: failedActionsRes.length, pending_approvals: pendingApprovalsRes.length, unprocessed_events: unprocessedEventsRes.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'retry_failed') {
      const failedRes = await fetch(`${url}/rest/v1/execution_actions?workspace_id=eq.${workspace_id}&action_status=eq.failed&select=*`, { headers: h }).then(r => r.json());
      let retried = 0;
      for (const a of failedRes) {
        if (a.attempts < a.max_attempts) {
          await fetch(`${url}/rest/v1/execution_actions?id=eq.${a.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ action_status: 'pending', error_message: null, updated_at: new Date().toISOString() }) });
          retried++;
        }
      }
      return new Response(JSON.stringify({ retried }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'escalate') {
      const failuresRes = await fetch(`${url}/rest/v1/execution_failures?workspace_id=eq.${workspace_id}&is_escalated=eq.false&resolved_at=is.null&select=*`, { headers: h }).then(r => r.json());
      let escalated = 0;
      for (const f of failuresRes) {
        if (f.failure_severity === 'critical' || f.failure_severity === 'high') {
          await fetch(`${url}/rest/v1/execution_failures?id=eq.${f.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ is_escalated: true, escalated_at: new Date().toISOString(), escalated_to: 'human' }) });
          await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, action_id: f.action_id, event_type: 'escalation_triggered', event_description: `Failure escalated: ${f.error_message}` }) });
          escalated++;
        }
      }
      return new Response(JSON.stringify({ escalated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'health') {
      const settingsRes = await fetch(`${url}/rest/v1/autopilot_settings?workspace_id=eq.${workspace_id}&select=*`, { headers: h }).then(r => r.json());
      const settings = settingsRes[0];
      const totalActions = settings?.total_actions_executed ?? 0;
      const succeeded = settings?.total_actions_succeeded ?? 0;
      const successRate = totalActions > 0 ? (succeeded / totalActions) * 100 : 0;
      return new Response(JSON.stringify({ autopilot_mode: settings?.autopilot_mode ?? 'off', is_active: settings?.is_active ?? false, total_cycles: settings?.total_cycles ?? 0, total_actions: totalActions, success_rate: successRate, total_roi: settings?.total_roi ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
