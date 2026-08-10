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
    const { context_type, entity_type, entity_id, workspace_id, token_budget, sources, exclude_sources } = await req.json();

    if (!context_type) {
      return new Response(JSON.stringify({ error: "context_type is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const start = Date.now();
    const maxTokens = token_budget ?? 8000;

    // 1. Check cache
    if (entity_type && entity_id) {
      const cacheKey = `context:${context_type}:${entity_type}:${entity_id}`;
      const cacheRes = await fetch(`${SUPABASE_URL}/rest/v1/context_cache?cache_key=eq.${encodeURIComponent(cacheKey)}&select=context,token_count,expires_at`, { headers });
      const cacheData = await cacheRes.json();
      if (cacheData && cacheData.length > 0) {
        const entry = cacheData[0];
        if (new Date(entry.expires_at).getTime() > Date.now()) {
          return new Response(JSON.stringify({
            context: entry.context,
            token_count: entry.token_count,
            cached: true,
            build_duration_ms: Date.now() - start,
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }

    // 2. Collect from sources
    const fragments: Record<string, unknown>[] = [];

    // Research Intelligence
    if (entity_id && (!sources || sources.includes("research_intelligence"))) {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${entity_id}&select=*`, { headers });
      const data = await res.json();
      if (data && data.length > 0) {
        fragments.push({
          source: "research_intelligence",
          source_label: "Research Intelligence",
          priority: "high",
          content: maskSensitive(data[0]),
          token_estimate: estimateTokens(data[0]),
          confidence: data[0].confidence_score ?? 0.7,
        });
      }
    }

    // Revenue Intelligence
    if (entity_id && (!sources || sources.includes("revenue_intelligence"))) {
      const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/revenue_profiles?company_id=eq.${entity_id}&select=*`, { headers });
      const profileData = await profileRes.json();
      if (profileData && profileData.length > 0) {
        const signalsRes = await fetch(`${SUPABASE_URL}/rest/v1/intelligence_signals?company_id=eq.${entity_id}&select=signal_type,signal_strength,confidence_score,description&order=detected_at.desc&limit=5`, { headers });
        const signalsData = await signalsRes.json();

        const recsRes = await fetch(`${SUPABASE_URL}/rest/v1/revenue_recommendations?company_id=eq.${entity_id}&select=recommendation_type,title,description,priority,status&order=created_at.desc&limit=5`, { headers });
        const recsData = await recsRes.json();

        const content = {
          ...profileData[0],
          signals: signalsData ?? [],
          recommendations: recsData ?? [],
        };
        fragments.push({
          source: "revenue_intelligence",
          source_label: "Revenue Intelligence",
          priority: "critical",
          content: maskSensitive(content),
          token_estimate: estimateTokens(content),
          confidence: 0.85,
        });
      }
    }

    // Knowledge Graph
    if (entity_id && (!sources || sources.includes("knowledge_graph"))) {
      const edgesRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_edges?or=(source_node_id.eq.${entity_id},target_node_id.eq.${entity_id})&is_deleted=eq.false&select=*`, { headers });
      const edgesData = await edgesRes.json();

      if (edgesData && edgesData.length > 0) {
        const nodeIds = new Set<string>();
        for (const e of edgesData) {
          nodeIds.add(e.source_node_id);
          nodeIds.add(e.target_node_id);
        }
        nodeIds.delete(entity_id);

        const nodesRes = await fetch(`${SUPABASE_URL}/rest/v1/graph_nodes?id=in.(${Array.from(nodeIds).join(",")})&is_deleted=eq.false&select=id,node_type,display_name,properties`, { headers });
        const nodesData = await nodesRes.json();

        const content = { connected_nodes: nodesData ?? [], relationships: edgesData ?? [] };
        fragments.push({
          source: "knowledge_graph",
          source_label: "Knowledge Graph",
          priority: "high",
          content,
          token_estimate: estimateTokens(content),
          confidence: 0.9,
        });
      }
    }

    // Company Profile
    if (workspace_id && (!sources || sources.includes("company_profile"))) {
      const wsRes = await fetch(`${SUPABASE_URL}/rest/v1/workspaces?id=eq.${workspace_id}&select=name,website,industry,country`, { headers });
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

    // 3. Sort by priority
    const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, minimal: 4 };
    fragments.sort((a, b) => (priorityOrder[a.priority as string] ?? 5) - (priorityOrder[b.priority as string] ?? 5));

    // 4. Allocate token budget
    let usedTokens = 0;
    const included: typeof fragments = [];
    for (const f of fragments) {
      if (usedTokens + (f.token_estimate as number) <= maxTokens) {
        included.push(f);
        usedTokens += f.token_estimate as number;
      }
    }

    // 5. Build assembled context
    const systemContext = {
      role: "Revenue AI Assistant",
      instructions: "You are a Revenue AI Assistant. Use the provided context to help with revenue-related tasks.",
      capabilities: ["Analyze company intelligence", "Score opportunities", "Detect buying signals", "Recommend next best actions"],
      limitations: ["Cannot access real-time data beyond provided context", "Read-only analysis"],
    };

    const assembledContext = {
      system: systemContext,
      metadata: {
        version: 1,
        token_count: usedTokens,
        source_count: included.length,
        sources_used: included.map((f) => f.source),
        compression_ratio: 1.0,
        quality_score: included.length > 0 ? included.reduce((s, f) => s + (f.confidence as number), 0) / included.length : 0,
        build_duration_ms: Date.now() - start,
        created_at: new Date().toISOString(),
      },
    };

    // 6. Create profile
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/context_profiles`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        context_name: `${context_type}:${entity_type ?? "unknown"}:${(entity_id ?? "").slice(0, 8)}`,
        context_type,
        entity_type: entity_type ?? null,
        entity_id: entity_id ?? null,
        version: 1,
        status: "active",
        token_count: usedTokens,
        source_count: included.length,
        compression_ratio: 1.0,
        quality_score: assembledContext.metadata.quality_score,
        build_duration_ms: Date.now() - start,
      }),
    });
    const profileData = await profileRes.json();
    const profileId = profileData?.[0]?.id;

    // 7. Create snapshot
    if (profileId) {
      await fetch(`${SUPABASE_URL}/rest/v1/context_snapshots`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          context_profile_id: profileId,
          snapshot_version: 1,
          assembled_context: assembledContext,
          token_count: usedTokens,
          source_contributions: included.map((f) => ({
            source: f.source,
            source_label: f.source_label,
            token_count: f.token_estimate,
            priority: f.priority,
            contribution_ratio: usedTokens > 0 ? (f.token_estimate as number) / usedTokens : 0,
          })),
        }),
      });
    }

    // 8. Cache
    if (entity_type && entity_id) {
      const cacheKey = `context:${context_type}:${entity_type}:${entity_id}`;
      await fetch(`${SUPABASE_URL}/rest/v1/context_cache?cache_key=eq.${encodeURIComponent(cacheKey)}`, { method: "DELETE", headers });
      await fetch(`${SUPABASE_URL}/rest/v1/context_cache`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          cache_key: cacheKey,
          entity_type,
          entity_id,
          context: assembledContext,
          token_count: usedTokens,
          expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        }),
      });
    }

    return new Response(JSON.stringify({
      context: assembledContext,
      profile_id: profileId,
      token_count: usedTokens,
      source_count: included.length,
      sources_used: included.map((f) => f.source),
      cached: false,
      build_duration_ms: Date.now() - start,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
