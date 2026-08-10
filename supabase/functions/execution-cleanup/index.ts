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
    const daysOld = parseInt(url.searchParams.get("days") ?? "30", 10);

    const cutoff = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

    // Delete old completed/cancelled/failed workflows (cascades to jobs and events)
    const { data: deletedWorkflows, error: wfError } = await supabase
      .from("execution_workflows")
      .delete()
      .in("status", ["completed", "cancelled", "failed"])
      .lt("created_at", cutoff)
      .select("id");

    if (wfError) {
      return new Response(JSON.stringify({ error: wfError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Delete old events not linked to any workflow
    const { data: deletedEvents } = await supabase
      .from("execution_events")
      .delete()
      .is("workflow_id", null)
      .lt("created_at", cutoff)
      .select("id");

    return new Response(
      JSON.stringify({
        workflows_deleted: deletedWorkflows?.length ?? 0,
        events_deleted: deletedEvents?.length ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Cleanup failed.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
