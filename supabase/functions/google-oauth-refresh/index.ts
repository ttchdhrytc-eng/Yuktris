import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

async function getGoogleCredentials(supabase: { rpc: (fn: string, args: Record<string, string>) => Promise<{ data: string | null }> }): Promise<{ clientId: string; clientSecret: string } | null> {
  let clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  let clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }

  const { data: idData } = await supabase.rpc("get_google_secret", { secret_name: "GOOGLE_CLIENT_ID" });
  const { data: secretData } = await supabase.rpc("get_google_secret", { secret_name: "GOOGLE_CLIENT_SECRET" });

  clientId = idData ?? null;
  clientSecret = secretData ?? null;

  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { refreshToken, accountId } = body;

    if (!refreshToken || !accountId) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Missing refresh token or account ID." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const creds = await getGoogleCredentials(supabase);

    if (!creds) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Google OAuth credentials not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the token
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}));
      const message = errData.error_description || errData.error || "Token refresh failed.";

      // Distinguish between transient errors (rate limit) and permanent errors (invalid grant)
      const isInvalidGrant = errData.error === "invalid_grant";

      if (isInvalidGrant) {
        // Refresh token is permanently invalid — mark as revoked (needs manual reconnect)
        await supabase
          .from("google_accounts")
          .update({ status: "revoked" })
          .eq("id", accountId);
      } else {
        // Transient error (rate limit, network) — keep as expired so auto-recovery can retry
        await supabase
          .from("google_accounts")
          .update({ status: "expired" })
          .eq("id", accountId);
      }

      return new Response(
        JSON.stringify({ refreshed: false, error: message, needsReconnect: isInvalidGrant }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

    // Update token — preserve existing refresh_token if Google doesn't return a new one
    const { data: existingToken } = await supabase
      .from("oauth_tokens")
      .select("refresh_token")
      .eq("google_account_id", accountId)
      .maybeSingle();

    const newRefreshToken = tokenData.refresh_token ?? existingToken?.refresh_token ?? null;

    await supabase
      .from("oauth_tokens")
      .update({
        access_token: tokenData.access_token,
        refresh_token: newRefreshToken,
        expires_at: expiresAt,
        scope: tokenData.scope ?? null,
      })
      .eq("google_account_id", accountId);

    // Restore account status to connected (handles expired account recovery)
    await supabase
      .from("google_accounts")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("id", accountId);

    return new Response(
      JSON.stringify({ refreshed: true, expires_at: expiresAt }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Token refresh failed.";
    return new Response(
      JSON.stringify({ refreshed: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
