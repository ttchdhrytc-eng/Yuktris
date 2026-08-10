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
    const { query, asset_type, industry, service, category_id, status, approval_status, min_confidence, limit, workspace_id } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    let url = `${SUPABASE_URL}/rest/v1/proposal_assets?select=*&order=confidence_score.desc`;
    if (workspace_id) url += `&workspace_id=eq.${workspace_id}`;
    if (asset_type) url += `&asset_type=eq.${asset_type}`;
    if (industry) url += `&industry=eq.${encodeURIComponent(industry)}`;
    if (service) url += `&service=eq.${encodeURIComponent(service)}`;
    if (category_id) url += `&category_id=eq.${category_id}`;
    if (status) url += `&status=eq.${status}`;
    if (approval_status) url += `&approval_status=eq.${approval_status}`;
    if (min_confidence !== undefined) url += `&confidence_score=gte.${min_confidence}`;
    if (query) url += `&or=(title.ilike.*${encodeURIComponent(query)}*,content_text.ilike.*${encodeURIComponent(query)}*,description.ilike.*${encodeURIComponent(query)}*)`;
    url += `&limit=${limit ?? 50}`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    const results = (data ?? []).map((asset: Record<string, unknown>) => {
      let score = (asset.confidence_score as number) ?? 0.5;
      if (query) {
        const title = ((asset.title as string) ?? '').toLowerCase();
        const contentText = ((asset.content_text as string) ?? '').toLowerCase();
        const desc = ((asset.description as string) ?? '').toLowerCase();
        const q = query.toLowerCase();
        if (title.includes(q)) score += 0.4;
        if (contentText.includes(q)) score += 0.3;
        if (desc.includes(q)) score += 0.2;
      }
      return { asset, score: Math.min(score, 1.0) };
    });

    results.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    return new Response(JSON.stringify({ results, total: results.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
