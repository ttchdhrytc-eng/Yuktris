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
    const agentName = url.searchParams.get("agent");

    if (agentName) {
      // Get health for a specific agent
      const { data: agent } = await supabase
        .from("agent_registry")
        .select("id, agent_name, status")
        .eq("agent_name", agentName)
        .maybeSingle();

      if (!agent) {
        return new Response(
          JSON.stringify({ error: `Agent not found: ${agentName}` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const agentRecord = agent as { id: string; agent_name: string; status: string };

      const { data: executions } = await supabase
        .from("agent_executions")
        .select("status, execution_time_ms, created_at")
        .eq("agent_id", agentRecord.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const execs = (executions ?? []) as Array<{ status: string; execution_time_ms: number; created_at: string }>;
      const total = execs.length;
      const successful = execs.filter((e) => e.status === "completed").length;
      const failed = execs.filter((e) => e.status === "failed").length;
      const avgTime = total > 0 ? Math.round(execs.reduce((s, e) => s + e.execution_time_ms, 0) / total) : 0;

      let healthStatus = "unknown";
      if (agentRecord.status === "error") {
        healthStatus = "down";
      } else if (total === 0) {
        healthStatus = "unknown";
      } else if (successful / total >= 0.9) {
        healthStatus = "healthy";
      } else if (successful / total >= 0.5) {
        healthStatus = "degraded";
      } else {
        healthStatus = "down";
      }

      return new Response(
        JSON.stringify({
          agent_name: agentName,
          healthy: healthStatus === "healthy",
          status: healthStatus,
          last_execution_at: execs[0]?.created_at ?? null,
          success_rate: total > 0 ? Math.round((successful / total) * 100) : 0,
          average_execution_time_ms: avgTime,
          total_executions: total,
          error_count: failed,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Get health for all agents
    const { data: agents } = await supabase
      .from("agent_registry")
      .select("id, agent_name, status")
      .order("agent_name", { ascending: true });

    const allAgents = (agents ?? []) as Array<{ id: string; agent_name: string; status: string }>;
    const results: Record<string, unknown>[] = [];

    for (const agent of allAgents) {
      const { data: executions } = await supabase
        .from("agent_executions")
        .select("status, execution_time_ms, created_at")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(100);

      const execs = (executions ?? []) as Array<{ status: string; execution_time_ms: number; created_at: string }>;
      const total = execs.length;
      const successful = execs.filter((e) => e.status === "completed").length;
      const failed = execs.filter((e) => e.status === "failed").length;
      const avgTime = total > 0 ? Math.round(execs.reduce((s, e) => s + e.execution_time_ms, 0) / total) : 0;

      let healthStatus = "unknown";
      if (agent.status === "error") {
        healthStatus = "down";
      } else if (total === 0) {
        healthStatus = "unknown";
      } else if (successful / total >= 0.9) {
        healthStatus = "healthy";
      } else if (successful / total >= 0.5) {
        healthStatus = "degraded";
      } else {
        healthStatus = "down";
      }

      results.push({
        agent_name: agent.agent_name,
        healthy: healthStatus === "healthy",
        status: healthStatus,
        last_execution_at: execs[0]?.created_at ?? null,
        success_rate: total > 0 ? Math.round((successful / total) * 100) : 0,
        average_execution_time_ms: avgTime,
        total_executions: total,
        error_count: failed,
      });
    }

    return new Response(
      JSON.stringify({ agents: results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
