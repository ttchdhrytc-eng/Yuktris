import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

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
    const { code, codeVerifier, redirectUri, workspaceId, userId, scopes } = body;

    if (!code || !codeVerifier || !redirectUri || !workspaceId || !userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const creds = await getGoogleCredentials(supabase);

    if (!creds) {
      return new Response(
        JSON.stringify({ success: false, error: "Google OAuth credentials not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        code,
        code_verifier: codeVerifier,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}));
      const message = errData.error_description || errData.error || "Token exchange failed.";
      return new Response(
        JSON.stringify({ success: false, error: message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();

    // Fetch user info from Google
    const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userInfoResponse.ok) {
      return new Response(
        JSON.stringify({ success: false, error: "Failed to fetch Google user info." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userInfo = await userInfoResponse.json();

    // Upsert google_accounts record
    const { data: existingAccount } = await supabase
      .from("google_accounts")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("google_user_id", userInfo.id)
      .maybeSingle();

    let accountId: string;
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

    if (existingAccount) {
      // Reconnect existing account
      accountId = existingAccount.id;
      await supabase
        .from("google_accounts")
        .update({
          status: "connected",
          email: userInfo.email,
          display_name: userInfo.name,
          avatar: userInfo.picture,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", accountId);

      // Preserve existing refresh_token if Google doesn't return a new one
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
          scope: tokenData.scope ?? scopes,
          token_type: tokenData.token_type ?? "Bearer",
        })
        .eq("google_account_id", accountId);
    } else {
      // Check if this is the first account (make it primary)
      const { data: existingAccounts } = await supabase
        .from("google_accounts")
        .select("id")
        .eq("workspace_id", workspaceId);

      const isPrimary = !existingAccounts || existingAccounts.length === 0;

      // Insert new account
      const { data: newAccount, error: accError } = await supabase
        .from("google_accounts")
        .insert({
          workspace_id: workspaceId,
          user_id: userId,
          google_user_id: userInfo.id,
          email: userInfo.email,
          display_name: userInfo.name,
          avatar: userInfo.picture,
          is_primary: isPrimary,
          status: "connected",
          connected_at: new Date().toISOString(),
          last_synced_at: new Date().toISOString(),
        })
        .select("id")
        .single();

      if (accError || !newAccount) {
        return new Response(
          JSON.stringify({ success: false, error: "Failed to create Google account record." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      accountId = newAccount.id;

      // Insert token
      await supabase.from("oauth_tokens").insert({
        google_account_id: accountId,
        provider: "google",
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token ?? null,
        expires_at: expiresAt,
        scope: tokenData.scope ?? scopes,
        token_type: tokenData.token_type ?? "Bearer",
      });
    }

    // Update integration_status for google
    await supabase
      .from("integration_status")
      .upsert({
        workspace_id: workspaceId,
        integration: "google",
        status: "connected",
        last_check: new Date().toISOString(),
        last_error: null,
        connected_account: accountId,
      }, { onConflict: "workspace_id,integration" });

    return new Response(
      JSON.stringify({ success: true, accountId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "OAuth callback failed.";
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
