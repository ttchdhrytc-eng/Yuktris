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
    for (const deal of deals) {
      if (deal.risk_score > 60 && deal.deal_value > 50000) {
        await fetch(`${supabaseUrl}/rest/v1/revenue_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, deal_id: deal.id, alert_type: "large_deal_at_risk", alert_title: "Large Deal At Risk", alert_message: `Deal "${deal.deal_name}" worth $${deal.deal_value.toLocaleString()} has a risk score of ${deal.risk_score}.`, severity: "critical" }) });
      }
      if (deal.days_in_stage > 45) {
        await fetch(`${supabaseUrl}/rest/v1/revenue_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, deal_id: deal.id, alert_type: "pipeline_bottleneck", alert_title: "Deal Stalled", alert_message: `Deal "${deal.deal_name}" has been in ${deal.current_stage} for ${deal.days_in_stage} days.`, severity: "high" }) });
      }
    }
    const forecastsRes = await fetch(`${supabaseUrl}/rest/v1/revenue_forecasts?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=2&select=*`, { headers });
    const forecasts = await forecastsRes.json();
    if (forecasts.length >= 2) {
      const latest = forecasts[0], prev = forecasts[1];
      if (latest.expected_revenue > prev.expected_revenue * 1.05) {
        await fetch(`${supabaseUrl}/rest/v1/revenue_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: "forecast_increased", alert_title: "Forecast Increased", alert_message: `Revenue forecast increased from $${prev.expected_revenue.toLocaleString()} to $${latest.expected_revenue.toLocaleString()}.`, severity: "medium" }) });
      } else if (latest.expected_revenue < prev.expected_revenue * 0.95) {
        await fetch(`${supabaseUrl}/rest/v1/revenue_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: "forecast_decreased", alert_title: "Forecast Decreased", alert_message: `Revenue forecast decreased from $${prev.expected_revenue.toLocaleString()} to $${latest.expected_revenue.toLocaleString()}.`, severity: "high" }) });
      }
    }
    return new Response(JSON.stringify({ generated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
