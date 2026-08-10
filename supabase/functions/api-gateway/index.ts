import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, params } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === "list") {
      const res = await fetch(`${supabaseUrl}/rest/v1/integration_api_keys_v2?workspace_id=eq.${workspace_id}&is_active=eq.true&select=id,key_name,key_prefix,key_type,scopes,created_at,last_used_at`, { headers });
      const keys = await res.json();
      return new Response(JSON.stringify({ keys }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "create") {
      const rawKey = `ei_${crypto.randomUUID().replace(/-/g, "")}${Date.now().toString(36)}`;
      const keyPrefix = rawKey.slice(0, 12);
      const keyRes = await fetch(`${supabaseUrl}/rest/v1/integration_api_keys_v2`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, key_name: params.name ?? "API Key", key_prefix: keyPrefix, key_hash: rawKey, key_type: "api_key", scopes: params.scopes ?? ["read","write"], is_active: true }) });
      const key = (await keyRes.json())[0];
      return new Response(JSON.stringify({ created: true, key: rawKey, id: key.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "revoke") {
      await fetch(`${supabaseUrl}/rest/v1/integration_api_keys_v2?id=eq.${params.key_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ is_active: false }) });
      return new Response(JSON.stringify({ revoked: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
