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
    const { query, entity_type, entity_id, memory_type, min_confidence, min_importance, min_freshness, limit, workspace_id } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    let url = `${SUPABASE_URL}/rest/v1/memory_entities?is_active=eq.true&order=importance_score.desc`;
    if (workspace_id) url += `&workspace_id=eq.${workspace_id}`;
    if (entity_type) url += `&entity_type=eq.${entity_type}`;
    if (entity_id) url += `&entity_id=eq.${entity_id}`;
    if (memory_type) url += `&memory_type=eq.${memory_type}`;
    if (min_confidence !== undefined) url += `&confidence_score=gte.${min_confidence}`;
    if (min_importance !== undefined) url += `&importance_score=gte.${min_importance}`;
    if (min_freshness !== undefined) url += `&freshness_score=gte.${min_freshness}`;
    if (query) url += `&or=(title.ilike.*${encodeURIComponent(query)}*,summary.ilike.*${encodeURIComponent(query)}*)`;
    url += `&limit=${limit ?? 50}`;

    const res = await fetch(url, { headers });
    const data = await res.json();

    const results = (data ?? []).map((entity: Record<string, unknown>) => {
      let score = (entity.importance_score as number) * 0.4 + (entity.confidence_score as number) * 0.3 + (entity.freshness_score as number) * 0.3;
      if (query) {
        const titleLower = ((entity.title as string) ?? '').toLowerCase();
        const summaryLower = ((entity.summary as string) ?? '').toLowerCase();
        const queryLower = query.toLowerCase();
        if (titleLower.includes(queryLower)) score += 0.2;
        if (summaryLower.includes(queryLower)) score += 0.15;
      }
      return { entity, score: Math.min(score, 1.0) };
    });

    results.sort((a: { score: number }, b: { score: number }) => b.score - a.score);

    return new Response(JSON.stringify({
      results,
      total: results.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
