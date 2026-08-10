import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") ?? "";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") ?? "";

interface WorkerPayload {
  request_id: string;
  company_name: string;
  website: string | null;
  request_type: string;
  workspace_id: string | null;
}

interface ProviderResult {
  provider: string;
  success: boolean;
  data: Record<string, unknown>;
  confidence: number;
  latency_ms: number;
  error: string | null;
  source_url: string | null;
}

async function updateRequest(id: string, updates: Record<string, unknown>): Promise<void> {
  await fetch(`${SUPABASE_URL}/rest/v1/research_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(updates),
  });
}

async function firecrawlResearch(companyName: string, website: string | null): Promise<ProviderResult> {
  const start = Date.now();
  if (!FIRECRAWL_API_KEY) {
    return { provider: "firecrawl", success: false, data: {}, confidence: 0, latency_ms: 0, error: "API key not configured", source_url: null };
  }

  const targetUrl = website ?? `https://${companyName.toLowerCase().replace(/\s+/g, "")}.com`;

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url: targetUrl, formats: ["markdown"], onlyMainContent: true }),
    });

    if (!response.ok) {
      return { provider: "firecrawl", success: false, data: {}, confidence: 0, latency_ms: Date.now() - start, error: `HTTP ${response.status}`, source_url: targetUrl };
    }

    const json = await response.json();
    const data = json.data ?? json;

    return {
      provider: "firecrawl",
      success: true,
      data: {
        markdown: data.markdown ?? "",
        metadata: data.metadata ?? {},
        title: data.metadata?.title ?? "",
        description: data.metadata?.description ?? "",
      },
      confidence: 0.85,
      latency_ms: Date.now() - start,
      error: null,
      source_url: targetUrl,
    };
  } catch (err) {
    return { provider: "firecrawl", success: false, data: {}, confidence: 0, latency_ms: Date.now() - start, error: err.message, source_url: targetUrl };
  }
}

async function tavilyResearch(companyName: string, website: string | null, requestType: string): Promise<ProviderResult> {
  const start = Date.now();
  if (!TAVILY_API_KEY) {
    return { provider: "tavily", success: false, data: {}, confidence: 0, latency_ms: 0, error: "API key not configured", source_url: null };
  }

  const queries = [`${companyName} company overview business model`];
  if (requestType === "full_intelligence") {
    queries.push(`${companyName} hiring growth expansion funding`);
    queries.push(`${companyName} technology stack tools software`);
    queries.push(`${companyName} CEO CTO executives leadership team`);
    queries.push(`${companyName} competitors market position`);
  }

  try {
    const allResults: Record<string, unknown>[] = [];

    for (const query of queries) {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: TAVILY_API_KEY,
          query,
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) continue;

      const json = await response.json();
      if (json.answer) allResults.push({ type: "answer", content: json.answer, query });
      if (json.results) {
        for (const r of json.results) {
          allResults.push({ type: "result", ...r, query });
        }
      }
    }

    return {
      provider: "tavily",
      success: allResults.length > 0,
      data: { results: allResults },
      confidence: 0.8,
      latency_ms: Date.now() - start,
      error: allResults.length > 0 ? null : "No results",
      source_url: website,
    };
  } catch (err) {
    return { provider: "tavily", success: false, data: {}, confidence: 0, latency_ms: Date.now() - start, error: err.message, source_url: null };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: WorkerPayload = await req.json();

    await updateRequest(payload.request_id, { status: "in_progress" });

    // Run providers in parallel
    const [firecrawlResult, tavilyResult] = await Promise.all([
      firecrawlResearch(payload.company_name, payload.website),
      tavilyResearch(payload.company_name, payload.website, payload.request_type),
    ]);

    const results = [firecrawlResult, tavilyResult];
    const successful = results.filter((r) => r.success);

    if (successful.length === 0) {
      await updateRequest(payload.request_id, {
        status: "failed",
        error_message: "All providers failed",
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({ request_id: payload.request_id, status: "failed", error: "All providers failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await updateRequest(payload.request_id, { status: "aggregating" });

    // Merge results
    const merged: Record<string, unknown> = {};
    for (const result of successful) {
      for (const [key, value] of Object.entries(result.data)) {
        if (value === null || value === undefined) continue;
        if (key in merged) {
          if (Array.isArray(merged[key]) && Array.isArray(value)) {
            merged[key] = [...(merged[key] as unknown[]), ...value];
          } else if (typeof merged[key] === "string" && typeof value === "string") {
            merged[key] = (merged[key] as string).length >= value.length ? merged[key] : value;
          }
        } else {
          merged[key] = value;
        }
      }
    }

    // Calculate confidence
    const totalConfidence = successful.reduce((sum, r) => sum + r.confidence, 0) / successful.length;
    const providerBonus = Math.min(successful.length * 0.05, 0.15);
    const confidenceScore = Math.min(totalConfidence + providerBonus, 1.0);

    await updateRequest(payload.request_id, { status: "normalizing" });

    // Build intelligence record
    const intelligence: Record<string, unknown> = {
      workspace_id: payload.workspace_id,
      company_name: payload.company_name,
      website: payload.website,
      summary: (merged.description as string) ?? (merged.summary as string) ?? null,
      confidence_score: confidenceScore,
      last_updated: new Date().toISOString(),
    };

    // Extract from Tavily results
    const tavilyResults = (tavilyResult.data.results as Record<string, unknown>[]) ?? [];
    const answers = tavilyResults.filter((r) => r.type === "answer");
    if (answers.length > 0 && !intelligence.summary) {
      intelligence.summary = answers.map((a) => a.content as string).join(" ").slice(0, 2000);
    }

    // Persist intelligence
    const intelRes = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Prefer": "return=representation,upsert=company_name",
      },
      body: JSON.stringify(intelligence),
    });

    let intelligenceId: string | null = null;
    if (intelRes.ok) {
      const intelData = await intelRes.json();
      if (intelData && intelData.length > 0) {
        intelligenceId = intelData[0].id;
      }
    }

    // Persist sources
    if (intelligenceId) {
      const sources = successful.map((r) => ({
        company_intelligence_id: intelligenceId,
        provider: r.provider,
        source_url: r.source_url,
        confidence_score: r.confidence,
        retrieved_at: new Date().toISOString(),
      }));

      await fetch(`${SUPABASE_URL}/rest/v1/research_sources`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "apikey": SERVICE_ROLE_KEY,
        },
        body: JSON.stringify(sources),
      });
    }

    // Complete
    await updateRequest(payload.request_id, {
      status: "completed",
      confidence_score: confidenceScore,
      completed_at: new Date().toISOString(),
      result_summary: { intelligence_id: intelligenceId, providers_used: successful.map((r) => r.provider) },
    });

    return new Response(
      JSON.stringify({
        request_id: payload.request_id,
        status: "completed",
        intelligence_id: intelligenceId,
        confidence: confidenceScore,
        providers_used: successful.map((r) => r.provider),
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
