import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function supabaseFetch(table: string, method: string, body?: unknown, query?: string) {
  const url = query
    ? `${SUPABASE_URL}/rest/v1/${table}?${query}`
    : `${SUPABASE_URL}/rest/v1/${table}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
    "apikey": SERVICE_ROLE_KEY,
  };
  if (method === "POST" || method === "PATCH") {
    headers["Prefer"] = "return=representation";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  return res;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { action, workspace_id, entities, relationships } = await req.json();

    if (action === "sync") {
      let nodesCreated = 0;
      let nodesUpdated = 0;
      let edgesCreated = 0;
      let edgesFailed = 0;

      // Sync entities (nodes)
      if (entities && entities.length > 0) {
        for (const entity of entities) {
          // Check for existing node by external_id
          let existingQuery = `node_type=eq.${entity.node_type}&is_deleted=eq.false`;
          if (entity.external_id) {
            existingQuery += `&external_id=eq.${encodeURIComponent(entity.external_id)}`;
          }
          if (workspace_id) {
            existingQuery += `&workspace_id=eq.${workspace_id}`;
          }

          const existingRes = await supabaseFetch("graph_nodes", "GET", undefined, `${existingQuery}&select=*&limit=1`);
          const existing = existingRes.ok ? await existingRes.json() : [];

          if (existing && existing.length > 0) {
            // Update existing node
            const mergedProperties = { ...existing[0].properties, ...entity.properties };
            await supabaseFetch("graph_nodes", "PATCH", {
              properties: mergedProperties,
              display_name: entity.display_name ?? existing[0].display_name,
              version: (existing[0].version ?? 0) + 1,
            }, `id=eq.${existing[0].id}`);
            nodesUpdated++;
          } else {
            // Create new node
            await supabaseFetch("graph_nodes", "POST", {
              workspace_id: workspace_id ?? null,
              node_type: entity.node_type,
              external_id: entity.external_id ?? null,
              display_name: entity.display_name,
              properties: entity.properties ?? {},
              confidence_score: entity.confidence_score ?? 0.8,
            });
            nodesCreated++;
          }
        }
      }

      // Sync relationships (edges)
      if (relationships && relationships.length > 0) {
        for (const rel of relationships) {
          // Resolve source node
          let sourceQuery = `node_type=eq.${rel.source_node_type}&external_id=eq.${encodeURIComponent(rel.source_external_id)}&is_deleted=eq.false&select=id`;
          if (workspace_id) sourceQuery += `&workspace_id=eq.${workspace_id}`;
          const sourceRes = await supabaseFetch("graph_nodes", "GET", undefined, sourceQuery);
          const sourceData = sourceRes.ok ? await sourceRes.json() : [];

          // Resolve target node
          let targetQuery = `node_type=eq.${rel.target_node_type}&external_id=eq.${encodeURIComponent(rel.target_external_id)}&is_deleted=eq.false&select=id`;
          if (workspace_id) targetQuery += `&workspace_id=eq.${workspace_id}`;
          const targetRes = await supabaseFetch("graph_nodes", "GET", undefined, targetQuery);
          const targetData = targetRes.ok ? await targetRes.json() : [];

          if (!sourceData?.length || !targetData?.length) {
            edgesFailed++;
            continue;
          }

          // Check if edge already exists
          const edgeQuery = `source_node_id=eq.${sourceData[0].id}&target_node_id=eq.${targetData[0].id}&relationship_type=eq.${rel.relationship_type}&is_deleted=eq.false&select=id`;
          const existingEdgeRes = await supabaseFetch("graph_edges", "GET", undefined, edgeQuery);
          const existingEdge = existingEdgeRes.ok ? await existingEdgeRes.json() : [];

          if (existingEdge && existingEdge.length > 0) {
            // Update existing edge
            await supabaseFetch("graph_edges", "PATCH", {
              properties: rel.properties ?? {},
              confidence_score: rel.confidence_score ?? 0.8,
              version: (existingEdge[0].version ?? 0) + 1,
            }, `id=eq.${existingEdge[0].id}`);
          } else {
            // Create new edge
            await supabaseFetch("graph_edges", "POST", {
              workspace_id: workspace_id ?? null,
              source_node_id: sourceData[0].id,
              target_node_id: targetData[0].id,
              relationship_type: rel.relationship_type,
              properties: rel.properties ?? {},
              confidence_score: rel.confidence_score ?? 0.8,
            });
            edgesCreated++;
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          nodes_created: nodesCreated,
          nodes_updated: nodesUpdated,
          edges_created: edgesCreated,
          edges_failed: edgesFailed,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
