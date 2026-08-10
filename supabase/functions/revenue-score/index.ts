import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function scoreCompany(company: Record<string, unknown>): Record<string, number> {
  const scores: Record<string, number> = {
    overall_score: 0,
    icp_score: 0.5,
    opportunity_score: 0.5,
    buying_intent_score: 0,
    growth_score: 0,
    technology_fit_score: 0,
    service_fit_score: 0,
    risk_score: 0,
    urgency_score: 0,
    relationship_score: 0.2,
    confidence_score: 0.5,
  };

  const buyingSignals = (company.buying_signals as Record<string, unknown>[]) ?? [];
  const growthSignals = (company.growth_signals as Record<string, unknown>[]) ?? [];
  const techStack = (company.technology_stack as Record<string, unknown>[]) ?? [];
  const services = (company.services as Record<string, unknown>[]) ?? [];
  const products = (company.products as Record<string, unknown>[]) ?? [];
  const decisionMakers = (company.decision_makers as Record<string, unknown>[]) ?? [];
  const socialProfiles = (company.social_profiles as Record<string, unknown>[]) ?? [];
  const competitors = ((company.competitive_positioning as Record<string, unknown>)?.competitors as string[]) ?? [];
  const confidenceScore = (company.confidence_score as number) ?? 0.5;

  // Buying intent
  const signalCount = buyingSignals.length;
  const avgSignalConfidence = buyingSignals.length > 0
    ? buyingSignals.reduce((s: number, sig: Record<string, unknown>) => s + ((sig.confidence as number) ?? 0), 0) / buyingSignals.length
    : 0;
  scores.buying_intent_score = Math.min((signalCount / 5) * 0.3 + avgSignalConfidence * 0.7, 1.0);

  // Growth
  const growthCount = growthSignals.length;
  const avgGrowthConfidence = growthSignals.length > 0
    ? growthSignals.reduce((s: number, sig: Record<string, unknown>) => s + ((sig.confidence as number) ?? 0), 0) / growthSignals.length
    : 0;
  scores.growth_score = Math.min((growthCount / 4) * 0.3 + avgGrowthConfidence * 0.5 + Math.min(techStack.length / 10, 1) * 0.2, 1.0);

  // Technology fit
  scores.technology_fit_score = Math.min(techStack.length / 15, 1.0) * 0.5 + Math.min(techStack.length > 0 ? 0.5 : 0, 1.0);

  // Service fit
  scores.service_fit_score = Math.min((services.length + products.length) / 10, 1.0) * 0.6 + (company.brand_positioning ? 0.4 : 0.1);

  // Risk
  let risk = (1 - confidenceScore) * 0.2;
  if (!company.website) risk += 0.15;
  if (decisionMakers.length === 0) risk += 0.2;
  risk += Math.min(competitors.length / 10, 0.3) * 0.2;
  if (socialProfiles.length === 0) risk += 0.1;
  if (!company.summary) risk += 0.1;
  scores.risk_score = Math.min(risk, 1.0);

  // Urgency
  const summary = ((company.summary as string) ?? "").toLowerCase();
  let urgency = 0;
  if (summary.includes("funding") || summary.includes("raised") || summary.includes("series")) urgency += 0.3;
  if (summary.includes("hiring") || summary.includes("expanding")) urgency += 0.2;
  urgency += scores.buying_intent_score * 0.3;
  urgency += Math.min(signalCount * 0.05, 0.2);
  scores.urgency_score = Math.min(urgency, 1.0);

  // Overall
  scores.overall_score = Math.round((
    scores.icp_score * 0.2 +
    scores.buying_intent_score * 0.2 +
    scores.growth_score * 0.15 +
    scores.technology_fit_score * 0.1 +
    scores.service_fit_score * 0.1 +
    (1 - scores.risk_score) * 0.1 +
    scores.relationship_score * 0.1 +
    scores.urgency_score * 0.05
  ) * 100) / 100;

  // Opportunity
  scores.opportunity_score = Math.round((
    scores.icp_score * 0.3 +
    scores.buying_intent_score * 0.35 +
    scores.growth_score * 0.2 +
    scores.technology_fit_score * 0.15
  ) * 100) / 100;

  // Confidence
  scores.confidence_score = Math.round((
    (buyingSignals.length > 0 ? 0.5 : 0.3) +
    (growthSignals.length > 0 ? 0.3 : 0.2) +
    confidenceScore * 0.2
  ) * 100) / 100;

  return scores;
}

function determinePriority(scores: Record<string, number>): string {
  const priorityScore = (
    scores.opportunity_score * 0.35 +
    scores.buying_intent_score * 0.25 +
    scores.icp_score * 0.2 +
    scores.growth_score * 0.1 +
    scores.urgency_score * 0.1
  ) * (1 - scores.risk_score * 0.3);

  if (priorityScore >= 0.75) return "critical";
  if (priorityScore >= 0.6) return "high";
  if (priorityScore >= 0.4) return "medium";
  if (priorityScore >= 0.2) return "low";
  return "none";
}

function determineRecommendedAction(scores: Record<string, number>, company: Record<string, unknown>): string {
  const dmCount = ((company.decision_makers as unknown[]) ?? []).length;
  const signalCount = ((company.buying_signals as unknown[]) ?? []).length;

  if (scores.overall_score >= 0.8 && dmCount > 0 && signalCount >= 2) return "Direct Outreach — Schedule Meeting";
  if (scores.buying_intent_score >= 0.7 && signalCount >= 3) return "Urgent Outreach — Capitalize on Buying Window";
  if (scores.icp_score >= 0.7 && dmCount === 0) return "Research Decision Makers";
  if (scores.growth_score >= 0.7 && scores.technology_fit_score >= 0.5) return "Growth-Focused Outreach";
  if (scores.risk_score >= 0.6) return "Additional Research Needed";
  if (scores.overall_score >= 0.4) return "Add to Nurture Sequence";
  return "Monitor for Changes";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { company_id, workspace_id } = await req.json();

    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // Load company intelligence
    const companyRes = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${company_id}&select=*`, { headers });
    const companyData = await companyRes.json();
    if (!companyData || companyData.length === 0) {
      return new Response(JSON.stringify({ error: "Company intelligence not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const company = companyData[0];
    const start = Date.now();

    // Score
    const scores = scoreCompany(company);
    const priority = determinePriority(scores);
    const recommendedAction = determineRecommendedAction(scores, company);

    // Persist profile
    const profileRes = await fetch(`${SUPABASE_URL}/rest/v1/revenue_profiles`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation,upsert=company_id" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        company_id,
        ...scores,
        priority,
        recommended_action: recommendedAction,
        analysis_duration_ms: Date.now() - start,
        version: 1,
      }),
    });
    const profileData = await profileRes.json();
    const profileId = profileData?.[0]?.id;

    // Persist signals
    const signals: Record<string, unknown>[] = [];
    for (const sig of (company.buying_signals as Record<string, unknown>[]) ?? []) {
      signals.push({
        workspace_id: workspace_id ?? null,
        company_id,
        signal_type: "buying_intent",
        signal_strength: (sig.confidence as number) ?? 0.5,
        confidence_score: (sig.confidence as number) ?? 0.5,
        source: "research_intelligence",
        description: sig.description ?? null,
      });
    }
    for (const sig of (company.growth_signals as Record<string, unknown>[]) ?? []) {
      signals.push({
        workspace_id: workspace_id ?? null,
        company_id,
        signal_type: "growth",
        signal_strength: (sig.confidence as number) ?? 0.5,
        confidence_score: (sig.confidence as number) ?? 0.5,
        source: "research_intelligence",
        description: sig.description ?? null,
      });
    }

    // Delete old signals
    await fetch(`${SUPABASE_URL}/rest/v1/intelligence_signals?company_id=eq.${company_id}`, { method: "DELETE", headers });

    if (signals.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/intelligence_signals`, {
        method: "POST",
        headers,
        body: JSON.stringify(signals),
      });
    }

    // Generate and persist recommendations
    const recommendations: Record<string, unknown>[] = [];
    recommendations.push({
      workspace_id: workspace_id ?? null,
      company_id,
      recommendation_type: "next_best_action",
      title: recommendedAction,
      description: `Overall score: ${Math.round(scores.overall_score * 100)}%, Priority: ${priority}`,
      priority: priority === "none" ? "low" : priority,
      status: "pending",
    });

    if (scores.buying_intent_score >= 0.6 && scores.icp_score >= 0.5) {
      recommendations.push({
        workspace_id: workspace_id ?? null,
        company_id,
        recommendation_type: "outreach",
        title: `Initiate outreach to ${company.company_name}`,
        description: `High buying intent (${Math.round(scores.buying_intent_score * 100)}%) with good ICP match.`,
        priority: "high",
        status: "pending",
      });
    }

    if (((company.decision_makers as unknown[]) ?? []).length === 0) {
      recommendations.push({
        workspace_id: workspace_id ?? null,
        company_id,
        recommendation_type: "decision_makers",
        title: `Identify decision makers at ${company.company_name}`,
        description: "No decision makers identified. Research key stakeholders before outreach.",
        priority: "high",
        status: "pending",
      });
    }

    if (scores.overall_score >= 0.7 && scores.buying_intent_score >= 0.6) {
      recommendations.push({
        workspace_id: workspace_id ?? null,
        company_id,
        recommendation_type: "meeting",
        title: `Request a discovery meeting with ${company.company_name}`,
        description: "Strong overall score with high buying intent. Ready for a direct meeting request.",
        priority: "high",
        status: "pending",
      });
    }

    if (scores.overall_score >= 0.8) {
      recommendations.push({
        workspace_id: workspace_id ?? null,
        company_id,
        recommendation_type: "proposal",
        title: `Prepare a proposal for ${company.company_name}`,
        description: "Excellent opportunity score. Top candidate for a tailored proposal.",
        priority: "critical",
        status: "pending",
      });
    }

    // Delete old pending recommendations
    await fetch(`${SUPABASE_URL}/rest/v1/revenue_recommendations?company_id=eq.${company_id}&status=eq.pending`, { method: "DELETE", headers });

    if (recommendations.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/revenue_recommendations`, {
        method: "POST",
        headers,
        body: JSON.stringify(recommendations),
      });
    }

    return new Response(JSON.stringify({
      profile_id: profileId,
      scores,
      priority,
      recommended_action: recommendedAction,
      signals_created: signals.length,
      recommendations_created: recommendations.length,
      duration_ms: Date.now() - start,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
