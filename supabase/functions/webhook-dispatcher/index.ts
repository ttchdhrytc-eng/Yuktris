import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);
  try {
    const body = await req.json() as Record<string, unknown>;
    const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id : "";
    if (!workspaceId) return jsonError("workspace_id is required", 400);
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, { allowServiceRole: true });
    const action = typeof body.action === "string" ? body.action : "dispatch";

    if (action === "replay") {
      const deliveryId = typeof body.delivery_id === "string" ? body.delivery_id : "";
      if (!deliveryId) return jsonError("delivery_id is required", 400);
      const { data: delivery, error: deliveryError } = await admin.from("webhook_deliveries")
        .select("*").eq("id", deliveryId).eq("workspace_id", workspaceId).maybeSingle();
      if (deliveryError) throw new Error(deliveryError.message);
      if (!delivery) return jsonError("Delivery not found", 404);
      const { data: subscription, error: subscriptionError } = await admin.from("webhook_subscriptions")
        .select("*").eq("id", delivery.subscription_id).eq("workspace_id", workspaceId).maybeSingle();
      if (subscriptionError) throw new Error(subscriptionError.message);
      if (!subscription) return jsonError("Subscription not found", 404);

      const response = await fetch(subscription.endpoint_url, {
        method: "POST",
        headers: { "Content-Type": subscription.content_type ?? "application/json", ...(subscription.headers ?? {}) },
        body: JSON.stringify(delivery.payload ?? {}),
        signal: AbortSignal.timeout(Math.max(1, subscription.timeout_seconds ?? 10) * 1000),
      });
      const responseBody = await response.text();
      await admin.from("webhook_replay_logs").insert({
        workspace_id: workspaceId,
        delivery_id: deliveryId,
        replay_status: response.ok ? "success" : "failed",
        replay_response: responseBody.slice(0, 2000),
        replay_http_status: response.status,
      });
      return jsonResponse({ replayed: true, status: response.status });
    }

    const events = Array.isArray(body.events) ? body.events.filter((v): v is string => typeof v === "string" && !!v) : [];
    if (events.length === 0) return jsonError("events must contain at least one event name", 400);
    const eventId = typeof body.event_id === "string" && body.event_id ? body.event_id : crypto.randomUUID();
    const { data: subscriptions, error: subscriptionsError } = await admin.from("webhook_subscriptions")
      .select("*").eq("workspace_id", workspaceId).eq("is_active", true);
    if (subscriptionsError) throw new Error(subscriptionsError.message);

    let dispatched = 0;
    for (const sub of subscriptions ?? []) {
      const subscribedEvents = Array.isArray(sub.events) ? sub.events : [];
      for (const eventName of events) {
        if (!subscribedEvents.includes(eventName)) continue;
        const { error } = await admin.from("webhook_deliveries").upsert({
          workspace_id: workspaceId,
          subscription_id: sub.id,
          event_name: eventName,
          event_id: eventId,
          payload: body.payload ?? {},
          status: "pending",
        }, { onConflict: "subscription_id,event_id", ignoreDuplicates: true });
        if (!error) dispatched++;
      }
    }
    return jsonResponse({ dispatched, event_id: eventId });
  } catch (error) {
    const status = authorizationStatus(error);
    return jsonError(error instanceof Error ? error.message : "Webhook dispatch failed", status);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
