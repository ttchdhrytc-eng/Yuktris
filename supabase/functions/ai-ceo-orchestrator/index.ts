import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    // Orchestrate all AI CEO functions
    const [analyzerRes, riskRes, growthRes, briefRes, recRes] = await Promise.all([
      fetch(`${supabaseUrl}/functions/v1/company-analyzer`, { method: "POST", headers, body: JSON.stringify({ workspace_id }) }),
      fetch(`${supabaseUrl}/functions/v1/risk-engine`, { method: "POST", headers, body: JSON.stringify({ workspace_id }) }),
      fetch(`${supabaseUrl}/functions/v1/growth-opportunity-engine`, { method: "POST", headers, body: JSON.stringify({ workspace_id }) }),
      fetch(`${supabaseUrl}/functions/v1/executive-brief-generator`, { method: "POST", headers, body: JSON.stringify({ workspace_id }) }),
      fetch(`${supabaseUrl}/functions/v1/recommendation-engine`, { method: "POST", headers, body: JSON.stringify({ workspace_id }) }),
    ]);
    const [analyzer, risk, growth, brief, rec] = await Promise.all([analyzerRes.json(), riskRes.json(), growthRes.json(), briefRes.json(), recRes.json()]);
    return new Response(JSON.stringify({ orchestrated: true, analyzer: analyzer.analyzed, risks: risk.detected, opportunities: growth.detected, brief: brief.generated, recommendations: rec.generated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
