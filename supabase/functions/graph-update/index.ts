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
    const { action, workspace_id, node_id, edge_id, updates, node_type, external_id, display_name, properties, confidence_score, source_node_id, target_node_id, relationship_type, primary_node_id, duplicate_node_ids } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
      "Prefer": "return=representation",
    };

    if (action === "create_node") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          node_type,
          external_id: external_id ?? null,
          display_name,
          properties: properties ?? {},
          confidence_score: confidence_score ?? 1.0,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ node: data?.[0] ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_node" && node_id) {
      const updateBody: Record<string, unknown> = {};
      if (display_name !== undefined) updateBody.display_name = display_name;
      if (properties !== undefined) updateBody.properties = properties;
      if (confidence_score !== undefined) updateBody.confidence_score = confidence_score;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?id=eq.${node_id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(updateBody),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ node: data?.[0] ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_node" && node_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?id=eq.${node_id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_deleted: true }),
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create_edge") {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          source_node_id,
          target_node_id,
          relationship_type,
          properties: properties ?? {},
          confidence_score: confidence_score ?? 1.0,
        }),
      });
      const data = await res.json();
      return new Response(JSON.stringify({ edge: data?.[0] ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_edge" && edge_id) {
      await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?id=eq.${edge_id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ is_deleted: true }),
      });
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "merge_nodes" && primary_node_id && duplicate_node_ids) {
      let edgesRelocated = 0;
      let edgesMerged = 0;

      for (const dupId of duplicate_node_ids) {
        // Relocate outgoing edges
        const outRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?source_node_id=eq.${dupId}&is_deleted=eq.false&select=*`, { headers });
        const outgoing = await outRes.json();

        for (const edge of outgoing ?? []) {
          if (edge.target_node_id === primary_node_id) continue;

          const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?source_node_id=eq.${primary_node_id}&target_node_id=eq.${edge.target_node_id}&relationship_type=eq.${edge.relationship_type}&is_deleted=eq.false&select=id`, { headers });
          const existing = await existingRes.json();

          if (existing?.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?id=eq.${edge.id}`, { method: "PATCH", headers, body: JSON.stringify({ is_deleted: true }) });
            edgesMerged++;
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?id=eq.${edge.id}`, { method: "PATCH", headers, body: JSON.stringify({ source_node_id: primary_node_id }) });
            edgesRelocated++;
          }
        }

        // Relocate incoming edges
        const inRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?target_node_id=eq.${dupId}&is_deleted=eq.false&select=*`, { headers });
        const incoming = await inRes.json();

        for (const edge of incoming ?? []) {
          if (edge.source_node_id === primary_node_id) continue;

          const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?source_node_id=eq.${edge.source_node_id}&target_node_id=eq.${primary_node_id}&relationship_type=eq.${edge.relationship_type}&is_deleted=eq.false&select=id`, { headers });
          const existing = await existingRes.json();

          if (existing?.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?id=eq.${edge.id}`, { method: "PATCH", headers, body: JSON.stringify({ is_deleted: true }) });
            edgesMerged++;
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?id=eq.${edge.id}`, { method: "PATCH", headers, body: JSON.stringify({ target_node_id: primary_node_id }) });
            edgesRelocated++;
          }
        }

        // Soft delete duplicate
        await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?id=eq.${dupId}`, { method: "PATCH", headers, body: JSON.stringify({ is_deleted: true }) });
      }

      return new Response(JSON.stringify({
        merged_node_id: primary_node_id,
        absorbed_node_ids: duplicate_node_ids,
        edges_relocated: edgesRelocated,
        edges_merged: edgesMerged,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
