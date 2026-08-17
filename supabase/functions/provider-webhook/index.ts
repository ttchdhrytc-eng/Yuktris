// provider-webhook — inbound webhook receiver for the Communication Provider Layer.
//
// SECURITY MODEL:
// - Callers are external third-party providers (Slack, WhatsApp/Meta, Gmail, Outlook,
//   LinkedIn Messaging, Microsoft Teams, Twilio SMS, Custom). They cannot present a
//   Supabase session JWT, so this function must be deployed with JWT verification
//   disabled at the gateway and instead authenticates the request itself.
// - workspace_id/provider identity are NEVER trusted from the request body/query.
//   They are always re-derived server-side from `connection_id` via `provider_connections`.
// - Every request must carry a valid signature verified against the secret stored for
//   that specific connection (`provider_connections.credentials.webhook_secret`).
//   Slack and Meta/WhatsApp use their own documented signature schemes; other
//   providers use a generic HMAC-SHA256 scheme keyed on the same stored secret.
// - Missing/invalid signature, unknown connection, or missing secret => fail closed (401/404).
// - Duplicate deliveries (retries) are detected via `external_event_id` and short-circuited
//   without reprocessing.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { verifyProviderSignature } from "../_shared/webhookSecurity.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, X-Slack-Signature, X-Slack-Request-Timestamp, X-Hub-Signature-256, X-Yuktris-Webhook-Signature, X-Yuktris-Webhook-Timestamp",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function restHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "apikey": SERVICE_ROLE_KEY,
  };
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ProviderConnectionRow {
  id: string;
  workspace_id: string;
  provider_id: string;
  provider_key: string;
  credentials: Record<string, unknown> | null;
  status: string;
}

export async function handleProviderWebhook(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const url = new URL(req.url);
    const rawBody = await req.text();

    let bodyJson: Record<string, unknown> = {};
    try {
      bodyJson = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      return jsonError("Invalid JSON payload", 400);
    }

    // connection_id identifies the webhook; prefer the URL (assigned at registration
    // time) but accept the body for backward compatibility. Never trust workspace_id
    // or provider_id supplied by the caller.
    const connectionId = url.searchParams.get("connection_id") || (bodyJson.connection_id as string | undefined);
    if (!connectionId) return jsonError("connection_id is required", 400);

    const connRes = await fetch(
      `${SUPABASE_URL}/rest/v1/provider_connections?id=eq.${connectionId}&select=id,workspace_id,provider_id,provider_key,credentials,status`,
      { headers: restHeaders() },
    );
    if (!connRes.ok) return jsonError("Unable to verify connection", 500);
    const connRows = (await connRes.json()) as ProviderConnectionRow[];
    const connection = connRows[0];

    // Do not reveal whether the connection exists to an unauthenticated caller.
    if (!connection) return jsonError("Unauthorized", 401);

    const secret = (connection.credentials?.webhook_secret as string | undefined) ?? "";
    if (!secret) return jsonError("Unauthorized", 401);

    const verification = await verifyProviderSignature(connection.provider_key, req, rawBody, secret);
    if (!verification.valid) return jsonError("Unauthorized", 401);

    if (connection.status === "disconnected" || connection.status === "revoked") {
      return jsonError("Connection is not active", 403);
    }

    const payload = (bodyJson.payload as Record<string, unknown>) ?? bodyJson;
    const externalEventId =
      (payload?.event_id as string | undefined) ??
      (payload?.message_id as string | undefined) ??
      (payload?.notification_id as string | undefined) ??
      null;

    // Idempotency: if we've already recorded this external event for this connection,
    // acknowledge without reprocessing (safe for provider retry behavior).
    if (externalEventId) {
      const dupRes = await fetch(
        `${SUPABASE_URL}/rest/v1/provider_webhooks?connection_id=eq.${connectionId}&external_event_id=eq.${encodeURIComponent(externalEventId)}&select=id,is_processed`,
        { headers: restHeaders() },
      );
      const dupRows = dupRes.ok ? ((await dupRes.json()) as Array<{ id: string; is_processed: boolean }>) : [];
      if (dupRows[0]) {
        return new Response(JSON.stringify({ processed: true, duplicate: true, webhook_id: dupRows[0].id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Store raw webhook, scoped to the workspace/provider derived from the connection.
    const webhookRes = await fetch(`${SUPABASE_URL}/rest/v1/provider_webhooks`, {
      method: "POST",
      headers: { ...restHeaders(), "Prefer": "return=representation" },
      body: JSON.stringify({
        connection_id: connection.id,
        provider_id: connection.provider_id,
        workspace_id: connection.workspace_id,
        external_event_id: externalEventId,
        raw_payload: payload ?? {},
        webhook_status: "processing",
        is_processed: false,
      }),
    });
    if (!webhookRes.ok) {
      const detail = await webhookRes.text();
      return jsonError(`Failed to store webhook: ${detail}`, 500);
    }
    const webhookData = await webhookRes.json();
    const webhookId = webhookData?.[0]?.id;

    await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        connection_id: connection.id,
        provider_id: connection.provider_id,
        workspace_id: connection.workspace_id,
        event_type: "webhook_received",
        event_status: "info",
        message: "Webhook received from provider",
        metadata: { webhook_id: webhookId },
      }),
    });

    const processedPayload = {
      processed_at: new Date().toISOString(),
      event_type: (payload as Record<string, unknown>)?.event_type ?? "unknown",
      message_id: (payload as Record<string, unknown>)?.message_id ?? null,
    };

    await fetch(`${SUPABASE_URL}/rest/v1/provider_webhooks?id=eq.${webhookId}`, {
      method: "PATCH",
      headers: restHeaders(),
      body: JSON.stringify({
        processed_payload: processedPayload,
        is_processed: true,
        processed_at: new Date().toISOString(),
        webhook_status: "active",
      }),
    });

    return new Response(JSON.stringify({
      processed: true,
      webhook_id: webhookId,
      message_id: processedPayload.message_id,
      error: null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Webhook processing failed", 500);
  }
}

if (import.meta.main) Deno.serve(handleProviderWebhook);
