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
    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    let campUrl = `${SUPABASE_URL}/rest/v1/outreach_campaigns?select=id,campaign_status`;
    if (workspaceId) campUrl += `&workspace_id=eq.${workspaceId}`;
    const campRes = await fetch(campUrl, { headers });
    const campaigns = await campRes.json();

    const totalCampaigns = (campaigns ?? []).length;
    const activeCampaigns = (campaigns ?? []).filter((c: { campaign_status: string }) => c.campaign_status === "active").length;
    const draftCampaigns = (campaigns ?? []).filter((c: { campaign_status: string }) => c.campaign_status === "draft").length;
    const completedCampaigns = (campaigns ?? []).filter((c: { campaign_status: string }) => c.campaign_status === "completed").length;

    let msgUrl = `${SUPABASE_URL}/rest/v1/outreach_messages?select=id,status`;
    if (workspaceId) msgUrl += `&workspace_id=eq.${workspaceId}`;
    const msgRes = await fetch(msgUrl, { headers });
    const messages = await msgRes.json();

    const totalMessages = (messages ?? []).length;
    const pendingMessages = (messages ?? []).filter((m: { status: string }) => m.status === "prepared").length;

    let seqUrl = `${SUPABASE_URL}/rest/v1/campaign_sequences?select=id`;
    if (workspaceId) seqUrl += `&workspace_id=eq.${workspaceId}`;
    const seqRes = await fetch(seqUrl, { headers });
    const sequences = await seqRes.json();

    let segUrl = `${SUPABASE_URL}/rest/v1/audience_segments?select=id`;
    if (workspaceId) segUrl += `&workspace_id=eq.${workspaceId}`;
    const segRes = await fetch(segUrl, { headers });
    const segments = await segRes.json();

    const errors: string[] = [];
    if (totalCampaigns === 0) errors.push("No campaigns created");

    return new Response(JSON.stringify({
      healthy: errors.length === 0,
      total_campaigns: totalCampaigns,
      active_campaigns: activeCampaigns,
      draft_campaigns: draftCampaigns,
      completed_campaigns: completedCampaigns,
      total_messages: totalMessages,
      total_sequences: (sequences ?? []).length,
      total_segments: (segments ?? []).length,
      pending_messages: pendingMessages,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
