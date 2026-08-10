import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");
    const agentId = url.searchParams.get("agent_id");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    let query = supabase
      .from("agent_executions")
      .select("*, agent_registry(agent_name, category)")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    if (agentId) query = query.eq("agent_id", agentId);

    const { data, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch execution history." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ executions: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch history.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
