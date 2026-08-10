import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, plan_id, action_id, session_id } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'start_cycle') {
      const cycRes = await fetch(`${url}/rest/v1/autonomous_execution_cycles`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, cycle_name: `Cycle ${new Date().toISOString()}`, cycle_status: 'running', cycle_type: 'business_evaluation', triggered_by: 'system', started_at: new Date().toISOString() }) }).then(r => r.json());
      const cycle = cycRes[0];
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, cycle_id: cycle.id, event_type: 'cycle_started', event_description: `Execution cycle started` }) });
      return new Response(JSON.stringify({ cycle_id: cycle.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'complete_cycle') {
      const { cycle_id } = await req.json();
      await fetch(`${url}/rest/v1/autonomous_execution_cycles?id=eq.${cycle_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ cycle_status: 'completed', completed_at: new Date().toISOString() }) });
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, cycle_id, event_type: 'cycle_completed', event_description: `Execution cycle completed` }) });
      return new Response(JSON.stringify({ completed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'create_plan') {
      const { plan_name, plan_type, priority, estimated_roi, estimated_revenue_impact } = await req.json();
      const planRes = await fetch(`${url}/rest/v1/execution_plans`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, plan_name, plan_type, priority: priority ?? 5, estimated_roi, estimated_revenue_impact: estimated_revenue_impact ?? 0, plan_status: 'pending_approval' }) }).then(r => r.json());
      const plan = planRes[0];
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, plan_id: plan.id, event_type: 'plan_created', event_description: `Plan created: ${plan_name}` }) });
      return new Response(JSON.stringify({ plan_id: plan.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'execute_plan') {
      await fetch(`${url}/rest/v1/execution_plans?id=eq.${plan_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ plan_status: 'executing', started_at: new Date().toISOString() }) });
      const sessRes = await fetch(`${url}/rest/v1/execution_sessions`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, plan_id, session_name: `Session for plan ${plan_id}`, session_status: 'running', agent_type: 'ai_ceo', started_at: new Date().toISOString() }) }).then(r => r.json());
      const sess = sessRes[0];
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, plan_id, session_id: sess.id, event_type: 'session_started', event_description: `Execution session started` }) });
      return new Response(JSON.stringify({ session_id: sess.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'queue_action') {
      const { action_type, action_payload, target_module, target_entity_id, requires_approval } = await req.json();
      const actRes = await fetch(`${url}/rest/v1/execution_actions`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, session_id, plan_id, action_type, action_payload: action_payload ?? {}, target_module, target_entity_id, action_status: 'queued', requires_approval: requires_approval ?? false }) }).then(r => r.json());
      const act = actRes[0];
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, plan_id, session_id, action_id: act.id, event_type: 'action_queued', event_description: `Action queued: ${action_type}` }) });
      if (requires_approval) { await fetch(`${url}/rest/v1/execution_approvals`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, plan_id, action_id: act.id, approval_type: 'action', approval_status: 'pending', requested_by: 'ai_ceo' }) }); }
      return new Response(JSON.stringify({ action_id: act.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'complete_action') {
      const { result_data } = await req.json();
      await fetch(`${url}/rest/v1/execution_actions?id=eq.${action_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ action_status: 'completed', completed_at: new Date().toISOString(), result_data: result_data ?? {} }) });
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, action_id, event_type: 'action_completed', event_description: `Action completed` }) });
      return new Response(JSON.stringify({ completed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'fail_action') {
      const { error_message, failure_type } = await req.json();
      await fetch(`${url}/rest/v1/execution_actions?id=eq.${action_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ action_status: 'failed', completed_at: new Date().toISOString(), error_message }) });
      await fetch(`${url}/rest/v1/execution_failures`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, action_id, session_id, plan_id, failure_type: failure_type ?? 'execution_error', failure_severity: 'medium', error_message }) });
      await fetch(`${url}/rest/v1/autopilot_execution_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, action_id, event_type: 'action_failed', event_description: `Action failed: ${error_message}` }) });
      return new Response(JSON.stringify({ failed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
