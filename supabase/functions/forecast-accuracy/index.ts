import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const forecastsRes = await fetch(`${supabaseUrl}/rest/v1/revenue_forecasts?workspace_id=eq.${workspace_id}&order=created_at.desc&limit=5&select=*`, { headers });
    const forecasts = await forecastsRes.json();
    const bookedRes = await fetch(`${supabaseUrl}/rest/v1/booked_revenue?workspace_id=eq.${workspace_id}&order=revenue_date.desc&limit=90&select=*`, { headers });
    const booked = await bookedRes.json();
    const accuracyRecords = [];
    for (const forecast of forecasts) {
      const periodStart = forecast.period_start;
      const periodEnd = forecast.period_end;
      const actualRev = booked.filter((b: any) => b.revenue_date >= periodStart && b.revenue_date <= periodEnd).reduce((s: number, b: any) => s + b.amount, 0);
      if (actualRev > 0) {
        const variance = actualRev - forecast.expected_revenue;
        const variancePct = forecast.expected_revenue > 0 ? (variance / forecast.expected_revenue) * 100 : 0;
        const accuracy = Math.max(0, 100 - Math.abs(variancePct));
        const bias = Math.abs(variancePct) < 5 ? "accurate" : variance > 0 ? "under_forecast" : "over_forecast";
        accuracyRecords.push({ workspace_id, forecast_id: forecast.id, period_start: periodStart, period_end: periodEnd, forecasted_revenue: forecast.expected_revenue, actual_revenue: actualRev, variance, variance_percentage: variancePct, accuracy_score: accuracy, bias });
      }
    }
    if (accuracyRecords.length > 0) { await fetch(`${supabaseUrl}/rest/v1/forecast_accuracy`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(accuracyRecords) }); }
    return new Response(JSON.stringify({ calculated: true, records: accuracyRecords.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
