import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const apiKey = authHeader.replace("Bearer ", "");
    if (!apiKey || apiKey.length < 10) return new Response(JSON.stringify({ authenticated: false, error: "Missing API key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const keyRes = await fetch(`${supabaseUrl}/rest/v1/integration_api_keys_v2?key_hash=eq.${apiKey}&is_active=eq.true&select=id,workspace_id,scopes`, { headers });
    const keyData = (await keyRes.json())[0];
    if (!keyData) return new Response(JSON.stringify({ authenticated: false, error: "Invalid API key" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    await fetch(`${supabaseUrl}/rest/v1/integration_api_keys_v2?id=eq.${keyData.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ last_used_at: new Date().toISOString() }) });
    return new Response(JSON.stringify({ authenticated: true, workspace_id: keyData.workspace_id, scopes: keyData.scopes }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
