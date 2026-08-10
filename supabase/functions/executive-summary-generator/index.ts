import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, summary_type } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const stype = summary_type ?? "weekly";
    const [dealsRes, forecastRes, healthRes, bookedRes, mrrRes, arrRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/pipeline_deals?workspace_id=eq.${workspace_id}&is_closed=eq.false&order=deal_value.desc&limit=20&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/revenue_forecasts?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=1&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/pipeline_health?workspace_id=eq.${workspace_id}&order=health_date.desc&limit=1&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/booked_revenue?workspace_id=eq.${workspace_id}&order=revenue_date.desc&limit=30&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/monthly_recurring_revenue?workspace_id=eq.${workspace_id}&order=mrr_date.desc&limit=2&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/annual_recurring_revenue?workspace_id=eq.${workspace_id}&order=arr_date.desc&limit=2&select=*`, { headers }),
    ]);
    const [deals, forecasts, health, booked, mrr, arr] = await Promise.all([dealsRes.json(), forecastRes.json(), healthRes.json(), bookedRes.json(), mrrRes.json(), arrRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "executive_summary_agent",
        system_prompt: "You are an elite executive AI assistant. Speak in first person. Return valid JSON.",
        user_prompt: `Generate a ${stype} executive summary.\n\nData: ${JSON.stringify({ deals, forecasts, health, bookedRevenue: booked, mrr, arr })}\n\nReturn JSON: { "headline": "...", "summary_text": "...", "key_metrics": {}, "highlights": [], "risks": [], "recommendations": [], "confidence": 0.82 }`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    if (stype === "quarterly") end.setMonth(end.getMonth() + 2);
    await fetch(`${supabaseUrl}/rest/v1/executive_summaries`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, summary_type: stype, period_start: start.toISOString().split("T")[0], period_end: end.toISOString().split("T")[0], summary_text: result.summary_text ?? "", key_metrics: result.key_metrics ?? {}, highlights: result.highlights ?? [], risks: result.risks ?? [], recommendations: result.recommendations ?? [], ai_confidence: result.confidence ?? 0.8 }) });
    await fetch(`${supabaseUrl}/rest/v1/executive_briefs`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, brief_date: new Date().toISOString().split("T")[0], brief_type: stype, headline: result.headline ?? `${stype} Brief`, summary: result.summary_text ?? "", key_points: result.highlights ?? [], action_items: result.recommendations ?? [], metrics: result.key_metrics ?? {}, ai_confidence: result.confidence ?? 0.8 }) });
    return new Response(JSON.stringify({ generated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
