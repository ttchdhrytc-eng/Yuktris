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

    // Count assets
    let assetUrl = `${SUPABASE_URL}/rest/v1/proposal_assets?select=id,status,approval_status,usage_count,confidence_score`;
    if (workspaceId) assetUrl += `&workspace_id=eq.${workspaceId}`;
    const assetRes = await fetch(assetUrl, { headers });
    const assets = await assetRes.json();

    const totalAssets = (assets ?? []).length;
    const activeAssets = (assets ?? []).filter((a: { status: string }) => a.status === 'active').length;
    const pendingApproval = (assets ?? []).filter((a: { approval_status: string }) => a.approval_status === 'pending').length;
    const expiredAssets = (assets ?? []).filter((a: { status: string }) => a.status === 'expired').length;
    const avgConfidence = totalAssets > 0 ? (assets as { confidence_score: number }[]).reduce((s, a) => s + a.confidence_score, 0) / totalAssets : 0;

    // Count categories
    let catUrl = `${SUPABASE_URL}/rest/v1/asset_categories?select=id&is_active=eq.true`;
    if (workspaceId) catUrl += `&workspace_id=eq.${workspaceId}`;
    const catRes = await fetch(catUrl, { headers });
    const categories = await catRes.json();

    // Count tags
    let tagUrl = `${SUPABASE_URL}/rest/v1/asset_tags?select=id`;
    if (workspaceId) tagUrl += `&workspace_id=eq.${workspaceId}`;
    const tagRes = await fetch(tagUrl, { headers });
    const tags = await tagRes.json();

    // Count versions
    let verUrl = `${SUPABASE_URL}/rest/v1/asset_versions?select=id`;
    if (workspaceId) verUrl += `&workspace_id=eq.${workspaceId}`;
    const verRes = await fetch(verUrl, { headers });
    const versions = await verRes.json();

    // Count relationships
    let relUrl = `${SUPABASE_URL}/rest/v1/asset_relationships?select=id`;
    if (workspaceId) relUrl += `&workspace_id=eq.${workspaceId}`;
    const relRes = await fetch(relUrl, { headers });
    const relationships = await relRes.json();

    // Count usage
    let usageUrl = `${SUPABASE_URL}/rest/v1/asset_usage_history?select=id`;
    if (workspaceId) usageUrl += `&workspace_id=eq.${workspaceId}`;
    const usageRes = await fetch(usageUrl, { headers });
    const usage = await usageRes.json();

    // Ratings
    let ratingUrl = `${SUPABASE_URL}/rest/v1/asset_ratings?select=rating`;
    if (workspaceId) ratingUrl += `&workspace_id=eq.${workspaceId}`;
    const ratingRes = await fetch(ratingUrl, { headers });
    const ratings = await ratingRes.json();

    const avgRating = (ratings ?? []).length > 0
      ? (ratings as { rating: number }[]).reduce((s: number, r) => s + r.rating, 0) / ratings.length
      : 0;

    const errors: string[] = [];
    if (totalAssets === 0) errors.push("No assets in library");
    if (pendingApproval > 10) errors.push(`${pendingApproval} assets pending approval`);

    return new Response(JSON.stringify({
      healthy: errors.length === 0,
      total_assets: totalAssets,
      active_assets: activeAssets,
      pending_approval: pendingApproval,
      expired_assets: expiredAssets,
      total_categories: (categories ?? []).length,
      total_tags: (tags ?? []).length,
      total_versions: (versions ?? []).length,
      total_relationships: (relationships ?? []).length,
      total_usage_events: (usage ?? []).length,
      average_confidence: Math.round(avgConfidence * 100) / 100,
      average_rating: Math.round(avgRating * 100) / 100,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
