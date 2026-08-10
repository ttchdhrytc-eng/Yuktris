import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function estimateTokens(data: unknown): number {
  return Math.ceil(JSON.stringify(data).length / 4);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { context_type, entity_type, entity_id, workspace_id, token_budget } = await req.json();

    if (!context_type || !entity_id) {
      return new Response(JSON.stringify({ error: "context_type and entity_id are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const fragments: { source: string; source_label: string; priority: string; content: Record<string, unknown>; token_estimate: number; confidence: number }[] = [];

    // Collect from research
    if (entity_id) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${entity_id}&select=*`, { headers });
      const data = await res.json();
      if (data && data.length > 0) {
        fragments.push({
          source: "research_intelligence",
          source_label: "Research Intelligence",
          priority: "high",
          content: data[0],
          token_estimate: estimateTokens(data[0]),
          confidence: (data[0].confidence_score as number) ?? 0.7,
        });
      }

      // Revenue
      const revRes = await fetch(`${SUPABASE_URL}/rest/v1/revenue_profiles?company_id=eq.${entity_id}&select=*`, { headers });
      const revData = await revRes.json();
      if (revData && revData.length > 0) {
        fragments.push({
          source: "revenue_intelligence",
          source_label: "Revenue Intelligence",
          priority: "critical",
          content: revData[0],
          token_estimate: estimateTokens(revData[0]),
          confidence: 0.85,
        });
      }

      // Graph
      const edgesRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?or=(source_node_id.eq.${entity_id},target_node_id.eq.${entity_id})&is_deleted=eq.false&select=id,relationship_type,source_node_id,target_node_id,confidence_score`, { headers });
      const edgesData = await edgesRes.json();
      if (edgesData && edgesData.length > 0) {
        fragments.push({
          source: "knowledge_graph",
          source_label: "Knowledge Graph",
          priority: "high",
          content: { relationship_count: edgesData.length, relationships: edgesData },
          token_estimate: estimateTokens(edgesData),
          confidence: 0.9,
        });
      }
    }

    // Workspace
    if (workspace_id) {
      const wsRes = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspace_id}&select=name,website,industry`, { headers });
      const wsData = await wsRes.json();
      if (wsData && wsData.length > 0) {
        fragments.push({
          source: "company_profile",
          source_label: "Company Profile",
          priority: "medium",
          content: wsData[0],
          token_estimate: 50,
          confidence: 1.0,
        });
      }
    }

    const maxTokens = token_budget ?? 8000;
    let usedTokens = 0;
    const included: typeof fragments = [];
    for (const f of fragments) {
      if (usedTokens + f.token_estimate <= maxTokens) {
        included.push(f);
        usedTokens += f.token_estimate;
      }
    }

    return new Response(JSON.stringify({
      fragments: included.map((f) => ({
        source: f.source,
        source_label: f.source_label,
        priority: f.priority,
        token_estimate: f.token_estimate,
        confidence: f.confidence,
      })),
      total_fragments: fragments.length,
      included_fragments: included.length,
      total_tokens: usedTokens,
      token_budget: maxTokens,
      sources_used: included.map((f) => f.source),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
