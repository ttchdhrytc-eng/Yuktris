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
    const agentName = url.searchParams.get("name");

    if (agentName) {
      const { data, error } = await supabase
        .from("agent_registry")
        .select("*")
        .eq("agent_name", agentName)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: `Agent not found: ${agentName}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Get dependencies
      const { data: deps } = await supabase
        .from("agent_dependencies")
        .select("depends_on_agent_id, dependency_type")
        .eq("agent_id", (data as { id: string }).id);

      const depIds = (deps ?? []) as Array<{ depends_on_agent_id: string; dependency_type: string }>;
      const depNames: Array<{ agent_name: string; dependency_type: string }> = [];

      for (const dep of depIds) {
        const { data: depAgent } = await supabase
          .from("agent_registry")
          .select("agent_name")
          .eq("id", dep.depends_on_agent_id)
          .maybeSingle();
        if (depAgent) {
          depNames.push({
            agent_name: (depAgent as { agent_name: string }).agent_name,
            dependency_type: dep.dependency_type,
          });
        }
      }

      return new Response(
        JSON.stringify({ agent: data, dependencies: depNames }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get all agents
    const { data, error } = await supabase
      .from("agent_registry")
      .select("*")
      .order("agent_name", { ascending: true });

    if (error) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch agents." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ agents: data ?? [] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch agent registry.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
