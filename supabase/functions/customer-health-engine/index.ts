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
    if (!account) return new Response(JSON.stringify({ error: "Account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const engRes = await fetch(`${supabaseUrl}/rest/v1/customer_engagement?customer_account_id=eq.${account_id}&order=engagement_date.desc&limit=20&select=*`, { headers });
    const engagements = await engRes.json();
    const fbRes = await fetch(`${supabaseUrl}/rest/v1/customer_feedback?customer_account_id=eq.${account_id}&order=feedback_date.desc&limit=10&select=*`, { headers });
    const feedback = await fbRes.json();
    const now = Date.now();
    const daysSinceContact = account.last_contact_at ? Math.floor((now - new Date(account.last_contact_at).getTime()) / 86400000) : 999;
    const engagementScore = Math.min(100, Math.max(0, 100 - daysSinceContact * 3));
    const communicationScore = Math.min(100, Math.max(0, 100 - daysSinceContact * 2));
    const adoptionScore = 50;
    const relationshipScore = Math.min(100, Math.max(0, 100 - daysSinceContact * 2));
    const positiveCount = feedback.filter((f: any) => f.sentiment === "positive").length;
    const negativeCount = feedback.filter((f: any) => f.sentiment === "negative").length;
    const satisfactionScore = feedback.length > 0 ? 50 + (positiveCount - negativeCount) * 10 : 50;
    const churnProbability = Math.max(0, Math.min(100, (100 - engagementScore) * 0.3 + (100 - satisfactionScore) * 0.3 + (100 - adoptionScore) * 0.2 + (daysSinceContact > 30 ? 20 : 0)));
    const overallHealth = Math.round((engagementScore + relationshipScore + adoptionScore + communicationScore + satisfactionScore) / 5);
    await fetch(`${supabaseUrl}/rest/v1/customer_health`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, health_date: new Date().toISOString().split("T")[0], overall_health_score: overallHealth, relationship_score: relationshipScore, engagement_score: engagementScore, product_adoption_score: adoptionScore, communication_score: communicationScore, expansion_score: account.expansion_score ?? 50, renewal_probability: account.renewal_probability ?? 50, churn_probability: churnProbability, executive_relationship_score: 50, customer_satisfaction_score: satisfactionScore, health_factors: { daysSinceContact, engagementCount: engagements.length }, ai_reasoning: "Health calculated from engagement, sentiment, and adoption signals.", ai_confidence: 0.75, supporting_evidence: [], recommended_actions: [] }) });
    await fetch(`${supabaseUrl}/rest/v1/customer_accounts`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ health_score: overallHealth, churn_risk_score: Math.round(churnProbability), last_health_check: new Date().toISOString() }) });
    return new Response(JSON.stringify({ calculated: true, health_score: overallHealth, churn_probability: churnProbability }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
