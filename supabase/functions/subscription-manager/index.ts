import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, billing_account_id, plan_id, billing_cycle } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const planRes = await fetch(`${supabaseUrl}/rest/v1/pricing_plans?id=eq.${plan_id}&select=*`, { headers });
    const plan = (await planRes.json())[0];
    if (!plan) return new Response(JSON.stringify({ error: "Plan not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const baRes = await fetch(`${supabaseUrl}/rest/v1/billing_accounts?id=eq.${billing_account_id}&select=*`, { headers });
    const billingAccount = (await baRes.json())[0];
    if (!billingAccount) return new Response(JSON.stringify({ error: "Billing account not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const periodEnd = new Date(); periodEnd.setMonth(periodEnd.getMonth() + (billing_cycle === "annual" ? 12 : billing_cycle === "quarterly" ? 3 : 1));
    const subRes = await fetch(`${supabaseUrl}/rest/v1/subscriptions`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, billing_account_id, customer_account_id: billingAccount.customer_account_id, plan_id, subscription_name: `${plan.plan_name} Subscription`, status: "active", billing_cycle: billing_cycle || "monthly", current_period_start: new Date().toISOString().split("T")[0], current_period_end: periodEnd.toISOString().split("T")[0], quantity: 1, mrr: plan.base_price, arr: plan.base_price * 12, auto_renew: true, ai_reasoning: `Auto-created subscription for ${plan.plan_name} plan at $${plan.base_price}/month.` }) });
    const subscription = (await subRes.json())[0];
    if (subscription) {
      await fetch(`${supabaseUrl}/rest/v1/subscription_items`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, subscription_id: subscription.id, product_name: plan.plan_name, product_description: plan.description, quantity: 1, unit_price: plan.base_price, billing_type: "recurring" }) });
      await fetch(`${supabaseUrl}/rest/v1/subscription_history`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, subscription_id: subscription.id, event_type: "subscription_created", event_description: `Subscription created for ${plan.plan_name}`, new_status: "active" }) });
      if (billingAccount.customer_account_id) {
        await fetch(`${supabaseUrl}/rest/v1/customer_accounts?id=eq.${billingAccount.customer_account_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ mrr: plan.base_price, arr: plan.base_price * 12 }) });
      }
    }
    return new Response(JSON.stringify({ created: true, subscription_id: subscription?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
