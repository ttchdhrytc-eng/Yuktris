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
    const {
      query_type,
      workspace_id,
      node_id,
      source_node_id,
      target_node_id,
      node_type,
      relationship_type,
      max_depth,
      min_confidence,
      limit,
      search_query,
    } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    if (query_type === "entity" && node_id) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/graph_nodes?id=eq.${node_id}&select=*`,
        { headers }
      );
      const data = await res.json();
      return new Response(
        JSON.stringify({ node: data?.[0] ?? null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query_type === "relationships" && node_id) {
      // Get outgoing and incoming edges
      const [outRes, inRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/graph_edges?source_node_id=eq.${node_id}&is_deleted=eq.false&select=*`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/graph_edges?target_node_id=eq.${node_id}&is_deleted=eq.false&select=*`, { headers }),
      ]);

      const outgoing = await outRes.json();
      const incoming = await inRes.json();

      // Get connected nodes
      const nodeIds = new Set<string>();
      for (const e of [...(outgoing ?? []), ...(incoming ?? [])]) {
        nodeIds.add(e.source_node_id);
        nodeIds.add(e.target_node_id);
      }
      nodeIds.delete(node_id);

      let nodes: unknown[] = [];
      if (nodeIds.size > 0) {
        const nodesRes = await fetch(
          `${SUPABASE_URL}/rest/v1/graph_nodes?id=in.(${Array.from(nodeIds).join(",")})&is_deleted=eq.false&select=*`,
          { headers }
        );
        nodes = await nodesRes.json();
      }

      return new Response(
        JSON.stringify({ edges: [...(outgoing ?? []), ...(incoming ?? [])], nodes }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query_type === "neighborhood" && node_id) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/graph_neighborhood`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_start_node_id: node_id,
          p_max_depth: max_depth ?? 2,
          p_workspace_id: workspace_id ?? null,
        }),
      });
      const data = await res.json();
      return new Response(
        JSON.stringify({ neighborhood: data ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query_type === "shortest_path" && source_node_id && target_node_id) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/graph_shortest_path`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          p_source_node_id: source_node_id,
          p_target_node_id: target_node_id,
          p_max_depth: max_depth ?? 5,
          p_workspace_id: workspace_id ?? null,
        }),
      });
      const data = await res.json();
      return new Response(
        JSON.stringify({ path: data ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query_type === "search" && search_query) {
      let query = `is_deleted=eq.false&or=(display_name.ilike.*${encodeURIComponent(search_query)}*,external_id.ilike.*${encodeURIComponent(search_query)}*)&select=*&order=updated_at.desc`;
      if (node_type) query += `&node_type=eq.${node_type}`;
      if (limit) query += `&limit=${limit}`;
      else query += `&limit=50`;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?${query}`, { headers });
      const data = await res.json();
      return new Response(
        JSON.stringify({ nodes: data ?? [], total: data?.length ?? 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query_type === "by_type" && node_type) {
      let query = `node_type=eq.${node_type}&is_deleted=eq.false&select=*&order=updated_at.desc&limit=${limit ?? 100}`;
      if (workspace_id) query += `&workspace_id=eq.${workspace_id}`;

      const res = await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?${query}`, { headers });
      const data = await res.json();
      return new Response(
        JSON.stringify({ nodes: data ?? [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (query_type === "statistics") {
      const [nodesRes, edgesRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?is_deleted=eq.false&select=node_type,confidence_score${workspace_id ? `&workspace_id=eq.${workspace_id}` : ""}`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/graph_edges?is_deleted=eq.false&select=relationship_type,confidence_score${workspace_id ? `&workspace_id=eq.${workspace_id}` : ""}`, { headers }),
      ]);

      const nodes = await nodesRes.json();
      const edges = await edgesRes.json();

      const nodesByType: Record<string, number> = {};
      for (const n of nodes ?? []) nodesByType[n.node_type] = (nodesByType[n.node_type] ?? 0) + 1;

      const edgesByType: Record<string, number> = {};
      for (const e of edges ?? []) edgesByType[e.relationship_type] = (edgesByType[e.relationship_type] ?? 0) + 1;

      const avgConfidence = (edges ?? []).length > 0
        ? (edges ?? []).reduce((sum: number, e: { confidence_score?: number }) => sum + (e.confidence_score ?? 0), 0) / (edges ?? []).length
        : 0;

      const totalNodes = (nodes ?? []).length;
      const totalEdges = (edges ?? []).length;
      const maxPossible = totalNodes > 1 ? totalNodes * (totalNodes - 1) : 1;

      return new Response(
        JSON.stringify({
          total_nodes: totalNodes,
          total_edges: totalEdges,
          nodes_by_type: nodesByType,
          edges_by_type: edgesByType,
          graph_density: totalEdges > 0 ? Math.round((totalEdges / maxPossible) * 10000) / 10000 : 0,
          average_confidence: avgConfidence,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid query_type or missing parameters" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
