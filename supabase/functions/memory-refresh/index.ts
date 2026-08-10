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
    const { memory_id, workspace_id } = await req.json();

    if (!memory_id) {
      return new Response(JSON.stringify({ error: "memory_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Update freshness score to 1.0
    const res = await fetch(`${SUPABASE_URL}/rest/v1/memory_entities?id=eq.${memory_id}`, {
      method: "PATCH",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        freshness_score: 1.0,
      }),
    });
    const data = await res.json();

    // Record learning event
    await fetch(`${SUPABASE_URL}/rest/v1/learning_events`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        event_type: "memory_refreshed",
        triggered_by: "memory_refresh",
        learning_summary: `Memory ${memory_id} refreshed`,
        confidence: 1.0,
      }),
    });

    return new Response(JSON.stringify({
      memory_id,
      refreshed: true,
      memory: data?.[0] ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
