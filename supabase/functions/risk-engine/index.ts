import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes, finRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,churn_risk_score,health_score`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/finance_alerts?workspace_id=eq.${workspace_id}&is_resolved=eq.false&select=*&limit=10`, { headers }),
    ]);
    const [subs, custs, finAlerts] = await Promise.all([subsRes.json(), custRes.json(), finRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "risk_engine_agent",
        system_prompt: "You are an elite AI CEO detecting business risks. Speak in first person. Return valid JSON.",
        user_prompt: `Detect all business risks.\n\nMRR: ${subs.reduce((s:number,x:any)=>s+(x.mrr||0),0)}\nARR: ${subs.reduce((s:number,x:any)=>s+(x.arr||0),0)}\nChurn Risk: ${custs.filter((c:any)=>c.churn_risk_score>60).length}\nFinance Alerts: ${finAlerts.length}\n\nReturn JSON: {"risks":[{"risk_title":"...","risk_description":"...","risk_category":"pipeline","risk_level":"high","probability":75,"impact":50000,"mitigation_strategy":"...","alert_type":"pipeline_shrinkage","ai_reasoning":"I found a major risk.","confidence":0.82}]}`,
        temperature: 0.3, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.risks?.length) {
      for (const risk of result.risks) {
        await fetch(`${supabaseUrl}/rest/v1/executive_risks`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, risk_title: risk.risk_title ?? "Risk", risk_description: risk.risk_description ?? "", risk_category: risk.risk_category ?? "operational", risk_level: risk.risk_level ?? "medium", probability: risk.probability ?? 50, impact: risk.impact ?? 0, mitigation_strategy: risk.mitigation_strategy ?? "", status: "active", ai_reasoning: risk.ai_reasoning ?? "", ai_confidence: risk.confidence ?? 0.8 }) });
        await fetch(`${supabaseUrl}/rest/v1/strategic_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: risk.alert_type ?? "revenue_decline", alert_title: risk.risk_title ?? "Risk Detected", alert_description: risk.risk_description ?? "", alert_severity: risk.risk_level ?? "medium", amount_impacted: risk.impact ?? 0, recommended_action: risk.mitigation_strategy ?? "", ai_reasoning: risk.ai_reasoning ?? "", ai_confidence: risk.confidence ?? 0.8 }) });
      }
    }
    return new Response(JSON.stringify({ detected: true, risks: result.risks?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
