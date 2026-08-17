// Shared webhook authentication helpers: HMAC verification, constant-time compare, service-role gate.

export function timingSafeEqual(a: string, b: string): boolean {
  const bufA = new TextEncoder().encode(a);
  const bufB = new TextEncoder().encode(b);
  if (bufA.length !== bufB.length) return false;
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) diff |= bufA[i] ^ bufB[i];
  return diff === 0;
}

async function hmacKey(secret: string, hash: "SHA-256" | "SHA-1"): Promise<CryptoKey> {
  return await globalThis.crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash },
    false,
    ["sign"],
  );
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await hmacKey(secret, "SHA-256");
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Verifies request came from Yuktris's own trusted internal caller (service-role bearer). */
export function verifyServiceRoleBearer(req: Request): boolean {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!serviceKey) return false;
  const authorization = req.headers.get("Authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "");
  if (!bearer) return false;
  return timingSafeEqual(bearer, serviceKey);
}

export interface SignatureVerificationResult {
  valid: boolean;
  reason?: string;
}

const MAX_SKEW_SECONDS = 5 * 60;

/**
 * Verifies an inbound provider webhook signature.
 * Uses the provider's own documented scheme where one is well-known (Slack, Meta/WhatsApp).
 * Falls back to a generic HMAC-SHA256 signature (secret from the workspace's stored
 * connection credentials) for providers without a dedicated validator implemented yet.
 */
export async function verifyProviderSignature(
  providerKey: string,
  req: Request,
  rawBody: string,
  secret: string,
): Promise<SignatureVerificationResult> {
  if (!secret) return { valid: false, reason: "no_secret_configured" };

  switch (providerKey) {
    case "slack": {
      const signature = req.headers.get("x-slack-signature") || "";
      const timestamp = req.headers.get("x-slack-request-timestamp") || "";
      if (!signature || !timestamp) return { valid: false, reason: "missing_signature_headers" };
      const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
      if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) return { valid: false, reason: "timestamp_out_of_range" };
      const base = `v0:${timestamp}:${rawBody}`;
      const computed = `v0=${await hmacSha256Hex(secret, base)}`;
      return { valid: timingSafeEqual(computed, signature), reason: "slack_signature_mismatch" };
    }
    case "whatsapp_business": {
      const header = req.headers.get("x-hub-signature-256") || "";
      if (!header.startsWith("sha256=")) return { valid: false, reason: "missing_signature_header" };
      const provided = header.slice("sha256=".length);
      const computed = await hmacSha256Hex(secret, rawBody);
      return { valid: timingSafeEqual(computed, provided), reason: "whatsapp_signature_mismatch" };
    }
    default: {
      // Generic platform signature for providers without a dedicated inbound-webhook
      // signing scheme wired up yet (gmail, outlook, linkedin_messaging,
      // microsoft_teams, twilio_sms, custom). Uses the secret established when the
      // workspace connected the provider.
      const signature = req.headers.get("x-yuktris-webhook-signature") || "";
      const timestamp = req.headers.get("x-yuktris-webhook-timestamp") || "";
      if (!signature || !timestamp) return { valid: false, reason: "missing_signature_headers" };
      const skew = Math.abs(Date.now() / 1000 - Number(timestamp));
      if (!Number.isFinite(skew) || skew > MAX_SKEW_SECONDS) return { valid: false, reason: "timestamp_out_of_range" };
      const computed = await hmacSha256Hex(secret, `${timestamp}.${rawBody}`);
      return { valid: timingSafeEqual(computed, signature), reason: "signature_mismatch" };
    }
  }
}
