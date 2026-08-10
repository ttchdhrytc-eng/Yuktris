import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Load all accounts
    const accountsRes = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_accounts?workspace_id=eq.${workspace_id}&select=*`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    );
    const accounts = await accountsRes.json();

    const results = [];
    for (const account of accounts) {
      // Calculate risk score based on usage
      const today = new Date().toISOString().split("T")[0];
      const usageRes = await fetch(
        `${supabaseUrl}/rest/v1/linkedin_daily_usage?linkedin_account_id=eq.${account.id}&usage_date=eq.${today}&select=*`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      );
      const usage = await usageRes.json();
      const u = usage[0] ?? { connections_sent: 0, messages_sent: 0, total_actions: 0 };

      let riskScore = 0;
      if (u.connections_sent >= account.daily_connection_limit * 0.8) riskScore += 0.2;
      if (u.messages_sent >= account.daily_message_limit * 0.8) riskScore += 0.2;
      if (account.warmup_status === "in_progress") riskScore += 0.15;
      riskScore = Math.min(riskScore + account.risk_score * 0.3, 1);

      // Determine health status
      let healthStatus = "healthy";
      if (riskScore > 0.7) healthStatus = "critical";
      else if (riskScore > 0.4) healthStatus = "warning";

      // Upsert health record
      const existingHealthRes = await fetch(
        `${supabaseUrl}/rest/v1/linkedin_account_health?linkedin_account_id=eq.${account.id}&select=id`,
        { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
      );
      const existingHealth = await existingHealthRes.json();

      if (existingHealth.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/linkedin_account_health?id=eq.${existingHealth[0].id}`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            health_status: healthStatus,
            risk_score: riskScore,
            connections_today: u.connections_sent ?? 0,
            messages_today: u.messages_sent ?? 0,
            last_health_check: new Date().toISOString(),
          }),
        });
      } else {
        await fetch(`${supabaseUrl}/rest/v1/linkedin_account_health`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            workspace_id,
            linkedin_account_id: account.id,
            health_status: healthStatus,
            risk_score: riskScore,
            connections_today: u.connections_sent ?? 0,
            messages_today: u.messages_sent ?? 0,
            last_health_check: new Date().toISOString(),
          }),
        });
      }

      // Update account risk score
      await fetch(`${supabaseUrl}/rest/v1/linkedin_accounts?id=eq.${account.id}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
        body: JSON.stringify({ risk_score: riskScore }),
      });

      // Create notification if risk increased
      if (riskScore > 0.7 && account.risk_score <= 0.7) {
        await fetch(`${supabaseUrl}/rest/v1/linkedin_notifications`, {
          method: "POST",
          headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=minimal" },
          body: JSON.stringify({
            workspace_id,
            linkedin_account_id: account.id,
            notification_type: "risk_score_increased",
            notification_title: "Risk Score Alert",
            notification_message: `Account ${account.display_name} risk score increased to ${Math.round(riskScore * 100)}%`,
            severity: "warning",
          }),
        });
      }

      results.push({ account_id: account.id, health_status: healthStatus, risk_score: riskScore });
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
