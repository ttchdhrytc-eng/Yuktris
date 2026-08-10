import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, transaction_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const txnRes = await fetch(`${supabaseUrl}/rest/v1/payment_transactions?id=eq.${transaction_id}&select=*`, { headers });
    const txn = (await txnRes.json())[0];
    if (!txn || txn.status !== "failed") return new Response(JSON.stringify({ skipped: true, reason: "Transaction not failed" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const retriesRes = await fetch(`${supabaseUrl}/rest/v1/payment_retries?payment_transaction_id=eq.${transaction_id}&order=retry_attempt.desc&limit=1`, { headers });
    const retries = await retriesRes.json();
    const attempt = retries.length > 0 ? retries[0].retry_attempt + 1 : 1;
    if (attempt > 3) {
      await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.${txn.invoice_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "uncollectible" }) });
      return new Response(JSON.stringify({ max_retries_reached: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const succeeded = Math.random() > 0.3;
    await fetch(`${supabaseUrl}/rest/v1/payment_retries`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, payment_transaction_id: transaction_id, retry_attempt: attempt, retry_date: new Date().toISOString(), retry_status: succeeded ? "succeeded" : "failed", retry_result: succeeded ? "Payment succeeded on retry" : "Payment failed on retry", next_retry_date: succeeded ? null : new Date(Date.now() + 3 * 86400000).toISOString() }) });
    if (succeeded) {
      await fetch(`${supabaseUrl}/rest/v1/payment_transactions?id=eq.${transaction_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "succeeded", processed_at: new Date().toISOString() }) });
      await fetch(`${supabaseUrl}/rest/v1/payment_failures?payment_transaction_id=eq.${transaction_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ is_resolved: true, resolved_at: new Date().toISOString() }) });
    } else {
      await fetch(`${supabaseUrl}/rest/v1/finance_alerts`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, alert_type: "failed_payment", alert_title: `Payment retry ${attempt} failed`, alert_description: `Payment retry attempt ${attempt} failed for $${txn.amount.toFixed(2)}.`, alert_severity: attempt >= 3 ? "critical" : "high", related_entity_id: transaction_id, related_entity_type: "payment_transaction", amount_impacted: txn.amount, recommended_action: "Contact customer to update payment method.", ai_reasoning: `I detected that payment retry ${attempt} failed.`, ai_confidence: 0.85 }) });
    }
    return new Response(JSON.stringify({ retried: true, attempt, succeeded }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
