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

    // Load approved prospects with contact_immediately or linkedin_first decisions
    const decisionsRes = await fetch(
      `${supabaseUrl}/rest/v1/outreach_decisions?workspace_id=eq.${workspace_id}&status=eq.active&decision=in.(contact_immediately,linkedin_first,multi_channel,connect_first)&select=id,company_id,contact_id,decision&limit=20`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    );
    const decisions = await decisionsRes.json();

    // Load available LinkedIn accounts
    const accountsRes = await fetch(
      `${supabaseUrl}/rest/v1/linkedin_accounts?workspace_id=eq.${workspace_id}&connection_status=in.(active,warming_up)&select=*&order=created_at.asc`,
      { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } },
    );
    const accounts = await accountsRes.json();

    if (!accounts.length) {
      return new Response(JSON.stringify({ scheduled: 0, reason: "No active LinkedIn accounts" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let scheduled = 0;
    for (const decision of decisions) {
      const account = accounts[scheduled % accounts.length];
      const actionType = decision.decision === "engage_content_first" ? "profile_visit" : "connection_request";

      // Create execution job
      const jobRes = await fetch(`${supabaseUrl}/rest/v1/linkedin_execution_jobs`, {
        method: "POST",
        headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({
          workspace_id,
          linkedin_account_id: account.id,
          company_id: decision.company_id,
          contact_id: decision.contact_id,
          outreach_decision_id: decision.id,
          action_type: actionType,
          status: "queued",
          priority: 2,
        }),
      });
      const job = await jobRes.json();
      if (job.length > 0) scheduled++;
    }

    return new Response(JSON.stringify({ scheduled, total_prospects: decisions.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
