// linkedin-session-manager — Manage LinkedIn browser sessions
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
    const body = await req.json();
    const { action, workspace_id, account_id, session_id } = body as Record<string, unknown>;

    if (!workspace_id) return jsonError("workspace_id is required", 400);

    switch (action) {
      case "list_sessions": {
        let q = supabase.from("linkedin_sessions").select("*").eq("workspace_id", workspace_id).order("updated_at", { ascending: false });
        if (account_id) q = q.eq("account_id", account_id);
        const { data, error } = await q;
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ sessions: data });
      }
      case "validate_session": {
        if (!session_id) return jsonError("session_id is required", 400);
        const { data: session } = await supabase.from("linkedin_sessions").select("expires_at, status").eq("id", session_id).maybeSingle();
        if (!session) return jsonError("Session not found", 404);
        const s = session as Record<string, unknown>;
        if (s.status === "expired" || s.status === "revoked") return jsonResponse({ valid: false, reason: s.status });
        if (s.expires_at && new Date(s.expires_at as string) < new Date()) {
          await supabase.from("linkedin_sessions").update({ status: "expired" }).eq("id", session_id);
          return jsonResponse({ valid: false, reason: "expired" });
        }
        await supabase.from("linkedin_sessions").update({ last_validated_at: new Date().toISOString() }).eq("id", session_id);
        return jsonResponse({ valid: true });
      }
      case "backup_session": {
        if (!session_id) return jsonError("session_id is required", 400);
        const { data: sess } = await supabase.from("linkedin_sessions").select("*").eq("id", session_id).maybeSingle();
        if (!sess) return jsonError("Session not found", 404);
        const s = sess as Record<string, unknown>;
        const { data, error } = await supabase.from("linkedin_session_backups").insert({
          workspace_id, account_id: s.account_id, session_id, backup_name: body.backup_name ?? `backup-${Date.now()}`,
          cookies_encrypted: s.cookies_encrypted, storage_state_encrypted: s.storage_state_encrypted, encrypted: true, backup_type: body.backup_type ?? "manual",
        }).select("*").maybeSingle();
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ backup: data });
      }
      case "restore_session": {
        const { backup_id } = body as Record<string, string>;
        if (!backup_id) return jsonError("backup_id is required", 400);
        const { data: backup } = await supabase.from("linkedin_session_backups").select("*").eq("id", backup_id).maybeSingle();
        if (!backup) return jsonError("Backup not found", 404);
        const b = backup as Record<string, unknown>;
        const { data, error } = await supabase.from("linkedin_sessions").insert({
          workspace_id, account_id: b.account_id, session_name: `restored-${Date.now()}`,
          cookies_encrypted: b.cookies_encrypted, storage_state_encrypted: b.storage_state_encrypted,
          encrypted: true, status: "active", last_validated_at: new Date().toISOString(), last_used_at: new Date().toISOString(),
        }).select("*").maybeSingle();
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ session: data });
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
