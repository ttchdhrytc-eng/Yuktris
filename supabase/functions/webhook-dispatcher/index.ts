import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { workspace_id, action, delivery_id } = body;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    if (action === "replay") {
      const delRes = await fetch(`${supabaseUrl}/rest/v1/webhook_deliveries?id=eq.${delivery_id}&select=*`, { headers });
      const delivery = (await delRes.json())[0];
      if (!delivery) return new Response(JSON.stringify({ error: "Delivery not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const subRes = await fetch(`${supabaseUrl}/rest/v1/webhook_subscriptions?id=eq.${delivery.subscription_id}&select=*`, { headers });
      const sub = (await subRes.json())[0];
      if (!sub) return new Response(JSON.stringify({ error: "Subscription not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const payload = delivery.payload;
      const response = await fetch(sub.endpoint_url, { method: "POST", headers: { "Content-Type": sub.content_type, ...sub.headers }, body: JSON.stringify(payload), signal: AbortSignal.timeout(sub.timeout_seconds * 1000) });
      const responseBody = await response.text();
      await fetch(`${supabaseUrl}/rest/v1/webhook_replay_logs`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, delivery_id, replay_status: response.ok ? "success" : "failed", replay_response: responseBody.slice(0, 2000), replay_http_status: response.status }) });
      return new Response(JSON.stringify({ replayed: true, status: response.status }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const subsRes = await fetch(`${supabaseUrl}/rest/v1/webhook_subscriptions?workspace_id=eq.${workspace_id}&is_active=eq.true&select=*`, { headers });
    const subs = await subsRes.json();
    let dispatched = 0;
    for (const sub of subs) {
      const events = body.events ?? [];
      for (const eventName of events) {
        if (!sub.events.includes(eventName)) continue;
        await fetch(`${supabaseUrl}/rest/v1/webhook_deliveries`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, subscription_id: sub.id, event_name: eventName, event_id: body.event_id ?? crypto.randomUUID(), payload: body.payload ?? {}, status: "pending" }) });
        dispatched++;
      }
    }
    return new Response(JSON.stringify({ dispatched }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
