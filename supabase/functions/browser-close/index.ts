// ============================================================
// browser-close — Close all browser workers in a workspace
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

    const body = await req.json();
    const { workspace_id, worker_id } = body as { workspace_id?: string; worker_id?: string };

    if (!workspace_id && !worker_id) {
      return jsonError("workspace_id or worker_id is required", 400);
    }

    let query = supabase.from("browser_workers").update({ status: "closing" });
    if (workspace_id) query = query.eq("workspace_id", workspace_id);
    if (worker_id) query = query.eq("id", worker_id);

    const { data, error } = await query.select("id, worker_name");

    if (error) {
      return jsonError(error.message, 400);
    }

    // Log closures
    const workers = data ?? [];
    for (const w of workers) {
      await supabase.from("browser_logs").insert({
        workspace_id: workspace_id ?? null,
        worker_id: w.id,
        level: "info",
        category: "lifecycle",
        message: `Worker ${w.worker_name} closing`,
      });
    }

    // Cancel pending queue items for these workers
    if (workspace_id) {
      await supabase
        .from("browser_queue")
        .update({ status: "cancelled", completed_at: new Date().toISOString() })
        .eq("workspace_id", workspace_id)
        .eq("status", "pending");
    }

    return jsonResponse({ closed: workers.length, workers });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Close failed", 500);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
