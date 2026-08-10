import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, invoice_id, amount, payment_method_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const invRes = await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.${invoice_id}&select=*`, { headers });
    const invoice = (await invRes.json())[0];
    if (!invoice) return new Response(JSON.stringify({ error: "Invoice not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const txnRes = await fetch(`${supabaseUrl}/rest/v1/payment_transactions`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, billing_account_id: invoice.billing_account_id, payment_method_id: payment_method_id ?? null, invoice_id, transaction_id: `TXN-${Date.now().toString().slice(-10)}`, amount, currency: "USD", status: "succeeded", transaction_type: "charge", processed_at: new Date().toISOString(), ai_reasoning: `I recorded a payment of $${amount.toFixed(2)} for invoice ${invoice.invoice_number}.` }) });
    const txn = (await txnRes.json())[0];
    if (txn) {
      await fetch(`${supabaseUrl}/rest/v1/invoice_payments`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, invoice_id, payment_transaction_id: txn.id, amount }) });
      const newAmountPaid = (invoice.amount_paid || 0) + amount;
      const newAmountDue = invoice.total - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? "paid" : "partial";
      await fetch(`${supabaseUrl}/rest/v1/invoices?id=eq.${invoice_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ amount_paid: newAmountPaid, amount_due: newAmountDue, status: newStatus, paid_at: newStatus === "paid" ? new Date().toISOString() : null }) });
      await fetch(`${supabaseUrl}/rest/v1/invoice_history`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, invoice_id, event_type: "payment_recorded", event_description: `Payment of $${amount.toFixed(2)} recorded`, previous_status: invoice.status, new_status: newStatus }) });
      if (newStatus === "paid") {
        await fetch(`${supabaseUrl}/rest/v1/recognized_revenue`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, billing_account_id: invoice.billing_account_id, subscription_id: invoice.subscription_id, invoice_id, recognition_date: new Date().toISOString().split("T")[0], recognition_period: new Date().toISOString().slice(0, 7), recognized_amount: invoice.total, revenue_type: "subscription", recognition_method: "monthly", ai_reasoning: `I recognized $${invoice.total.toFixed(2)} in revenue.` }) });
      }
    }
    return new Response(JSON.stringify({ processed: true, transaction_id: txn?.id, status: "succeeded" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
