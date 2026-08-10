import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const renewalsRes = await fetch(`${supabaseUrl}/rest/v1/renewal_pipeline?workspace_id=eq.${workspace_id}&renewal_status=in.(pending,in_progress,at_risk)&order=renewal_date.asc&select=*`, { headers });
    const renewals = await renewalsRes.json();
    for (const renewal of renewals) {
      const daysToRenewal = Math.floor((new Date(renewal.renewal_date).getTime() - Date.now()) / 86400000);
      await fetch(`${supabaseUrl}/rest/v1/renewal_pipeline?id=eq.${renewal.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ days_to_renewal: daysToRenewal }) });
      const acctRes = await fetch(`${supabaseUrl}/rest/v1/customer_accounts?id=eq.${renewal.customer_account_id}&select=health_score,churn_risk_score,account_name`, { headers });
      const account = (await acctRes.json())[0];
      if (!account) continue;
      let renewalHealth = "healthy", renewalProbability = renewal.renewal_probability;
      if (account.health_score < 40 || account.churn_risk_score > 50) { renewalHealth = "critical"; renewalProbability = Math.min(renewalProbability, 30); }
      else if (account.health_score < 60) { renewalHealth = "at_risk"; renewalProbability = Math.min(renewalProbability, 50); }
      else if (account.health_score < 75) { renewalHealth = "watch"; }
      await fetch(`${supabaseUrl}/rest/v1/renewal_pipeline?id=eq.${renewal.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ renewal_health: renewalHealth, renewal_probability: renewalProbability }) });
      if (daysToRenewal <= 90 && daysToRenewal > 0) {
        const reminderType = daysToRenewal <= 14 ? "final" : daysToRenewal <= 30 ? "urgent" : "upcoming";
        await fetch(`${supabaseUrl}/rest/v1/renewal_reminders`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, renewal_pipeline_id: renewal.id, reminder_date: new Date().toISOString().split("T")[0], reminder_type: reminderType, reminder_message: `Renewal for ${account.account_name} due in ${daysToRenewal} days. Value: $${renewal.renewal_value.toLocaleString()}.` }) });
      }
    }
    return new Response(JSON.stringify({ processed: renewals.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
