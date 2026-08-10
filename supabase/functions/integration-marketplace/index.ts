import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, provider_key, auth_data } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const providerRes = await fetch(`${supabaseUrl}/rest/v1/integration_providers?provider_key=eq.${provider_key}&select=*`, { headers });
    const provider = (await providerRes.json())[0];
    if (!provider) return new Response(JSON.stringify({ error: "Provider not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const connRes = await fetch(`${supabaseUrl}/rest/v1/integration_connections`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, provider_id: provider.id, connection_name: `${provider.provider_name} Connection`, connection_status: "connected", auth_type: provider.auth_type, external_account_id: auth_data.account_id ?? null, external_account_name: auth_data.account_name ?? null, external_metadata: auth_data, ai_reasoning: `I connected to ${provider.provider_name}.` }) });
    const conn = (await connRes.json())[0];
    if (auth_data.access_token) await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id: conn.id, credential_type: "oauth_access_token", encrypted_value: auth_data.access_token, expires_at: auth_data.expires_at ?? null, scopes: auth_data.scopes ?? [] }) });
    if (auth_data.api_key) await fetch(`${supabaseUrl}/rest/v1/integration_credentials`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id: conn.id, credential_type: "api_key", encrypted_value: auth_data.api_key }) });
    await fetch(`${supabaseUrl}/rest/v1/integration_health`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id: conn.id, health_score: 100, health_status: "healthy" }) });
    await fetch(`${supabaseUrl}/rest/v1/integration_installs`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, provider_id: provider.id, connection_id: conn.id, install_status: "active", config: auth_data, permissions: { scopes: auth_data.scopes ?? [] } }) });
    await fetch(`${supabaseUrl}/rest/v1/integration_events`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id: conn.id, event_type: "connected", event_name: "connected", event_description: `Connected to ${provider.provider_name}` }) });
    return new Response(JSON.stringify({ installed: true, connection_id: conn.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
