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
    const { version_id } = await req.json();

    if (!version_id) {
      return new Response(JSON.stringify({ error: "version_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const res = await fetch(`${SUPABASE_URL}/rest/v1/proposal_versions?id=eq.${version_id}&select=content,proposal_project_id`, { headers });
    const data = await res.json();

    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "Version not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content = data[0].content;
    const projectId = data[0].proposal_project_id;

    // Get company name
    const projRes = await fetch(`${SUPABASE_URL}/rest/v1/proposal_projects?id=eq.${projectId}&select=company_id`, { headers });
    const projData = await projRes.json();
    const companyId = projData?.[0]?.company_id;

    let companyName = "Unknown";
    if (companyId) {
      const compRes = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${companyId}&select=company_name`, { headers });
      const compData = await compRes.json();
      companyName = compData?.[0]?.company_name ?? "Unknown";
    }

    return new Response(JSON.stringify({
      version_id,
      company_name: companyName,
      content,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
