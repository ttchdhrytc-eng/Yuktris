import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, subscription_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const subRes = await fetch(`${supabaseUrl}/rest/v1/subscriptions?id=eq.${subscription_id}&select=*,billing_accounts(*)`, { headers });
    const subscription = (await subRes.json())[0];
    if (!subscription) return new Response(JSON.stringify({ error: "Subscription not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const itemsRes = await fetch(`${supabaseUrl}/rest/v1/subscription_items?subscription_id=eq.${subscription_id}&select=*`, { headers });
    const items = await itemsRes.json();
    const invoiceNumber = `INV-${Date.now().toString().slice(-8)}`;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 30);
    let subtotal = 0;
    for (const item of items) { subtotal += item.quantity * item.unit_price; }
    const discountTotal = subtotal * ((subscription.discount_percent || 0) / 100);
    const total = subtotal - discountTotal;
    const invRes = await fetch(`${supabaseUrl}/rest/v1/invoices`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, billing_account_id: subscription.billing_account_id, subscription_id, customer_account_id: subscription.customer_account_id, invoice_number: invoiceNumber, invoice_date: new Date().toISOString().split("T")[0], due_date: dueDate.toISOString().split("T")[0], period_start: subscription.current_period_start, period_end: subscription.current_period_end, subtotal, discount_total: discountTotal, tax_total: 0, total, amount_due: total, currency: "USD", status: "draft", ai_reasoning: `I generated this invoice for ${subscription.subscription_name} totaling $${total.toFixed(2)}.` }) });
    const invoice = (await invRes.json())[0];
    if (invoice) {
      for (const item of items) {
        await fetch(`${supabaseUrl}/rest/v1/invoice_items`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, invoice_id: invoice.id, subscription_item_id: item.id, description: item.product_name, quantity: item.quantity, unit_price: item.unit_price, discount_percent: subscription.discount_percent || 0, line_total: item.quantity * item.unit_price }) });
      }
      await fetch(`${supabaseUrl}/rest/v1/invoice_history`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, invoice_id: invoice.id, event_type: "invoice_created", event_description: `Invoice ${invoiceNumber} created for $${total.toFixed(2)}`, new_status: "draft" }) });
    }
    return new Response(JSON.stringify({ generated: true, invoice_id: invoice?.id, invoice_number: invoiceNumber, total }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
