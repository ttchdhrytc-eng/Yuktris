import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const accountsRes = await fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&order=health_score.asc&select=*`, { headers });
    const accounts = await accountsRes.json();
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "customer_insights_agent",
        system_prompt: "You are an elite customer success intelligence AI. Speak in first person. Return valid JSON.",
        user_prompt: `Generate customer insights.\n\nAccounts: ${JSON.stringify(accounts)}\n\nReturn JSON: { "insights": [{"insight_type":"risk","insight_title":"5 customers with high churn risk","insight_text":"I identified five customers with a high churn risk.","severity":"high","confidence":0.85}] }`,
        temperature: 0.3, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.insights?.length) {
      for (const ins of result.insights) {
        await fetch(`${supabaseUrl}/rest/v1/revenue_insights`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, insight_type: ins.insight_type ?? "recommendation", insight_title: ins.insight_title ?? "Customer Insight", insight_text: ins.insight_text ?? "", insight_data: ins.insight_data ?? {}, severity: ins.severity ?? "info", confidence: ins.confidence ?? 0.7 }) });
      }
    }
    return new Response(JSON.stringify({ generated: true, insights: result.insights?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
