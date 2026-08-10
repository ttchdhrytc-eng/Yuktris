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
    const { workspace_id, snapshot_name, description } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Count current nodes and edges
    let nodeQuery = "is_deleted=eq.false&select=id";
    let edgeQuery = "is_deleted=eq.false&select=id";
    if (workspace_id) {
      nodeQuery += `&workspace_id=eq.${workspace_id}`;
      edgeQuery += `&workspace_id=eq.${workspace_id}`;
    }

    const [nodesRes, edgesRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?${nodeQuery}`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/graph_edges?${edgeQuery}`, { headers }),
    ]);

    const nodes = await nodesRes.json();
    const edges = await edgesRes.json();

    const nodeCount = (nodes ?? []).length;
    const edgeCount = (edges ?? []).length;

    // Create snapshot record
    const snapshotRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_snapshots`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        snapshot_name: snapshot_name ?? `Rebuild ${new Date().toISOString()}`,
        description: description ?? "Graph rebuild snapshot",
        node_count: nodeCount,
        edge_count: edgeCount,
      }),
    });

    const snapshotData = await snapshotRes.json();

    // Restore confidence scores for all edges (rebuild)
    const allEdgesRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?is_deleted=eq.false&select=id,confidence_score${workspace_id ? `&workspace_id=eq.${workspace_id}` : ""}`, { headers });
    const allEdges = await allEdgesRes.json();

    let edgesRebuilt = 0;
    for (const edge of allEdges ?? []) {
      // Reset confidence to 1.0 for rebuild
      await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?id=eq.${edge.id}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({ confidence_score: Math.max(edge.confidence_score ?? 0.5, 0.5) }),
      });
      edgesRebuilt++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        snapshot_id: snapshotData?.[0]?.id ?? null,
        node_count: nodeCount,
        edge_count: edgeCount,
        edges_rebuilt: edgesRebuilt,
        message: "Graph rebuild completed successfully.",
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
