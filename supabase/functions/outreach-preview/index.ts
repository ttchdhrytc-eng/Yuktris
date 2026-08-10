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

    const [campRes, seqRes, msgRes, segRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/outreach_campaigns?id=eq.${campaign_id}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/campaign_sequences?campaign_id=eq.${campaign_id}&select=*`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/outreach_messages?campaign_id=eq.${campaign_id}&select=*&order=prepared_at.asc`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/audience_segments?campaign_id=eq.${campaign_id}&select=*`, { headers }),
    ]);

    const [campData, seqData, msgData, segData] = await Promise.all([
      campRes.json(), seqRes.json(), msgRes.json(), segRes.json(),
    ]);

    // Get variants for each message
    const messages = await Promise.all((msgData ?? []).map(async (msg: Record<string, unknown>) => {
      const varRes = await fetch(`${SUPABASE_URL}/rest/v1/message_variants?message_id=eq.${msg.id}&select=*`, { headers });
      const varData = await varRes.json();
      return { ...msg, variants: varData ?? [] };
    }));

    return new Response(JSON.stringify({
      campaign: campData?.[0] ?? null,
      sequences: seqData ?? [],
      messages,
      segments: segData ?? [],
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
