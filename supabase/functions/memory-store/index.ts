import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function maskSensitive(content: Record<string, unknown>): Record<string, unknown> {
  const sensitive = ["password", "secret", "api_key", "token", "credential", "private_key"];
  const masked = { ...content };
  for (const key of Object.keys(masked)) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      masked[key] = "[REDACTED]";
    }
  }
  return masked;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { entity_type, entity_id, memory_type, title, summary, content, confidence_score, importance_score, workspace_id } = await req.json();

    if (!entity_type || !entity_id || !memory_type || !title) {
      return new Response(JSON.stringify({ error: "entity_type, entity_id, memory_type, and title are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const safeContent = maskSensitive(content ?? {});

    // Check for existing memory
    let existingQuery = `${SUPABASE_URL}/rest/v1/memory_entities?entity_type=eq.${entity_type}&entity_id=eq.${entity_id}&memory_type=eq.${memory_type}&is_active=eq.true&select=*`;
    if (workspace_id) existingQuery += `&workspace_id=eq.${workspace_id}`;
    const existingRes = await fetch(existingQuery, { headers });
    const existingData = await existingRes.json();

    let memoryId: string;
    let created: boolean;

    if (existingData && existingData.length > 0) {
      // Update existing
      const existing = existingData[0];
      const mergedContent = { ...existing.content, ...safeContent };
      const newConfidence = Math.min((existing.confidence_score + (confidence_score ?? 0.5)) / 2 + 0.05, 1.0);

      const updateRes = await fetch(`${SUPABASE_URL}/rest/v1/memory_entities?id=eq.${existing.id}`, {
        method: "PATCH",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({
          title: title !== existing.title ? title : existing.title,
          summary: summary ?? existing.summary,
          content: mergedContent,
          confidence_score: newConfidence,
          importance_score: Math.max(existing.importance_score, importance_score ?? 0.5),
          freshness_score: 1.0,
          version: existing.version + 1,
        }),
      });
      const updateData = await updateRes.json();
      memoryId = updateData?.[0]?.id ?? existing.id;
      created = false;
    } else {
      // Create new
      const createRes = await fetch(`${SUPABASE_URL}/rest/v1/memory_entities`, {
        method: "POST",
        headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          entity_type,
          entity_id,
          memory_type,
          title,
          summary: summary ?? null,
          content: safeContent,
          confidence_score: confidence_score ?? 0.5,
          importance_score: importance_score ?? 0.5,
        }),
      });
      const createData = await createRes.json();
      memoryId = createData?.[0]?.id;
      created = true;
    }

    // Create memory record for version history
    await fetch(`${SUPABASE_URL}/rest/v1/memory_records`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        memory_entity_id: memoryId,
        source: "memory_store",
        content: safeContent,
      }),
    });

    // Record learning event
    await fetch(`${SUPABASE_URL}/rest/v1/learning_events`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        event_type: created ? "memory_created" : "memory_updated",
        entity_type,
        entity_id,
        triggered_by: "memory_store",
        learning_summary: created ? `New memory created: ${title}` : `Memory updated: ${title}`,
        confidence: confidence_score ?? 0.5,
      }),
    });

    return new Response(JSON.stringify({
      memory_id: memoryId,
      created,
      message: created ? "Memory created successfully" : "Memory updated successfully",
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
