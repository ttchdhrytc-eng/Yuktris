// paddle-webhook — Paddle webhook handler + checkout creation
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Paddle-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const isWebhook = url.pathname.includes("paddle-webhook") && req.headers.get("X-Paddle-Signature") !== null;

    // ── Webhook handler (POST with X-Paddle-Signature) ──────
    if (isWebhook && req.method === "POST") {
      return await handleWebhook(req, supabase);
    }

    // ── API actions (POST without signature) ────────────────
    if (req.method === "POST") {
      const body = await req.json();
      const { action } = body as Record<string, unknown>;

      switch (action) {
        case "create_checkout": return await createCheckout(body, supabase);
        case "sync_customer": return await syncCustomer(body, supabase);
        case "sync_subscription": return await syncSubscription(body, supabase);
        case "sync_transaction": return await syncTransaction(body, supabase);
        case "list_products": return await listProducts();
        default: return jsonError(`Unknown action: ${action}`, 400);
      }
    }

    return jsonError("Method not allowed", 405);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Paddle operation failed", 500);
  }
});

// ── Webhook Handler ──────────────────────────────────────────

async function handleWebhook(req: Request, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const signature = req.headers.get("X-Paddle-Signature") || "";
  const rawBody = await req.text();

  // Verify webhook signature
  const webhookSecret = Deno.env.get("PADDLE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return jsonError("PADDLE_WEBHOOK_SECRET not configured", 500);
  }

  // Paddle uses HMAC-SHA256 with the webhook secret
  // Format: "ts=timestamp;v1=signature"
  const isValid = await verifyPaddleSignature(signature, rawBody, webhookSecret);
  if (!isValid) {
    return jsonError("Invalid webhook signature", 401);
  }

  const event = JSON.parse(rawBody) as Record<string, unknown>;
  const eventType = event.event_type as string;
  const eventData = event.data as Record<string, unknown>;
  const eventId = event.event_id as string;

  if (!eventType || !eventId) {
    return jsonError("Missing event_type or event_id", 400);
  }

  // Idempotency check — prevent duplicate processing
  const { data: existing } = await supabase
    .from("billing_webhook_events")
    .select("id, processed")
    .eq("provider", "paddle")
    .eq("provider_event_id", eventId)
    .maybeSingle();

  if (existing) {
    return jsonResponse({ status: "duplicate", message: "Event already processed" });
  }

  // Store the webhook event
  const { data: webhookRecord, error: webhookError } = await supabase
    .from("billing_webhook_events")
    .insert({
      provider: "paddle",
      provider_event_id: eventId,
      event_type: eventType,
      event_data: event,
      processed: false,
    })
    .select("*")
    .maybeSingle();

  if (webhookError) {
    return jsonError(`Failed to store webhook: ${webhookError.message}`, 500);
  }

  // Process the event
  let processingError: string | null = null;
  try {
    await processPaddleEvent(eventType, eventData, supabase);
  } catch (e) {
    processingError = e instanceof Error ? e.message : "Processing failed";
  }

  // Mark as processed
  await supabase
    .from("billing_webhook_events")
    .update({
      processed: true,
      processed_at: new Date().toISOString(),
      error: processingError,
    })
    .eq("id", (webhookRecord as Record<string, string>).id);

  if (processingError) {
    return jsonError(`Processing error: ${processingError}`, 500);
  }

  return jsonResponse({ status: "processed", event_type: eventType });
}

// ── Paddle Signature Verification ────────────────────────────

async function verifyPaddleSignature(signature: string, body: string, secret: string): Promise<boolean> {
  try {
    // Paddle webhook signature format: "ts=TIMESTAMP;v1=HMAC"
    // The HMAC is computed as HMAC-SHA256(timestamp + ":" + body, secret)
    const parts = signature.split(";");
    let timestamp = "";
    let hmacValue = "";

    for (const part of parts) {
      const [key, value] = part.split("=");
      if (key === "ts") timestamp = value;
      if (key === "v1") hmacValue = value;
    }

    if (!timestamp || !hmacValue) return false;

    const keyBytes = new TextEncoder().encode(secret);
    const messageBytes = new TextEncoder().encode(timestamp + ":" + body);

    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
    );

    const computed = await globalThis.crypto.subtle.sign("HMAC", cryptoKey, messageBytes);
    const computedHex = Array.from(new Uint8Array(computed))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");

    return computedHex === hmacValue;
  } catch {
    return false;
  }
}

// ── Event Processing ──────────────────────────────────────────

async function processPaddleEvent(
  eventType: string,
  data: Record<string, unknown>,
  supabase: ReturnType<typeof createClient>
): Promise<void> {
  const workspaceId = (data.custom_data as Record<string, string> | undefined)?.workspace_id ?? null;

  switch (eventType) {
    // ── Transaction events ──
    case "transaction.created":
    case "transaction.ready":
    case "transaction.billed":
    case "transaction.paid":
    case "transaction.completed":
    case "transaction.payment_failed":
    case "transaction.canceled": {
      const txId = data.id as string;
      const customerId = data.customer_id as string;
      const status = (data.status as string) ?? "pending";
      const total = (data.total as string) ?? "0";
      const currency = (data.currency_code as string) ?? "USD";
      const invoiceId = data.invoice_id as string | undefined;

      await syncTransactionToDb(supabase, workspaceId, {
        id: txId, customer_id: customerId, status, total, currency, invoice_id: invoiceId,
      });
      break;
    }

    // ── Subscription events ──
    case "subscription.created":
    case "subscription.activated":
    case "subscription.updated":
    case "subscription.canceled":
    case "subscription.paused": {
      const subId = data.id as string;
      const customerId = data.customer_id as string;
      const status = (data.status as string) ?? "active";
      const priceId = (data.items as Array<Record<string, unknown>>)?.[0]?.price?.id as string | undefined;
      const billingPeriod = data.current_billing_period as Record<string, string> | undefined;

      await syncSubscriptionToDb(supabase, workspaceId, {
        id: subId, customer_id: customerId, status, price_id: priceId,
        current_period_start: billingPeriod?.starts_at,
        current_period_end: billingPeriod?.ends_at,
        canceled_at: (data.canceled_at as string) ?? null,
      });
      break;
    }

    // ── Customer events ──
    case "customer.created":
    case "customer.updated": {
      const customerId = data.id as string;
      const email = (data.email as string) ?? "";
      const name = data.name as string | undefined;
      const status = (data.status as string) ?? "active";

      await syncCustomerToDb(supabase, workspaceId, {
        id: customerId, email, name, status,
      });
      break;
    }

    // ── Refund/adjustment events ──
    case "adjustment.created":
    case "adjustment.updated": {
      // Handle refund/credit adjustments
      break;
    }

    default:
      // Unknown event type — store but don't process
      break;
  }
}

// ── Sync Helpers ──────────────────────────────────────────────

async function syncCustomerToDb(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string | null,
  customer: { id: string; email: string; name?: string; status: string }
): Promise<void> {
  if (!workspaceId) return;
  const { data: existing } = await supabase
    .from("billing_customers")
    .select("id")
    .eq("provider_customer_id", customer.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (existing) {
    await supabase.from("billing_customers").update({
      email: customer.email, name: customer.name ?? null, status: customer.status,
    }).eq("id", (existing as Record<string, string>).id);
  } else {
    await supabase.from("billing_customers").insert({
      workspace_id: workspaceId, provider: "paddle",
      provider_customer_id: customer.id, email: customer.email,
      name: customer.name ?? null, status: customer.status,
    });
  }
}

async function syncSubscriptionToDb(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string | null,
  sub: { id: string; customer_id: string; status: string; price_id?: string; current_period_start?: string; current_period_end?: string; canceled_at?: string | null }
): Promise<void> {
  if (!workspaceId) return;
  const { data: existing } = await supabase
    .from("billing_subscriptions")
    .select("id")
    .eq("provider_subscription_id", sub.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const subData = {
    provider: "paddle", provider_customer_id: sub.customer_id,
    provider_subscription_id: sub.id, status: sub.status,
    price_id: sub.price_id ?? null,
    current_period_start: sub.current_period_start ?? null,
    current_period_end: sub.current_period_end ?? null,
    canceled_at: sub.canceled_at ?? null,
  };

  if (existing) {
    await supabase.from("billing_subscriptions").update(subData).eq("id", (existing as Record<string, string>).id);
  } else {
    await supabase.from("billing_subscriptions").insert({ workspace_id: workspaceId, ...subData });
  }
}

async function syncTransactionToDb(
  supabase: ReturnType<typeof createClient>,
  workspaceId: string | null,
  tx: { id: string; customer_id: string; status: string; total: string; currency: string; invoice_id?: string }
): Promise<void> {
  if (!workspaceId) return;
  const { data: existing } = await supabase
    .from("billing_transactions")
    .select("id")
    .eq("provider_transaction_id", tx.id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  const txData = {
    provider: "paddle", provider_customer_id: tx.customer_id,
    provider_transaction_id: tx.id,
    amount_cents: Math.round(parseFloat(tx.total) * 100),
    currency: tx.currency, status: tx.status,
  };

  if (existing) {
    await supabase.from("billing_transactions").update(txData).eq("id", (existing as Record<string, string>).id);
  } else {
    await supabase.from("billing_transactions").insert({ workspace_id: workspaceId, ...txData });
  }

  if (tx.invoice_id) {
    const { data: invExisting } = await supabase
      .from("billing_invoices")
      .select("id")
      .eq("provider_invoice_id", tx.invoice_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (!invExisting) {
      await supabase.from("billing_invoices").insert({
        workspace_id: workspaceId, provider: "paddle",
        provider_customer_id: tx.customer_id, provider_invoice_id: tx.invoice_id,
        status: tx.status === "completed" || tx.status === "paid" ? "paid" : "open",
        total_cents: Math.round(parseFloat(tx.total) * 100), currency: tx.currency,
        paid_at: tx.status === "completed" || tx.status === "paid" ? new Date().toISOString() : null,
      });
    }
  }
}

// ── Checkout Creation ────────────────────────────────────────

async function createCheckout(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>): Promise<Response> {
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  const environment = Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox";
  const baseUrl = environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

  if (!apiKey) {
    return jsonError("PADDLE_API_KEY not configured. Add it in Supabase secrets.", 500);
  }

  const workspaceId = body.workspace_id as string;
  const items = body.items as Array<{ price_id: string; quantity: number }>;
  const customer = body.customer as { email: string; name?: string } | undefined;

  if (!items || items.length === 0) {
    return jsonError("At least one item is required", 400);
  }

  try {
    const response = await fetch(`${baseUrl}/api/2.0/checkout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: items.map(i => ({ price_id: i.price_id, quantity: i.quantity })),
        customer: customer ? { email: customer.email, name: customer.name } : undefined,
        custom_data: { workspace_id: workspaceId },
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: "Checkout creation failed" }));
      return jsonError((err as Record<string, string>).error ?? `Paddle API error (${response.status})`, 502);
    }

    const data = await response.json() as Record<string, unknown>;
    return jsonResponse({ checkout_url: data.url ?? data.checkout_url ?? null, data });
  } catch (e) {
    return jsonError(`Checkout failed: ${e instanceof Error ? e.message : "Unknown error"}`, 500);
  }
}

// ── API Action Handlers ──────────────────────────────────────

async function syncCustomer(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>): Promise<Response> {
  await syncCustomerToDb(supabase, body.workspace_id as string, {
    id: body.id as string, email: body.email as string, name: body.name as string | undefined, status: body.status as string,
  });
  return jsonResponse({ status: "synced" });
}

async function syncSubscription(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>): Promise<Response> {
  await syncSubscriptionToDb(supabase, body.workspace_id as string, {
    id: body.id as string, customer_id: body.customer_id as string, status: body.status as string,
    price_id: body.price_id as string | undefined,
  });
  return jsonResponse({ status: "synced" });
}

async function syncTransaction(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>): Promise<Response> {
  await syncTransactionToDb(supabase, body.workspace_id as string, {
    id: body.id as string, customer_id: body.customer_id as string,
    status: body.status as string, total: body.total as string, currency: body.currency as string,
  });
  return jsonResponse({ status: "synced" });
}

async function listProducts(): Promise<Response> {
  const apiKey = Deno.env.get("PADDLE_API_KEY");
  const environment = Deno.env.get("PADDLE_ENVIRONMENT") || "sandbox";
  const baseUrl = environment === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

  if (!apiKey) {
    return jsonError("PADDLE_API_KEY not configured", 500);
  }

  try {
    const response = await fetch(`${baseUrl}/api/2.0/prices`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (!response.ok) {
      return jsonError(`Paddle API error (${response.status})`, 502);
    }
    const data = await response.json();
    return jsonResponse(data);
  } catch (e) {
    return jsonError(`Failed: ${e instanceof Error ? e.message : "Unknown"}`, 500);
  }
}

// ── Helpers ──────────────────────────────────────────────────

function jsonResponse(d: Record<string, unknown>): Response {
  return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonError(m: string, s: number): Response {
  return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
