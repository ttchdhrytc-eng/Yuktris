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

    const results: Record<string, number> = {};

    // 1. Recover stale running jobs (started > 2 minutes ago)
    const staleCutoff = new Date(Date.now() - 120_000).toISOString();
    const { data: staleJobs } = await supabase
      .from("execution_jobs")
      .select("id")
      .eq("status", "running")
      .lt("started_at", staleCutoff);

    let staleCount = 0;
    for (const job of (staleJobs ?? []) as Array<{ id: string }>) {
      await supabase.from("execution_jobs").update({ status: "queued" }).eq("id", job.id);
      staleCount++;
    }
    results.stale_jobs_recovered = staleCount;

    // 2. Requeue retrying jobs
    const { data: retryingJobs } = await supabase
      .from("execution_jobs")
      .select("id")
      .eq("status", "retrying");

    let retryCount = 0;
    for (const job of (retryingJobs ?? []) as Array<{ id: string }>) {
      await supabase.from("execution_jobs").update({ status: "queued" }).eq("id", job.id);
      retryCount++;
    }
    results.jobs_requeued = retryCount;

    // 3. Mark stale workers as offline
    const workerCutoff = new Date(Date.now() - 60_000).toISOString();
    const { data: staleWorkers } = await supabase
      .from("worker_registry")
      .update({ status: "offline" })
      .neq("status", "offline")
      .lt("last_heartbeat", workerCutoff)
      .select("id");

    results.workers_marked_offline = staleWorkers?.length ?? 0;

    return new Response(JSON.stringify({ recovered: results }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Recovery failed.";
    return new Response(JSON.stringify({ error: message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
