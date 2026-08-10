// linkedin-health — LinkedIn automation health monitoring
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
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");
    if (!workspaceId) return jsonError("workspace_id is required", 400);

    const { data: accounts } = await supabase.from("linkedin_accounts").select("*").eq("workspace_id", workspaceId);
    const { data: sessions } = await supabase.from("linkedin_sessions").select("*").eq("workspace_id", workspaceId).eq("status", "active");
    const { data: queueStats } = await supabase.from("browser_execution_queue").select("status").eq("workspace_id", workspaceId);
    const { data: failures } = await supabase.from("browser_execution_failures").select("id, resolved").eq("workspace_id", workspaceId).eq("resolved", false).limit(10);
    const { data: loginHistory } = await supabase.from("linkedin_login_history").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(5);

    const accountList = accounts ?? [];
    const queueItems = queueStats ?? [];

    return jsonResponse({
      accounts: {
        total: accountList.length,
        active: accountList.filter((a: Record<string, unknown>) => a.status === "active").length,
        restricted: accountList.filter((a: Record<string, unknown>) => a.status === "restricted" || a.status === "banned").length,
        connected: accountList.filter((a: Record<string, unknown>) => a.session_status === "connected").length,
      },
      sessions: { active: (sessions ?? []).length },
      queue: {
        pending: queueItems.filter((q: Record<string, unknown>) => q.status === "pending").length,
        running: queueItems.filter((q: Record<string, unknown>) => q.status === "running").length,
        completed: queueItems.filter((q: Record<string, unknown>) => q.status === "completed").length,
        failed: queueItems.filter((q: Record<string, unknown>) => q.status === "failed").length,
      },
      failures: { unresolved: (failures ?? []).length },
      recent_logins: loginHistory ?? [],
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Health check failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
