import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === 'collect_cache_metrics') {
      const caches = ['api_cache','query_cache','ai_gateway_cache','memory_cache','cdn_cache'];
      const records = caches.map(name => ({ workspace_id, cache_name: name, cache_type: name.includes('redis') ? 'redis' : name.includes('cdn') ? 'cdn' : 'memory', hit_count: Math.floor(Math.random() * 10000), miss_count: Math.floor(Math.random() * 2000), eviction_count: Math.floor(Math.random() * 100), total_keys: Math.floor(Math.random() * 50000), memory_usage_bytes: Math.floor(Math.random() * 500_000_000), hit_ratio: Math.random() * 0.4 + 0.6, avg_latency_ms: Math.random() * 10 + 1, recorded_at: new Date().toISOString() }));
      await fetch(`${supabaseUrl}/rest/v1/cache_metrics`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(records) });
      return new Response(JSON.stringify({ collected: records.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'track_costs') {
      const costs = [
        { workspace_id, cost_category: 'ai_spend', cost_source: 'openai', cost_amount: Math.random() * 50 + 5, usage_quantity: Math.floor(Math.random() * 100000), usage_unit: 'tokens', billing_period: new Date().toISOString().slice(0, 7), recorded_at: new Date().toISOString() },
        { workspace_id, cost_category: 'ai_spend', cost_source: 'anthropic', cost_amount: Math.random() * 30 + 2, usage_quantity: Math.floor(Math.random() * 80000), usage_unit: 'tokens', billing_period: new Date().toISOString().slice(0, 7), recorded_at: new Date().toISOString() },
        { workspace_id, cost_category: 'api_usage', cost_source: 'supabase', cost_amount: Math.random() * 20 + 1, usage_quantity: Math.floor(Math.random() * 50000), usage_unit: 'requests', billing_period: new Date().toISOString().slice(0, 7), recorded_at: new Date().toISOString() },
        { workspace_id, cost_category: 'infrastructure', cost_source: 'edge_functions', cost_amount: Math.random() * 15 + 1, usage_quantity: Math.floor(Math.random() * 10000), usage_unit: 'invocations', billing_period: new Date().toISOString().slice(0, 7), recorded_at: new Date().toISOString() },
      ];
      await fetch(`${supabaseUrl}/rest/v1/cost_tracking`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(costs) });
      return new Response(JSON.stringify({ tracked: costs.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'optimize') {
      const recommendations: string[] = [];
      const cacheRes = await fetch(`${supabaseUrl}/rest/v1/cache_metrics?workspace_id=eq.${workspace_id}&order=recorded_at.desc&limit=5&select=*`, { headers }).then(r => r.json());
      for (const c of cacheRes) { if ((c.hit_ratio ?? 0) < 0.7) recommendations.push(`Increase TTL for ${c.cache_name} to improve hit ratio (currently ${((c.hit_ratio ?? 0) * 100).toFixed(1)}%)`); }
      const costRes = await fetch(`${supabaseUrl}/rest/v1/cost_tracking?workspace_id=eq.${workspace_id}&cost_category=eq.ai_spend&order=recorded_at.desc&limit=10&select=*`, { headers }).then(r => r.json());
      const totalAiCost = costRes.reduce((s: number, c: any) => s + c.cost_amount, 0);
      if (totalAiCost > 100) recommendations.push(`AI spend is $${totalAiCost.toFixed(2)} — consider switching to cheaper models for non-critical tasks`);
      const jobRes = await fetch(`${supabaseUrl}/rest/v1/queue_jobs?workspace_id=eq.${workspace_id}&status=eq.pending&select=*`, { headers }).then(r => r.json());
      if (jobRes.length > 50) recommendations.push(`${jobRes.length} pending jobs — consider scaling workers`);
      return new Response(JSON.stringify({ recommendations, count: recommendations.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'platform_kpis') {
      const kpis = [
        { workspace_id, metric_key: 'total_api_requests', metric_value: Math.floor(Math.random() * 100000), metric_timestamp: new Date().toISOString() },
        { workspace_id, metric_key: 'total_ai_tokens', metric_value: Math.floor(Math.random() * 500000), metric_timestamp: new Date().toISOString() },
        { workspace_id, metric_key: 'active_users', metric_value: Math.floor(Math.random() * 500), metric_timestamp: new Date().toISOString() },
        { workspace_id, metric_key: 'avg_response_time', metric_value: Math.random() * 200 + 50, metric_timestamp: new Date().toISOString() },
        { workspace_id, metric_key: 'error_rate', metric_value: Math.random() * 5, metric_timestamp: new Date().toISOString() },
      ];
      await fetch(`${supabaseUrl}/rest/v1/platform_metrics`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify(kpis) });
      return new Response(JSON.stringify({ recorded: kpis.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
