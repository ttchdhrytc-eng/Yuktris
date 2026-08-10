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
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    let nodeQuery = "is_deleted=eq.false&select=*";
    let edgeQuery = "is_deleted=eq.false&select=*";
    if (workspaceId) {
      nodeQuery += `&workspace_id=eq.${workspaceId}`;
      edgeQuery += `&workspace_id=eq.${workspaceId}`;
    }

    const [nodesRes, edgesRes, deletedNodesRes, deletedEdgesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?${nodeQuery}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/graph_edges?${edgeQuery}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?is_deleted=eq.true&select=id${workspaceId ? `&workspace_id=eq.${workspaceId}` : ""}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/graph_edges?is_deleted=eq.true&select=id${workspaceId ? `&workspace_id=eq.${workspaceId}` : ""}`, { headers }),
    ]);

    const nodes = await nodesRes.json();
    const edges = await edgesRes.json();
    const deletedNodes = await deletedNodesRes.json();
    const deletedEdges = await deletedEdgesRes.json();

    // Find orphaned nodes (nodes with no edges)
    const connectedNodeIds = new Set<string>();
    for (const e of edges ?? []) {
      connectedNodeIds.add(e.source_node_id);
      connectedNodeIds.add(e.target_node_id);
    }
    const orphanedNodes = (nodes ?? []).filter((n: { id: string }) => !connectedNodeIds.has(n.id)).length;

    // Low confidence edges
    const lowConfidenceEdges = (edges ?? []).filter((e: { confidence_score: number }) => e.confidence_score < 0.5).length;

    // Average confidence
    const avgConfidence = (edges ?? []).length > 0
      ? (edges ?? []).reduce((sum: number, e: { confidence_score: number }) => sum + (e.confidence_score ?? 0), 0) / (edges ?? []).length
      : 0;

    const errors: string[] = [];
    if ((nodes ?? []).length === 0) errors.push("No nodes in graph");
    if (orphanedNodes > 0) errors.push(`${orphanedNodes} orphaned nodes`);

    return new Response(
      JSON.stringify({
        healthy: errors.length === 0 && (nodes ?? []).length > 0,
        total_nodes: (nodes ?? []).length,
        total_edges: (edges ?? []).length,
        orphaned_nodes: orphanedNodes,
        deleted_nodes: (deletedNodes ?? []).length,
        deleted_edges: (deletedEdges ?? []).length,
        low_confidence_edges: lowConfidenceEdges,
        average_confidence: avgConfidence,
        errors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
