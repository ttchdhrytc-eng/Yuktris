import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'track') {
      const { entity_type, entity_id, roi_type, investment, return_amount, window_days } = await req.json();
      const roiPct = investment > 0 ? ((return_amount - investment) / investment) * 100 : 0;
      await fetch(`${url}/rest/v1/roi_tracking`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, entity_type, entity_id, roi_type, investment_amount: investment, return_amount, roi_percentage: roiPct, roi_status: 'measuring', measurement_start: new Date().toISOString(), measurement_window_days: window_days ?? 30 }) });
      return new Response(JSON.stringify({ tracked: true, roi_percentage: roiPct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'measure') {
      const trackingRes = await fetch(`${url}/rest/v1/roi_tracking?workspace_id=eq.${workspace_id}&roi_status=eq.measuring&select=*`, { headers: h }).then(r => r.json());
      let measured = 0;
      for (const t of trackingRes) {
        const roiPct = t.investment_amount > 0 ? ((t.return_amount - t.investment_amount) / t.investment_amount) * 100 : 0;
        await fetch(`${url}/rest/v1/roi_tracking?id=eq.${t.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ roi_status: 'realized', roi_percentage: roiPct, measurement_end: new Date().toISOString() }) });
        measured++;
      }
      return new Response(JSON.stringify({ measured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'snapshot') {
      const allRoi = await fetch(`${url}/rest/v1/roi_tracking?workspace_id=eq.${workspace_id}&roi_status=eq.realized&select=*`, { headers: h }).then(r => r.json());
      const totalInvestment = (allRoi as any[]).reduce((s, r) => s + r.investment_amount, 0);
      const totalReturn = (allRoi as any[]).reduce((s, r) => s + r.return_amount, 0);
      const totalRoi = totalReturn - totalInvestment;
      const roiPct = totalInvestment > 0 ? (totalRoi / totalInvestment) * 100 : 0;
      const byArea: Record<string, number> = {};
      for (const r of allRoi) { byArea[r.entity_type] = (byArea[r.entity_type] ?? 0) + (r.return_amount - r.investment_amount); }
      const sorted = Object.entries(byArea).sort((a, b) => b[1] - a[1]);
      await fetch(`${url}/rest/v1/roi_snapshots`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, snapshot_period: new Date().toISOString().slice(0, 7), total_investment: totalInvestment, total_return: totalReturn, total_roi: totalRoi, total_roi_percentage: roiPct, plans_measured: (allRoi as any[]).filter(r => r.entity_type === 'plan').length, actions_measured: (allRoi as any[]).filter(r => r.entity_type === 'action').length, optimizations_measured: (allRoi as any[]).filter(r => r.entity_type === 'optimization').length, top_performing_area: sorted[0]?.[0] ?? null, worst_performing_area: sorted[sorted.length - 1]?.[0] ?? null, roi_by_area: byArea }) });
      return new Response(JSON.stringify({ total_roi: totalRoi, roi_percentage: roiPct }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
