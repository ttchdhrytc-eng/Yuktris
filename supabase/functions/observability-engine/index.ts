import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const LOG_CATEGORIES = ['application','api','ai','workflow','agent','edge_function','database','auth','webhook','integration','security','audit','system'];
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, log_level, log_category, source_module, message, stack_trace, correlation_id, request_id, duration_ms } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === 'log') {
      await fetch(`${supabaseUrl}/rest/v1/application_logs`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, log_level: log_level ?? 'info', log_category: log_category ?? 'application', source_module: source_module ?? 'unknown', log_message: message, stack_trace: stack_trace ?? null, correlation_id: correlation_id ?? null, request_id: request_id ?? null, duration_ms: duration_ms ?? null }) });
      return new Response(JSON.stringify({ logged: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'trace') {
      const { trace_id, span_id, parent_span_id, service_name, operation_name, start_time, end_time, duration_ms: trace_duration, span_status, span_attributes } = await req.json();
      await fetch(`${supabaseUrl}/rest/v1/distributed_traces`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, trace_id, span_id, parent_span_id: parent_span_id ?? null, service_name, operation_name, start_time, end_time: end_time ?? null, duration_ms: trace_duration ?? null, span_status: span_status ?? 'ok', span_attributes: span_attributes ?? {} }) });
      return new Response(JSON.stringify({ traced: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'aggregate_errors') {
      const errorsRes = await fetch(`${supabaseUrl}/rest/v1/application_logs?workspace_id=eq.${workspace_id}&log_level=in.(error,fatal)&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&select=*`, { headers }).then(r => r.json());
      const byModule: Record<string, number> = {};
      for (const e of errorsRes) { byModule[e.source_module] = (byModule[e.source_module] ?? 0) + 1; }
      await fetch(`${supabaseUrl}/rest/v1/platform_metrics`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, metric_key: 'error_aggregation', metric_value: errorsRes.length, metric_dimensions: byModule, metric_timestamp: new Date().toISOString() }) });
      return new Response(JSON.stringify({ aggregated: true, total_errors: errorsRes.length, by_module: byModule }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'slow_queries') {
      const slowRes = await fetch(`${supabaseUrl}/rest/v1/application_logs?workspace_id=eq.${workspace_id}&log_category=eq.database&duration_ms=gte.1000&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&select=*`, { headers }).then(r => r.json());
      return new Response(JSON.stringify({ slow_queries: slowRes.length, queries: slowRes.slice(0, 20) }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
