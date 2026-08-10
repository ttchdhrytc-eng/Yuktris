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
    const { connection_id, cursor } = await req.json();

    if (!connection_id) {
      return new Response(JSON.stringify({ error: "connection_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load connection
    const connRes = await fetch(
      `${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connection_id}&select=*`,
      { headers: restHeaders() }
    );
    const connData = await connRes.json();
    if (!connData || connData.length === 0) {
      return new Response(JSON.stringify({ error: "Connection not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const connection = connData[0];

    if (connection.status !== "connected") {
      return new Response(JSON.stringify({
        connection_id,
        provider_key: connection.provider_key,
        synced: false,
        new_messages: 0,
        updated_messages: 0,
        sync_cursor: connection.sync_cursor,
        last_sync: new Date().toISOString(),
        error: "Connection is not connected",
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Log sync started
    await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        connection_id,
        provider_id: connection.provider_id,
        workspace_id: connection.workspace_id,
        event_type: "sync_started",
        event_status: "info",
        message: "Sync started",
      }),
    });

    // Perform sync (base implementation — providers override)
    const now = new Date().toISOString();
    const newCursor = cursor ?? connection.sync_cursor ?? now;

    // Update connection
    await fetch(`${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connection_id}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify({
        last_sync_at: now,
        sync_cursor: newCursor,
      }),
    });

    // Log sync completed
    await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        connection_id,
        provider_id: connection.provider_id,
        workspace_id: connection.workspace_id,
        event_type: "sync_completed",
        event_status: "success",
        message: "Sync completed",
        metadata: { new_cursor: newCursor },
      }),
    });

    return new Response(JSON.stringify({
      connection_id,
      provider_key: connection.provider_key,
      synced: true,
      new_messages: 0,
      updated_messages: 0,
      sync_cursor: newCursor,
      last_sync: now,
      error: null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
