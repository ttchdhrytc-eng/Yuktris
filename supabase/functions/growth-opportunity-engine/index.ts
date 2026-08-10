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
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,health_score,expansion_score`, { headers }),
    ]);
    const [subs, custs] = await Promise.all([subsRes.json(), custRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "growth_engine_agent",
        system_prompt: "You are an elite AI CEO detecting growth opportunities. Speak in first person. Return valid JSON.",
        user_prompt: `Find all growth opportunities.\n\nMRR: ${subs.reduce((s:number,x:any)=>s+(x.mrr||0),0)}\nARR: ${subs.reduce((s:number,x:any)=>s+(x.arr||0),0)}\nCustomers: ${custs.length}\nAvg Expansion Score: ${custs.length>0?custs.reduce((s:number,c:any)=>s+(c.expansion_score||0),0)/custs.length:0}\n\nReturn JSON: {"opportunities":[{"opportunity_title":"...","opportunity_description":"...","opportunity_type":"upsell","estimated_value":150000,"probability":70,"time_horizon":"60d","ai_reasoning":"I found a strategic opportunity.","confidence":0.8}]}`,
        temperature: 0.3, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.opportunities?.length) {
      for (const opp of result.opportunities) {
        await fetch(`${supabaseUrl}/rest/v1/executive_opportunities`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, opportunity_title: opp.opportunity_title ?? "Opportunity", opportunity_description: opp.opportunity_description ?? "", opportunity_type: opp.opportunity_type ?? "growth", estimated_value: opp.estimated_value ?? 0, probability: opp.probability ?? 50, time_horizon: opp.time_horizon ?? "30d", status: "identified", ai_reasoning: opp.ai_reasoning ?? "", ai_confidence: opp.confidence ?? 0.75 }) });
      }
    }
    return new Response(JSON.stringify({ detected: true, opportunities: result.opportunities?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
