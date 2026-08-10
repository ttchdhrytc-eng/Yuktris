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

    const body = await req.json();
    const { task_description, target_agents, input, workspace_id } = body;

    // Get all active agents
    const { data: agents } = await supabase
      .from("agent_registry")
      .select("id, agent_name, status")
      .eq("status", "active")
      .order("agent_name", { ascending: true });

    const allAgents = (agents ?? []) as Array<{ id: string; agent_name: string }>;

    // Get dependencies
    const { data: deps } = await supabase
      .from("agent_dependencies")
      .select("agent_id, depends_on_agent_id, dependency_type");

    const allDeps = (deps ?? []) as Array<{
      agent_id: string;
      depends_on_agent_id: string;
      dependency_type: string;
    }>;

    // Infer agents from task description
    const desc = (task_description ?? "").toLowerCase();
    let selected = (target_agents ?? []) as string[];

    if (selected.length === 0) {
      const keywords: Record<string, string[]> = {
        website_research_agent: ["website", "crawl", "scrape"],
        company_intelligence_agent: ["company", "intelligence"],
        linkedin_intelligence_agent: ["linkedin", "employee"],
        technology_detection_agent: ["technology", "tech stack", "stack"],
        seo_analysis_agent: ["seo", "search"],
        icp_scoring_agent: ["icp", "score", "fit"],
        buying_signal_agent: ["intent", "buying signal"],
        proposal_generator_agent: ["proposal", "pitch"],
        email_writer_agent: ["email", "outreach"],
        follow_up_agent: ["follow", "sequence"],
        meeting_preparation_agent: ["meeting", "brief"],
        crm_update_agent: ["crm", "update record"],
        executive_summary_agent: ["summary", "executive"],
        workflow_decision_agent: ["workflow", "route", "decision"],
      };

      for (const [agentName, kws] of Object.entries(keywords)) {
        if (kws.some((kw) => desc.includes(kw))) {
          selected.push(agentName);
        }
      }

      if (selected.length === 0) {
        selected = ["company_intelligence_agent"];
      }
    }

    // Build plan with dependency ordering (topological sort)
    const nameToId = new Map(allAgents.map((a) => [a.agent_name, a.id]));
    const idToName = new Map(allAgents.map((a) => [a.id, a.agent_name]));

    // Build adjacency for selected agents
    const selectedIds = new Set(selected.map((n) => nameToId.get(n)).filter(Boolean) as string[]);
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const id of selectedIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const dep of allDeps) {
      if (selectedIds.has(dep.agent_id) && selectedIds.has(dep.depends_on_agent_id)) {
        if (dep.dependency_type === "requires" || dep.dependency_type === "enhances") {
          adjacency.get(dep.agent_id)?.push(dep.depends_on_agent_id);
          inDegree.set(dep.agent_id, (inDegree.get(dep.agent_id) ?? 0) + 1);
        }
      }
    }

    // Kahn's algorithm
    const queue: string[] = [];
    for (const [id, deg] of inDegree) {
      if (deg === 0) queue.push(id);
    }

    const sorted: string[] = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);
      for (const [id, deps] of adjacency) {
        if (deps.includes(current)) {
          const newDeg = (inDegree.get(id) ?? 0) - 1;
          inDegree.set(id, newDeg);
          if (newDeg === 0) queue.push(id);
        }
      }
    }

    // Build steps
    const steps: Record<string, unknown>[] = [];
    const stepByAgent = new Map<string, string>();

    for (const agentId of sorted) {
      const agentName = idToName.get(agentId)!;
      const stepId = `step-${steps.length}`;
      stepByAgent.set(agentName, stepId);

      const agentDeps = allDeps.filter(
        (d) => d.agent_id === agentId && (d.dependency_type === "requires" || d.dependency_type === "enhances"),
      );

      const depStepIds = agentDeps
        .map((d) => stepByAgent.get(idToName.get(d.depends_on_agent_id) ?? ""))
        .filter(Boolean) as string[];

      steps.push({
        step_id: stepId,
        agent_name: agentName,
        depends_on: depStepIds,
        mode: depStepIds.length > 0 ? "sequential" : "parallel",
        input: input ?? {},
        optional: false,
      });
    }

    const planId = crypto.randomUUID();

    return new Response(
      JSON.stringify({
        plan_id: planId,
        steps,
        mode: steps.length > 1 ? "sequential" : "single",
        estimated_steps: steps.length,
        estimated_tokens: steps.length * 2000,
        estimated_cost: steps.length * 0.03,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Planning failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
