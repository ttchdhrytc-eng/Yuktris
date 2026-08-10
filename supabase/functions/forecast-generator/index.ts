import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, forecast_type } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const ftype = forecast_type ?? "quarterly";
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (ftype === "quarterly") end = new Date(now.getFullYear(), now.getMonth() + 3, 0);
    if (ftype === "annual") end = new Date(now.getFullYear() + 1, now.getMonth(), 0);
    const dealsRes = await fetch(`${supabaseUrl}/rest/v1/pipeline_deals?workspace_id=eq.${workspace_id}&is_closed=eq.false&select=*`, { headers });
    const deals = await dealsRes.json();
    const bookedRes = await fetch(`${supabaseUrl}/rest/v1/booked_revenue?workspace_id=eq.${workspace_id}&order=revenue_date.desc&limit=30&select=*`, { headers });
    const booked = await bookedRes.json();
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "revenue_forecast_agent",
        system_prompt: "You are an elite revenue forecasting AI. Return valid JSON.",
        user_prompt: `Generate a ${ftype} revenue forecast.\n\nPipeline: ${JSON.stringify(deals)}\nBooked Revenue: ${JSON.stringify(booked)}\n\nReturn JSON: { "expected_revenue": 250000, "weighted_revenue": 180000, "best_case_revenue": 350000, "worst_case_revenue": 120000, "committed_revenue": 150000, "pipeline_revenue": 500000, "confidence": 0.75, "ai_reasoning": "...", "supporting_signals": [] }`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    await fetch(`${supabaseUrl}/rest/v1/revenue_forecasts`, {
      method: "POST", headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify({ workspace_id, forecast_type: ftype, period_start: start.toISOString().split("T")[0], period_end: end.toISOString().split("T")[0], expected_revenue: result.expected_revenue ?? 0, weighted_revenue: result.weighted_revenue ?? 0, best_case_revenue: result.best_case_revenue ?? 0, worst_case_revenue: result.worst_case_revenue ?? 0, committed_revenue: result.committed_revenue ?? 0, pipeline_revenue: result.pipeline_revenue ?? 0, forecast_confidence: result.confidence ?? 0.7, deal_count: deals.length, ai_reasoning: result.ai_reasoning ?? "", supporting_signals: result.supporting_signals ?? [] }),
    });
    await fetch(`${supabaseUrl}/rest/v1/forecast_history`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, snapshot_date: new Date().toISOString().split("T")[0], forecast_type: ftype, expected_revenue: result.expected_revenue ?? 0, weighted_revenue: result.weighted_revenue ?? 0, confidence: result.confidence ?? 0.7 }) });
    return new Response(JSON.stringify({ generated: true, expected_revenue: result.expected_revenue }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
