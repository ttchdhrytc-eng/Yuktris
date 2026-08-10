import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, params } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === "create_org") {
      const slug = (params.name as string).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      await fetch(`${supabaseUrl}/rest/v1/enterprise_organizations`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, org_name: params.name, org_slug: slug, org_type: "enterprise", status: "active", contract_type: params.contract_type ?? "annual", seat_count: params.seat_count ?? 10 }) });
      return new Response(JSON.stringify({ created: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "configure_sso") {
      await fetch(`${supabaseUrl}/rest/v1/enterprise_sso_configs`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, enterprise_org_id: params.org_id ?? null, sso_type: params.sso_type ?? "saml", sso_entity_id: params.entity_id ?? null, sso_login_url: params.login_url ?? null, sso_certificate: params.certificate ?? null, sso_metadata_url: params.metadata_url ?? null, is_active: true }) });
      return new Response(JSON.stringify({ configured: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "create_policy") {
      await fetch(`${supabaseUrl}/rest/v1/enterprise_security_policies`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, policy_type: params.policy_type, policy_name: params.policy_name, policy_config: params.config ?? {}, is_enforced: true }) });
      return new Response(JSON.stringify({ created: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "update_compliance") {
      const { data: existing } = await fetch(`${supabaseUrl}/rest/v1/enterprise_compliance?workspace_id=eq.${workspace_id}&compliance_type=eq.${params.compliance_type}&select=id`, { headers }).then(r => r.json());
      const updateData = { workspace_id, compliance_type: params.compliance_type, compliance_status: params.status ?? "in_progress", is_active: true };
      if (existing[0]) { await fetch(`${supabaseUrl}/rest/v1/enterprise_compliance?id=eq.${existing[0].id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(updateData) }); }
      else { await fetch(`${supabaseUrl}/rest/v1/enterprise_compliance`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(updateData) }); }
      return new Response(JSON.stringify({ updated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === "audit_log") {
      await fetch(`${supabaseUrl}/rest/v1/enterprise_audit_logs`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, user_id: params.user_id ?? null, action: params.action, resource_type: params.resource_type ?? null, resource_id: params.resource_id ?? null, ip_address: params.ip_address ?? null, severity: params.severity ?? "info", metadata: params.metadata ?? {} }) });
      return new Response(JSON.stringify({ logged: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
