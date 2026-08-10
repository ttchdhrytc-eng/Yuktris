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
    const { workspace_id } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Load assets
    let assetUrl = `${SUPABASE_URL}/rest/v1/proposal_assets?select=*`;
    if (workspace_id) assetUrl += `&workspace_id=eq.${workspace_id}`;
    const assetRes = await fetch(assetUrl, { headers });
    const assets = await assetRes.json();

    const totalAssets = (assets ?? []).length;
    const activeAssets = (assets ?? []).filter((a: { status: string }) => a.status === 'active').length;
    const pendingApproval = (assets ?? []).filter((a: { approval_status: string }) => a.approval_status === 'pending').length;
    const expiredAssets = (assets ?? []).filter((a: { status: string }) => a.status === 'expired').length;
    const totalUsage = (assets ?? []).reduce((s: number, a: { usage_count: number }) => s + (a.usage_count ?? 0), 0);
    const avgConfidence = totalAssets > 0 ? (assets as { confidence_score: number }[]).reduce((s, a) => s + a.confidence_score, 0) / totalAssets : 0;
    const unused = (assets ?? []).filter((a: { usage_count: number }) => a.usage_count === 0).length;

    // Type distribution
    const typeDist: Record<string, number> = {};
    for (const a of (assets ?? [])) {
      typeDist[(a as { asset_type: string }).asset_type] = (typeDist[(a as { asset_type: string }).asset_type] ?? 0) + 1;
    }

    // Industry distribution
    const industryDist: Record<string, number> = {};
    for (const a of (assets ?? [])) {
      const ind = (a as { industry: string | null }).industry;
      if (ind) industryDist[ind] = (industryDist[ind] ?? 0) + 1;
    }

    // Most/least used
    const sorted = [...(assets ?? [])].sort((a: { usage_count: number }, b: { usage_count: number }) => b.usage_count - a.usage_count);
    const mostUsed = sorted.slice(0, 10).map((a: { id: string; title: string; usage_count: number; asset_type: string }) => ({
      id: a.id, title: a.title, usage_count: a.usage_count, asset_type: a.asset_type,
    }));
    const leastUsed = sorted.filter((a: { usage_count: number }) => a.usage_count > 0).slice(-10).reverse().map((a: { id: string; title: string; usage_count: number; asset_type: string }) => ({
      id: a.id, title: a.title, usage_count: a.usage_count, asset_type: a.asset_type,
    }));

    // Ratings
    let ratingUrl = `${SUPABASE_URL}/rest/v1/asset_ratings?select=asset_id,rating`;
    if (workspace_id) ratingUrl += `&workspace_id=eq.${workspace_id}`;
    const ratingRes = await fetch(ratingUrl, { headers });
    const ratings = await ratingRes.json();

    const avgRating = (ratings ?? []).length > 0
      ? (ratings as { rating: number }[]).reduce((s, r) => s + r.rating, 0) / ratings.length
      : 0;

    // Duplicate detection (simple title-based)
    const duplicates: { primary_id: string; duplicate_id: string; similarity: number }[] = [];
    for (let i = 0; i < (assets ?? []).length; i++) {
      for (let j = i + 1; j < (assets ?? []).length; j++) {
        const a = (assets as Record<string, string>[])[i];
        const b = (assets as Record<string, string>[])[j];
        if (a.asset_type !== b.asset_type) continue;
        const aTitle = (a.title ?? '').toLowerCase().split(/\s+/);
        const bTitle = (b.title ?? '').toLowerCase().split(/\s+/);
        const setA = new Set(aTitle);
        const setB = new Set(bTitle);
        const intersection = new Set([...setA].filter((x) => setB.has(x)));
        const union = new Set([...setA, ...setB]);
        const sim = union.size === 0 ? 0 : intersection.size / union.size;
        if (sim >= 0.7) {
          duplicates.push({ primary_id: a.id, duplicate_id: b.id, similarity: Math.round(sim * 100) / 100 });
        }
      }
    }

    return new Response(JSON.stringify({
      total_assets: totalAssets,
      active_assets: activeAssets,
      archived_assets: (assets ?? []).filter((a: { status: string }) => a.status === 'archived').length,
      expired_assets: expiredAssets,
      pending_approval: pendingApproval,
      approved_assets: (assets ?? []).filter((a: { approval_status: string }) => a.approval_status === 'approved').length,
      total_usage: totalUsage,
      average_confidence: Math.round(avgConfidence * 100) / 100,
      average_rating: Math.round(avgRating * 100) / 100,
      type_distribution: typeDist,
      industry_distribution: industryDist,
      most_used: mostUsed,
      least_used: leastUsed,
      top_rated: [],
      unused_assets: unused,
      duplicate_candidates: duplicates,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
