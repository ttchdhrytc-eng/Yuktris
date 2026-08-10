// ============================================================
// browser-session — Manage browser sessions (save/load/delete)
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
    const { action, workspace_id } = body as { action: string; workspace_id: string };

    if (!workspace_id) {
      return jsonError("workspace_id is required", 400);
    }

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("browser_sessions")
          .select("*")
          .eq("workspace_id", workspace_id)
          .order("updated_at", { ascending: false });
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ sessions: data });
      }

      case "create": {
        const { name, session_type, cookies, storage_state, user_agent, viewport, timezone, locale } = body;
        const { data, error } = await supabase
          .from("browser_sessions")
          .insert({
            workspace_id,
            name,
            session_type: session_type ?? "standard",
            cookies: cookies ?? [],
            storage_state: storage_state ?? {},
            local_storage: {},
            session_storage: {},
            encrypted: true,
            user_agent: user_agent ?? null,
            viewport: viewport ?? null,
            timezone: timezone ?? null,
            locale: locale ?? null,
            status: "active",
            last_used_at: new Date().toISOString(),
          })
          .select("*")
          .maybeSingle();
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ session: data });
      }

      case "update": {
        const { session_id, ...updates } = body;
        const { data, error } = await supabase
          .from("browser_sessions")
          .update(updates)
          .eq("id", session_id)
          .eq("workspace_id", workspace_id)
          .select("*")
          .maybeSingle();
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ session: data });
      }

      case "delete": {
        const { session_id } = body;
        const { error } = await supabase
          .from("browser_sessions")
          .delete()
          .eq("id", session_id)
          .eq("workspace_id", workspace_id);
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ deleted: true });
      }

      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Session operation failed", 500);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
