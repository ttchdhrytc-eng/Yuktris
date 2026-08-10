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
    const { assets, workspace_id, created_by } = await req.json();

    if (!assets || !Array.isArray(assets)) {
      return new Response(JSON.stringify({ error: "assets array is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of assets) {
      try {
        if (!row.title || !row.asset_type) {
          failed++;
          errors.push(`Missing required fields: ${row.title ?? 'unnamed'}`);
          continue;
        }

        const res = await fetch(`${SUPABASE_URL}/rest/v1/proposal_assets`, {
          method: "POST",
          headers: { ...headers, "Prefer": "return=representation" },
          body: JSON.stringify({
            workspace_id: workspace_id ?? null,
            title: row.title,
            description: row.description ?? null,
            asset_type: row.asset_type,
            industry: row.industry ?? null,
            service: row.service ?? null,
            content: row.content ?? {},
            content_text: row.content_text ?? null,
            language: row.language ?? 'en',
            status: 'draft',
            approval_status: 'pending',
            owner: row.owner ?? null,
            created_by: created_by ?? null,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          failed++;
          errors.push(`Failed: ${row.title}: ${(data as { message?: string }).message ?? 'Unknown'}`);
          continue;
        }

        const assetId = data?.[0]?.id;

        if (assetId) {
          await fetch(`${SUPABASE_URL}/rest/v1/asset_versions`, {
            method: "POST",
            headers,
            body: JSON.stringify({
              workspace_id: workspace_id ?? null,
              asset_id: assetId,
              version_number: 1,
              content: row.content ?? {},
              content_text: row.content_text ?? null,
              change_summary: 'Imported',
              created_by: created_by ?? null,
            }),
          });
        }

        imported++;
      } catch (err) {
        failed++;
        errors.push(`Error: ${row.title}: ${(err as Error).message}`);
      }
    }

    return new Response(JSON.stringify({ imported, failed, errors }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
