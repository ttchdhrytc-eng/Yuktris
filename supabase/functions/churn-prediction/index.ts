import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, account_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [acctRes, healthRes, signalsRes, engRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?id=eq.${account_id}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_health?customer_account_id=eq.${account_id}&order=health_date.desc&limit=1&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/churn_signals?customer_account_id=eq.${account_id}&is_active=eq.true&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_engagement?customer_account_id=eq.${account_id}&order=engagement_date.desc&limit=30&select=*`, { headers }),
    ]);
    const [accounts, healthRecords, signals, engagements] = await Promise.all([acctRes.json(), healthRes.json(), signalsRes.json(), engRes.json()]);
    const account = accounts[0], health = healthRecords[0];
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "churn_prediction_agent",
        system_prompt: "You are an elite churn prediction AI. Return valid JSON.",
        user_prompt: `Predict churn.\n\nAccount: ${JSON.stringify(account)}\nHealth: ${JSON.stringify(health)}\nActive Signals: ${JSON.stringify(signals)}\nEngagement Count: ${engagements.length}\n\nReturn JSON: { "churn_probability_30d": 0.15, "churn_probability_60d": 0.22, "churn_probability_90d": 0.30, "churn_probability_annual": 0.35, "ai_reasoning": "...", "confidence": 0.78, "supporting_signals": [], "mitigation_plan": "...", "recommended_actions": [] }`,
        temperature: 0.3, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    const maxRisk = Math.max(result.churn_probability_30d ?? 0, result.churn_probability_60d ?? 0, result.churn_probability_90d ?? 0, result.churn_probability_annual ?? 0);
    const riskLevel = maxRisk > 0.7 ? "critical" : maxRisk > 0.5 ? "high" : maxRisk > 0.25 ? "medium" : "low";
    await fetch(`${supabaseUrl}/rest/v1/churn_predictions`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, prediction_date: new Date().toISOString().split("T")[0], churn_probability_30d: result.churn_probability_30d ?? 0, churn_probability_60d: result.churn_probability_60d ?? 0, churn_probability_90d: result.churn_probability_90d ?? 0, churn_probability_annual: result.churn_probability_annual ?? 0, churn_risk_level: riskLevel, ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.7, supporting_signals: result.supporting_signals ?? [], mitigation_plan: result.mitigation_plan ?? "", recommended_actions: result.recommended_actions ?? [] }) });
    return new Response(JSON.stringify({ predicted: true, risk_level: riskLevel, max_risk: maxRisk }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
