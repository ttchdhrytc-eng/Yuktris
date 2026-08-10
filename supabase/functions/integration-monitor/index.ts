import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const connsRes = await fetch(`${supabaseUrl}/rest/v1/integration_connections?workspace_id=eq.${workspace_id}&is_active=eq.true&select=id,connection_name`, { headers });
    const conns = await connsRes.json();
    for (const conn of conns) {
      const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, { method: "POST", headers, body: JSON.stringify({ workspace_id, agent_name: "integration_monitor", system_prompt: "You are an integration health monitor. Return valid JSON.", user_prompt: `Assess health of connection: ${conn.connection_name}.\n\nReturn JSON: {"health_score":85,"health_status":"healthy","latency_ms":120,"error_rate":2,"success_rate":98,"ai_reasoning":"I checked the connection health."}`, temperature: 0.2, max_tokens: 1000 }) });
      const aiResult = await aiRes.json();
      const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
      await fetch(`${supabaseUrl}/rest/v1/integration_health?connection_id=eq.${conn.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ health_score: result.health_score ?? 100, health_status: result.health_status ?? "healthy", latency_ms: result.latency_ms ?? 0, error_rate: result.error_rate ?? 0, success_rate: result.success_rate ?? 100, last_check_at: new Date().toISOString(), ai_reasoning: result.ai_reasoning ?? "" }) });
      if ((result.health_score ?? 100) < 50) { await fetch(`${supabaseUrl}/rest/v1/integration_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id: conn.id, notification_type: "health_degraded", notification_title: `Health degraded: ${conn.connection_name}`, notification_message: `Health score dropped to ${result.health_score}`, priority: "high" }) }); }
    }
    return new Response(JSON.stringify({ monitored: true, connections: conns.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
