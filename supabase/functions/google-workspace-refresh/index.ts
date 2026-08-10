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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { workspaceId } = body;

    if (!workspaceId) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Missing workspaceId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the workspace's google_workspace record
    const { data: wsRecord, error: wsError } = await supabase
      .from("google_workspace")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();

    if (wsError || !wsRecord) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Workspace not initialized." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the token for the linked Google account
    const { data: token, error: tokenError } = await supabase
      .from("oauth_tokens")
      .select("refresh_token")
      .eq("google_account_id", wsRecord.google_account_id)
      .maybeSingle();

    if (tokenError || !token?.refresh_token) {
      await supabase
        .from("google_workspace")
        .update({ connection_health: "error", last_health_check: new Date().toISOString() })
        .eq("id", wsRecord.id);

      return new Response(
        JSON.stringify({ refreshed: false, error: "No refresh token available." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creds = await getGoogleCredentials(supabase);
    if (!creds) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Google OAuth credentials not configured." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh the token at Google
    const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: creds.clientId,
        client_secret: creds.clientSecret,
        refresh_token: token.refresh_token,
        grant_type: "refresh_token",
      }),
    });

    if (!tokenResponse.ok) {
      const errData = await tokenResponse.json().catch(() => ({}));
      const message = errData.error_description || errData.error || "Token refresh failed.";

      await supabase
        .from("google_accounts")
        .update({ status: "expired" })
        .eq("id", wsRecord.google_account_id);

      await supabase
        .from("google_workspace")
        .update({ connection_health: "expired", last_health_check: new Date().toISOString() })
        .eq("id", wsRecord.id);

      return new Response(
        JSON.stringify({ refreshed: false, error: message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tokenData = await tokenResponse.json();
    const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

    // Update the token in the database
    await supabase
      .from("oauth_tokens")
      .update({
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        scope: tokenData.scope ?? null,
      })
      .eq("google_account_id", wsRecord.google_account_id);

    // Update the account status
    await supabase
      .from("google_accounts")
      .update({ status: "connected", last_synced_at: new Date().toISOString() })
      .eq("id", wsRecord.google_account_id);

    // Update workspace health to healthy
    await supabase
      .from("google_workspace")
      .update({ connection_health: "healthy", last_health_check: new Date().toISOString() })
      .eq("id", wsRecord.id);

    return new Response(
      JSON.stringify({ refreshed: true, expiresAt }),
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
