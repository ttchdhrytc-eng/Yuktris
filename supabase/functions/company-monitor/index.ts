import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    // Check for anomalies across modules
    const [subsRes, custRes, invRes, finAlertRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&select=mrr,status,created_at&order=created_at.desc&limit=10`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=health_score,churn_risk_score&order=created_at.desc&limit=10`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/invoices?workspace_id=eq.${workspace_id}&status=eq.overdue&select=amount_due&limit=10`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/finance_alerts?workspace_id=eq.${workspace_id}&is_resolved=eq.false&select=*&limit=10`, { headers }),
    ]);
    const [subs, custs, overdueInvs, finAlerts] = await Promise.all([subsRes.json(), custRes.json(), invRes.json(), finAlertRes.json()]);
    // Detect anomalies
    const anomalies: any[] = [];
    if (custs.filter((c: any) => c.churn_risk_score > 60).length > 0) anomalies.push({ anomaly_type: "churn_spike", anomaly_title: "Churn risk spike", anomaly_description: `I detected ${custs.filter((c:any)=>c.churn_risk_score>60).length} customers at high churn risk.`, severity: "high", source_module: "customer_success" });
    if (overdueInvs.length > 0) anomalies.push({ anomaly_type: "cashflow_issue", anomaly_title: "Overdue invoices detected", anomaly_description: `I detected ${overdueInvs.length} overdue invoices.`, severity: "high", source_module: "finance" });
    if (finAlerts.length > 3) anomalies.push({ anomaly_type: "execution_bottleneck", anomaly_title: "Multiple finance alerts unresolved", anomaly_description: `I detected ${finAlerts.length} unresolved finance alerts.`, severity: "medium", source_module: "finance" });
    for (const a of anomalies) {
      await fetch(`${supabaseUrl}/rest/v1/anomaly_detection`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, anomaly_type: a.anomaly_type, anomaly_title: a.anomaly_title, anomaly_description: a.anomaly_description, severity: a.severity, source_module: a.source_module, ai_reasoning: a.anomaly_description, ai_confidence: 0.8 }) });
    }
    await fetch(`${supabaseUrl}/rest/v1/ai_ceo_state?workspace_id=eq.${workspace_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ last_monitor_at: new Date().toISOString() }) });
    return new Response(JSON.stringify({ monitored: true, anomalies: anomalies.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
