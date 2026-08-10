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
    const { action, workflow_id, workspace_id } = body;

    switch (action) {
      case "start": {
        const { workflow_name, workflow_version, execution_plan, context } = body;

        const { data, error } = await supabase
          .from("execution_workflows")
          .insert({
            workspace_id: workspace_id ?? null,
            workflow_name,
            workflow_version: workflow_version ?? "1.0.0",
            status: "queued",
            execution_plan: execution_plan ?? null,
            context: context ?? null,
          })
          .select("id")
          .maybeSingle();

        if (error) {
          return new Response(
            JSON.stringify({ error: error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        // Log event
        await supabase.from("execution_events").insert({
          workflow_id: (data as { id: string }).id,
          event_type: "workflow_started",
          event_data: { workflow_name },
        });

        return new Response(
          JSON.stringify({ workflow_id: (data as { id: string }).id, status: "queued" }),
          { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      case "pause": {
        const { error } = await supabase
          .from("execution_workflows")
          .update({ status: "paused" })
          .eq("id", workflow_id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("execution_events").insert({ workflow_id, event_type: "workflow_paused" });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "resume": {
        const { error } = await supabase
          .from("execution_workflows")
          .update({ status: "running" })
          .eq("id", workflow_id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("execution_events").insert({ workflow_id, event_type: "workflow_resumed" });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "cancel": {
        const { error } = await supabase
          .from("execution_workflows")
          .update({ status: "cancelled", completed_at: new Date().toISOString() })
          .eq("id", workflow_id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("execution_jobs").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("workflow_id", workflow_id).in("status", ["pending", "queued", "waiting", "running", "paused"]);

        await supabase.from("execution_events").insert({ workflow_id, event_type: "workflow_cancelled" });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "retry": {
        const { error } = await supabase
          .from("execution_workflows")
          .update({ status: "running" })
          .eq("id", workflow_id);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        await supabase.from("execution_jobs").update({ status: "queued", error: null }).eq("workflow_id", workflow_id).in("status", ["failed", "dead_letter"]);

        await supabase.from("execution_events").insert({ workflow_id, event_type: "retry_triggered" });

        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Execution dispatch failed.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
