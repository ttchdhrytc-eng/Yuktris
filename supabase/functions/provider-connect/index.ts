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
    const { provider_key, workspace_id, redirect_uri, scopes } = await req.json();

    if (!provider_key || !workspace_id) {
      return new Response(JSON.stringify({ error: "provider_key and workspace_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Load provider definition
    const providerRes = await fetch(
      `${SUPABASE_URL}/rest/v1/communication_providers?provider_key=eq.${provider_key}&select=*`,
      { headers: restHeaders() }
    );
    const providerData = await providerRes.json();
    if (!providerData || providerData.length === 0) {
      return new Response(JSON.stringify({ error: `Provider not found: ${provider_key}` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const provider = providerData[0];

    // 2. Find or create connection
    const connRes = await fetch(
      `${SUPABASE_URL}/rest/v1/provider_connections?workspace_id=eq.${workspace_id}&provider_id=eq.${provider.id}&select=*`,
      { headers: restHeaders() }
    );
    const connData = await connRes.json();
    let connection = connData?.[0];

    if (!connection) {
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/provider_connections`, {
        method: "POST",
        headers: { ...restHeaders(), "Prefer": "return=representation" },
        body: JSON.stringify({
          workspace_id,
          provider_id: provider.id,
          provider_key,
          status: "connecting",
          connection_health: "unknown",
        }),
      });
      const createData = await createRes.json();
      connection = createData?.[0];
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connection.id}`, {
        method: "PATCH",
        headers: restHeaders(),
        body: JSON.stringify({ status: "connecting" }),
      });
    }

    // 3. Sync capabilities
    for (const cap of provider.capabilities ?? []) {
      await fetch(`${SUPABASE_URL}/rest/v1/provider_capabilities`, {
        method: "POST",
        headers: restHeaders(),
        body: JSON.stringify({
          provider_id: provider.id,
          capability_key: cap,
          capability_name: cap.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()),
          is_supported: true,
          is_enabled: true,
        }),
      });
    }

    // 4. Log event
    await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        connection_id: connection.id,
        provider_id: provider.id,
        workspace_id,
        event_type: "connected",
        event_status: "info",
        message: `Connection initiated for ${provider.provider_name}`,
      }),
    });

    // 5. Build response
    let authUrl: string | undefined;
    if (provider.auth_type === "oauth" && provider.auth_url) {
      const state = crypto.randomUUID();
      const scopeParam = (scopes ?? provider.default_scopes ?? []).join(" ");
      authUrl = `${provider.auth_url}?client_id=PLACEHOLDER&redirect_uri=${encodeURIComponent(redirect_uri ?? "")}&scope=${encodeURIComponent(scopeParam)}&response_type=code&state=${state}`;
    }

    // Update connection status
    await fetch(`${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connection.id}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify({
        status: authUrl ? "pending" : "connected",
        scopes: scopes ?? provider.default_scopes ?? [],
      }),
    });

    return new Response(JSON.stringify({
      connected: !authUrl,
      auth_url: authUrl,
      state: authUrl ? crypto.randomUUID() : undefined,
      connection_id: connection.id,
      provider_key,
      error: null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
