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

    // Count entities
    let entityQuery = `${SUPABASE_URL}/rest/v1/memory_entities?select=id,is_active,confidence_score,freshness_score,importance_score`;
    if (workspaceId) entityQuery += `&workspace_id=eq.${workspaceId}`;
    const entityRes = await fetch(entityQuery, { headers });
    const entities = await entityRes.json();

    const totalMemories = (entities ?? []).length;
    const activeMemories = (entities ?? []).filter((e: { is_active: boolean }) => e.is_active).length;
    const expiredMemories = totalMemories - activeMemories;

    const avgConfidence = totalMemories > 0
      ? (entities as { confidence_score: number }[]).reduce((s, e) => s + (e.confidence_score ?? 0), 0) / totalMemories
      : 0;
    const avgFreshness = totalMemories > 0
      ? (entities as { freshness_score: number }[]).reduce((s, e) => s + (e.freshness_score ?? 0), 0) / totalMemories
      : 0;
    const avgImportance = totalMemories > 0
      ? (entities as { importance_score: number }[]).reduce((s, e) => s + (e.importance_score ?? 0), 0) / totalMemories
      : 0;

    // Count relationships
    let relQuery = `${SUPABASE_URL}/rest/v1/memory_relationships?select=id`;
    if (workspaceId) relQuery += `&workspace_id=eq.${workspaceId}`;
    const relRes = await fetch(relQuery, { headers });
    const relData = await relRes.json();

    // Count learning events
    let eventQuery = `${SUPABASE_URL}/rest/v1/learning_events?select=id&order=created_at.desc&limit=100`;
    if (workspaceId) eventQuery += `&workspace_id=eq.${workspaceId}`;
    const eventRes = await fetch(eventQuery, { headers });
    const eventData = await eventRes.json();

    const errors: string[] = [];
    if (totalMemories === 0) errors.push("No memories stored");
    if (avgFreshness < 0.3) errors.push("Average freshness is critically low");

    return new Response(JSON.stringify({
      healthy: errors.length === 0,
      total_memories: totalMemories,
      active_memories: activeMemories,
      expired_memories: expiredMemories,
      total_relationships: (relData ?? []).length,
      total_learning_events: (eventData ?? []).length,
      duplicate_count: 0,
      average_confidence: Math.round(avgConfidence * 100) / 100,
      average_freshness: Math.round(avgFreshness * 100) / 100,
      average_importance: Math.round(avgImportance * 100) / 100,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
