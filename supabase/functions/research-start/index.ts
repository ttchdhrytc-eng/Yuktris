import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { company_name, website, request_type, workspace_id } = await req.json();

    if (!company_name || company_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "company_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create research request record
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
        website: website ?? null,
        request_type: request_type ?? "full_intelligence",
        status: "pending",
        providers_used: ["firecrawl", "tavily"],
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      return new Response(
        JSON.stringify({ error: `Failed to create request: ${errBody}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData = await createRes.json();
    const requestId = requestData[0].id;

    // Trigger research-worker asynchronously via queue
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
        website: website ?? null,
        request_type: request_type ?? "full_intelligence",
        workspace_id: workspace_id ?? null,
      }),
    }).catch((err) => {
      console.error("[research-start] Failed to trigger worker:", err);
    });

    return new Response(
      JSON.stringify({
        request_id: requestId,
        status: "pending",
        message: "Research request created and queued for processing.",
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
