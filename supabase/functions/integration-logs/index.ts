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
    const integrationId = url.searchParams.get("integrationId");
    const workspaceId = url.searchParams.get("workspaceId");
    const event = url.searchParams.get("event");
    const status = url.searchParams.get("status");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    if (!integrationId && !workspaceId) {
      return new Response(
        JSON.stringify({ error: "Missing integrationId or workspaceId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Single integration logs
    if (integrationId) {
      let query = supabase
        .from("integration_logs")
        .select("*")
        .eq("integration_id", integrationId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (event) query = query.eq("event", event);
      if (status) query = query.eq("status", status);

      const { data, error } = await query;
      if (error) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch logs." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ logs: data ?? [] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Workspace-wide logs
    let query = supabase
      .from("integration_logs")
      .select(`
        *,
        integrations!inner(workspace_id)
      `)
      .eq("integrations.workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (event) query = query.eq("event", event);
    if (status) query = query.eq("status", status);

    const { data, error } = await query;
    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch workspace logs." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ logs: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch logs.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
