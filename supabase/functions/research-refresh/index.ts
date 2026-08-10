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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { company_name, workspace_id } = await req.json();

    if (!company_name) {
      return new Response(
        JSON.stringify({ error: "company_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Invalidate cache by updating last_updated to epoch
    await fetch(
      `${SUPABASE_URL}/rest/v1/company_intelligence?company_name=ilike.${encodeURIComponent(company_name)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
          "apikey": SERVICE_ROLE_KEY,
        },
        body: JSON.stringify({ last_updated: "1970-01-01T00:00:00Z" }),
      }
    );

    // Create new research request
    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/research_requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        company_name: company_name.trim(),
        request_type: "refresh",
        status: "pending",
        providers_used: ["firecrawl", "tavily"],
      }),
    });

    const requestData = await createRes.json();
    const requestId = requestData[0].id;

    // Trigger worker
    await fetch(`${SUPABASE_URL}/functions/v1/research-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        request_id: requestId,
        company_name: company_name.trim(),
        website: null,
        request_type: "refresh",
        workspace_id: workspace_id ?? null,
      }),
    }).catch((err) => {
      console.error("[research-refresh] Failed to trigger worker:", err);
    });

    return new Response(
      JSON.stringify({
        request_id: requestId,
        status: "pending",
        message: "Research refresh queued.",
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
