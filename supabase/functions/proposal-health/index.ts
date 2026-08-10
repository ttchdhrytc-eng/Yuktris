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
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Count projects
    let projectQuery = `${SUPABASE_URL}/rest/v1/proposal_projects?select=id,status`;
    if (workspaceId) projectQuery += `&workspace_id=eq.${workspaceId}`;
    const projectRes = await fetch(projectQuery, { headers });
    const projects = await projectRes.json();

    const totalProjects = (projects ?? []).length;
    const draftCount = (projects ?? []).filter((p: { status: string }) => p.status === 'draft').length;
    const inReviewCount = (projects ?? []).filter((p: { status: string }) => p.status === 'in_review').length;
    const approvedCount = (projects ?? []).filter((p: { status: string }) => p.status === 'approved').length;
    const rejectedCount = (projects ?? []).filter((p: { status: string }) => p.status === 'rejected').length;
    const sentCount = (projects ?? []).filter((p: { status: string }) => p.status === 'sent').length;

    // Count versions
    let versionQuery = `${SUPABASE_URL}/rest/v1/proposal_versions?select=id`;
    if (workspaceId) versionQuery += `&workspace_id=eq.${workspaceId}`;
    const versionRes = await fetch(versionQuery, { headers });
    const versions = await versionRes.json();

    // Count assets
    let assetQuery = `${SUPABASE_URL}/rest/v1/proposal_assets?select=id`;
    if (workspaceId) assetQuery += `&workspace_id=eq.${workspaceId}`;
    const assetRes = await fetch(assetQuery, { headers });
    const assets = await assetRes.json();

    // Count reviews
    let reviewQuery = `${SUPABASE_URL}/rest/v1/proposal_reviews?select=id`;
    if (workspaceId) reviewQuery += `&workspace_id=eq.${workspaceId}`;
    const reviewRes = await fetch(reviewQuery, { headers });
    const reviews = await reviewRes.json();

    // Count approvals
    let approvalQuery = `${SUPABASE_URL}/rest/v1/proposal_approvals?select=approval_status`;
    if (workspaceId) approvalQuery += `&workspace_id=eq.${workspaceId}`;
    const approvalRes = await fetch(approvalQuery, { headers });
    const approvals = await approvalRes.json();

    const errors: string[] = [];
    if (totalProjects === 0) errors.push("No proposal projects created");

    return new Response(JSON.stringify({
      healthy: errors.length === 0,
      total_projects: totalProjects,
      total_versions: (versions ?? []).length,
      draft_count: draftCount,
      in_review_count: inReviewCount,
      approved_count: approvedCount,
      sent_count: sentCount,
      rejected_count: rejectedCount,
      total_assets: (assets ?? []).length,
      total_reviews: (reviews ?? []).length,
      total_approvals: (approvals ?? []).length,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
