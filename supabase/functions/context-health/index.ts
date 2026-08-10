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

    let profileQuery = `${SUPABASE_URL}/rest/v1/context_profiles?select=*`;
    if (workspaceId) profileQuery += `&workspace_id=eq.${workspaceId}`;
    const profilesRes = await fetch(profileQuery, { headers });
    const profiles = await profilesRes.json();

    const active = (profiles ?? []).filter((p: { status: string }) => p.status === "active").length;
    const stale = (profiles ?? []).filter((p: { status: string }) => p.status === "stale").length;

    let cacheQuery = `${SUPABASE_URL}/rest/v1/context_cache?select=id,expires_at`;
    if (workspaceId) cacheQuery += `&workspace_id=eq.${workspaceId}`;
    const cacheRes = await fetch(cacheQuery, { headers });
    const cacheData = await cacheRes.json();

    const now = Date.now();
    const expiredCache = (cacheData ?? []).filter((e: { expires_at: string }) => new Date(e.expires_at).getTime() < now).length;

    const avgTokens = (profiles ?? []).length > 0
      ? Math.round((profiles as { token_count: number }[]).reduce((s, p) => s + (p.token_count ?? 0), 0) / profiles.length)
      : 0;

    const avgDuration = (profiles ?? []).length > 0
      ? Math.round((profiles as { build_duration_ms: number | null }[]).reduce((s, p) => s + (p.build_duration_ms ?? 0), 0) / profiles.length)
      : 0;

    const avgQuality = (profiles ?? []).length > 0
      ? Math.round((profiles as { quality_score: number }[]).reduce((s, p) => s + (p.quality_score ?? 0), 0) / profiles.length * 100) / 100
      : 0;

    const avgCompression = (profiles ?? []).length > 0
      ? Math.round((profiles as { compression_ratio: number }[]).reduce((s, p) => s + (p.compression_ratio ?? 1), 0) / profiles.length * 100) / 100
      : 1.0;

    const errors: string[] = [];
    if ((profiles ?? []).length === 0) errors.push("No context profiles generated");
    if (stale > active) errors.push("More stale profiles than active");

    return new Response(JSON.stringify({
      healthy: errors.length === 0,
      total_profiles: (profiles ?? []).length,
      active_profiles: active,
      stale_profiles: stale,
      total_snapshots: 0,
      cache_entries: (cacheData ?? []).length,
      cache_hit_rate: 0,
      average_token_count: avgTokens,
      average_build_duration_ms: avgDuration,
      average_quality_score: avgQuality,
      average_compression_ratio: avgCompression,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
