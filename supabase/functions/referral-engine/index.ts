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
    if (!account || account.health_score < 70) return new Response(JSON.stringify({ skipped: true, reason: "Health score too low for referrals" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "referral_agent",
        system_prompt: "You are an elite referral and advocacy AI. Return valid JSON.",
        user_prompt: `Identify referral opportunities and champions.\n\nAccount: ${JSON.stringify(account)}\n\nReturn JSON: { "referrals":[{"target_company":"TechCorp","target_contact":"CTO","estimated_value":80000,"probability":60,"reasoning":"Strong advocate"}], "champions":[{"name":"Jane Doe","title":"VP Ops","email":"jane@example.com","score":85,"advocacy_type":"reference","engagement_level":"very_high","reasoning":"Vocal advocate"}], "confidence":0.75 }`,
        temperature: 0.3, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.referrals?.length) {
      for (const ref of result.referrals) {
        await fetch(`${supabaseUrl}/rest/v1/referral_opportunities`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, referral_target_company: ref.target_company ?? null, referral_target_contact: ref.target_contact ?? null, referral_value: ref.estimated_value ?? 0, referral_probability: ref.probability ?? 50, ai_reasoning: ref.reasoning ?? "", ai_confidence: result.confidence ?? 0.7 }) });
      }
    }
    if (result.champions?.length) {
      for (const ch of result.champions) {
        await fetch(`${supabaseUrl}/rest/v1/customer_champions`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, customer_account_id: account_id, champion_name: ch.name ?? "", champion_title: ch.title ?? null, champion_email: ch.email ?? null, champion_score: ch.score ?? 70, advocacy_type: ch.advocacy_type ?? "reference", engagement_level: ch.engagement_level ?? "high", ai_reasoning: ch.reasoning ?? "" }) });
      }
    }
    return new Response(JSON.stringify({ generated: true, referrals: result.referrals?.length ?? 0, champions: result.champions?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
