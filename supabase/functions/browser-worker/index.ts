// ============================================================
// browser-worker — Worker management API (NOT a fake executor)
// ============================================================
//
// This edge function manages browser_workers records and provides
// worker status. It does NOT execute Playwright or fake task completion.
//
// The real Playwright worker runs as a separate Node.js service
// (workers/linkedin-browser-worker/) and registers itself in the
// browser_workers table. This endpoint provides management API.
//
// Actions:
//   GET  /browser-worker — list workers
//   POST /browser-worker { action: "status" } — worker stats
//   POST /browser-worker { action: "register", worker_name } — register a worker
//   POST /browser-worker { action: "close", worker_id } — mark worker for shutdown

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
      let q = supabase.from("browser_workers").select("*").order("created_at", { ascending: false }).limit(50);
      if (workspaceId) q = q.eq("workspace_id", workspaceId);
      const { data, error } = await q;
      if (error) return jsonError(error.message, 500);
      return jsonResponse({ workers: data ?? [] });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action as string | undefined;

    if (action === "status") {
      const { data, error } = await supabase.from("browser_workers").select("status").limit(500);
      if (error) return jsonError(error.message, 500);
      const stats: Record<string, number> = {};
      for (const w of data ?? []) {
        stats[w.status] = (stats[w.status] || 0) + 1;
      }
      const idleCount = stats.idle ?? 0;
      return jsonResponse({
        worker_stats: stats,
        idle_workers: idleCount,
        worker_available: idleCount > 0,
        message: idleCount > 0
          ? "Browser worker available."
          : "No browser worker available. Deploy the linkedin-browser-worker service to process tasks.",
      });
    }

    if (action === "register") {
      const workspaceId = body.workspace_id as string;
      const workerName = body.worker_name as string;
      if (!workspaceId || !workerName) return jsonError("Missing workspace_id or worker_name", 400);
      const { data, error } = await supabase.from("browser_workers").insert({
        workspace_id: workspaceId,
        worker_name: workerName,
        browser_type: "chromium",
        status: "idle",
        metadata: { registered_via: "edge_function" },
      }).select("id").maybeSingle();
      if (error) return jsonError(error.message, 500);
      return jsonResponse({ worker_id: data?.id, registered: true });
    }

    if (action === "close") {
      const workerId = body.worker_id as string;
      if (!workerId) return jsonError("Missing worker_id", 400);
      await supabase.from("browser_workers").update({ status: "closing", updated_at: new Date().toISOString() }).eq("id", workerId);
      await supabase.from("browser_queue").update({ status: "cancelled" }).eq("worker_id", workerId).eq("status", "pending");
      return jsonResponse({ closed: true, worker_id: workerId });
    }

    return jsonError("Unknown action. Use GET, or POST with action: 'status', 'register', or 'close'.", 400);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Worker API failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
