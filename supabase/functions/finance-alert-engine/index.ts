import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [invRes, failRes, overdueRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/invoices?workspace_id=eq.${workspace_id}&status=in.(sent,partial,overdue)&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/payment_failures?workspace_id=eq.${workspace_id}&is_resolved=eq.false&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/overdue_accounts?workspace_id=eq.${workspace_id}&select=*`, { headers }),
    ]);
    const [invoices, failures, overdue] = await Promise.all([invRes.json(), failRes.json(), overdueRes.json()]);
    let alertsCreated = 0;
    for (const inv of invoices) {
      if (inv.amount_due > 10000) {
        await fetch(`${supabaseUrl}/rest/v1/finance_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: "large_unpaid_invoice", alert_title: `Large unpaid invoice: ${inv.invoice_number}`, alert_description: `Invoice ${inv.invoice_number} has $${inv.amount_due.toFixed(2)} outstanding.`, alert_severity: "high", related_entity_id: inv.id, related_entity_type: "invoice", amount_impacted: inv.amount_due, recommended_action: "Follow up with customer for payment.", ai_reasoning: `I detected a large unpaid invoice.`, ai_confidence: 0.85 }) });
        alertsCreated++;
      }
    }
    for (const fail of failures) {
      await fetch(`${supabaseUrl}/rest/v1/finance_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: "failed_payment", alert_title: "Failed payment requires attention", alert_description: "Payment failure detected. Retry may be needed.", alert_severity: "high", related_entity_id: fail.payment_transaction_id, related_entity_type: "payment_transaction", amount_impacted: 0, recommended_action: "Retry payment or contact customer.", ai_reasoning: "I detected a failed payment.", ai_confidence: 0.85 }) });
      alertsCreated++;
    }
    for (const oa of overdue) {
      await fetch(`${supabaseUrl}/rest/v1/finance_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: "overdue_account", alert_title: `Overdue account: $${oa.total_overdue.toFixed(2)}`, alert_description: `Account is ${oa.days_overdue} days overdue.`, alert_severity: oa.risk_level === "critical" ? "critical" : "high", related_entity_id: oa.billing_account_id, related_entity_type: "billing_account", amount_impacted: oa.total_overdue, recommended_action: "Initiate collection process.", ai_reasoning: "I detected an overdue account.", ai_confidence: 0.85 }) });
      alertsCreated++;
    }
    return new Response(JSON.stringify({ generated: true, alerts_created: alertsCreated }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
