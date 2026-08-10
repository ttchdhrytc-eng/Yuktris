// ============================================================
// browser-monitor — Real-time browser worker monitoring
// ============================================================
//
// Returns aggregated monitoring data: worker statuses, health
// snapshots, queue depth, error counts, and uptime stats.

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
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    if (!workspaceId) {
      return jsonError("workspace_id is required", 400);
    }

    // Fetch workers
    const { data: workers } = await supabase
      .from("browser_workers")
      .select("*")
      .eq("workspace_id", workspaceId);

    // Fetch queue stats
    const { data: queueStats } = await supabase
      .from("browser_queue")
      .select("status")
      .eq("workspace_id", workspaceId);

    // Fetch recent errors
    const { data: recentErrors } = await supabase
      .from("browser_errors")
      .select("id, error_type, error_message, resolved, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(10);

    // Fetch latest health per worker
    const { data: latestHealth } = await supabase
      .from("browser_health")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("recorded_at", { ascending: false })
      .limit(workers?.length ?? 10);

    // Aggregate
    const workerList = workers ?? [];
    const queueItems = queueStats ?? [];
    const errors = recentErrors ?? [];
    const healthSnapshots = latestHealth ?? [];

    const monitoring = {
      workers: {
        total: workerList.length,
        idle: workerList.filter((w) => w.status === "idle").length,
        busy: workerList.filter((w) => w.status === "busy").length,
        crashed: workerList.filter((w) => w.status === "crashed").length,
        launching: workerList.filter((w) => w.status === "launching").length,
        closing: workerList.filter((w) => w.status === "closing").length,
        total_actions_completed: workerList.reduce((s, w) => s + (w.actions_completed ?? 0), 0),
        total_actions_failed: workerList.reduce((s, w) => s + (w.actions_failed ?? 0), 0),
        total_uptime_seconds: workerList.reduce((s, w) => s + (w.uptime_seconds ?? 0), 0),
        total_crashes: workerList.reduce((s, w) => s + (w.crash_count ?? 0), 0),
      },
      queue: {
        total: queueItems.length,
        pending: queueItems.filter((q) => q.status === "pending").length,
        running: queueItems.filter((q) => q.status === "running").length,
        completed: queueItems.filter((q) => q.status === "completed").length,
        failed: queueItems.filter((q) => q.status === "failed").length,
        retrying: queueItems.filter((q) => q.status === "retrying").length,
        cancelled: queueItems.filter((q) => q.status === "cancelled").length,
      },
      errors: {
        total: errors.length,
        unresolved: errors.filter((e) => !e.resolved).length,
        recent: errors,
      },
      health: healthSnapshots,
      worker_details: workerList,
      timestamp: new Date().toISOString(),
    };

    return jsonResponse(monitoring);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Monitoring failed", 500);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
