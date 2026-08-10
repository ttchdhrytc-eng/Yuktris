import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const invRes = await fetch(`${supabaseUrl}/rest/v1/invoices?workspace_id=eq.${workspace_id}&status=eq.paid&select=*`, { headers });
    const invoices = await invRes.json();
    let recognized = 0;
    for (const inv of invoices) {
      const existingRes = await fetch(`${supabaseUrl}/rest/v1/recognized_revenue?invoice_id=eq.${inv.id}&limit=1`, { headers });
      const existing = await existingRes.json();
      if (existing.length > 0) continue;
      await fetch(`${supabaseUrl}/rest/v1/recognized_revenue`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, billing_account_id: inv.billing_account_id, subscription_id: inv.subscription_id, invoice_id: inv.id, recognition_date: new Date().toISOString().split("T")[0], recognition_period: new Date().toISOString().slice(0, 7), recognized_amount: inv.total, revenue_type: "subscription", recognition_method: "monthly", ai_reasoning: `I recognized $${inv.total.toFixed(2)} in revenue.` }) });
      recognized++;
    }
    return new Response(JSON.stringify({ recognized, count: recognized }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
