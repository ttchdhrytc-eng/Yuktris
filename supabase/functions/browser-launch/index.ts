// ============================================================
// browser-launch — Launch browser worker pool
// ============================================================
//
// Creates worker records in the database and signals the
// browser worker infrastructure to start Playwright instances.

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
    const { workspace_id, pool_size } = body as { workspace_id: string; pool_size?: number };

    if (!workspace_id) {
      return jsonError("workspace_id is required", 400);
    }

    const size = Math.min(Math.max(pool_size ?? 5, 1), 20);

    // Create worker records
    const workers = [];
    for (let i = 0; i < size; i++) {
      const { data, error } = await supabase
        .from("browser_workers")
        .insert({
          workspace_id,
          worker_name: `worker-${Date.now()}-${i + 1}`,
          browser_type: "chromium",
          status: "launching",
        })
        .select("id, worker_name")
        .maybeSingle();

      if (!error && data) {
        workers.push(data);

        // Log the launch
        await supabase.from("browser_logs").insert({
          workspace_id,
          worker_id: data.id,
          level: "info",
          category: "lifecycle",
          message: `Worker ${data.worker_name} created, awaiting browser launch`,
        });
      }
    }

    return jsonResponse({
      launched: workers.length,
      workers,
      pool_size: size,
      message: `${workers.length} browser workers registered. Workers will launch when the browser worker edge function processes them.`,
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Launch failed", 500);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
