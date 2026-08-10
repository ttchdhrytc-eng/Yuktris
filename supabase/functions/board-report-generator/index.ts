import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes, profitRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,health_score`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/profitability?workspace_id=eq.${workspace_id}&order=period.desc&limit=1&select=*`, { headers }),
    ]);
    const [subs, custs, profit] = await Promise.all([subsRes.json(), custRes.json(), profitRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "board_report_agent",
        system_prompt: "You are an elite AI CEO generating a board report. Speak in first person. Return valid JSON.",
        user_prompt: `Generate a board report.\n\nMRR: ${subs.reduce((s:number,x:any)=>s+(x.mrr||0),0)}\nARR: ${subs.reduce((s:number,x:any)=>s+(x.arr||0),0)}\nCustomers: ${custs.length}\nProfitability: ${JSON.stringify(profit[0]||{})}\n\nReturn JSON: {"revenue_summary":"...","forecast_summary":"...","pipeline_summary":"...","profit_summary":"...","customer_summary":"...","risk_summary":"...","opportunity_summary":"...","strategic_summary":"...","ai_reasoning":"I prepared the board report.","confidence":0.8}`,
        temperature: 0.3, max_tokens: 3500,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    const periodStart = new Date(); periodStart.setMonth(periodStart.getMonth() - 3);
    await fetch(`${supabaseUrl}/rest/v1/board_reports`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, report_period: `Q${Math.ceil((periodStart.getMonth()+1)/3)} ${periodStart.getFullYear()}`, period_start: periodStart.toISOString().split("T")[0], period_end: new Date().toISOString().split("T")[0], revenue_summary: result.revenue_summary ?? "", forecast_summary: result.forecast_summary ?? "", pipeline_summary: result.pipeline_summary ?? "", profit_summary: result.profit_summary ?? "", customer_summary: result.customer_summary ?? "", risk_summary: result.risk_summary ?? "", opportunity_summary: result.opportunity_summary ?? "", strategic_summary: result.strategic_summary ?? "", ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.78, full_report: result }) });
    return new Response(JSON.stringify({ generated: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
