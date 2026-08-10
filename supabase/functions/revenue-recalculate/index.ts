import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { company_id, workspace_id, all } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    if (all) {
      // Recalculate all profiles in workspace
      let query = `${SUPABASE_URL}/rest/v1/revenue_profiles?select=company_id`;
      if (workspace_id) query += `&workspace_id=eq.${workspace_id}`;

      const profilesRes = await fetch(query, { headers });
      const profiles = await profilesRes.json();

      let recalculated = 0;
      let failed = 0;

      for (const profile of (profiles ?? [])) {
        try {
          await fetch(`${SUPABASE_URL}/functions/v1/revenue-score`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
              "apikey": SERVICE_ROLE_KEY,
            },
            body: JSON.stringify({ company_id: profile.company_id, workspace_id }),
          });
          recalculated++;
        } catch {
          failed++;
        }
      }

      return new Response(JSON.stringify({
        status: "completed",
        recalculated,
        failed,
        total: (profiles ?? []).length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Single company recalculation
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id is required (or set all=true)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const scoreRes = await fetch(`${SUPABASE_URL}/functions/v1/revenue-score`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({ company_id, workspace_id }),
    });

    const scoreData = await scoreRes.json();

    return new Response(JSON.stringify({
      company_id,
      status: "recalculated",
      ...scoreData,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
