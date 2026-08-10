import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,churn_risk_score`, { headers }),
    ]);
    const [subs, custs] = await Promise.all([subsRes.json(), custRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "strategic_planner_agent",
        system_prompt: "You are an elite AI CEO creating a strategic plan. Speak in first person. Return valid JSON.",
        user_prompt: `Create a 30/60/90 day strategic plan.\n\nMRR: ${subs.reduce((s:number,x:any)=>s+(x.mrr||0),0)}\nARR: ${subs.reduce((s:number,x:any)=>s+(x.arr||0),0)}\nChurn Risk: ${custs.filter((c:any)=>c.churn_risk_score>60).length}\n\nReturn JSON: {"initiatives":[{"initiative_name":"...","initiative_description":"...","initiative_type":"growth","priority":"critical","target_end_date":"2025-12-15","expected_roi":250,"ai_reasoning":"..."}],"ai_reasoning":"I created a strategic plan.","confidence":0.78}`,
        temperature: 0.3, max_tokens: 3500,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.initiatives?.length) {
      for (const init of result.initiatives) {
        await fetch(`${supabaseUrl}/rest/v1/strategic_initiatives`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, initiative_name: init.initiative_name ?? "Initiative", initiative_description: init.initiative_description ?? "", initiative_type: init.initiative_type ?? "growth", status: "planning", priority: init.priority ?? "medium", target_end_date: init.target_end_date ?? null, expected_roi: init.expected_roi ?? 0, ai_reasoning: init.ai_reasoning ?? "" }) });
      }
    }
    return new Response(JSON.stringify({ generated: true, initiatives: result.initiatives?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
