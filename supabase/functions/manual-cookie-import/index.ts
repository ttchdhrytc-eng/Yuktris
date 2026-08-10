import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SCRYPT_SALT = "linkedin-session-salt-v3";
const KEY_ID = "li-session-aes256-gcm-v3";

async function deriveKey(secret: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(SCRYPT_SALT), iterations: 100000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
}

function bufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function encrypt(plaintext: string, secret: string): Promise<string> {
  const key = await deriveKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return bufferToBase64(combined.buffer);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const encryptionSecret = Deno.env.get("LINKEDIN_SESSION_ENCRYPTION_KEY");

    if (!encryptionSecret) {
      return new Response(JSON.stringify({ error: "Server encryption key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's JWT for auth verification
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authError } = await userClient.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as {
      linkedinEmail: string;
      displayName?: string;
      cookiesJson: string;
      profileUrl?: string;
      profileName?: string;
      workspaceId: string;
    };

    if (!body.cookiesJson || !body.linkedinEmail || !body.workspaceId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate cookie JSON
    let cookies: unknown;
    try {
      cookies = JSON.parse(body.cookiesJson);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid cookie JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cookieArray = Array.isArray(cookies)
      ? cookies
      : (cookies as { cookies?: unknown[] }).cookies;

    if (!Array.isArray(cookieArray) || cookieArray.length === 0) {
      return new Response(JSON.stringify({ error: "No cookies found in JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const hasSessionCookie = (cookieArray as { name: string }[]).some(
      (c) => c.name === "li_at" || c.name === "li_s" || c.name === "bsession",
    );
    if (!hasSessionCookie) {
      return new Response(JSON.stringify({ error: "No LinkedIn session cookie (li_at) found" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role client for DB writes (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify workspace membership
    const { data: membership, error: memberError } = await adminClient
      .from("workspace_members")
      .select("workspace_id")
      .eq("workspace_id", body.workspaceId)
      .eq("user_id", userData.user.id)
      .maybeSingle();

    if (memberError || !membership) {
      return new Response(JSON.stringify({ error: "Not a member of this workspace" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create LinkedIn account
    const { data: account, error: insertError } = await adminClient
      .from("linkedin_accounts")
      .insert({
        workspace_id: body.workspaceId,
        account_name: body.displayName || body.linkedinEmail,
        linkedin_email: body.linkedinEmail,
        profile_url: body.profileUrl ?? null,
        profile_name: body.profileName ?? null,
        status: "active",
        session_status: "connected",
        connection_state: "connected",
      })
      .select("*")
      .maybeSingle();

    if (insertError || !account) {
      return new Response(JSON.stringify({ error: "Failed to create account" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Encrypt cookies using AES-256-GCM (same pipeline as worker)
    const cookiesEnc = await encrypt(body.cookiesJson, encryptionSecret);
    const storageEnc = await encrypt(JSON.stringify({ cookies: cookieArray }), encryptionSecret);
    const localEnc = await encrypt("{}", encryptionSecret);
    const sessionEnc = await encrypt("{}", encryptionSecret);

    // Save encrypted session via RPC
    const { data: sessionId, error: sessionError } = await adminClient.rpc("save_linkedin_session", {
      p_workspace_id: body.workspaceId,
      p_account_id: account.id,
      p_session_name: `manual-${account.id.slice(0, 8)}`,
      p_cookies_encrypted: cookiesEnc,
      p_storage_state_encrypted: storageEnc,
      p_local_storage_encrypted: localEnc,
      p_session_storage_encrypted: sessionEnc,
      p_encryption_key_id: KEY_ID,
      p_user_agent: null,
      p_viewport: null,
      p_browser_version: null,
      p_playwright_version: null,
      p_timezone: null,
      p_language: null,
      p_browserbase_session_id: null,
      p_browser_fingerprint: {},
    });

    if (sessionError || !sessionId) {
      // Cleanup account if session save failed
      await adminClient.from("linkedin_accounts").delete().eq("id", account.id);
      return new Response(JSON.stringify({ error: "Failed to save encrypted session" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log session event
    await adminClient.from("linkedin_session_events").insert({
      workspace_id: body.workspaceId,
      account_id: account.id,
      event_type: "login_success",
      event_data: { method: "manual_cookie_import", encrypted: true, key_id: KEY_ID },
    });

    return new Response(JSON.stringify({
      accountId: account.id,
      sessionId,
      message: "LinkedIn account connected. Session encrypted with AES-256-GCM.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
