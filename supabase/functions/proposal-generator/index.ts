import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action, request_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    if (action === "detect") {
      // Find meetings with moved_to_opportunity outcome
      const meetingsRes = await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?workspace_id=eq.${workspace_id}&status=eq.completed&select=id,conversation_id,contact_id,company_id,prospect_name,prospect_title,company_name,meeting_type,revenue_estimate&order=updated_at.desc&limit=30`, { headers });
      const meetings = await meetingsRes.json();
      let detected = 0;
      for (const meeting of meetings) {
        const outcomesRes = await fetch(`${supabaseUrl}/rest/v1/meeting_outcomes?meeting_id=eq.${meeting.id}&select=*`, { headers });
        const outcomes = await outcomesRes.json();
        if (!outcomes.length) continue;
        const outcome = outcomes[0];
        if (!["moved_to_opportunity", "followup_scheduled"].includes(outcome.outcome)) continue;
        const existingRes = await fetch(`${supabaseUrl}/rest/v1/proposal_requests?meeting_id=eq.${meeting.id}&status=in.(pending,approved,generating,generated)&select=id&limit=1`, { headers });
        const existing = await existingRes.json();
        if (existing.length > 0) continue;
        await fetch(`${supabaseUrl}/rest/v1/proposal_requests`, {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ workspace_id, meeting_id: meeting.id, conversation_id: meeting.conversation_id, contact_id: meeting.contact_id, company_id: meeting.company_id, prospect_name: meeting.prospect_name, company_name: meeting.company_name, trigger_reason: "meeting_outcome", trigger_data: { meeting_type: meeting.meeting_type, outcome: outcome.outcome }, buying_stage: "decision", meeting_score: 50, estimated_deal_value: outcome.deal_value ?? meeting.revenue_estimate, urgency: "high", confidence_score: 0.8, reasoning: `Meeting outcome: ${outcome.outcome}`, status: "pending" }),
        });
        await fetch(`${supabaseUrl}/rest/v1/proposal_notifications`, {
          method: "POST", headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({ workspace_id, notification_type: "proposal_ready", notification_title: "Proposal Request Detected", notification_message: `${meeting.prospect_name ?? "A prospect"} is ready for a proposal.`, severity: "success" }),
        });
        detected++;
      }
      return new Response(JSON.stringify({ detected, total_meetings: meetings.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "generate") {
      // Load request
      const reqRes = await fetch(`${supabaseUrl}/rest/v1/proposal_requests?id=eq.${request_id}&select=*`, { headers });
      const reqs = await reqRes.json();
      const request = reqs[0];
      if (!request) return new Response(JSON.stringify({ error: "Request not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

      // Update status
      await fetch(`${supabaseUrl}/rest/v1/proposal_requests?id=eq.${request_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "generating" }) });

      // Load context
      let company = null;
      if (request.company_id) { const cRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${request.company_id}&select=*`, { headers }); const cs = await cRes.json(); company = cs[0]; }
      let meetingBrief = null;
      if (request.meeting_id) { const mbRes = await fetch(`${supabaseUrl}/rest/v1/meeting_briefs?meeting_id=eq.${request.meeting_id}&order=version.desc&limit=1&select=*`, { headers }); const mbs = await mbRes.json(); meetingBrief = mbs[0]; }

      // Call AI Gateway
      const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
        method: "POST", headers,
        body: JSON.stringify({
          workspace_id, agent_name: "proposal_intelligence_agent",
          system_prompt: "You are an elite proposal generation AI. Generate comprehensive proposals with pricing, ROI, packages, and negotiation guidance. Return valid JSON.",
          user_prompt: `Generate a complete proposal for:\n\nRequest: ${JSON.stringify({ prospect: request.prospect_name, company: request.company_name, dealValue: request.estimated_deal_value, urgency: request.urgency })}\n\nContext: ${JSON.stringify({ company, meetingBrief })}\n\nReturn JSON with: strategy, content, executive_summary, packages, options, roi, businessCase, timeline, scope, deliverables, risks, caseStudiesSelected, testimonials, contractTerms, paymentPlans, negotiation, score, reasoning.`,
          temperature: 0.3, max_tokens: 10000,
        }),
      });
      const aiResult = await aiRes.json();
      const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);

      // Create project
      const projRes = await fetch(`${supabaseUrl}/rest/v1/proposal_projects`, {
        method: "POST", headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ workspace_id, company_id: request.company_id, project_name: `Proposal: ${request.prospect_name ?? "Unknown"}`, proposal_type: "enterprise", status: "review", priority: request.urgency === "high" ? "high" : "medium", strategy: result.strategy ?? {}, metadata: { request_id } }),
      });
      const projects = await projRes.json();
      const projectId = projects[0]?.id;

      // Create version
      const verRes = await fetch(`${supabaseUrl}/rest/v1/proposal_versions`, {
        method: "POST", headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({ workspace_id, proposal_project_id: projectId, version_number: 1, content: result.content ?? {}, executive_summary: result.executive_summary ?? "", problem_analysis: result.problem_analysis ?? {}, solution_recommendation: result.solution_recommendation ?? {}, implementation_roadmap: result.implementation_roadmap ?? {}, risk_assessment: result.risk_assessment ?? {}, competitive_differentiation: result.competitive_differentiation ?? {}, roi_estimation: result.roi_estimation ?? {}, team_recommendation: result.team_recommendation ?? {}, case_studies: result.case_studies ?? [], is_latest: true, created_by: "ai" }),
      });
      const versions = await verRes.json();
      const versionId = versions[0]?.id;

      // Persist packages, roi, negotiation, score, reasoning, approvals
      if (result.packages?.length) {
        await fetch(`${supabaseUrl}/rest/v1/proposal_packages`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(result.packages.map((p: any, i: number) => ({ workspace_id, project_id: projectId, version_id: versionId, package_tier: p.package_tier ?? "good", package_name: p.package_name, description: p.description, features: p.features ?? [], deliverables: p.deliverables ?? [], timeline_weeks: p.timeline_weeks, price: p.price, roi_estimate: p.roi_estimate ?? {}, is_recommended: p.is_recommended ?? (i === 1), sort_order: i }))) });
      }
      if (result.roi) {
        await fetch(`${supabaseUrl}/rest/v1/proposal_roi`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id: projectId, version_id: versionId, investment_amount: result.roi.investment_amount ?? 0, annual_savings: result.roi.annual_savings, revenue_increase: result.roi.revenue_increase, productivity_gain_hours: result.roi.productivity_gain_hours, productivity_gain_value: result.roi.productivity_gain_value, payback_period_months: result.roi.payback_period_months, break_even_month: result.roi.break_even_month, roi_1_year: result.roi.roi_1_year, roi_3_year: result.roi.roi_3_year, roi_5_year: result.roi.roi_5_year, business_impact: result.roi.business_impact, total_3_year_value: result.roi.total_3_year_value, total_5_year_value: result.roi.total_5_year_value, confidence: result.roi.confidence ?? 0.7 }) });
      }
      if (result.negotiation) {
        await fetch(`${supabaseUrl}/rest/v1/proposal_negotiation`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id: projectId, version_id: versionId, negotiation_round: 1, predicted_objections: result.negotiation.predicted_objections ?? [], pricing_concerns: result.negotiation.pricing_concerns ?? [], competitor_comparison: result.negotiation.competitor_comparison ?? [], discount_requests: result.negotiation.discount_requests ?? [], risk_concerns: result.negotiation.risk_concerns ?? [], negotiation_guidance: result.negotiation.negotiation_guidance, fallback_offers: result.negotiation.fallback_offers ?? [], alternative_packages: result.negotiation.alternative_packages ?? [], concessions: result.negotiation.concessions ?? [], red_lines: result.negotiation.red_lines ?? [], confidence: result.negotiation.confidence ?? 0.7 }) });
      }
      if (result.score) {
        await fetch(`${supabaseUrl}/rest/v1/proposal_score`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id: projectId, win_probability: result.score.win_probability ?? 50, pricing_strength: result.score.pricing_strength ?? 60, competitive_position: result.score.competitive_position ?? 65, roi_quality: result.score.roi_quality ?? 70, proposal_quality: result.score.proposal_quality ?? 75, relationship_strength: result.score.relationship_strength ?? 60, decision_confidence: result.score.decision_confidence ?? 55, overall_score: result.score.overall_score ?? 62, score_explanation: result.score.score_explanation ?? {}, confidence: result.score.confidence ?? 0.75 }) });
      }
      if (result.reasoning?.length) {
        await fetch(`${supabaseUrl}/rest/v1/proposal_ai_reasoning`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify(result.reasoning.map((r: any) => ({ workspace_id, project_id: projectId, reasoning_type: r.reasoning_type ?? "structure", reasoning_text: r.reasoning_text ?? "", reasoning_data: r.reasoning_data ?? {}, confidence: r.confidence ?? 0.7 }))) });
      }

      // Create approvals
      await fetch(`${supabaseUrl}/rest/v1/proposal_approvals`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify([{ workspace_id, project_id: projectId, version_id: versionId, approval_type: "internal", approver_name: "Sales Lead", approval_status: "pending" }, { workspace_id, project_id: projectId, version_id: versionId, approval_type: "pricing", approver_name: "Finance", approval_status: "pending" }, { workspace_id, project_id: projectId, version_id: versionId, approval_type: "legal", approver_name: "Legal", approval_status: "pending" }]) });

      // Create status record
      await fetch(`${supabaseUrl}/rest/v1/proposal_status`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id: projectId, status: "review", status_reason: "AI-generated proposal ready for review", changed_by: "ai" }) });

      // Update request
      await fetch(`${supabaseUrl}/rest/v1/proposal_requests?id=eq.${request_id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ status: "generated", project_id: projectId }) });

      // Notification
      await fetch(`${supabaseUrl}/rest/v1/proposal_notifications`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, project_id: projectId, notification_type: "proposal_ready", notification_title: "Proposal Generated", notification_message: `I've prepared the proposal for ${request.prospect_name ?? "the prospect"}.`, severity: "success" }) });

      return new Response(JSON.stringify({ generated: true, project_id: projectId }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
