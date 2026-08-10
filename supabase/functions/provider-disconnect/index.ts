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
    const { connection_id } = await req.json();

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

    // Update status
    await fetch(`${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connection_id}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify({
        status: "disconnected",
        connection_health: "unknown",
        credentials: {},
        token_expires_at: null,
        connected_account: null,
        connected_account_id: null,
      }),
    });

    // Log event
    await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        connection_id,
        provider_id: connection.provider_id,
        workspace_id: connection.workspace_id,
        event_type: "disconnected",
        event_status: "success",
        message: "Connection disconnected",
      }),
    });

    return new Response(JSON.stringify({
      disconnected: true,
      connection_id,
      error: null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
