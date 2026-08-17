// Behavioral tests for webhook-receiver: internal-only auth gate + delivery idempotency.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = "https://stub.supabase.co";
const SERVICE_KEY = "stub-service-role-key";
Deno.env.set("SUPABASE_URL", SUPABASE_URL);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);

const { handleWebhookReceiver } = await import("./index.ts");

function installFetchMock(opts: { subs?: unknown[]; existingDeliveryIds?: string[] } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });

    if (url.includes("/rest/v1/webhook_subscriptions")) {
      return new Response(JSON.stringify(opts.subs ?? []), { status: 200 });
    }
    if (url.includes("/rest/v1/webhook_deliveries") && (!init?.method || init.method === "GET")) {
      const hasExisting = (opts.existingDeliveryIds ?? []).some((id) => url.includes(encodeURIComponent(id)));
      return new Response(JSON.stringify(hasExisting ? [{ id: "existing-delivery" }] : []), { status: 200 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test("webhook-receiver: rejects missing Authorization (fail closed)", async () => {
  const req = new Request("https://x/webhook-receiver", {
    method: "POST",
    body: JSON.stringify({ workspace_id: "ws-1", event_name: "meeting.booked" }),
  });
  const res = await handleWebhookReceiver(req);
  assertEquals(res.status, 401);
});

Deno.test("webhook-receiver: rejects invalid bearer token", async () => {
  const req = new Request("https://x/webhook-receiver", {
    method: "POST",
    headers: { Authorization: "Bearer not-the-service-key" },
    body: JSON.stringify({ workspace_id: "ws-1", event_name: "meeting.booked" }),
  });
  const res = await handleWebhookReceiver(req);
  assertEquals(res.status, 401);
});

Deno.test("webhook-receiver: accepts valid service-role bearer and queues matching subscription", async () => {
  const mock = installFetchMock({
    subs: [{ id: "sub-1", events: ["meeting.booked"] }],
  });
  try {
    const req = new Request("https://x/webhook-receiver", {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ workspace_id: "ws-1", event_name: "meeting.booked", event_payload: { foo: "bar" }, event_id: "evt-1" }),
    });
    const res = await handleWebhookReceiver(req);
    const json = await res.json();
    assertEquals(res.status, 200);
    assertEquals(json.queued, 1);
    assertEquals(json.duplicates, 0);
  } finally {
    mock.restore();
  }
});

Deno.test("webhook-receiver: repeated call with same event_id does not duplicate delivery", async () => {
  const mock = installFetchMock({
    subs: [{ id: "sub-1", events: ["meeting.booked"] }],
    existingDeliveryIds: ["evt-1"],
  });
  try {
    const req = new Request("https://x/webhook-receiver", {
      method: "POST",
      headers: { Authorization: `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ workspace_id: "ws-1", event_name: "meeting.booked", event_payload: {}, event_id: "evt-1" }),
    });
    const res = await handleWebhookReceiver(req);
    const json = await res.json();
    assertEquals(res.status, 200);
    assertEquals(json.queued, 0);
    assertEquals(json.duplicates, 1);

    const insertCall = mock.calls.find((c) => c.url.includes("/rest/v1/webhook_deliveries") && c.init?.method === "POST");
    assertEquals(insertCall, undefined);
  } finally {
    mock.restore();
  }
});
