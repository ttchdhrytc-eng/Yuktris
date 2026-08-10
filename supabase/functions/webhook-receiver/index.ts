import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { workspace_id, event_name, event_payload } = body;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    await fetch(`${supabaseUrl}/rest/v1/webhook_events`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, event_name, event_category: "incoming", event_schema: event_payload }) });
    const subsRes = await fetch(`${supabaseUrl}/rest/v1/webhook_subscriptions?workspace_id=eq.${workspace_id}&is_active=eq.true&select=*`, { headers });
    const subs = await subsRes.json();
    let queued = 0;
    for (const sub of subs) {
      if (!sub.events.includes(event_name)) continue;
      await fetch(`${supabaseUrl}/rest/v1/webhook_deliveries`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, subscription_id: sub.id, event_name, event_id: crypto.randomUUID(), payload: event_payload, status: "pending" }) });
      queued++;
    }
    return new Response(JSON.stringify({ received: true, queued }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
