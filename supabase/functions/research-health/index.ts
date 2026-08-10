import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";

async function checkFirecrawl(): Promise<{ healthy: boolean; latency_ms: number; error: string | null }> {
  const start = Date.now();
  if (!FIRECRAWL_API_KEY) {
    return { healthy: false, latency_ms: 0, error: "API key not configured" };
  }
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: "https://example.com", formats: ["markdown"], limit: 1 }),
    });
    return { healthy: response.ok, latency_ms: Date.now() - start, error: response.ok ? null : `HTTP ${response.status}` };
  } catch (err) {
    return { healthy: false, latency_ms: Date.now() - start, error: err.message };
  }
}

async function checkTavily(): Promise<{ healthy: boolean; latency_ms: number; error: string | null }> {
  const start = Date.now();
  if (!TAVILY_API_KEY) {
    return { healthy: false, latency_ms: 0, error: "API key not configured" };
  }
  try {
    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: TAVILY_API_KEY, query: "test", max_results: 1 }),
    });
    return { healthy: response.ok, latency_ms: Date.now() - start, error: response.ok ? null : `HTTP ${response.status}` };
  } catch (err) {
    return { healthy: false, latency_ms: Date.now() - start, error: err.message };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const [firecrawl, tavily] = await Promise.all([checkFirecrawl(), checkTavily()]);

    const providers = [
      {
        provider: "firecrawl",
        status: firecrawl.healthy ? "active" : (FIRECRAWL_API_KEY ? "degraded" : "inactive"),
        healthy: firecrawl.healthy,
        latency_ms: firecrawl.latency_ms,
        last_checked: new Date().toISOString(),
        error: firecrawl.error,
        capabilities: ["website_crawling", "company_research", "business_model_detection", "technology_stack_detection", "service_extraction", "content_analysis", "brand_messaging_analysis", "industry_classification"],
      },
      {
        provider: "tavily",
        status: tavily.healthy ? "active" : (TAVILY_API_KEY ? "degraded" : "inactive"),
        healthy: tavily.healthy,
        latency_ms: tavily.latency_ms,
        last_checked: new Date().toISOString(),
        error: tavily.error,
        capabilities: ["company_research", "business_model_detection", "icp_identification", "industry_classification", "competitive_positioning", "decision_maker_discovery", "buying_signal_detection", "growth_signal_detection", "hiring_signal_detection", "funding_detection", "social_presence_detection", "contact_information_discovery", "brand_messaging_analysis"],
      },
      {
        provider: "google",
        status: "inactive",
        healthy: false,
        latency_ms: null,
        last_checked: new Date().toISOString(),
        error: "Not implemented",
        capabilities: ["company_research", "industry_classification", "competitive_positioning", "social_presence_detection"],
      },
      {
        provider: "linkedin",
        status: "inactive",
        healthy: false,
        latency_ms: null,
        last_checked: new Date().toISOString(),
        error: "Not implemented",
        capabilities: ["company_research", "decision_maker_discovery", "social_presence_detection", "growth_signal_detection", "hiring_signal_detection"],
      },
      {
        provider: "schema",
        status: "inactive",
        healthy: false,
        latency_ms: null,
        last_checked: new Date().toISOString(),
        error: "Not implemented",
        capabilities: ["company_research", "service_extraction", "contact_information_discovery", "location_detection", "social_presence_detection"],
      },
      {
        provider: "technology",
        status: "inactive",
        healthy: false,
        latency_ms: null,
        last_checked: new Date().toISOString(),
        error: "Not implemented",
        capabilities: ["technology_stack_detection"],
      },
      {
        provider: "whois",
        status: "inactive",
        healthy: false,
        latency_ms: null,
        last_checked: new Date().toISOString(),
        error: "Not implemented",
        capabilities: ["company_research", "location_detection"],
      },
    ];

    const allHealthy = providers.filter((p) => p.status === "active").length;
    const totalProviders = providers.length;

    return new Response(
      JSON.stringify({
        healthy: allHealthy > 0,
        active_providers: allHealthy,
        total_providers: totalProviders,
        providers,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
