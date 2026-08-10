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
    const { version_id, review_status, review_notes, overall_score, reviewer_name, workspace_id } = await req.json();

    if (!version_id || !review_status) {
      return new Response(JSON.stringify({ error: "version_id and review_status are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Create review
    const reviewRes = await fetch(`${SUPABASE_URL}/rest/v1/proposal_reviews`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        proposal_version_id: version_id,
        reviewer_name: reviewer_name ?? null,
        review_status,
        review_notes: review_notes ?? null,
        overall_score: overall_score ?? 0,
      }),
    });
    const reviewData = await reviewRes.json();
    const reviewId = reviewData?.[0]?.id;

    // Update project status
    const versionRes = await fetch(`${SUPABASE_URL}/rest/v1/proposal_versions?id=eq.${version_id}&select=proposal_project_id`, { headers });
    const versionData = await versionRes.json();
    const projectId = versionData?.[0]?.proposal_project_id;

    if (projectId) {
      const projectStatus = review_status === 'approved' ? 'approved' : review_status === 'rejected' ? 'rejected' : 'in_review';
      await fetch(`${SUPABASE_URL}/rest/v1/proposal_projects?id=eq.${projectId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ status: projectStatus }),
      });
    }

    return new Response(JSON.stringify({
      review_id: reviewId,
      version_id,
      review_status,
      project_status_updated: !!projectId,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
