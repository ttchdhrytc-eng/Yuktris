import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
        JSON.stringify({ healthy: false, error: "Missing workspaceId." }),
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
        JSON.stringify({ healthy: false, health: "error", error: "Workspace not initialized." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the linked Google account
    const { data: account } = await supabase
      .from("google_accounts")
      .select("*")
      .eq("id", wsRecord.google_account_id)
      .maybeSingle();

    if (!account) {
      // Update health to error
      await supabase
        .from("google_workspace")
        .update({ connection_health: "error", last_health_check: new Date().toISOString() })
        .eq("id", wsRecord.id);

      return new Response(
        JSON.stringify({ healthy: false, health: "error", error: "No Google account linked." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load the token
    const { data: token } = await supabase
      .from("oauth_tokens")
      .select("*")
      .eq("google_account_id", account.id)
      .maybeSingle();

    const now = new Date();
    const isExpired = token?.expires_at ? new Date(token.expires_at) < now : !token;
    const needsReconnect = account.status === "disconnected" || account.status === "revoked" || (!token?.refresh_token && isExpired);

    // Determine health
    let health: string = "healthy";
    const errors: string[] = [];

    if (needsReconnect) {
      health = "error";
      errors.push("Account needs reconnection.");
    } else if (isExpired) {
      health = "expired";
      errors.push("Access token has expired.");
    }

    // Parse granted scopes and detect services
    const grantedScopes = (token?.scope ?? "").split(" ").filter(Boolean);
    const scopeSet = new Set(grantedScopes);

    const SERVICES = [
      { id: "gmail", scopes: ["https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/gmail.send"] },
      { id: "calendar", scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"] },
      { id: "meet", scopes: ["https://www.googleapis.com/auth/calendar", "https://www.googleapis.com/auth/calendar.events"] },
      { id: "contacts", scopes: ["https://www.googleapis.com/auth/contacts.readonly"] },
      { id: "drive", scopes: ["https://www.googleapis.com/auth/drive.readonly"] },
    ];

    const services: Record<string, boolean> = {};
    for (const svc of SERVICES) {
      services[svc.id] = svc.scopes.every((s) => scopeSet.has(s));
    }

    if (health === "healthy" && Object.values(services).some((v) => !v)) {
      health = "degraded";
    }

    // Persist health check
    await supabase
      .from("google_workspace")
      .update({
        connection_health: health,
        last_health_check: now.toISOString(),
      })
      .eq("id", wsRecord.id);

    // Sync permissions
    const allScopes = SERVICES.flatMap((s) => s.scopes);
    for (const scope of allScopes) {
      const isGranted = scopeSet.has(scope);
      const { data: existingPerm } = await supabase
        .from("google_permissions")
        .select("id")
        .eq("google_workspace_id", wsRecord.id)
        .eq("scope", scope)
        .maybeSingle();

      if (existingPerm) {
        await supabase
          .from("google_permissions")
          .update({ granted: isGranted, last_checked: now.toISOString() })
          .eq("id", existingPerm.id);
      } else {
        await supabase
          .from("google_permissions")
          .insert({
            google_workspace_id: wsRecord.id,
            scope,
            granted: isGranted,
            last_checked: now.toISOString(),
          });
      }
    }

    return new Response(
      JSON.stringify({
        healthy: health === "healthy",
        health,
        services,
        tokenExpired: isExpired,
        tokenExpiresAt: token?.expires_at ?? null,
        lastCheckedAt: now.toISOString(),
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed.";
    return new Response(
      JSON.stringify({ healthy: false, health: "error", error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
