import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes, propRes, meetRes, forecastRes, finRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,health_score,churn_risk_score`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/proposals?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=50&select=status,value`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/meetings?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=50&select=status`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/revenue_forecasts?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=5&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/profitability?workspace_id=eq.${workspace_id}&order=period.desc&limit=1&select=*`, { headers }),
    ]);
    const [subs, custs, props, meets, forecasts, profit] = await Promise.all([subsRes.json(), custRes.json(), propRes.json(), meetRes.json(), forecastRes.json(), finRes.json()]);
    const totalMRR = subs.reduce((s: number, x: any) => s + (x.mrr || 0), 0);
    const totalARR = subs.reduce((s: number, x: any) => s + (x.arr || 0), 0);
    const activeCustomers = custs.filter((c: any) => c.account_status === "active").length;
    const churnRiskCount = custs.filter((c: any) => c.churn_risk_score > 60).length;
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "ai_ceo_analyzer",
        system_prompt: "You are an elite AI CEO. Speak in first person. Return valid JSON.",
        user_prompt: `Analyze the entire company.\n\nMRR: ${totalMRR}\nARR: ${totalARR}\nActive Customers: ${activeCustomers}\nChurn Risk: ${churnRiskCount}\nProposals: ${props.length}\nMeetings: ${meets.length}\nProfitability: ${JSON.stringify(profit[0] || {})}\n\nReturn JSON: {"overall_company_score":72,"health_score":70,"growth_score":65,"efficiency_score":68,"risk_score":35,"opportunity_score":72,"revenue_health":72,"pipeline_health":68,"customer_health":75,"team_health":70,"financial_health":65,"market_health":70,"operational_health":68,"growth_health":65,"observations":[],"predictions":[],"ai_reasoning":"I analyzed every department.","confidence":0.78}`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    const stateRes = await fetch(`${supabaseUrl}/rest/v1/ai_ceo_state?workspace_id=eq.${workspace_id}&select=id`, { headers });
    const existingState = (await stateRes.json())[0];
    const stateData = { workspace_id, overall_company_score: result.overall_company_score ?? 70, health_score: result.health_score ?? 70, growth_score: result.growth_score ?? 65, efficiency_score: result.efficiency_score ?? 68, risk_score: result.risk_score ?? 35, opportunity_score: result.opportunity_score ?? 72, last_analysis_at: new Date().toISOString(), ai_reasoning: result.ai_reasoning ?? "" };
    if (existingState) { await fetch(`${supabaseUrl}/rest/v1/ai_ceo_state?id=eq.${existingState.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(stateData) }); }
    else { await fetch(`${supabaseUrl}/rest/v1/ai_ceo_state`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(stateData) }); }
    await fetch(`${supabaseUrl}/rest/v1/company_health`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, measurement_date: new Date().toISOString().split("T")[0], overall_score: result.overall_company_score ?? 70, revenue_health: result.revenue_health ?? 72, pipeline_health: result.pipeline_health ?? 68, customer_health: result.customer_health ?? 75, team_health: result.team_health ?? 70, financial_health: result.financial_health ?? 65, market_health: result.market_health ?? 70, operational_health: result.operational_health ?? 68, growth_health: result.growth_health ?? 65, ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.75 }) });
    return new Response(JSON.stringify({ analyzed: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
