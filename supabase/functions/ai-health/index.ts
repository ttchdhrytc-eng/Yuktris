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

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    // Check health of all providers
    const providers = [
      { id: "openai", name: "OpenAI", hasKey: !!OPENAI_API_KEY },
      { id: "anthropic", name: "Anthropic Claude", hasKey: false },
      { id: "gemini", name: "Google Gemini", hasKey: false },
      { id: "grok", name: "xAI Grok", hasKey: false },
      { id: "openrouter", name: "OpenRouter", hasKey: false },
      { id: "mistral", name: "Mistral AI", hasKey: false },
      { id: "deepseek", name: "DeepSeek", hasKey: false },
    ];

    const results = [];

    for (const provider of providers) {
      const now = new Date().toISOString();

      if (provider.id === "openai" && provider.hasKey) {
        // Do a lightweight models list call to check connectivity
        const start = Date.now();
        try {
          const resp = await fetch("https://api.openai.com/v1/models", {
            headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
            signal: AbortSignal.timeout(5000),
          });
          const latency = Date.now() - start;

          results.push({
            provider: provider.id,
            name: provider.name,
            healthy: resp.ok,
            status: resp.ok ? "healthy" : "degraded",
            latency_ms: latency,
            last_checked_at: now,
            error: resp.ok ? null : `HTTP ${resp.status}`,
          });
        } catch (err) {
          results.push({
            provider: provider.id,
            name: provider.name,
            healthy: false,
            status: "down",
            latency_ms: null,
            last_checked_at: now,
            error: err instanceof Error ? err.message : "Connection failed",
          });
        }
      } else if (provider.id === "openai" && !provider.hasKey) {
        results.push({
          provider: provider.id,
          name: provider.name,
          healthy: false,
          status: "degraded",
          latency_ms: null,
          last_checked_at: now,
          error: "No API key configured.",
        });
      } else {
        results.push({
          provider: provider.id,
          name: provider.name,
          healthy: false,
          status: "unknown",
          latency_ms: null,
          last_checked_at: now,
          error: "Provider not yet implemented.",
        });
      }
    }

    // Also return model count from DB
    const { data: models } = await supabase
      .from("ai_models")
      .select("id")
      .eq("status", "active");

    return new Response(
      JSON.stringify({
        providers: results,
        total_models: models?.length ?? 0,
        checked_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Health check failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
