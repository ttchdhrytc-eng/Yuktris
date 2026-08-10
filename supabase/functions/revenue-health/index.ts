import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Count profiles
    let profileQuery = `${SUPABASE_URL}/rest/v1/revenue_profiles?select=*`;
    if (workspaceId) profileQuery += `&workspace_id=eq.${workspaceId}`;
    const profilesRes = await fetch(profileQuery, { headers });
    const profiles = await profilesRes.json();

    // Count signals
    let signalQuery = `${SUPABASE_URL}/rest/v1/intelligence_signals?select=id`;
    if (workspaceId) signalQuery += `&workspace_id=eq.${workspaceId}`;
    const signalsRes = await fetch(signalQuery, { headers });
    const signals = await signalsRes.json();

    // Count recommendations
    let recQuery = `${SUPABASE_URL}/rest/v1/revenue_recommendations?select=id`;
    if (workspaceId) recQuery += `&workspace_id=eq.${workspaceId}`;
    const recsRes = await fetch(recQuery, { headers });
    const recs = await recsRes.json();

    // Count stale profiles (updated > 7 days ago)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    let staleQuery = `${SUPABASE_URL}/rest/v1/revenue_profiles?select=id&updated_at=lt.${sevenDaysAgo}`;
    if (workspaceId) staleQuery += `&workspace_id=eq.${workspaceId}`;
    const staleRes = await fetch(staleQuery, { headers });
    const stale = await staleRes.json();

    // Count low confidence profiles
    let lowConfQuery = `${SUPABASE_URL}/rest/v1/revenue_profiles?select=id&confidence_score=lt.0.4`;
    if (workspaceId) lowConfQuery += `&workspace_id=eq.${workspaceId}`;
    const lowConfRes = await fetch(lowConfQuery, { headers });
    const lowConf = await lowConfRes.json();

    const errors: string[] = [];
    if ((profiles ?? []).length === 0) errors.push("No revenue profiles generated");
    if ((stale ?? []).length > 0) errors.push(`${(stale ?? []).length} stale profiles`);

    return new Response(JSON.stringify({
      healthy: errors.length === 0,
      total_profiles: (profiles ?? []).length,
      total_signals: (signals ?? []).length,
      total_recommendations: (recs ?? []).length,
      stale_profiles: (stale ?? []).length,
      low_confidence_profiles: (lowConf ?? []).length,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
