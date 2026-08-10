import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { connection_id, workspace_id, provider_id, payload } = await req.json();

    if (!connection_id || !workspace_id) {
      return new Response(JSON.stringify({ error: "connection_id and workspace_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Store raw webhook
    const webhookRes = await fetch(`${SUPABASE_URL}/rest/v1/provider_webhooks`, {
      method: "POST",
      headers: { ...restHeaders(), "Prefer": "return=representation" },
      body: JSON.stringify({
        connection_id,
        provider_id: provider_id ?? null,
        workspace_id,
        raw_payload: payload ?? {},
        webhook_status: "processing",
        is_processed: false,
      }),
    });
    const webhookData = await webhookRes.json();
    const webhookId = webhookData?.[0]?.id;

    // Log webhook received event
    await fetch(`${SUPABASE_URL}/rest/v1/provider_events`, {
      method: "POST",
      headers: restHeaders(),
      body: JSON.stringify({
        connection_id,
        provider_id: provider_id ?? null,
        workspace_id,
        event_type: "webhook_received",
        event_status: "info",
        message: "Webhook received from provider",
        metadata: { webhook_id: webhookId },
      }),
    });

    // Process webhook (base implementation — providers override)
    // In a real implementation, this would call the provider's processWebhook method
    const processedPayload = {
      processed_at: new Date().toISOString(),
      event_type: (payload as Record<string, unknown>)?.event_type ?? "unknown",
      message_id: (payload as Record<string, unknown>)?.message_id ?? null,
    };

    // Mark as processed
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
