import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
const ENCRYPTION_VERSION = "linkedin-credentials-aes256-gcm-v1";

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function encryptionKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("LINKEDIN_CREDENTIAL_ENCRYPTION_KEY");
  if (!secret || secret.length < 32) throw new Error("Credential encryption is not configured");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, ["encrypt"]);
}

async function encrypt(value: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(value)));
  const packed = new Uint8Array(iv.length + encrypted.length);
  packed.set(iv); packed.set(encrypted, iv.length);
  return toBase64(packed);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);
  try {
    const body = await req.json() as Record<string, unknown>;
    const workspaceId = typeof body.workspace_id === "string" ? body.workspace_id : "";
    const { userId } = await authorizeLinkedInWorkspace(req, workspaceId);
    if (!userId) throw new Error("Unauthorized");

    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authorization = req.headers.get("Authorization") || "";
    const userClient = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (body.action === "delete") {
      const accountId = typeof body.account_id === "string" ? body.account_id : "";
      const { data, error } = await userClient.rpc("revoke_linkedin_credentials", { p_workspace_id: workspaceId, p_account_id: accountId });
      if (error) throw error;
      return jsonResponse({ credentials_configured: false, deleted: data === true });
    }

    const username = typeof body.username === "string" ? body.username.trim() : "";
    let password = typeof body.password === "string" ? body.password : "";
    if (!username || !password || username.length > 320 || password.length > 1024) return jsonError("LinkedIn sign-in details are required", 400);
    const key = await encryptionKey();
    const encryptedUsername = await encrypt(username, key);
    const encryptedPassword = await encrypt(password, key);
    password = "";
    const idempotencyKey = typeof body.idempotency_key === "string" ? body.idempotency_key : crypto.randomUUID();
    const existingAccountId = typeof body.existing_account_id === "string" ? body.existing_account_id : null;
    const { data, error } = await userClient.rpc("start_linkedin_connection_with_credentials", {
      p_workspace_id: workspaceId,
      p_encrypted_username: encryptedUsername,
      p_encrypted_password: encryptedPassword,
      p_encryption_version: ENCRYPTION_VERSION,
      p_linkedin_email: null,
      p_display_name: null,
      p_existing_account_id: existingAccountId,
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw error;
    const result = Array.isArray(data) ? data[0] : data;
    return jsonResponse({
      account_id: result?.account_id,
      queue_item_id: result?.queue_item_id,
      queue_status: result?.queue_status,
      reused: result?.reused === true,
      credentials_configured: true,
    });
  } catch (error) {
    const status = authorizationStatus(error);
    return jsonError(status === 500 ? "Unable to configure LinkedIn credentials" : (error as Error).message, status);
  }
});

function jsonResponse(value: Record<string, unknown>): Response {
  return new Response(JSON.stringify(value), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" } });
}
