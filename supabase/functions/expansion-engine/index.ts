import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, account_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const acctRes = await fetch(`${supabaseUrl}/rest/v1/customer_accounts?id=eq.${account_id}&select=*`, { headers });
    const account = (await acctRes.json())[0];
    if (!account || account.health_score < 60) return new Response(JSON.stringify({ skipped: true, reason: "Health score too low" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "expansion_agent",
        system_prompt: "You are an elite expansion intelligence AI. Return valid JSON.",
        user_prompt: `Detect expansion opportunities.\n\nAccount: ${JSON.stringify(account)}\n\nReturn JSON: { "overall_expansion_score": 75, "upsell_score": 80, "cross_sell_score": 65, "new_department_score": 70, "new_geography_score": 40, "enterprise_score": 60, "scoring_factors": {}, "ai_reasoning": "...", "confidence": 0.78, "opportunities": [{"expansion_type":"upsell","opportunity_name":"Premium upgrade","estimated_value":50000,"probability":65,"likelihood_to_close":60,"recommended_timing":"Q4","decision_makers":[],"supporting_reasons":[],"ai_reasoning":"Ready for premium"}] }`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    await fetch(`${supabaseUrl}/rest/v1/expansion_scores`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, score_date: new Date().toISOString().split("T")[0], overall_expansion_score: result.overall_expansion_score ?? 50, upsell_score: result.upsell_score ?? 50, cross_sell_score: result.cross_sell_score ?? 50, new_department_score: result.new_department_score ?? 50, new_geography_score: result.new_geography_score ?? 50, enterprise_score: result.enterprise_score ?? 50, scoring_factors: result.scoring_factors ?? {}, ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.7 }) });
    if (result.opportunities?.length) {
      for (const opp of result.opportunities) {
        await fetch(`${supabaseUrl}/rest/v1/expansion_opportunities`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, expansion_type: opp.expansion_type ?? "upsell", opportunity_name: opp.opportunity_name ?? "Expansion", opportunity_description: opp.opportunity_description ?? null, estimated_value: opp.estimated_value ?? 0, probability: opp.probability ?? 50, likelihood_to_close: opp.likelihood_to_close ?? 50, recommended_timing: opp.recommended_timing ?? null, decision_makers: opp.decision_makers ?? [], supporting_reasons: opp.supporting_reasons ?? [], ai_reasoning: opp.ai_reasoning ?? result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.7 }) });
      }
    }
    await fetch(`${supabaseUrl}/rest/v1/customer_accounts?id=eq.${account_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ expansion_score: result.overall_expansion_score ?? 50 }) });
    return new Response(JSON.stringify({ detected: true, score: result.overall_expansion_score, opportunities: result.opportunities?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
