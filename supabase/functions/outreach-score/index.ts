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
    const { campaign_id } = await req.json();

    if (!campaign_id) {
      return new Response(JSON.stringify({ error: "campaign_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    const msgRes = await fetch(`${SUPABASE_URL}/rest/v1/outreach_messages?campaign_id=eq.${campaign_id}&select=status,channel,subject_line,cta,score`, { headers });
    const messages = await msgRes.json();
    const msgList = messages ?? [];

    const total = msgList.length;
    const sent = msgList.filter((m: { status: string }) => ["sent", "delivered", "opened", "replied"].includes(m.status)).length;
    const opened = msgList.filter((m: { status: string }) => ["opened", "replied"].includes(m.status)).length;
    const replied = msgList.filter((m: { status: string }) => m.status === "replied").length;
    const bounced = msgList.filter((m: { status: string }) => m.status === "bounced").length;

    // Channel performance
    const channelPerf: Record<string, { sent: number; opened: number; replied: number }> = {};
    for (const m of msgList) {
      const ch = (m as { channel: string }).channel;
      if (!channelPerf[ch]) channelPerf[ch] = { sent: 0, opened: 0, replied: 0 };
      if (["sent", "delivered", "opened", "replied"].includes((m as { status: string }).status)) channelPerf[ch].sent++;
      if (["opened", "replied"].includes((m as { status: string }).status)) channelPerf[ch].opened++;
      if ((m as { status: string }).status === "replied") channelPerf[ch].replied++;
    }

    // Best subject lines
    const subjectLines = msgList
      .filter((m: { subject_line: string | null }) => (m as { subject_line: string | null }).subject_line)
      .map((m: { subject_line: string; score: number }) => ({ subject: m.subject_line, score: m.score }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 5);

    // Best CTAs
    const ctas = msgList
      .filter((m: { cta: string | null }) => (m as { cta: string | null }).cta)
      .map((m: { cta: string; score: number }) => ({ cta: m.cta, score: m.score }))
      .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
      .slice(0, 5);

    // Store metrics
    await fetch(`${SUPABASE_URL}/rest/v1/campaign_metrics`, {
      method: "POST", headers,
      body: JSON.stringify({
        campaign_id,
        total_messages: total, total_sent: sent, total_opened: opened, total_replied: replied,
        total_positive_replies: 0, total_meetings_booked: 0, total_proposals_sent: 0,
        total_bounced: bounced, total_failed: msgList.filter((m: { status: string }) => m.status === "failed").length,
        open_rate: sent > 0 ? Math.round((opened / sent) * 100) / 100 : 0,
        reply_rate: sent > 0 ? Math.round((replied / sent) * 100) / 100 : 0,
        positive_reply_rate: 0, meeting_rate: 0, conversion_rate: 0,
        bounce_rate: sent > 0 ? Math.round((bounced / sent) * 100) / 100 : 0,
        channel_performance: channelPerf,
        best_subject_lines: subjectLines.map((s: { subject: string }) => s.subject),
        best_ctas: ctas.map((c: { cta: string }) => c.cta),
      }),
    });

    return new Response(JSON.stringify({
      campaign_id,
      total_messages: total, total_sent: sent, total_opened: opened, total_replied: replied, total_bounced: bounced,
      open_rate: sent > 0 ? Math.round((opened / sent) * 100) / 100 : 0,
      reply_rate: sent > 0 ? Math.round((replied / sent) * 100) / 100 : 0,
      bounce_rate: sent > 0 ? Math.round((bounced / sent) * 100) / 100 : 0,
      channel_performance: channelPerf,
      best_subject_lines: subjectLines,
      best_ctas: ctas,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
