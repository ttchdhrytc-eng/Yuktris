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
    const action = url.searchParams.get("action");
    const workspaceId = url.searchParams.get("workspace_id");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    if (action === "cleanup") {
      // Delete expired entries
      const now = new Date().toISOString();
      const res = await fetch(`${SUPABASE_URL}/rest/v1/context_cache?expires_at=lt=${now}`, {
        method: "DELETE",
        headers: { ...headers, "Prefer": "return=representation" },
      });
      const data = await res.json();
      return new Response(JSON.stringify({ cleaned: data?.length ?? 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "invalidate") {
      const entityType = url.searchParams.get("entity_type");
      const entityId = url.searchParams.get("entity_id");
      if (entityType && entityId) {
        await fetch(`${SUPABASE_URL}/rest/v1/context_cache?entity_type=eq.${entityType}&entity_id=eq.${entityId}`, { method: "DELETE", headers });
        return new Response(JSON.stringify({ invalidated: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Default: return cache stats
    let query = `${SUPABASE_URL}/rest/v1/context_cache?select=id,token_count,expires_at`;
    if (workspaceId) query += `&workspace_id=eq.${workspaceId}`;
    const res = await fetch(query, { headers });
    const data = await res.json();

    const now = Date.now();
    const expired = (data ?? []).filter((e: { expires_at: string }) => new Date(e.expires_at).getTime() < now).length;
    const avgTokens = (data ?? []).length > 0
      ? Math.round((data as { token_count: number }[]).reduce((s, e) => s + (e.token_count ?? 0), 0) / data.length)
      : 0;

    return new Response(JSON.stringify({
      total_entries: (data ?? []).length,
      expired_entries: expired,
      active_entries: (data ?? []).length - expired,
      avg_token_count: avgTokens,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
