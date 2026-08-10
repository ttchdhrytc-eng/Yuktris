import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { workspace_id, conversation_id, action } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };

    if (action === "ingest") {
      // Ingest a new message
      const { conversation_id: convId, sender, channel, content, message_type, attachments, metadata } = await req.json();

      const msgRes = await fetch(`${supabaseUrl}/rest/v1/conversation_messages`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=representation" },
        body: JSON.stringify({
          conversation_id: convId,
          workspace_id: workspace_id,
          sender,
          channel,
          content,
          message_type: message_type ?? "text",
          attachments: attachments ?? [],
          metadata: metadata ?? {},
          timestamp: new Date().toISOString(),
        }),
      });
      const msg = await msgRes.json();

      // Record event
      await fetch(`${supabaseUrl}/rest/v1/conversation_events`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          workspace_id: workspace_id,
          conversation_id: convId,
          message_id: msg[0]?.id,
          event_type: sender === "prospect" ? "message_received" : "message_sent",
          event_data: { channel, message_type: message_type ?? "text" },
        }),
      });

      return new Response(JSON.stringify({ status: "ingested", message_id: msg[0]?.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "analyze") {
      // Load messages for the conversation
      const messagesRes = await fetch(
        `${supabaseUrl}/rest/v1/conversation_messages?conversation_id=eq.${conversation_id}&order=timestamp.asc&select=*`,
        { headers },
      );
      const messages = await messagesRes.json();

      // Load conversation
      const convRes = await fetch(
        `${supabaseUrl}/rest/v1/conversations?id=eq.${conversation_id}&select=*`,
        { headers },
      );
      const convs = await convRes.json();
      const conv = convs[0];

      if (!conv || messages.length === 0) {
        return new Response(JSON.stringify({ error: "Conversation or messages not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Load personalization context
      const persRes = await fetch(
        `${supabaseUrl}/rest/v1/personalization_profiles?workspace_id=eq.${workspace_id}&order=version.desc&limit=1&select=communication_style,tone,value_proposition,conversation_angle`,
        { headers },
      );
      const pers = await persRes.json();

      // Load outreach decision
      let decision = null;
      if (conv.company_id) {
        const decRes = await fetch(
          `${supabaseUrl}/rest/v1/outreach_decisions?workspace_id=eq.${workspace_id}&company_id=eq.${conv.company_id}&status=eq.active&limit=1&select=decision,decision_reason`,
          { headers },
        );
        const decs = await decRes.json();
        decision = decs[0] ?? null;
      }

      // Load message strategy
      let strategy = null;
      if (conv.company_id) {
        const stratRes = await fetch(
          `${supabaseUrl}/rest/v1/message_strategies?workspace_id=eq.${workspace_id}&company_id=eq.${conv.company_id}&order=created_at.desc&limit=1&select=connection_request_strategy,first_message_strategy,follow_up_strategy,cta_strategy,objection_prevention_strategy`,
          { headers },
        );
        const strats = await stratRes.json();
        strategy = strats[0] ?? null;
      }

      // Call AI Gateway for analysis
      const aiResponse = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
        method: "POST",
        headers: { ...headers },
        body: JSON.stringify({
          workspace_id,
          agent_name: "conversation_intelligence_agent",
          system_prompt: "You are an elite sales conversation analyst. Analyze conversations and return valid JSON.",
          user_prompt: `Analyze this conversation:\n\nMessages: ${JSON.stringify(messages.map((m: any) => ({ sender: m.sender, content: m.content, timestamp: m.timestamp })))}\n\nProspect: ${conv.prospect_name}\nCompany: ${conv.company_name}\n\nContext: ${JSON.stringify({ personalization: pers, outreachDecision: decision, messageStrategy: strategy })}\n\nReturn JSON with: intent, sentiment, buyingStage, objections, recommendation, replies, score, summary, labels, meetingReadiness, risk.`,
          temperature: 0.3,
          max_tokens: 6000,
        }),
      });
      const aiResult = await aiResponse.json();
      const analysis = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);

      // Persist intent
      await fetch(`${supabaseUrl}/rest/v1/conversation_intents`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          workspace_id: workspace_id,
          conversation_id: conversation_id,
          primary_intent: analysis.intent?.primary_intent ?? "unknown",
          secondary_intent: analysis.intent?.secondary_intent ?? null,
          conversation_goal: analysis.intent?.conversation_goal ?? null,
          urgency: analysis.intent?.urgency ?? "medium",
          likelihood_to_buy: analysis.intent?.likelihood_to_buy ?? 0.3,
          meeting_likelihood: analysis.intent?.meeting_likelihood ?? 0.2,
          revenue_opportunity: analysis.intent?.revenue_opportunity ?? null,
          confidence: analysis.intent?.confidence ?? 0.5,
          reasoning: analysis.intent?.reasoning ?? null,
        }),
      });

      // Persist buying stage
      const prevStageRes = await fetch(
        `${supabaseUrl}/rest/v1/conversation_buying_stage?conversation_id=eq.${conversation_id}&order=version.desc&limit=1&select=buying_stage,version`,
        { headers },
      );
      const prevStages = await prevStageRes.json();
      await fetch(`${supabaseUrl}/rest/v1/conversation_buying_stage`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          workspace_id: workspace_id,
          conversation_id: conversation_id,
          buying_stage: analysis.buyingStage?.buying_stage ?? "cold",
          previous_stage: prevStages[0]?.buying_stage ?? null,
          stage_reason: analysis.buyingStage?.stage_reason ?? "Initial stage",
          stage_signals: analysis.buyingStage?.stage_signals ?? [],
          confidence: analysis.buyingStage?.confidence ?? 0.5,
          version: (prevStages[0]?.version ?? 0) + 1,
        }),
      });

      // Persist recommendation
      await fetch(`${supabaseUrl}/rest/v1/conversation_recommendations`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          workspace_id: workspace_id,
          conversation_id: conversation_id,
          recommended_action: analysis.recommendation?.recommended_action ?? "no_action",
          action_reason: analysis.recommendation?.action_reason ?? "No action needed",
          action_priority: analysis.recommendation?.action_priority ?? "low",
          confidence: analysis.recommendation?.confidence ?? 0.5,
          reasoning: analysis.recommendation?.reasoning ?? null,
        }),
      });

      // Persist replies
      if (analysis.replies?.length) {
        await fetch(`${supabaseUrl}/rest/v1/conversation_reply_library`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(analysis.replies.map((r: any) => ({
            workspace_id: workspace_id,
            conversation_id: conversation_id,
            reply_type: r.reply_type,
            reply_text: r.reply_text,
            cta: r.cta ?? null,
            confidence: r.confidence ?? 0.5,
            status: "pending",
          }))),
        });
      }

      // Persist score
      const prevScoreRes = await fetch(
        `${supabaseUrl}/rest/v1/conversation_score?conversation_id=eq.${conversation_id}&order=version.desc&limit=1&select=version`,
        { headers },
      );
      const prevScores = await prevScoreRes.json();
      await fetch(`${supabaseUrl}/rest/v1/conversation_score`, {
        method: "POST",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          workspace_id: workspace_id,
          conversation_id: conversation_id,
          intent_score: analysis.score?.intent_score ?? 0,
          sentiment_score: analysis.score?.sentiment_score ?? 0,
          engagement_score: analysis.score?.engagement_score ?? 0,
          buying_stage_score: analysis.score?.buying_stage_score ?? 0,
          meeting_readiness_score: analysis.score?.meeting_readiness_score ?? 0,
          risk_score: analysis.score?.risk_score ?? 0,
          overall_score: analysis.score?.overall_score ?? 0,
          score_explanation: analysis.score?.score_explanation ?? {},
          confidence: analysis.score?.confidence ?? 0.5,
          version: (prevScores[0]?.version ?? 0) + 1,
        }),
      });

      // Update conversation
      await fetch(`${supabaseUrl}/rest/v1/conversations?id=eq.${conversation_id}`, {
        method: "PATCH",
        headers: { ...headers, Prefer: "return=minimal" },
        body: JSON.stringify({
          buying_stage: analysis.buyingStage?.buying_stage ?? "cold",
          meeting_readiness_level: analysis.meetingReadiness?.level ?? "not_ready",
          risk_level: analysis.risk?.level ?? "low",
          overall_confidence: analysis.score?.confidence ?? 0.5,
          last_analyzed_at: new Date().toISOString(),
        }),
      });

      // Upsert summary
      const existingSummaryRes = await fetch(
        `${supabaseUrl}/rest/v1/conversation_summary?conversation_id=eq.${conversation_id}&select=id`,
        { headers },
      );
      const existingSummaries = await existingSummaryRes.json();
      if (existingSummaries.length > 0) {
        await fetch(`${supabaseUrl}/rest/v1/conversation_summary?id=eq.${existingSummaries[0].id}`, {
          method: "PATCH",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({
            summary: analysis.summary?.summary ?? "",
            next_action: analysis.summary?.next_action ?? null,
            meeting_readiness: analysis.summary?.meeting_readiness ?? "not_ready",
            executive_summary: analysis.summary?.executive_summary ?? null,
            recommended_followup: analysis.summary?.recommended_followup ?? null,
            escalation_suggestion: analysis.summary?.escalation_suggestion ?? null,
          }),
        });
      } else {
        await fetch(`${supabaseUrl}/rest/v1/conversation_summary`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify({
            conversation_id: conversation_id,
            summary: analysis.summary?.summary ?? "",
            next_action: analysis.summary?.next_action ?? null,
            meeting_readiness: analysis.summary?.meeting_readiness ?? "not_ready",
            executive_summary: analysis.summary?.executive_summary ?? null,
            recommended_followup: analysis.summary?.recommended_followup ?? null,
            escalation_suggestion: analysis.summary?.escalation_suggestion ?? null,
          }),
        });
      }

      // Persist labels
      if (analysis.labels?.length) {
        await fetch(`${supabaseUrl}/rest/v1/conversation_labels?conversation_id=eq.${conversation_id}`, {
          method: "DELETE",
          headers,
        });
        await fetch(`${supabaseUrl}/rest/v1/conversation_labels`, {
          method: "POST",
          headers: { ...headers, Prefer: "return=minimal" },
          body: JSON.stringify(analysis.labels.map((label: string) => ({
            workspace_id: workspace_id,
            conversation_id: conversation_id,
            label,
            label_confidence: 0.8,
          }))),
        });
      }

      return new Response(JSON.stringify({ status: "analyzed", conversation_id, analysis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
