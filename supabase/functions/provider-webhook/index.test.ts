// Behavioral tests for provider-webhook: auth, cross-workspace isolation, idempotency.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hmacSha256Hex } from "../_shared/webhookSecurity.ts";

const SUPABASE_URL = "https://stub.supabase.co";
const SERVICE_KEY = "stub-service-role-key";
Deno.env.set("SUPABASE_URL", SUPABASE_URL);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", SERVICE_KEY);

const { handleProviderWebhook } = await import("./index.ts");

interface MockConnection {
  id: string;
  workspace_id: string;
  provider_id: string;
  provider_key: string;
  credentials: { webhook_secret?: string };
  status: string;
}

function installFetchMock(connection: MockConnection | null, opts: { existingExternalEventId?: string } = {}) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    calls.push({ url, init });

    if (url.includes("/rest/v1/provider_connections")) {
      return new Response(JSON.stringify(connection ? [connection] : []), { status: 200 });
    }
    if (url.includes("/rest/v1/provider_webhooks") && (!init || init.method === undefined || init.method === "GET")) {
      const existing = opts.existingExternalEventId
        ? [{ id: "existing-webhook-id", is_processed: true }]
        : [];
      return new Response(JSON.stringify(existing), { status: 200 });
    }
    if (url.includes("/rest/v1/provider_webhooks") && init?.method === "POST") {
      return new Response(JSON.stringify([{ id: "new-webhook-id" }]), { status: 201 });
    }
    if (url.includes("/rest/v1/provider_webhooks") && init?.method === "PATCH") {
      return new Response(JSON.stringify([{}]), { status: 200 });
    }
    if (url.includes("/rest/v1/provider_events")) {
      return new Response(JSON.stringify([{}]), { status: 201 });
    }
    return new Response("{}", { status: 200 });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = original; } };
}

Deno.test("provider-webhook: rejects missing signature (fail closed)", async () => {
  const mock = installFetchMock({
    id: "conn-1", workspace_id: "ws-real", provider_id: "prov-1",
    provider_key: "slack", credentials: { webhook_secret: "sekret" }, status: "connected",
  });
  try {
    const req = new Request(`https://x/provider-webhook?connection_id=conn-1`, {
      method: "POST", body: JSON.stringify({ workspace_id: "ws-attacker", payload: { event_id: "e1" } }),
    });
    const res = await handleProviderWebhook(req);
    assertEquals(res.status, 401);
  } finally {
    mock.restore();
  }
});

Deno.test("provider-webhook: rejects invalid signature", async () => {
  const mock = installFetchMock({
    id: "conn-1", workspace_id: "ws-real", provider_id: "prov-1",
    provider_key: "slack", credentials: { webhook_secret: "sekret" }, status: "connected",
  });
  try {
    const rawBody = JSON.stringify({ payload: { event_id: "e1" } });
    const req = new Request(`https://x/provider-webhook?connection_id=conn-1`, {
      method: "POST",
      headers: { "x-slack-signature": "v0=wrong", "x-slack-request-timestamp": String(Math.floor(Date.now() / 1000)) },
      body: rawBody,
    });
    const res = await handleProviderWebhook(req);
    assertEquals(res.status, 401);
  } finally {
    mock.restore();
  }
});

Deno.test("provider-webhook: accepts valid signature and derives workspace_id from connection, not body", async () => {
  const connection: MockConnection = {
    id: "conn-1", workspace_id: "ws-real-owner", provider_id: "prov-1",
    provider_key: "slack", credentials: { webhook_secret: "sekret" }, status: "connected",
  };
  const mock = installFetchMock(connection);
  try {
    const rawBody = JSON.stringify({ workspace_id: "ws-attacker-supplied", payload: { event_id: "e1" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const sig = `v0=${await hmacSha256Hex("sekret", `v0:${timestamp}:${rawBody}`)}`;
    const req = new Request(`https://x/provider-webhook?connection_id=conn-1`, {
      method: "POST",
      headers: { "x-slack-signature": sig, "x-slack-request-timestamp": timestamp },
      body: rawBody,
    });
    const res = await handleProviderWebhook(req);
    assertEquals(res.status, 200);

    const insertCall = mock.calls.find((c) => c.url.includes("/rest/v1/provider_webhooks") && c.init?.method === "POST");
    const insertedBody = JSON.parse(String(insertCall?.init?.body));
    // Cross-workspace injection prevention: stored workspace_id must be the connection's
    // real workspace, never the attacker-supplied body value.
    assertEquals(insertedBody.workspace_id, "ws-real-owner");
  } finally {
    mock.restore();
  }
});

Deno.test("provider-webhook: unknown connection_id is rejected without revealing existence", async () => {
  const mock = installFetchMock(null);
  try {
    const req = new Request(`https://x/provider-webhook?connection_id=does-not-exist`, {
      method: "POST", body: JSON.stringify({ payload: {} }),
    });
    const res = await handleProviderWebhook(req);
    assertEquals(res.status, 401);
  } finally {
    mock.restore();
  }
});

Deno.test("provider-webhook: duplicate external_event_id short-circuits without reprocessing", async () => {
  const connection: MockConnection = {
    id: "conn-1", workspace_id: "ws-real-owner", provider_id: "prov-1",
    provider_key: "whatsapp_business", credentials: { webhook_secret: "sekret" }, status: "connected",
  };
  const mock = installFetchMock(connection, { existingExternalEventId: "evt-dup" });
  try {
    const rawBody = JSON.stringify({ payload: { event_id: "evt-dup" } });
    const sig = `sha256=${await hmacSha256Hex("sekret", rawBody)}`;
    const req = new Request(`https://x/provider-webhook?connection_id=conn-1`, {
      method: "POST", headers: { "x-hub-signature-256": sig }, body: rawBody,
    });
    const res = await handleProviderWebhook(req);
    const json = await res.json();
    assertEquals(res.status, 200);
    assertEquals(json.duplicate, true);

    const insertCall = mock.calls.find((c) => c.url.includes("/rest/v1/provider_webhooks") && c.init?.method === "POST");
    assertEquals(insertCall, undefined);
  } finally {
    mock.restore();
  }
});
