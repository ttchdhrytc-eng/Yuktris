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
    const { company_id, proposal_type, project_name, workspace_id, custom_instructions } = await req.json();

    if (!company_id || !proposal_type) {
      return new Response(JSON.stringify({ error: "company_id and proposal_type are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const start = Date.now();

    // 1. Load company intelligence
    const companyRes = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${company_id}&select=*`, { headers });
    const companyData = await companyRes.json();
    if (!companyData || companyData.length === 0) {
      return new Response(JSON.stringify({ error: "Company intelligence not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const company = companyData[0];

    // 2. Load revenue profile
    const revRes = await fetch(`${SUPABASE_URL}/rest/v1/revenue_profiles?company_id=eq.${company_id}&select=*`, { headers });
    const revData = await revRes.json();
    const revenue = revData?.[0] ?? {};

    // 3. Load signals
    const signalsRes = await fetch(`${SUPABASE_URL}/rest/v1/intelligence_signals?company_id=eq.${company_id}&select=signal_type,signal_strength,confidence_score,description&order=detected_at.desc&limit=20`, { headers });
    const signalsData = await signalsRes.json();

    // 4. Build proposal content
    const buyingSignals = (company.buying_signals ?? []).map((s: Record<string, unknown>) => ({
      signal_type: s.signal_type as string,
      description: s.description as string,
      confidence: s.confidence as number,
    }));
    const growthSignals = (company.growth_signals ?? []).map((s: Record<string, unknown>) => ({
      signal_type: s.signal_type as string,
      description: s.description as string,
      confidence: s.confidence as number,
    }));
    const techStack = (company.technology_stack ?? []).map((t: Record<string, unknown>) => ({
      name: t.name as string,
      category: t.category as string,
    }));
    const competitors = ((company.competitive_positioning as { competitors?: string[] }) ?? {}).competitors ?? [];
    const decisionMakers = (company.decision_makers ?? []).map((dm: Record<string, unknown>) => ({
      name: dm.name as string,
      title: dm.title as string,
      department: dm.department as string,
    }));

    // Strategy
    const approachMap: Record<string, string> = {
      executive: "Strategic executive partnership approach focused on long-term business transformation.",
      sales: "Consultative sales approach emphasizing value-driven solutions.",
      seo: "Data-driven SEO strategy focused on organic growth and content authority.",
      google_ads: "Performance-focused Google Ads strategy optimizing for ROAS.",
      meta_ads: "Creative-driven Meta Ads approach leveraging audience targeting.",
      linkedin_ads: "B2B-focused LinkedIn Ads strategy targeting decision-makers.",
      digital_marketing: "Integrated digital marketing approach combining SEO, paid media, and content.",
      website: "Conversion-optimized website development approach.",
      software: "Agile software development with iterative delivery.",
      ai_solution: "AI-native solution approach emphasizing data strategy and measurable outcomes.",
      custom: "Tailored strategic approach based on specific business requirements.",
    };

    const timelineMap: Record<string, number> = {
      executive: 16, sales: 8, seo: 12, google_ads: 4, meta_ads: 4, linkedin_ads: 4,
      digital_marketing: 16, website: 12, software: 20, ai_solution: 24, custom: 12,
    };

    const strategy = {
      approach: approachMap[proposal_type] ?? approachMap.custom,
      primary_objectives: [
        revenue.buying_intent_score >= 0.7 ? "Capitalize on current buying intent" : "Build relationship and demonstrate value",
        "Establish clear ROI expectations and measurable success criteria",
        ...(custom_instructions ? [`Address: ${custom_instructions}`] : []),
      ],
      key_differentiators: ["Deep industry expertise", "Data-driven approach", "Dedicated account team"],
      risk_factors: revenue.risk_score >= 0.6 ? ["Incomplete company data may require additional discovery"] : [],
      success_metrics: [
        { metric: "Project kickoff", target: "Within 2 weeks of approval", timeframe: "2 weeks" },
        { metric: "First deliverable", target: "Within 4 weeks", timeframe: "4 weeks" },
      ],
      competitive_positioning: competitors.length > 5 ? "Differentiate through superior value and service" : "Position as results-driven partner",
      recommended_timeline_weeks: timelineMap[proposal_type] ?? 12,
    };

    // Pain points
    const painPoints: Record<string, unknown>[] = [];
    if (techStack.length < 5) painPoints.push({ pain_point: "Limited Technology Stack", description: `Only ${techStack.length} technologies detected.`, severity: techStack.length < 3 ? "high" : "medium", impact: "May limit efficiency", evidence: `${techStack.length} tools`, proposed_solution: "Technology modernization plan." });
    if (competitors.length > 5) painPoints.push({ pain_point: "Competitive Pressure", description: `${competitors.length} competitors identified.`, severity: "high", impact: "Crowded market", evidence: `${competitors.length} competitors`, proposed_solution: "Differentiation strategy." });
    if (decisionMakers.length < 2) painPoints.push({ pain_point: "Limited Decision-Maker Visibility", description: `${decisionMakers.length} decision maker(s) found.`, severity: "medium", impact: "Bottleneck in buying", evidence: `${decisionMakers.length} DMs`, proposed_solution: "Multi-thread the relationship." });

    // Solutions
    const solutionMap: Record<string, { service_name: string; description: string; rationale: string; deliverables: string[]; timeline_weeks: number; dependencies: string[]; priority: string }[]> = {
      seo: [
        { service_name: "Technical SEO Audit", description: "Comprehensive technical SEO audit.", rationale: "Foundation for organic growth.", deliverables: ["Audit report", "Fixes implementation"], timeline_weeks: 8, dependencies: ["Website access"], priority: "high" },
        { service_name: "Content Strategy", description: "Data-driven content strategy.", rationale: "Content authority for search growth.", deliverables: ["Strategy doc", "Monthly content"], timeline_weeks: 12, dependencies: ["Brand guidelines"], priority: "high" },
      ],
      google_ads: [
        { service_name: "Google Ads Management", description: "Full-funnel campaign setup and optimization.", rationale: "ROAS-positive paid search.", deliverables: ["Account setup", "Monthly optimization"], timeline_weeks: 4, dependencies: ["Google Ads account"], priority: "high" },
      ],
      executive: [
        { service_name: "Strategic Consultation", description: "Comprehensive strategy assessment.", rationale: "Strategic foundation.", deliverables: ["Assessment", "Roadmap", "KPI framework"], timeline_weeks: 16, dependencies: ["Stakeholder access"], priority: "high" },
      ],
    };

    const solutions = solutionMap[proposal_type] ?? [
      { service_name: "Custom Solution", description: "Tailored solution for your business.", rationale: "Addresses specific needs.", deliverables: ["Solution design", "Implementation"], timeline_weeks: 12, dependencies: ["Requirements"], priority: "high" },
    ];

    // Pricing
    const lineItems = solutions.map((s) => ({
      name: s.service_name,
      description: s.description,
      quantity: 1,
      unit_price: 5000,
      total: 5000,
      category: "Services",
    }));
    lineItems.push({ name: "Project Management", description: "Dedicated PM.", quantity: 1, unit_price: 2500, total: 2500, category: "Management" });
    lineItems.push({ name: "Onboarding", description: "Discovery and setup.", quantity: 1, unit_price: 1500, total: 1500, category: "Setup" });
    const subtotal = lineItems.reduce((s, i) => s + i.total, 0);
    const discount = revenue.icp_score >= 0.8 ? Math.round(subtotal * 0.05 * 100) / 100 : 0;
    const total = subtotal - discount;

    const pricing = {
      model: ["seo", "google_ads", "meta_ads", "linkedin_ads", "digital_marketing"].includes(proposal_type) ? "monthly" : "milestone",
      line_items: lineItems,
      subtotal, discount, tax: 0, total, currency: "USD",
      payment_terms: "50% upfront, 50% upon completion. Net 15.",
      valid_until: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
      rationale: `Total investment of $${total.toLocaleString()} aligned with company expectations.`,
    };

    // ROI
    const roiMultiplier: Record<string, number> = { seo: 4, google_ads: 6, ai_solution: 7, executive: 3, sales: 5 };
    const roiMult = roiMultiplier[proposal_type] ?? 4;
    const projectedRevenue = Math.round(total * roiMult);
    const projectedSavings = Math.round(total * 1.5);
    const totalValue = projectedRevenue + projectedSavings;
    const roiPct = total > 0 ? Math.round((totalValue / total) * 100) / 100 : 0;

    const roi = {
      investment: total,
      projected_revenue: projectedRevenue,
      projected_cost_savings: projectedSavings,
      projected_efficiency_gain: Math.round(total * 1.0),
      total_projected_value: totalValue,
      roi_percentage: roiPct,
      payback_period_months: Math.max(1, Math.round(total / (totalValue / 12))),
      assumptions: ["Based on industry benchmarks", "Assumes consistent execution"],
      confidence: 0.7,
    };

    // Roadmap
    const roadmap = [
      { phase: 1, title: "Discovery & Planning", description: "Initial discovery and planning.", duration_weeks: 2, deliverables: ["Kickoff", "Requirements"], milestones: ["Charter approved"], dependencies: ["Stakeholder access"] },
      ...solutions.map((s, i) => ({ phase: i + 2, title: s.service_name, description: s.description, duration_weeks: s.timeline_weeks, deliverables: s.deliverables, milestones: [`${s.service_name} delivered`], dependencies: s.dependencies })),
      { phase: solutions.length + 2, title: "Review & Optimization", description: "Post-implementation review.", duration_weeks: 2, deliverables: ["Report", "Documentation"], milestones: ["Sign-off"], dependencies: ["Prior phases"] },
    ];

    let currentWeek = 0;
    const timeline = roadmap.map((p) => {
      const startWk = currentWeek + 1;
      const endWk = currentWeek + p.duration_weeks;
      currentWeek = endWk;
      return { phase: `Phase ${p.phase}: ${p.title}`, start_week: startWk, end_week: endWk, milestone: p.milestones[0] };
    });

    // Executive summary
    const execSummary = `This proposal outlines a comprehensive ${proposal_type.replace(/_/g, " ")} strategy for ${company.company_name}. ` +
      `With a total investment of $${total.toLocaleString()}, we project a total value of $${totalValue.toLocaleString()} ` +
      `representing a ${roiPct.toFixed(1)}x ROI with a ${roi.payback_period_months}-month payback period. ` +
      `The implementation timeline spans approximately ${strategy.recommended_timeline_weeks} weeks.`;

    const content = {
      strategy,
      executive_summary: execSummary,
      company_overview: `${company.company_name} is a ${company.company_size ?? "mid-market"} company${company.industry ? ` in the ${company.industry} industry` : ""}. ${company.summary ?? ""}`,
      problem_analysis: painPoints,
      business_objectives: strategy.primary_objectives,
      recommended_strategy: `${strategy.approach} ${strategy.competitive_positioning}`,
      solution_recommendations: solutions,
      implementation_roadmap: roadmap,
      timeline,
      pricing,
      roi,
      risk_assessment: { overall_risk: revenue.risk_score >= 0.6 ? "high" : "medium", risks: strategy.risk_factors.map((r) => ({ risk: r, probability: 0.5, impact: 0.6, mitigation: "Proactive planning and communication." })), assumptions: roi.assumptions },
      competitive_differentiation: competitors.slice(0, 5).map((c: string) => ({ competitor: c, their_approach: "Traditional approach.", our_advantage: "AI-powered, data-driven approach.", key_difference: "Superior results through intelligence." })),
      case_studies: [{ title: "Success Story", client: "Confidential", industry: company.industry ?? "Technology", challenge: "Business challenge.", solution: "Our solution.", results: ["150% increase in metrics", "60% cost reduction"], relevance: "Demonstrates our capability." }],
      team_recommendation: [
        { role: "Project Director", responsibility: "Overall strategy and client relationship.", allocation: "20%", expertise: "10+ years experience." },
        { role: "Project Manager", responsibility: "Day-to-day management.", allocation: "50%", expertise: "Certified PMP." },
      ],
      faqs: [
        { question: "What is the total investment?", answer: `$${total.toLocaleString()}.` },
        { question: "What is the expected ROI?", answer: `${roiPct.toFixed(1)}x with ${roi.payback_period_months}-month payback.` },
        { question: "How do we get started?", answer: "Approve this proposal and we'll schedule a kickoff within 5 business days." },
      ],
      call_to_action: `We're excited to partner with ${company.company_name}. Contact us today to begin.`,
    };

    const tokenCount = estimateTokens(content);

    // 5. Create project
    const projectRes = await fetch(`${SUPABASE_URL}/rest/v1/proposal_projects`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        company_id,
        project_name: project_name ?? `${proposal_type.replace(/_/g, " ")} Proposal for ${company.company_name}`,
        proposal_type,
        status: "draft",
        priority: strategy.recommended_timeline_weeks > 16 ? "high" : "medium",
        strategy,
      }),
    });
    const projectData = await projectRes.json();
    const projectId = projectData?.[0]?.id;

    // 6. Mark old versions as not latest
    await fetch(`${SUPABASE_URL}/rest/v1/proposal_versions?proposal_project_id=eq.${projectId}&is_latest=eq.true`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ is_latest: false }),
    });

    // 7. Create version
    const versionRes = await fetch(`${SUPABASE_URL}/rest/v1/proposal_versions`, {
      method: "POST",
      headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        proposal_project_id: projectId,
        version_number: 1,
        content,
        executive_summary: execSummary,
        problem_analysis: painPoints,
        solution_recommendation: solutions,
        implementation_roadmap: roadmap,
        risk_assessment: content.risk_assessment,
        competitive_differentiation: content.competitive_differentiation,
        roi_estimation: roi,
        team_recommendation: content.team_recommendation,
        case_studies: content.case_studies,
        token_count: tokenCount,
        generation_duration_ms: Date.now() - start,
        is_latest: true,
      }),
    });
    const versionData = await versionRes.json();
    const versionId = versionData?.[0]?.id;

    return new Response(JSON.stringify({
      project_id: projectId,
      version_id: versionId,
      version_number: 1,
      content,
      token_count: tokenCount,
      duration_ms: Date.now() - start,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
