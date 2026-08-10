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
    const { primary_memory_id, duplicate_memory_ids, workspace_id } = await req.json();

    if (!primary_memory_id || !duplicate_memory_ids || !Array.isArray(duplicate_memory_ids)) {
      return new Response(JSON.stringify({ error: "primary_memory_id and duplicate_memory_ids are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Load primary
    const primaryRes = await fetch(`${SUPABASE_URL}/rest/v1/memory_entities?id=eq.${primary_memory_id}&select=*`, { headers });
    const primaryData = await primaryRes.json();
    if (!primaryData || primaryData.length === 0) {
      return new Response(JSON.stringify({ error: "Primary memory not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const primary = primaryData[0];

    let relationshipsRelocated = 0;

    for (const dupId of duplicate_memory_ids) {
      // Load duplicate
      const dupRes = await fetch(`${SUPABASE_URL}/rest/v1/memory_entities?id=eq.${dupId}&select=*`, { headers });
      const dupData = await dupRes.json();
      if (!dupData || dupData.length === 0) continue;
      const duplicate = dupData[0];

      // Merge content
      const mergedContent = { ...duplicate.content, ...primary.content };
      const newConfidence = Math.max(primary.confidence_score, duplicate.confidence_score);
      const newImportance = Math.max(primary.importance_score, duplicate.importance_score);

      await fetch(`${SUPABASE_URL}/rest/v1/memory_entities?id=eq.${primary_memory_id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({
          content: mergedContent,
          confidence_score: newConfidence,
          importance_score: newImportance,
          version: primary.version + 1,
        }),
      });

      // Relocate relationships — update source
      const sourceRelRes = await fetch(`${SUPABASE_URL}/rest/v1/memory_relationships?source_memory_id=eq.${dupId}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({ source_memory_id: primary_memory_id }),
      });
      const sourceRelData = await sourceRelRes.json();
      relationshipsRelocated += sourceRelData?.length ?? 0;

      // Relocate relationships — update target
      const targetRelRes = await fetch(`${SUPABASE_URL}/rest/v1/memory_relationships?target_memory_id=eq.${dupId}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({ target_memory_id: primary_memory_id }),
      });
      const targetRelData = await targetRelRes.json();
      relationshipsRelocated += targetRelData?.length ?? 0;

      // Deactivate duplicate
      await fetch(`${SUPABASE_URL}/rest/v1/memory_entities?id=eq.${dupId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_active: false }),
      });

      // Record learning event
      await fetch(`${SUPABASE_URL}/rest/v1/learning_events`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          event_type: "memory_merged",
          entity_type: primary.entity_type,
          entity_id: primary.entity_id,
          triggered_by: "memory_merge",
          learning_summary: `Merged duplicate memory "${duplicate.title}" into "${primary.title}"`,
          confidence: 0.9,
        }),
      });
    }

    return new Response(JSON.stringify({
      merged_memory_id: primary_memory_id,
      absorbed_memory_ids: duplicate_memory_ids,
      relationships_relocated: relationshipsRelocated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
