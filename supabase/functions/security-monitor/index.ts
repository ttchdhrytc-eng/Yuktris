import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, event_type, user_id, ip_address, user_agent } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === 'log_event') {
      const severity = event_type === 'brute_force_detected' || event_type === 'suspicious_activity' ? 'high' : event_type === 'login_failed' ? 'medium' : 'info';
      const riskScore = severity === 'high' ? 80 : severity === 'medium' ? 40 : 10;
      await fetch(`${supabaseUrl}/rest/v1/security_events`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, event_type, event_severity: severity, event_source: 'security-monitor', user_id: user_id ?? null, ip_address: ip_address ?? null, user_agent: user_agent ?? null, risk_score: riskScore }) });
      return new Response(JSON.stringify({ logged: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'detect_brute_force') {
      const recentRes = await fetch(`${supabaseUrl}/rest/v1/security_events?workspace_id=eq.${workspace_id}&event_type=eq.login_failed&created_at=gte.${new Date(Date.now() - 300000).toISOString()}&select=*`, { headers }).then(r => r.json());
      if (recentRes.length >= 5) {
        const existingAlert = await fetch(`${supabaseUrl}/rest/v1/security_alerts?workspace_id=eq.${workspace_id}&alert_type=eq.brute_force&alert_status=eq.open&select=id`, { headers }).then(r => r.json());
        if (!existingAlert[0]) {
          await fetch(`${supabaseUrl}/rest/v1/security_alerts`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, alert_type: 'brute_force', alert_severity: 'high', alert_status: 'open', alert_title: 'Brute Force Attack Detected', alert_description: `${recentRes.length} failed login attempts in 5 minutes`, alert_source: 'security-monitor', affected_user_id: user_id ?? null, recommended_actions: ['Block IP address', 'Require MFA', 'Reset password'] }) });
        }
        return new Response(JSON.stringify({ detected: true, attempts: recentRes.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ detected: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'scan_threats') {
      let threatsFound = 0;
      const failedLogins = await fetch(`${supabaseUrl}/rest/v1/security_events?workspace_id=eq.${workspace_id}&event_type=eq.login_failed&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&select=*`, { headers }).then(r => r.json());
      if (failedLogins.length >= 10) {
        threatsFound++;
        await fetch(`${supabaseUrl}/rest/v1/security_alerts`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, alert_type: 'credential_stuffing', alert_severity: 'critical', alert_status: 'open', alert_title: 'Credential Stuffing Attack', alert_description: `${failedLogins.length} failed logins in 1 hour`, alert_source: 'security-monitor', recommended_actions: ['Enable rate limiting', 'Force MFA', 'Notify affected users'] }) });
      }
      const rateLimits = await fetch(`${supabaseUrl}/rest/v1/security_events?workspace_id=eq.${workspace_id}&event_type=eq.rate_limit_exceeded&created_at=gte.${new Date(Date.now() - 3600000).toISOString()}&select=*`, { headers }).then(r => r.json());
      if (rateLimits.length >= 20) {
        threatsFound++;
        await fetch(`${supabaseUrl}/rest/v1/security_alerts`, { method: 'POST', headers: { ...headers, Prefer: 'return=minimal' }, body: JSON.stringify({ workspace_id, alert_type: 'api_abuse', alert_severity: 'high', alert_status: 'open', alert_title: 'API Abuse Detected', alert_description: `${rateLimits.length} rate limit violations in 1 hour`, alert_source: 'security-monitor', recommended_actions: ['Throttle API access', 'Review API key usage', 'Contact account owner'] }) });
      }
      return new Response(JSON.stringify({ scanned: true, threats: threatsFound }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
