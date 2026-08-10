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
    const { integrationId } = body;

    if (!integrationId) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Missing integrationId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: record, error } = await supabase
      .from("integrations")
      .select("*")
      .eq("id", integrationId)
      .maybeSingle();

    if (error || !record) {
      return new Response(
        JSON.stringify({ refreshed: false, error: "Integration not found." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Provider-specific refresh logic
    // For OAuth providers, refresh via the provider's token endpoint
    // For API key providers, no refresh needed
    if (record.provider_type === "api_key") {
      await supabase.from("integration_logs").insert({
        integration_id: integrationId,
        event: "refresh",
        status: "success",
        message: "API key provider — no token refresh needed.",
      });

      return new Response(
        JSON.stringify({ refreshed: true, expires_at: null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For OAuth providers, check if we have refresh metadata
    const metadata = record.metadata ?? {};
    const refreshToken = (metadata as Record<string, unknown>).refresh_token as string | undefined;

    if (!refreshToken) {
      await supabase
        .from("integrations")
        .update({ connection_health: "expired" })
        .eq("id", integrationId);

      await supabase.from("integration_logs").insert({
        integration_id: integrationId,
        event: "refresh",
        status: "failure",
        message: "No refresh token available.",
      });

      return new Response(
        JSON.stringify({ refreshed: false, error: "No refresh token available. Reconnection required." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log that refresh was attempted
    await supabase.from("integration_logs").insert({
      integration_id: integrationId,
      event: "refresh",
      status: "info",
      message: "Token refresh requested. Provider-specific implementation required.",
    });

    return new Response(
      JSON.stringify({ refreshed: false, error: "Provider-specific refresh not yet implemented." }),
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
