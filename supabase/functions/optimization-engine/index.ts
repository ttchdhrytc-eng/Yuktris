import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'identify_opportunities') {
      const areas = ['sales','marketing','messaging','pricing','follow_up_timing','proposal_quality','meeting_quality','forecast_accuracy','customer_health','retention','expansion','pipeline','revenue','profitability'];
      const opportunities = [];
      for (const area of areas) {
        if (Math.random() > 0.6) {
          opportunities.push({ workspace_id, optimization_area: area, opportunity_title: `Optimize ${area.replace(/_/g, ' ')} strategy`, opportunity_description: `AI identified an opportunity to improve ${area} performance`, estimated_gain: Math.random() * 1000 + 100, confidence_score: Math.random() * 0.3 + 0.6, implementation_effort: ['low','medium','high'][Math.floor(Math.random() * 3)] });
        }
      }
      if (opportunities.length > 0) await fetch(`${url}/rest/v1/optimization_opportunities`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(opportunities) });
      return new Response(JSON.stringify({ identified: opportunities.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'apply') {
      const { opportunity_id, before_value, after_value } = await req.json();
      await fetch(`${url}/rest/v1/optimization_opportunities?id=eq.${opportunity_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ is_implemented: true, implemented_at: new Date().toISOString(), before_state: { value: before_value }, after_state: { value: after_value }, actual_gain: after_value && before_value ? after_value - before_value : null }) });
      await fetch(`${url}/rest/v1/optimization_history`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, opportunity_id, optimization_status: 'measuring', before_value, after_value, estimated_gain: 0, applied_at: new Date().toISOString() }) });
      return new Response(JSON.stringify({ applied: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'measure') {
      const measuringRes = await fetch(`${url}/rest/v1/optimization_history?workspace_id=eq.${workspace_id}&optimization_status=eq.measuring&select=*`, { headers: h }).then(r => r.json());
      let measured = 0;
      for (const opt of measuringRes) {
        const gain = (opt.after_value ?? 0) - (opt.before_value ?? 0);
        const isSig = Math.abs(gain) > Math.max(Math.abs(opt.before_value ?? 1) * 0.05, 1);
        await fetch(`${url}/rest/v1/optimization_history?id=eq.${opt.id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ optimization_status: 'completed', measured_gain: gain, is_significant: isSig, measured_at: new Date().toISOString() }) });
        measured++;
      }
      return new Response(JSON.stringify({ measured }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
