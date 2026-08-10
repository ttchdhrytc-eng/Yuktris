import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, account_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [acctRes, healthRes, bookedRes, renewalsRes, expansionRes, churnRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?id=eq.${account_id}&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_health?customer_account_id=eq.${account_id}&order=health_date.desc&limit=1&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/booked_revenue?order=revenue_date.desc&limit=30&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/renewal_pipeline?customer_account_id=eq.${account_id}&limit=1&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/expansion_opportunities?customer_account_id=eq.${account_id}&limit=5&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/churn_predictions?customer_account_id=eq.${account_id}&order=prediction_date.desc&limit=1&select=*`, { headers }),
    ]);
    const [accounts, health, booked, renewals, expansion, churn] = await Promise.all([acctRes.json(), healthRes.json(), bookedRes.json(), renewalsRes.json(), expansionRes.json(), churnRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "executive_review_agent",
        system_prompt: "You are an elite executive business review generator AI. Speak in first person. Return valid JSON.",
        user_prompt: `Generate an EBR.\n\nAccount: ${JSON.stringify(accounts[0])}\nHealth: ${JSON.stringify(health[0])}\nBooked Revenue: ${JSON.stringify(booked)}\nRenewals: ${JSON.stringify(renewals)}\nExpansion: ${JSON.stringify(expansion)}\nChurn: ${JSON.stringify(churn[0])}\n\nReturn JSON: { "executive_summary":"...","key_achievements":[],"key_challenges":[],"roi_analysis":{},"value_delivered":"...","future_roadmap":[],"action_items":[],"attendees":[],"ai_reasoning":"...","confidence":0.85 }`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    await fetch(`${supabaseUrl}/rest/v1/executive_business_reviews`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, review_date: new Date().toISOString().split("T")[0], review_status: "completed", review_type: "qbr", executive_summary: result.executive_summary ?? "", key_achievements: result.key_achievements ?? [], key_challenges: result.key_challenges ?? [], roi_analysis: result.roi_analysis ?? {}, value_delivered: result.value_delivered ?? "", future_roadmap: result.future_roadmap ?? [], action_items: result.action_items ?? [], attendees: result.attendees ?? [], ai_generated: true, ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.85, next_review_date: new Date(Date.now() + 90 * 86400000).toISOString().split("T")[0] }) });
    return new Response(JSON.stringify({ generated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
