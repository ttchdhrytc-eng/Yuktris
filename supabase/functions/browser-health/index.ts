// ============================================================
// browser-health — Get health metrics for browser workers
// ============================================================

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
    const workerId = url.searchParams.get("worker_id");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    let query = supabase
      .from("browser_health")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(limit);

    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    if (workerId) query = query.eq("worker_id", workerId);

    const { data, error } = await query;

    if (error) {
      return jsonError(error.message, 400);
    }

    // Aggregate stats
    const snapshots = data ?? [];
    const stats = {
      total_snapshots: snapshots.length,
      avg_cpu: snapshots.length > 0 ? snapshots.reduce((s, h) => s + (h.cpu_usage ?? 0), 0) / snapshots.length : 0,
      avg_memory: snapshots.length > 0 ? snapshots.reduce((s, h) => s + (h.memory_usage_mb ?? 0), 0) / snapshots.length : 0,
      total_network_errors: snapshots.reduce((s, h) => s + (h.network_error_count ?? 0), 0),
      total_crashes: snapshots.reduce((s, h) => s + (h.crash_count ?? 0), 0),
      responsive_count: snapshots.filter((h) => h.is_responsive).length,
    };

    return jsonResponse({ snapshots, stats });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Health check failed", 500);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
