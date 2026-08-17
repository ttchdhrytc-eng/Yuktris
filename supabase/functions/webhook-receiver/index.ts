// webhook-receiver — internal trigger that fans out a Yuktris business event to a
// workspace's active outbound webhook subscriptions.
//
// SECURITY MODEL:
// - This is an internal-only endpoint. There is no legitimate external/frontend caller
//   (nothing in the app calls this today) so it is locked to Yuktris's own service-role
//   bearer token. Any request without a valid service-role bearer is rejected (fail closed).
// - workspace_id is supplied by the trusted internal caller (already scoped upstream to a
//   single workspace by the engine that owns the business event), never by an
//   unauthenticated third party.
// - event_id (if supplied) is used for delivery idempotency so a retried internal call
//   cannot fan out duplicate deliveries to a subscriber.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyServiceRoleBearer } from "../_shared/webhookSecurity.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization" };

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

export async function handleWebhookReceiver(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  if (!verifyServiceRoleBearer(req)) return jsonError("Unauthorized", 401);

  try {
    const body = await req.json();
    const { workspace_id, event_name, event_payload, event_id } = body;
    if (!workspace_id || !event_name) return jsonError("workspace_id and event_name are required", 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    await fetch(`${supabaseUrl}/rest/v1/webhook_events`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, event_name, event_category: "incoming", event_schema: event_payload ?? {} }) });

    const subsRes = await fetch(`${supabaseUrl}/rest/v1/webhook_subscriptions?workspace_id=eq.${workspace_id}&is_active=eq.true&select=*`, { headers });
    const subs = await subsRes.json();
    const deliveryEventId = typeof event_id === "string" && event_id ? event_id : crypto.randomUUID();
    let queued = 0;
    let duplicates = 0;
    for (const sub of subs) {
      if (!sub.events.includes(event_name)) continue;

      // Idempotency: skip if this event was already queued for this subscription.
      const existingRes = await fetch(
        `${supabaseUrl}/rest/v1/webhook_deliveries?subscription_id=eq.${sub.id}&event_id=eq.${encodeURIComponent(deliveryEventId)}&select=id`,
        { headers },
      );
      const existing = existingRes.ok ? await existingRes.json() : [];
      if (existing[0]) {
        duplicates++;
        continue;
      }

      await fetch(`${supabaseUrl}/rest/v1/webhook_deliveries`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, subscription_id: sub.id, event_name, event_id: deliveryEventId, payload: event_payload, status: "pending" }) });
      queued++;
    }
    return new Response(JSON.stringify({ received: true, queued, duplicates }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Webhook receive failed", 500);
  }
}

if (import.meta.main) Deno.serve(handleWebhookReceiver);
