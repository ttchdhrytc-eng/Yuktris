// ============================================================
// linkedin-queue — Queue orchestration API (NOT a fake worker)
// ============================================================
//
// This edge function is an API layer for the browser execution queue.
// It does NOT execute Playwright or fake task completion.
//
// The real Playwright worker runs as a separate Node.js service
// (workers/linkedin-browser-worker/) and polls browser_execution_queue
// directly. This endpoint provides queue status and management.
//
// Actions:
//   GET  /linkedin-queue — list queue items (optionally filtered)
//   POST /linkedin-queue { action: "status" } — return queue stats
//   POST /linkedin-queue { action: "cancel", item_id } — cancel a task

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (req.method === "GET") {
      const url = new URL(req.url);
      const workspaceId = url.searchParams.get("workspace_id");
      const status = url.searchParams.get("status") || "pending";

      let q = supabase.from("browser_execution_queue").select("*").eq("status", status).order("created_at", { ascending: false }).limit(50);
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data, error } = await q;
      if (error) return jsonError(error.message, 500);
      return jsonResponse({ items: data ?? [] });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === "status") {
      const workspaceId = body.workspace_id as string | undefined;
      let q = supabase.from("browser_execution_queue").select("status, action_type").limit(500);
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data, error } = await q;
      if (error) return jsonError(error.message, 500);

      const stats: Record<string, number> = {};
      for (const item of data ?? []) {
        stats[item.status] = (stats[item.status] || 0) + 1;
      }

      // Check worker availability
      const { data: workers } = await supabase.from("browser_workers").select("status").eq("status", "idle").limit(10);
      const workerCount = workers?.length ?? 0;

      return jsonResponse({
        queue_stats: stats,
        idle_workers: workerCount,
        worker_available: workerCount > 0,
        message: workerCount > 0 ? "Worker available — tasks will be processed." : "No worker available — tasks remain pending until a worker comes online.",
      });
    }

    if (action === "cancel") {
      const itemId = body.item_id as string;
      if (!itemId) return jsonError("Missing item_id", 400);
      const { error } = await supabase.from("browser_execution_queue").update({ status: "cancelled", completed_at: new Date().toISOString() }).eq("id", itemId).in("status", ["pending", "retry"]);
      if (error) return jsonError(error.message, 500);
      return jsonResponse({ cancelled: true, item_id: itemId });
    }

    return jsonError("Unknown action. Use GET, or POST with action: 'status' or 'cancel'.", 400);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Queue API failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
