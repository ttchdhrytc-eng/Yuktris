// Behavioral tests for webhook signature verification and service-role gating.
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hmacSha256Hex, verifyProviderSignature, verifyServiceRoleBearer } from "./webhookSecurity.ts";

const SECRET = "test-connection-secret";

Deno.test("verifyProviderSignature: slack valid signature is accepted", async () => {
  const rawBody = JSON.stringify({ event_id: "evt_1" });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = `v0=${await hmacSha256Hex(SECRET, `v0:${timestamp}:${rawBody}`)}`;
  const req = new Request("https://example.com/provider-webhook", {
    method: "POST",
    headers: { "x-slack-signature": sig, "x-slack-request-timestamp": timestamp },
    body: rawBody,
  });
  const result = await verifyProviderSignature("slack", req, rawBody, SECRET);
  assertEquals(result.valid, true);
});

Deno.test("verifyProviderSignature: slack invalid signature is rejected", async () => {
  const rawBody = JSON.stringify({ event_id: "evt_1" });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const req = new Request("https://example.com/provider-webhook", {
    method: "POST",
    headers: { "x-slack-signature": "v0=deadbeef", "x-slack-request-timestamp": timestamp },
    body: rawBody,
  });
  const result = await verifyProviderSignature("slack", req, rawBody, SECRET);
  assertEquals(result.valid, false);
});

Deno.test("verifyProviderSignature: slack stale timestamp is rejected (replay protection)", async () => {
  const rawBody = JSON.stringify({ event_id: "evt_1" });
  const staleTimestamp = (Math.floor(Date.now() / 1000) - 3600).toString(); // 1 hour old
  const sig = `v0=${await hmacSha256Hex(SECRET, `v0:${staleTimestamp}:${rawBody}`)}`;
  const req = new Request("https://example.com/provider-webhook", {
    method: "POST",
    headers: { "x-slack-signature": sig, "x-slack-request-timestamp": staleTimestamp },
    body: rawBody,
  });
  const result = await verifyProviderSignature("slack", req, rawBody, SECRET);
  assertEquals(result.valid, false);
  assertEquals(result.reason, "timestamp_out_of_range");
});

Deno.test("verifyProviderSignature: missing signature headers are rejected", async () => {
  const rawBody = "{}";
  const req = new Request("https://example.com/provider-webhook", { method: "POST", body: rawBody });
  const result = await verifyProviderSignature("slack", req, rawBody, SECRET);
  assertEquals(result.valid, false);
  assertEquals(result.reason, "missing_signature_headers");
});

Deno.test("verifyProviderSignature: whatsapp/meta valid X-Hub-Signature-256 is accepted", async () => {
  const rawBody = JSON.stringify({ message_id: "wamid.1" });
  const sig = `sha256=${await hmacSha256Hex(SECRET, rawBody)}`;
  const req = new Request("https://example.com/provider-webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": sig },
    body: rawBody,
  });
  const result = await verifyProviderSignature("whatsapp_business", req, rawBody, SECRET);
  assertEquals(result.valid, true);
});

Deno.test("verifyProviderSignature: whatsapp/meta tampered body is rejected", async () => {
  const rawBody = JSON.stringify({ message_id: "wamid.1" });
  const sig = `sha256=${await hmacSha256Hex(SECRET, rawBody)}`;
  const tamperedBody = JSON.stringify({ message_id: "wamid.2" });
  const req = new Request("https://example.com/provider-webhook", {
    method: "POST",
    headers: { "x-hub-signature-256": sig },
    body: tamperedBody,
  });
  const result = await verifyProviderSignature("whatsapp_business", req, tamperedBody, SECRET);
  assertEquals(result.valid, false);
});

Deno.test("verifyProviderSignature: generic provider (e.g. gmail/custom) valid HMAC accepted", async () => {
  const rawBody = JSON.stringify({ event_id: "evt_9" });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const sig = await hmacSha256Hex(SECRET, `${timestamp}.${rawBody}`);
  const req = new Request("https://example.com/provider-webhook", {
    method: "POST",
    headers: { "x-yuktris-webhook-signature": sig, "x-yuktris-webhook-timestamp": timestamp },
    body: rawBody,
  });
  const result = await verifyProviderSignature("custom", req, rawBody, SECRET);
  assertEquals(result.valid, true);
});

Deno.test("verifyProviderSignature: empty secret always fails closed", async () => {
  const rawBody = "{}";
  const req = new Request("https://example.com/provider-webhook", { method: "POST", body: rawBody });
  const result = await verifyProviderSignature("slack", req, rawBody, "");
  assertEquals(result.valid, false);
  assertEquals(result.reason, "no_secret_configured");
});

Deno.test("verifyServiceRoleBearer: valid service-role bearer is accepted", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret-xyz");
  const req = new Request("https://example.com/webhook-receiver", {
    method: "POST",
    headers: { Authorization: "Bearer service-role-secret-xyz" },
  });
  assertEquals(verifyServiceRoleBearer(req), true);
});

Deno.test("verifyServiceRoleBearer: missing Authorization header is rejected", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret-xyz");
  const req = new Request("https://example.com/webhook-receiver", { method: "POST" });
  assertEquals(verifyServiceRoleBearer(req), false);
});

Deno.test("verifyServiceRoleBearer: wrong bearer token is rejected", () => {
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "service-role-secret-xyz");
  const req = new Request("https://example.com/webhook-receiver", {
    method: "POST",
    headers: { Authorization: "Bearer someone-elses-anon-key" },
  });
  assertEquals(verifyServiceRoleBearer(req), false);
});
