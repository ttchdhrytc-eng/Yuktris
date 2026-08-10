import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes, riskRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,churn_risk_score`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/executive_risks?workspace_id=eq.${workspace_id}&status=eq.active&select=*&limit=10`, { headers }),
    ]);
    const [subs, custs, risks] = await Promise.all([subsRes.json(), custRes.json(), riskRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "recommendation_engine_agent",
        system_prompt: "You are an elite AI CEO generating strategic recommendations. Speak in first person. Return valid JSON.",
        user_prompt: `Generate recommendations.\n\nMRR: ${subs.reduce((s:number,x:any)=>s+(x.mrr||0),0)}\nARR: ${subs.reduce((s:number,x:any)=>s+(x.arr||0),0)}\nChurn Risk: ${custs.filter((c:any)=>c.churn_risk_score>60).length}\nActive Risks: ${risks.length}\n\nReturn JSON: {"recommendations":[{"recommendation_title":"...","recommendation_description":"...","recommendation_type":"immediate","priority":"critical","expected_impact":"...","estimated_value":30000,"confidence":0.85,"ai_reasoning":"I recommend..."}]}`,
        temperature: 0.3, max_tokens: 3500,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.recommendations?.length) {
      for (const rec of result.recommendations) {
        await fetch(`${supabaseUrl}/rest/v1/executive_recommendations`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, recommendation_title: rec.recommendation_title ?? "Recommendation", recommendation_description: rec.recommendation_description ?? "", recommendation_type: rec.recommendation_type ?? "immediate", priority: rec.priority ?? "medium", expected_impact: rec.expected_impact ?? "", estimated_value: rec.estimated_value ?? 0, confidence: rec.confidence ?? 0.75, status: "active", ai_reasoning: rec.ai_reasoning ?? "" }) });
      }
    }
    return new Response(JSON.stringify({ generated: true, recommendations: result.recommendations?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
