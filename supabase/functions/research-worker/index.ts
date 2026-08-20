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
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY") ?? "";

interface WorkerPayload {
  request_id: string;
  company_name: string;
  website: string | null;
  request_type: string;
  workspace_id: string | null;
  business_analysis_id?: string | null;
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

type CompanyIntelligencePayload = {
  industry: string | null;
  sub_industry: string | null;
  business_model: string | null;
  company_size: string | null;
  locations: string[];
  summary: string | null;
  technology_stack: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  products: Array<Record<string, unknown>>;
  target_market: Array<Record<string, unknown>>;
  brand_positioning: string | null;
  seo_summary: Record<string, unknown>;
  social_profiles: Array<Record<string, unknown>>;
  contact_information: Record<string, unknown>;
  buying_signals: Array<Record<string, unknown>>;
  growth_signals: Array<Record<string, unknown>>;
  decision_makers: Array<Record<string, unknown>>;
  competitive_positioning: Record<string, unknown>;
};

function normalizeWebsite(website: string | null, companyName: string): string {
  const fallback = `https://${companyName.toLowerCase().replace(/[^a-z0-9]+/g, "")}.com`;
  const raw = (website ?? fallback).trim();
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw.replace(/^\/+/, "")}`;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

async function updateRequest(id: string, updates: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/research_requests?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    console.error("[research-worker] Failed to update research request:", response.status, await response.text());
  }
}

// -----------------------------------------------------------------------------
// Website research
// Firecrawl is primary. Jina Reader is a no-key fallback when Firecrawl fails.
// -----------------------------------------------------------------------------

async function firecrawlResearch(companyName: string, website: string | null): Promise<ProviderResult> {
  const start = Date.now();
  const targetUrl = normalizeWebsite(website, companyName);

  if (!FIRECRAWL_API_KEY) {
    return {
      provider: "firecrawl",
      success: false,
      data: {},
      confidence: 0,
      latency_ms: Date.now() - start,
      error: "Firecrawl API key not configured",
      source_url: targetUrl,
    };
  }

  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: targetUrl,
        formats: ["markdown"],
        onlyMainContent: true,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        provider: "firecrawl",
        success: false,
        data: {},
        confidence: 0,
        latency_ms: Date.now() - start,
        error: `Firecrawl HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
        source_url: targetUrl,
      };
    }

    const json = await response.json();
    const data = json.data ?? json;
    const markdown = typeof data.markdown === "string" ? data.markdown.trim() : "";

    if (!markdown) {
      return {
        provider: "firecrawl",
        success: false,
        data: {},
        confidence: 0,
        latency_ms: Date.now() - start,
        error: "Firecrawl returned no readable markdown",
        source_url: targetUrl,
      };
    }

    return {
      provider: "firecrawl",
      success: true,
      data: {
        markdown,
        metadata: data.metadata ?? {},
        title: data.metadata?.title ?? "",
        description: data.metadata?.description ?? "",
      },
      confidence: 0.9,
      latency_ms: Date.now() - start,
      error: null,
      source_url: targetUrl,
    };
  } catch (err) {
    return {
      provider: "firecrawl",
      success: false,
      data: {},
      confidence: 0,
      latency_ms: Date.now() - start,
      error: errorMessage(err),
      source_url: targetUrl,
    };
  }
}

async function jinaResearch(companyName: string, website: string | null): Promise<ProviderResult> {
  const start = Date.now();
  const targetUrl = normalizeWebsite(website, companyName);
  const readerUrl = `https://r.jina.ai/${targetUrl}`;

  try {
    const response = await fetch(readerUrl, {
      method: "GET",
      headers: {
        "Accept": "text/plain",
        "X-Return-Format": "markdown",
      },
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return {
        provider: "jina",
        success: false,
        data: {},
        confidence: 0,
        latency_ms: Date.now() - start,
        error: `Jina HTTP ${response.status}${body ? `: ${body.slice(0, 300)}` : ""}`,
        source_url: targetUrl,
      };
    }

    const markdown = (await response.text()).trim();
    if (!markdown) {
      return {
        provider: "jina",
        success: false,
        data: {},
        confidence: 0,
        latency_ms: Date.now() - start,
        error: "Jina returned no readable content",
        source_url: targetUrl,
      };
    }

    return {
      provider: "jina",
      success: true,
      data: { markdown },
      confidence: 0.82,
      latency_ms: Date.now() - start,
      error: null,
      source_url: targetUrl,
    };
  } catch (err) {
    return {
      provider: "jina",
      success: false,
      data: {},
      confidence: 0,
      latency_ms: Date.now() - start,
      error: errorMessage(err),
      source_url: targetUrl,
    };
  }
}

async function websiteResearch(companyName: string, website: string | null): Promise<ProviderResult> {
  const firecrawl = await firecrawlResearch(companyName, website);
  if (firecrawl.success) return firecrawl;

  console.warn("[research-worker] Firecrawl failed; trying Jina Reader fallback:", firecrawl.error);
  const jina = await jinaResearch(companyName, website);
  if (jina.success) return jina;

  return {
    provider: "website",
    success: false,
    data: {},
    confidence: 0,
    latency_ms: firecrawl.latency_ms + jina.latency_ms,
    error: `Firecrawl failed (${firecrawl.error}); Jina failed (${jina.error})`,
    source_url: normalizeWebsite(website, companyName),
  };
}

// -----------------------------------------------------------------------------
// Tavily enrichment
// -----------------------------------------------------------------------------

async function tavilyResearch(
  companyName: string,
  website: string | null,
  requestType: string,
): Promise<ProviderResult> {
  const start = Date.now();

  if (!TAVILY_API_KEY) {
    return {
      provider: "tavily",
      success: false,
      data: {},
      confidence: 0,
      latency_ms: 0,
      error: "Tavily API key not configured",
      source_url: website,
    };
  }

  const domain = normalizeWebsite(website, companyName).replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const queries = [
    `${companyName} ${domain} company overview services products business model`,
  ];

  if (requestType === "full_intelligence") {
    queries.push(`${companyName} ${domain} customers target market`);
    queries.push(`${companyName} ${domain} technology stack`);
    queries.push(`${companyName} ${domain} leadership executives`);
    queries.push(`${companyName} ${domain} competitors market position`);
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

      if (Array.isArray(json.results)) {
        for (const result of json.results) {
          allResults.push({ type: "result", ...result, query });
        }
      }
    }

    return {
      provider: "tavily",
      success: allResults.length > 0,
      data: { results: allResults },
      confidence: allResults.length > 0 ? 0.8 : 0,
      latency_ms: Date.now() - start,
      error: allResults.length > 0 ? null : "No Tavily results",
      source_url: website,
    };
  } catch (err) {
    return {
      provider: "tavily",
      success: false,
      data: {},
      confidence: 0,
      latency_ms: Date.now() - start,
      error: errorMessage(err),
      source_url: website,
    };
  }
}

// -----------------------------------------------------------------------------
// OpenAI normalization
// Converts raw website + Tavily evidence into the company_intelligence shape
// already consumed by Yuktris' BusinessIntelligenceService.
// -----------------------------------------------------------------------------

function emptyIntelligence(summary: string | null): CompanyIntelligencePayload {
  return {
    industry: null,
    sub_industry: null,
    business_model: null,
    company_size: null,
    locations: [],
    summary,
    technology_stack: [],
    services: [],
    products: [],
    target_market: [],
    brand_positioning: null,
    seo_summary: {},
    social_profiles: [],
    contact_information: {},
    buying_signals: [],
    growth_signals: [],
    decision_makers: [],
    competitive_positioning: {},
  };
}

function safeArray(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value)
    ? value.filter((item) => item && typeof item === "object" && !Array.isArray(item)) as Array<Record<string, unknown>>
    : [];
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
}

function normalizeAIIntelligence(value: unknown, fallbackSummary: string | null): CompanyIntelligencePayload {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    industry: typeof raw.industry === "string" ? raw.industry : null,
    sub_industry: typeof raw.sub_industry === "string" ? raw.sub_industry : null,
    business_model: typeof raw.business_model === "string" ? raw.business_model : null,
    company_size: typeof raw.company_size === "string" ? raw.company_size : null,
    locations: safeStringArray(raw.locations),
    summary: typeof raw.summary === "string" && raw.summary.trim() ? raw.summary : fallbackSummary,
    technology_stack: safeArray(raw.technology_stack),
    services: safeArray(raw.services),
    products: safeArray(raw.products),
    target_market: safeArray(raw.target_market),
    brand_positioning: typeof raw.brand_positioning === "string" ? raw.brand_positioning : null,
    seo_summary: raw.seo_summary && typeof raw.seo_summary === "object" && !Array.isArray(raw.seo_summary)
      ? raw.seo_summary as Record<string, unknown>
      : {},
    social_profiles: safeArray(raw.social_profiles),
    contact_information: raw.contact_information && typeof raw.contact_information === "object" && !Array.isArray(raw.contact_information)
      ? raw.contact_information as Record<string, unknown>
      : {},
    buying_signals: safeArray(raw.buying_signals),
    growth_signals: safeArray(raw.growth_signals),
    decision_makers: safeArray(raw.decision_makers),
    competitive_positioning:
      raw.competitive_positioning &&
      typeof raw.competitive_positioning === "object" &&
      !Array.isArray(raw.competitive_positioning)
        ? raw.competitive_positioning as Record<string, unknown>
        : {},
  };
}

function buildEvidence(
  companyName: string,
  website: string | null,
  websiteResult: ProviderResult,
  tavilyResult: ProviderResult,
): string {
  const markdown = typeof websiteResult.data.markdown === "string"
    ? websiteResult.data.markdown
    : "";

  const description = typeof websiteResult.data.description === "string"
    ? websiteResult.data.description
    : "";

  const tavilyResults = Array.isArray(tavilyResult.data.results)
    ? tavilyResult.data.results as Record<string, unknown>[]
    : [];

  const tavilyText = tavilyResults
    .slice(0, 20)
    .map((item) => {
      const title = typeof item.title === "string" ? item.title : "";
      const content =
        typeof item.content === "string"
          ? item.content
          : typeof item.answer === "string"
            ? item.answer
            : typeof item.content === "number"
              ? String(item.content)
              : "";
      const url = typeof item.url === "string" ? item.url : "";
      return [title, content, url].filter(Boolean).join("\n");
    })
    .filter(Boolean)
    .join("\n\n");

  return [
    `Company: ${companyName}`,
    `Website: ${website ?? ""}`,
    description ? `Website metadata description:\n${description}` : "",
    markdown ? `Website content:\n${markdown.slice(0, 24000)}` : "",
    tavilyText ? `External research:\n${tavilyText.slice(0, 14000)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function analyzeCompany(
  companyName: string,
  website: string | null,
  websiteResult: ProviderResult,
  tavilyResult: ProviderResult,
): Promise<CompanyIntelligencePayload> {
  const websiteDescription =
    typeof websiteResult.data.description === "string" && websiteResult.data.description.trim()
      ? websiteResult.data.description.trim()
      : null;

  if (!OPENAI_API_KEY) {
    console.warn("[research-worker] OPENAI_API_KEY missing; storing raw research without AI normalization");
    return emptyIntelligence(websiteDescription);
  }

  const evidence = buildEvidence(companyName, website, websiteResult, tavilyResult);

  const systemPrompt = [
    "You are Yuktris' company intelligence analyst.",
    "Analyze only the supplied evidence. Do not invent facts that are not supported.",
    "Return one valid JSON object and no markdown.",
    "Use null or [] when evidence is insufficient.",
    "Keep array items as objects so downstream systems can use them.",
  ].join(" ");

  const userPrompt = `Analyze this company evidence and return JSON with exactly these top-level keys:

{
  "industry": string|null,
  "sub_industry": string|null,
  "business_model": string|null,
  "company_size": string|null,
  "locations": string[],
  "summary": string|null,
  "technology_stack": [{"name": string, "evidence": string}],
  "services": [{"name": string, "description": string}],
  "products": [{"name": string, "description": string}],
  "target_market": [{"segment": string, "industry": string, "company_size": string, "location": string}],
  "brand_positioning": string|null,
  "seo_summary": {"title": string, "description": string, "keywords": string[]},
  "social_profiles": [{"platform": string, "url": string}],
  "contact_information": {"email": string|null, "phone": string|null, "address": string|null},
  "buying_signals": [{"signal": string, "description": string}],
  "growth_signals": [{"signal": string, "description": string}],
  "decision_makers": [{"name": string, "title": string}],
  "competitive_positioning": {
    "positioning": string|null,
    "direct_competitors": [{"name": string, "reason": string}],
    "strengths": [{"description": string}],
    "weaknesses": [{"description": string}],
    "opportunities": [{"description": string}],
    "risks": [{"description": string}]
  }
}

Evidence:
${evidence}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      console.error("[research-worker] OpenAI normalization failed:", response.status, await response.text());
      return emptyIntelligence(websiteDescription);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(content);

    return normalizeAIIntelligence(parsed, websiteDescription);
  } catch (err) {
    console.error("[research-worker] OpenAI normalization error:", errorMessage(err));
    return emptyIntelligence(websiteDescription);
  }
}

async function persistSources(intelligenceId: string, results: ProviderResult[]): Promise<void> {
  const sources = results
    .filter((result) => result.success)
    .map((result) => ({
      company_intelligence_id: intelligenceId,
      provider: result.provider,
      source_url: result.source_url,
      confidence_score: result.confidence,
      retrieved_at: new Date().toISOString(),
    }));

  if (sources.length === 0) return;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/research_sources`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    },
    body: JSON.stringify(sources),
  });

  // Older schemas may not yet allow "jina" in the provider constraint.
  // Source logging must not make onboarding fail.
  if (!response.ok) {
    console.warn("[research-worker] Could not persist one or more research_sources:", response.status, await response.text());
  }
}

let activePayload: WorkerPayload | null = null;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const payload: WorkerPayload = await req.json();
    activePayload = payload;

    if (!payload.request_id || !payload.company_name) {
      return new Response(
        JSON.stringify({ error: "request_id and company_name are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await updateRequest(payload.request_id, { status: "in_progress" });

    // Firecrawl primary with Jina fallback, while Tavily enriches in parallel.
    const [websiteResult, tavilyResult] = await Promise.all([
      websiteResearch(payload.company_name, payload.website),
      tavilyResearch(payload.company_name, payload.website, payload.request_type),
    ]);

    const results = [websiteResult, tavilyResult];
    const successful = results.filter((result) => result.success);

    if (successful.length === 0) {
      const error = results
        .map((result) => `${result.provider}: ${result.error ?? "failed"}`)
        .join("; ");

      await updateRequest(payload.request_id, {
        status: "failed",
        error_message: error || "All providers failed",
        completed_at: new Date().toISOString(),
      });

      return new Response(
        JSON.stringify({
          request_id: payload.request_id,
          status: "failed",
          error: error || "All providers failed",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await updateRequest(payload.request_id, { status: "aggregating" });

    const totalConfidence =
      successful.reduce((sum, result) => sum + result.confidence, 0) / successful.length;
    const providerBonus = Math.min(successful.length * 0.05, 0.1);
    const confidenceScore = Math.min(totalConfidence + providerBonus, 1);

    await updateRequest(payload.request_id, { status: "normalizing" });

    const normalized = await analyzeCompany(
      payload.company_name,
      payload.website,
      websiteResult,
      tavilyResult,
    );

    const intelligence: Record<string, unknown> = {
      workspace_id: payload.workspace_id,
      company_name: payload.company_name,
      website: payload.website,
      ...normalized,
      confidence_score: confidenceScore,
      last_updated: new Date().toISOString(),
    };

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

    if (!intelRes.ok) {
      const body = await intelRes.text();
      throw new Error(`Failed to persist company intelligence (HTTP ${intelRes.status}): ${body}`);
    }

    const intelData = await intelRes.json();
    const intelligenceId =
      Array.isArray(intelData) && intelData.length > 0 && typeof intelData[0]?.id === "string"
        ? intelData[0].id
        : null;

    if (!intelligenceId) {
      throw new Error("Company intelligence was persisted but no intelligence id was returned");
    }

    await persistSources(intelligenceId, results);

    if (payload.business_analysis_id) {
      const serviceNames = (normalized.services ?? []).map((item) => String(item.name ?? item.title ?? item.description ?? "").trim()).filter(Boolean);
      const productNames = (normalized.products ?? []).map((item) => String(item.name ?? item.title ?? item.description ?? "").trim()).filter(Boolean);
      const targetAudience = (normalized.target_market ?? []).map((item) => String(item.name ?? item.segment ?? item.description ?? "").trim()).filter(Boolean).join("; ");
      const analysisRes = await fetch(`${SUPABASE_URL}/rest/v1/business_analysis?id=eq.${payload.business_analysis_id}&workspace_id=eq.${payload.workspace_id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json", Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({
          company_name: payload.company_name,
          website: payload.website,
          industry: normalized.industry,
          description: normalized.summary,
          business_model: normalized.business_model,
          products: productNames,
          services: serviceNames,
          target_audience: targetAudience,
          usp: normalized.brand_positioning,
          confidence_score: Math.round(confidenceScore * 100),
          analysis_status: "completed",
          completion_percentage: 100,
          error_message: null,
          updated_at: new Date().toISOString(),
        }),
      });
      if (!analysisRes.ok) throw new Error(`Failed to complete business analysis (HTTP ${analysisRes.status})`);
    }

    await updateRequest(payload.request_id, {
      status: "completed",
      confidence_score: confidenceScore,
      completed_at: new Date().toISOString(),
      result_summary: {
        intelligence_id: intelligenceId,
        providers_used: successful.map((result) => result.provider),
        website_provider: websiteResult.provider,
      },
    });

    return new Response(
      JSON.stringify({
        request_id: payload.request_id,
        status: "completed",
        intelligence_id: intelligenceId,
        confidence: confidenceScore,
        providers_used: successful.map((result) => result.provider),
        website_provider: websiteResult.provider,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const message = errorMessage(err);
    console.error("[research-worker]", message);

    try {
      if (activePayload?.request_id) {
        await updateRequest(activePayload.request_id, {
          status: "failed",
          error_message: message,
          completed_at: new Date().toISOString(),
        });
      }
    } catch {
      // Best-effort failure update only.
    } finally {
      activePayload = null;
    }

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
