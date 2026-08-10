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
    const { action } = body;

    switch (action) {
      case "execute": {
        const { agent_name, input, workspace_id, workflow_id } = body;

        // Get agent from registry
        const { data: agent, error: agentError } = await supabase
          .from("agent_registry")
          .select("*")
          .eq("agent_name", agent_name)
          .maybeSingle();

        if (agentError || !agent) {
          return new Response(
            JSON.stringify({ error: `Agent not found: ${agent_name}` }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const agentRecord = agent as { id: string; status: string };

        if (agentRecord.status !== "active") {
          return new Response(
            JSON.stringify({ error: `Agent is not active: ${agent_name}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Log execution start
        const startTime = Date.now();
        const { data: execution } = await supabase
          .from("agent_executions")
          .insert({
            workspace_id: workspace_id ?? null,
            agent_id: agentRecord.id,
            workflow_id: workflow_id ?? null,
            status: "running",
            input_payload: input ?? null,
            execution_time_ms: 0,
            tokens_used: 0,
            estimated_cost: 0,
          })
          .select("id")
          .maybeSingle();

        const executionId = (execution as { id: string } | null)?.id;

        // Agent execution is handled client-side through the orchestrator.
        // This edge function logs the execution and returns the execution ID.
        // The actual agent logic runs in the browser via the AgentOrchestrator.
        return new Response(
          JSON.stringify({
            execution_id: executionId,
            agent_name,
            status: "pending",
            message: "Execution logged. Agent logic runs client-side through the orchestrator.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "plan": {
        const { task_description, target_agents, input, workspace_id } = body;

        // Get all agents from DB to resolve dependencies
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

        // Simple planning: infer agents from task description
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

        // Build plan steps with dependency ordering
        const nameToId = new Map(allAgents.map((a) => [a.agent_name, a.id]));
        const steps: Record<string, unknown>[] = [];
        const completed: string[] = [];

        for (const agentName of selected) {
          const agentId = nameToId.get(agentName);
          if (!agentId) continue;

          const agentDeps = allDeps.filter(
            (d) => d.agent_id === agentId && (d.dependency_type === "requires" || d.dependency_type === "enhances"),
          );

          const depNames = agentDeps
            .map((d) => allAgents.find((a) => a.id === d.depends_on_agent_id)?.agent_name)
            .filter((n): n is string => !!n && selected.includes(n));

          steps.push({
            step_id: `step-${steps.length}`,
            agent_name: agentName,
            depends_on: depNames,
            mode: depNames.length > 0 ? "sequential" : "parallel",
            input: input ?? {},
            optional: false,
          });
          completed.push(agentName);
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
      }

      case "update_status": {
        const { execution_id, status, output_payload, execution_time_ms, tokens_used, estimated_cost, error_message } = body;

        const { error } = await supabase
          .from("agent_executions")
          .update({
            status,
            output_payload: output_payload ?? null,
            execution_time_ms: execution_time_ms ?? 0,
            tokens_used: tokens_used ?? 0,
            estimated_cost: estimated_cost ?? 0,
            error_message: error_message ?? null,
          })
          .eq("id", execution_id);

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Agent execution failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
