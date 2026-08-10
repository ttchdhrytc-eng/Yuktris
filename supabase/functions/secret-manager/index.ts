import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, connection_id, action } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === "rotate") {
      await fetch(`${supabaseUrl}/rest/v1/integration_credentials?connection_id=eq.${connection_id}&is_valid=eq.true`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ is_valid: false }) });
      await fetch(`${supabaseUrl}/rest/v1/integration_events`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id, event_type: "credential_rotated", event_name: "credential_rotated", event_description: "Credentials rotated" }) });
      await fetch(`${supabaseUrl}/rest/v1/integration_audit`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, connection_id, audit_type: "credential", audit_action: "rotate", audit_description: "Rotated all credentials", performed_by_type: "system", severity: "high" }) });
      return new Response(JSON.stringify({ rotated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "list") {
      const res = await fetch(`${supabaseUrl}/rest/v1/integration_credentials?workspace_id=eq.${workspace_id}&connection_id=eq.${connection_id}&select=id,credential_type,is_valid,expires_at,last_validated_at`, { headers });
      const creds = await res.json();
      return new Response(JSON.stringify({ credentials: creds }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
