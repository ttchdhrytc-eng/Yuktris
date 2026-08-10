import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function restHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "apikey": SERVICE_ROLE_KEY,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const connectionId = url.searchParams.get("connection_id");
    const workspaceId = url.searchParams.get("workspace_id");

    if (connectionId) {
      // Single connection health check
      const startTime = Date.now();

      const connRes = await fetch(
        `${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connectionId}&select=*`,
        { headers: restHeaders() }
      );
      const connData = await connRes.json();
      if (!connData || connData.length === 0) {
        return new Response(JSON.stringify({ error: "Connection not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const connection = connData[0];
      const latency = Date.now() - startTime;

      const tokenExpired = connection.token_expires_at
        ? new Date(connection.token_expires_at) < new Date()
        : false;

      let health = "healthy";
      const errors: string[] = [];
      if (connection.status === "disconnected") { health = "unknown"; errors.push("Disconnected"); }
      else if (connection.status === "error") { health = "error"; errors.push("Error state"); }
      else if (tokenExpired) { health = "expired"; errors.push("Token expired"); }

      // Record health snapshot
      await fetch(`${SUPABASE_URL}/rest/v1/provider_health`, {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify({
          connection_id: connectionId,
          health_status: health,
          latency_ms: latency,
          is_healthy: health === "healthy",
          error_message: errors.length > 0 ? errors.join("; ") : null,
          consecutive_failures: health === "error" ? 1 : 0,
          last_checked_at: new Date().toISOString(),
        }),
      });

      // Update connection health
      await fetch(`${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connectionId}`, {
        method: "PATCH",
        headers: restHeaders(),
        body: JSON.stringify({
          connection_health: health,
          last_health_check_at: new Date().toISOString(),
        }),
      });

      // Log event
      await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify({
          connection_id: connectionId,
          provider_id: connection.provider_id,
          workspace_id: connection.workspace_id,
          event_type: "health_check",
          event_status: health === "healthy" ? "success" : "warning",
          message: `Health check: ${health}`,
        }),
      });

      return new Response(JSON.stringify({
        connection_id: connectionId,
        provider_key: connection.provider_key,
        healthy: health === "healthy",
        health,
        latency_ms: latency,
        status: connection.status,
        token_expired: tokenExpired,
        token_expires_at: connection.token_expires_at,
        last_checked_at: new Date().toISOString(),
        errors,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Workspace health summary
    if (workspaceId) {
      const connsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/provider_connections?workspace_id=eq.${workspaceId}&select=id,provider_key,status,connection_health,token_expires_at`,
        { headers: restHeaders() }
      );
      const connections = await connsRes.json();

      const summary = { total: 0, healthy: 0, degraded: 0, expired: 0, error: 0, unknown: 0 };
      const results: unknown[] = [];

      for (const conn of connections ?? []) {
        summary.total++;
        summary[conn.connection_health]++;
        const tokenExpired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : false;
        results.push({
          connection_id: conn.id,
          provider_key: conn.provider_key,
          healthy: conn.connection_health === "healthy" && !tokenExpired,
          health: conn.connection_health,
          status: conn.status,
          token_expired: tokenExpired,
        });
      }

      return new Response(JSON.stringify({ summary, connections: results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "connection_id or workspace_id is required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
