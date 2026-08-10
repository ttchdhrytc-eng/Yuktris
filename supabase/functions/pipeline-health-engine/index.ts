import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const dealsRes = await fetch(`${supabaseUrl}/rest/v1/pipeline_deals?workspace_id=eq.${workspace_id}&is_closed=eq.false&select=*`, { headers });
    const deals = await dealsRes.json();
    let stale = 0, atRisk = 0;
    const now = Date.now();
    for (const deal of deals) {
      const lastActivity = deal.last_activity_at ? Math.floor((now - new Date(deal.last_activity_at).getTime()) / 86400000) : 999;
      if (lastActivity > 14) stale++;
      if (deal.risk_score > 50 || deal.days_in_stage > 30) atRisk++;
      if (lastActivity > 14) { await fetch(`${supabaseUrl}/rest/v1/pipeline_leakage`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, deal_id: deal.id, leakage_type: "no_activity", leakage_description: `No activity for ${lastActivity} days`, risk_score: deal.risk_score, confidence: 0.8, expected_impact: "Deal may stall", recommended_action: `Follow up with ${deal.company_name ?? "prospect"}` }) }); }
      if (deal.days_in_stage > 30) { await fetch(`${supabaseUrl}/rest/v1/pipeline_leakage`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, deal_id: deal.id, leakage_type: "stalled", leakage_description: `Stuck in ${deal.current_stage} for ${deal.days_in_stage} days`, risk_score: deal.risk_score, confidence: 0.8, expected_impact: "Deal may be lost", recommended_action: "Advance or remove this deal" }) }); }
    }
    const closedRes = await fetch(`${supabaseUrl}/rest/v1/pipeline_deals?workspace_id=eq.${workspace_id}&is_closed=eq.true&select=closed_status,deal_value`, { headers });
    const closed = await closedRes.json();
    const won = closed.filter((d: any) => d.closed_status === "won").length;
    const lost = closed.filter((d: any) => d.closed_status === "lost").length;
    const total = won + lost;
    const winRate = total > 0 ? (won / total) * 100 : 0;
    const totalValue = deals.reduce((s: number, d: any) => s + d.deal_value, 0);
    const weightedValue = deals.reduce((s: number, d: any) => s + d.weighted_value, 0);
    const healthScore = Math.max(0, 100 - stale * 5 - atRisk * 3);
    await fetch(`${supabaseUrl}/rest/v1/pipeline_health`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, health_date: new Date().toISOString().split("T")[0], overall_health_score: healthScore, pipeline_coverage: totalValue, stale_deal_count: stale, at_risk_count: atRisk, win_rate: winRate, loss_rate: total > 0 ? (lost / total) * 100 : 0, avg_days_in_pipeline: deals.length > 0 ? deals.reduce((s: number, d: any) => s + d.days_in_stage, 0) / deals.length : 0 }) });
    return new Response(JSON.stringify({ calculated: true, health_score: healthScore, stale, atRisk }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
