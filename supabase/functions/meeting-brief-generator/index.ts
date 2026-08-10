import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, meeting_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    // Load meeting
    const meetingRes = await fetch(`${supabaseUrl}/rest/v1/meeting_scheduler?id=eq.${meeting_id}&select=*`, { headers });
    const meetings = await meetingRes.json();
    const meeting = meetings[0];
    if (!meeting) return new Response(JSON.stringify({ error: "Meeting not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Load context
    let company = null;
    if (meeting.company_id) {
      const compRes = await fetch(`${supabaseUrl}/rest/v1/companies?id=eq.${meeting.company_id}&select=*`, { headers });
      const comps = await compRes.json();
      company = comps[0];
    }

    // Load conversation
    let conversation = null;
    if (meeting.conversation_id) {
      const convRes = await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${meeting.conversation_id}&select=buying_stage,meeting_readiness_level`, { headers });
      const convs = await convRes.json();
      conversation = convs[0];
    }

    // Load personalization
    const persRes = await fetch(`${supabaseUrl}/rest/v1/personalization_profiles?workspace_id=eq.${workspace_id}&order=version.desc&limit=1&select=communication_style,tone,value_proposition,pain_point_references,trust_signals`, { headers });
    const pers = await persRes.json();

    // Call AI Gateway for brief generation
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id,
        agent_name: "meeting_intelligence_agent",
        system_prompt: "You are an elite meeting preparation AI. Generate comprehensive meeting briefs, agendas, discovery questions, and competitor intelligence. Return valid JSON.",
        user_prompt: `Generate complete meeting preparation for:\n\nMeeting: ${JSON.stringify({ type: meeting.meeting_type, title: meeting.meeting_title, prospect: meeting.prospect_name, company: meeting.company_name, duration: meeting.duration_minutes })}\n\nContext: ${JSON.stringify({ company, conversation, personalization: pers[0] })}\n\nReturn JSON with: brief, agenda, questions, competitorIntel, preparation, checklist, score, reasoning.`,
        temperature: 0.3,
        max_tokens: 8000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);

    // Persist brief
    await fetch(`${supabaseUrl}/rest/v1/meeting_briefs`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, executive_summary: result.brief?.executive_summary, company_overview: result.brief?.company_overview, prospect_overview: result.brief?.prospect_overview, timeline: result.brief?.timeline ?? [], conversation_summary: result.brief?.conversation_summary, pain_points: result.brief?.pain_points ?? [], goals: result.brief?.goals ?? [], buying_signals: result.brief?.buying_signals ?? [], decision_makers: result.brief?.decision_makers ?? [], objections: result.brief?.objections ?? [], competitors: result.brief?.competitors ?? [], technologies: result.brief?.technologies ?? [], revenue_estimate: result.brief?.revenue_estimate, likelihood_to_close: result.brief?.likelihood_to_close ?? 0.3, next_recommendation: result.brief?.next_recommendation, confidence: result.brief?.confidence ?? 0.5 }),
    });

    // Persist agenda
    await fetch(`${supabaseUrl}/rest/v1/meeting_agendas`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, agenda_items: result.agenda?.agenda_items ?? [], total_duration_minutes: result.agenda?.total_duration_minutes ?? meeting.duration_minutes }),
    });

    // Persist questions
    if (result.questions?.length) {
      await fetch(`${supabaseUrl}/rest/v1/meeting_questions`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(result.questions.map((q: any) => ({ workspace_id, meeting_id, question_category: q.question_category, question_text: q.question_text, priority: q.priority ?? "medium" }))),
      });
    }

    // Persist competitor intel
    if (result.competitorIntel?.length) {
      await fetch(`${supabaseUrl}/rest/v1/meeting_competitor_intel`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(result.competitorIntel.map((c: any) => ({ workspace_id, meeting_id, competitor_name: c.competitor_name, comparison: c.comparison ?? {}, weaknesses: c.weaknesses ?? [], differentiators: c.differentiators ?? [], battle_cards: c.battle_cards ?? [], objection_handling: c.objection_handling ?? [], pricing_comparison: c.pricing_comparison ?? {}, migration_strategy: c.migration_strategy }))),
      });
    }

    // Persist preparation
    await fetch(`${supabaseUrl}/rest/v1/meeting_preparation`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, proposal_checklist: result.preparation?.proposal_checklist ?? [], roi_data: result.preparation?.roi_data ?? {}, case_studies: result.preparation?.case_studies ?? [], trust_signals: result.preparation?.trust_signals ?? [], testimonials: result.preparation?.testimonials ?? [], relevant_industries: result.preparation?.relevant_industries ?? [], pricing_recommendation: result.preparation?.pricing_recommendation, offer_recommendation: result.preparation?.offer_recommendation }),
    });

    // Persist checklist
    await fetch(`${supabaseUrl}/rest/v1/meeting_checklists`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, checklist_items: result.checklist?.checklist_items ?? [], completion_percentage: result.checklist?.completion_percentage ?? 0 }),
    });

    // Persist score
    await fetch(`${supabaseUrl}/rest/v1/meeting_score`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, preparation_score: result.score?.preparation_score ?? 0, qualification_score: result.score?.qualification_score ?? 0, revenue_score: result.score?.revenue_score ?? 0, likelihood_to_close: result.score?.likelihood_to_close ?? 0, risk_score: result.score?.risk_score ?? 0, overall_score: result.score?.overall_score ?? 0, score_explanation: result.score?.score_explanation ?? {}, confidence: result.score?.confidence ?? 0.5 }),
    });

    // Persist reasoning
    if (result.reasoning?.length) {
      await fetch(`${supabaseUrl}/rest/v1/meeting_ai_reasoning`, {
        method: "POST", headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify(result.reasoning.map((r: any) => ({ workspace_id, meeting_id, reasoning_type: r.reasoning_type, reasoning_text: r.reasoning_text, confidence: r.confidence ?? 0.7 }))),
      });
    }

    // Create notification
    await fetch(`${supabaseUrl}/rest/v1/meeting_notifications`, {
      method: "POST", headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ workspace_id, meeting_id, notification_type: "brief_ready", notification_title: "Meeting Brief Ready", notification_message: "Full meeting brief, agenda, discovery questions, and competitor battle cards are ready.", severity: "success" }),
    });

    return new Response(JSON.stringify({ generated: true, meeting_id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
