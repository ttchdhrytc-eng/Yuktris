import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,health_score,churn_risk_score`, { headers }),
    ]);
    const [subs, custs] = await Promise.all([subsRes.json(), custRes.json()]);
    const totalMRR = subs.reduce((s: number, x: any) => s + (x.mrr || 0), 0);
    const totalARR = subs.reduce((s: number, x: any) => s + (x.arr || 0), 0);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "executive_brief_agent",
        system_prompt: "You are an elite AI CEO generating an executive briefing. Speak in first person. Return valid JSON.",
        user_prompt: `Generate today's executive brief.\n\nMRR: ${totalMRR}\nARR: ${totalARR}\nActive Customers: ${custs.filter((c:any)=>c.account_status==='active').length}\nChurn Risk: ${custs.filter((c:any)=>c.churn_risk_score>60).length}\n\nReturn JSON: {"executive_summary":"...","wins":"...","losses":"...","risks":"...","revenue_summary":"...","forecast_summary":"...","customer_health_summary":"...","finance_summary":"...","cashflow_summary":"...","hiring_summary":"...","growth_summary":"...","competition_summary":"...","strategic_priorities":"...","ai_reasoning":"I prepared today's executive briefing.","confidence":0.8}`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    await fetch(`${supabaseUrl}/rest/v1/ai_ceo_executive_briefs`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, brief_date: new Date().toISOString().split("T")[0], executive_summary: result.executive_summary ?? "", wins: result.wins ?? "", losses: result.losses ?? "", risks: result.risks ?? "", revenue_summary: result.revenue_summary ?? "", forecast_summary: result.forecast_summary ?? "", customer_health_summary: result.customer_health_summary ?? "", finance_summary: result.finance_summary ?? "", cashflow_summary: result.cashflow_summary ?? "", hiring_summary: result.hiring_summary ?? "", growth_summary: result.growth_summary ?? "", competition_summary: result.competition_summary ?? "", strategic_priorities: result.strategic_priorities ?? "", ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.78, full_brief: result }) });
    await fetch(`${supabaseUrl}/rest/v1/ai_ceo_state?workspace_id=eq.${workspace_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ last_brief_at: new Date().toISOString() }) });
    return new Response(JSON.stringify({ generated: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
