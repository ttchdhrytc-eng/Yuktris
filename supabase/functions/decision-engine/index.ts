import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'decide') {
      const { decision_type, title, reason, entity_type, entity_id, confidence, risk, expected_roi, requires_approval } = await req.json();
      const decRes = await fetch(`${url}/rest/v1/decision_engine`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, decision_type, decision_title: title, decision_reason: reason, entity_type: entity_type ?? null, entity_id: entity_id ?? null, confidence_score: confidence ?? 0.7, risk_score: risk ?? 0.3, expected_roi: expected_roi ?? null, requires_approval: requires_approval ?? false, decision_status: requires_approval ? 'pending' : 'approved' }) }).then(r => r.json());
      const dec = decRes[0];
      await fetch(`${url}/rest/v1/execution_confidence`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, entity_type: 'decision', entity_id: dec.id, confidence_score: confidence ?? 0.7, risk_score: risk ?? 0.3, expected_roi: expected_roi ?? null }) });
      return new Response(JSON.stringify({ decision_id: dec.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'add_evidence') {
      const { decision_id, evidence_type, evidence_source, evidence_description, evidence_weight, supports_decision } = await req.json();
      await fetch(`${url}/rest/v1/decision_evidence`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, decision_id, evidence_type, evidence_source, evidence_description, evidence_weight: evidence_weight ?? 0.5, supports_decision: supports_decision ?? true }) });
      return new Response(JSON.stringify({ added: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'measure_outcome') {
      const { decision_id, predicted_value, actual_value, outcome_status } = await req.json();
      const variance = predicted_value && actual_value ? Math.abs(actual_value - predicted_value) : null;
      const accuracy = predicted_value && actual_value ? Math.max(0, 1 - (variance ?? 0) / Math.max(Math.abs(predicted_value), 1)) : null;
      await fetch(`${url}/rest/v1/decision_outcomes`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, decision_id, predicted_value, actual_value, variance, accuracy_score: accuracy, outcome_status: outcome_status ?? 'pending', measured_at: new Date().toISOString() }) });
      await fetch(`${url}/rest/v1/decision_engine?id=eq.${decision_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ measured_at: new Date().toISOString(), actual_impact: { actual_value, accuracy } }) });
      return new Response(JSON.stringify({ measured: true, accuracy }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'accuracy_report') {
      const decisionsRes = await fetch(`${url}/rest/v1/decision_engine?workspace_id=eq.${workspace_id}&decision_status=eq.completed&select=*`, { headers: h }).then(r => r.json());
      const outcomesRes = await fetch(`${url}/rest/v1/decision_outcomes?workspace_id=eq.${workspace_id}&select=*`, { headers: h }).then(r => r.json());
      const total = decisionsRes.length;
      const correct = (outcomesRes as any[]).filter(o => o.outcome_status === 'positive').length;
      const accuracy = total > 0 ? (correct / total) * 100 : 0;
      await fetch(`${url}/rest/v1/decision_accuracy`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, model_version: 'v1', total_decisions: total, correct_predictions: correct, incorrect_predictions: total - correct, accuracy_percentage: accuracy, measurement_period_end: new Date().toISOString() }) });
      return new Response(JSON.stringify({ total, correct, accuracy }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
