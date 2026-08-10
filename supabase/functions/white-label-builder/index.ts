import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, settings } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === "enable") {
      const { data: existing } = await fetch(`${supabaseUrl}/rest/v1/white_label_settings?workspace_id=eq.${workspace_id}&select=id`, { headers }).then(r => r.json());
      if (existing[0]) { await fetch(`${supabaseUrl}/rest/v1/white_label_settings?id=eq.${existing[0].id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ is_white_labeled: true, ...settings }) }); }
      else { await fetch(`${supabaseUrl}/rest/v1/white_label_settings`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, is_white_labeled: true, ...settings }) }); }
      return new Response(JSON.stringify({ enabled: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "disable") {
      await fetch(`${supabaseUrl}/rest/v1/white_label_settings?workspace_id=eq.${workspace_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ is_white_labeled: false }) });
      return new Response(JSON.stringify({ disabled: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "add_domain") {
      const { domain } = settings;
      await fetch(`${supabaseUrl}/rest/v1/custom_domains`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, domain, domain_type: "full", ssl_status: "pending", dns_verified: false, is_primary: false, is_active: true }) });
      return new Response(JSON.stringify({ added: true, domain }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
