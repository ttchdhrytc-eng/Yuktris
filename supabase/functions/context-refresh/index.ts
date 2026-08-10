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
    const { context_type, entity_type, entity_id, workspace_id } = await req.json();

    if (!entity_type || !entity_id) {
      return new Response(JSON.stringify({ error: "entity_type and entity_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Invalidate cache
    const cacheKey = `context:${context_type ?? "company"}:${entity_type}:${entity_id}`;
    await fetch(`${SUPABASE_URL}/rest/v1/context_cache?cache_key=eq.${encodeURIComponent(cacheKey)}`, { method: "DELETE", headers });

    // Mark profile as stale
    await fetch(`${SUPABASE_URL}/rest/v1/context_profiles?entity_type=eq.${entity_type}&entity_id=eq.${entity_id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "stale" }),
    });

    // Trigger context-build
    const buildRes = await fetch(`${SUPABASE_URL}/functions/v1/context-build`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ context_type: context_type ?? "company", entity_type, entity_id, workspace_id }),
    });

    const buildData = await buildRes.json();

    return new Response(JSON.stringify({
      status: "refreshed",
      ...buildData,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
