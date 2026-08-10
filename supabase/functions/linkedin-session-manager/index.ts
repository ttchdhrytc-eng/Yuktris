// linkedin-session-manager — Manage LinkedIn browser sessions
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, workspace_id, account_id, session_id } = body as Record<string, unknown>;

    if (!workspace_id) return jsonError("workspace_id is required", 400);
    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id);

    switch (action) {
      case "list_sessions": {
        let q = supabase.from("linkedin_session_public_view").select("*").eq("workspace_id", workspace_id).order("updated_at", { ascending: false });
        if (account_id) q = q.eq("account_id", account_id);
        const { data, error } = await q;
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ sessions: data });
      }
      case "validate_session": {
        if (!session_id) return jsonError("session_id is required", 400);
        const { data: session } = await supabase.from("linkedin_sessions").select("expires_at, status").eq("id", session_id).eq("workspace_id", workspace_id).maybeSingle();
        if (!session) return jsonError("Session not found", 404);
        const s = session as Record<string, unknown>;
        if (s.status === "expired" || s.status === "revoked") return jsonResponse({ valid: false, reason: s.status });
        if (s.expires_at && new Date(s.expires_at as string) < new Date()) {
          await supabase.from("linkedin_sessions").update({ status: "expired" }).eq("id", session_id).eq("workspace_id", workspace_id);
          return jsonResponse({ valid: false, reason: "expired" });
        }
        await supabase.from("linkedin_sessions").update({ last_validated_at: new Date().toISOString() }).eq("id", session_id).eq("workspace_id", workspace_id);
        return jsonResponse({ valid: true });
      }
      case "backup_session": {
        return jsonError("Session backup is disabled pending validated restore support", 410);
      }
      case "restore_session": {
        return jsonError("Session restore is disabled; the browser worker must validate restored state", 410);
      }
      case "list_events": {
        let q = supabase.from("linkedin_session_events").select("*").eq("workspace_id", workspace_id).order("created_at", { ascending: false }).limit(50);
        if (account_id) q = q.eq("account_id", account_id);
        const { data, error } = await q;
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ events: data });
      }
      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Session operation failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
