import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    const { company_id, contact_id, contact_name, contact_email, campaign_type, campaign_name, target_channels, workspace_id, priority, custom_instructions } = await req.json();

    if (!company_id || !campaign_type) {
      return new Response(JSON.stringify({ error: "company_id and campaign_type are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    // 1. Load company
    const compRes = await fetch(`${SUPABASE_URL}/rest/v1/company_intelligence?id=eq.${company_id}&select=*`, { headers });
    const compData = await compRes.json();
    if (!compData || compData.length === 0) {
      return new Response(JSON.stringify({ error: "Company not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const company = compData[0];

    // 2. Load revenue profile
    const revRes = await fetch(`${SUPABASE_URL}/rest/v1/revenue_profiles?company_id=eq.${company_id}&select=*`, { headers });
    const revData = await revRes.json();
    const revenue = revData?.[0] ?? {};

    const buyingIntentScore = revenue.buying_intent_score ?? 0.3;
    const icpScore = revenue.icp_score ?? 0.5;
    const growthScore = revenue.growth_score ?? 0.5;

    // 3. Strategy
    const approachMap: Record<string, string> = {
      cold_outreach: "Value-first cold outreach with personalized icebreaker.",
      warm_outreach: "Relationship-building approach.",
      inbound_followup: "Rapid response capitalizing on interest.",
      proposal_followup: "Value-reinforcement with ROI.",
      meeting_followup: "Action-oriented with next steps.",
      re_engagement: "Reconnection with new value.",
      nurture: "Educational content without hard selling.",
      customer_expansion: "Expansion highlighting new capabilities.",
      renewal: "Value-reminder showcasing results.",
      referral: "Asking for introductions based on value.",
      custom: "Tailored approach.",
    };

    const strategy = {
      approach: approachMap[campaign_type] ?? approachMap.custom,
      primary_channels: target_channels ?? ["email", "linkedin"],
      message_tone: buyingIntentScore >= 0.7 ? "Direct and action-oriented" : "Consultative",
      personalization_level: icpScore >= 0.7 ? "Highly personalized" : "Lightly personalized",
      follow_up_cadence: buyingIntentScore >= 0.7 ? "Day 1, 3, 7, 14" : "Day 1, 5, 10, 20",
      success_probability: Math.min(buyingIntentScore * 0.4 + icpScore * 0.3 + growthScore * 0.3, 1.0),
    };

    // 4. Sequence steps
    const stepTemplates: Record<string, { channel: string; delay_days: number; name: string; template: string }[]> = {
      cold_outreach: [
        { channel: "email", delay_days: 0, name: "Initial Outreach", template: "Personalized cold email" },
        { channel: "email", delay_days: 3, name: "Follow-up 1", template: "Value-add follow-up" },
        { channel: "linkedin", delay_days: 5, name: "LinkedIn Connect", template: "Connection request" },
        { channel: "email", delay_days: 7, name: "Follow-up 2", template: "Breakup email" },
      ],
      inbound_followup: [
        { channel: "email", delay_days: 0, name: "Rapid Response", template: "Quick response to interest" },
        { channel: "email", delay_days: 2, name: "Value Add", template: "Share case study" },
        { channel: "phone", delay_days: 4, name: "Discovery Call", template: "Phone to qualify" },
      ],
    };

    const steps = (stepTemplates[campaign_type] ?? [
      { channel: "email", delay_days: 0, name: "Initial Contact", template: "Custom initial outreach" },
      { channel: "email", delay_days: 5, name: "Follow-up", template: "Custom follow-up" },
    ]).map((s, i) => ({ step_number: i + 1, step_name: s.name, channel: s.channel, delay_days: s.delay_days, delay_hours: 0, message_template: s.template, is_conditional: false, conditions: {} }));

    const totalDays = steps.reduce((sum, s) => sum + s.delay_days, 0);

    // 5. Generate messages
    const messages = steps.map((step) => {
      const icebreaker = `I noticed ${company.company_name}${company.industry ? ` in the ${company.industry} space` : ""} and was impressed by what you are building.`;
      const subject = campaign_type === "cold_outreach" ? `Quick idea for ${company.company_name}` : `Following up — ${company.company_name}`;
      const body = `${contact_name ? `Hi ${contact_name.split(" ")[0]},` : "Hi,"}\n\n${icebreaker}\n\nWe help companies like ${company.company_name} achieve measurable results through data-driven strategies.\n\nWould you be open to a 15-minute call this week?\n\nBest regards`;
      const cta = buyingIntentScore >= 0.8 ? "Open to a 15-min call this week?" : "Should I send over a relevant case study?";

      return {
        channel: step.channel,
        step_number: step.step_number,
        subject_line: subject,
        message_body: body,
        cta,
        icebreaker,
        personalization: { company_name: company.company_name, icp_score: icpScore, intent_score: buyingIntentScore },
        score: Math.min(0.4 + buyingIntentScore * 0.3 + icpScore * 0.2, 1.0),
        variants: [
          { type: "subject", content: `${subject} — variant B`, label: "B", score: 0.7 },
          { type: "cta", content: "Want me to share some resources?", label: "Soft", score: 0.6 },
        ],
      };
    });

    // 6. Create campaign
    const campRes = await fetch(`${SUPABASE_URL}/rest/v1/outreach_campaigns`, {
      method: "POST", headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        company_id,
        contact_id: contact_id ?? null,
        campaign_name: campaign_name ?? `${campaign_type.replace(/_/g, " ")} — ${company.company_name}`,
        campaign_type,
        campaign_status: "draft",
        priority: priority ?? "medium",
        target_channels: strategy.primary_channels,
        strategy,
      }),
    });
    const campData = await campRes.json();
    const campaignId = campData?.[0]?.id;

    // 7. Create sequence
    const seqRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_sequences`, {
      method: "POST", headers: { ...headers, "Prefer": "return=representation" },
      body: JSON.stringify({
        workspace_id: workspace_id ?? null,
        campaign_id: campaignId,
        sequence_name: `${campaign_type} sequence`,
        total_steps: steps.length,
        total_duration_days: totalDays,
        target_timezone: "America/New_York",
        send_windows: [{ day_of_week: 3, start_hour: 10, end_hour: 12 }],
      }),
    });
    const seqData = await seqRes.json();
    const sequenceId = seqData?.[0]?.id;

    // 8. Create steps and messages
    for (const step of steps) {
      const stepRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_steps`, {
        method: "POST", headers: { ...headers, "Prefer": "return=representation" },
        body: JSON.stringify({
          workspace_id: workspace_id ?? null,
          sequence_id: sequenceId,
          step_number: step.step_number,
          step_name: step.step_name,
          channel: step.channel,
          delay_days: step.delay_days,
          delay_hours: step.delay_hours,
          message_template: step.message_template,
          is_conditional: false,
          conditions: {},
        }),
      });
      const stepData = await stepRes.json();
      const stepId = stepData?.[0]?.id;

      const msg = messages.find((m) => m.step_number === step.step_number);
      if (msg) {
        const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/outreach_messages`, {
          method: "POST", headers: { ...headers, "Prefer": "return=representation" },
          body: JSON.stringify({
            workspace_id: workspace_id ?? null,
            campaign_id: campaignId,
            sequence_id: sequenceId,
            step_id: stepId,
            contact_id: contact_id ?? null,
            contact_name: contact_name ?? null,
            contact_email: contact_email ?? null,
            channel: msg.channel,
            subject_line: msg.subject_line,
            message_body: msg.message_body,
            cta: msg.cta,
            personalization: msg.personalization,
            icebreaker: msg.icebreaker,
            status: "prepared",
            score: msg.score,
          }),
        });
        const msgData = await msgRes.json();
        const messageId = msgData?.[0]?.id;

        if (messageId && msg.variants.length > 0) {
          for (const v of msg.variants) {
            await fetch(`${SUPABASE_URL}/rest/v1/message_variants`, {
              method: "POST", headers,
              body: JSON.stringify({
                workspace_id: workspace_id ?? null,
                message_id: messageId,
                variant_type: v.type,
                variant_content: v.content,
                variant_label: v.label,
                score: v.score,
              }),
            });
          }
        }

        await fetch(`${SUPABASE_URL}/rest/v1/engagement_events`, {
          method: "POST", headers,
          body: JSON.stringify({
            workspace_id: workspace_id ?? null,
            message_id: messageId,
            campaign_id: campaignId,
            event_type: "prepared",
            event_data: { score: msg.score, channel: msg.channel },
          }),
        });
      }
    }

    return new Response(JSON.stringify({
      campaign_id: campaignId,
      sequence_id: sequenceId,
      strategy,
      sequence: { sequence_name: `${campaign_type} sequence`, total_steps: steps.length, total_duration_days: totalDays, steps, send_windows: [{ day_of_week: 3, start_hour: 10, end_hour: 12 }], target_timezone: "America/New_York" },
      messages,
      audience_segment: { segment_name: `${campaign_type} segment`, segment_type: "general", criteria: {}, priority_level: priority ?? "medium", contact_count: 1 },
      channel_recommendations: strategy.primary_channels.map((c: string) => ({ channel: c, score: 0.7, reason: "Recommended for campaign type" })),
      timing_recommendation: { day_of_week: 3, start_hour: 10, end_hour: 12, timezone: "America/New_York", confidence: 0.75, reason: "Optimal send window" },
      engagement_score: { score: Math.min(buyingIntentScore * 0.5 + icpScore * 0.3 + growthScore * 0.2, 1.0), level: "medium", factors: [] },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
