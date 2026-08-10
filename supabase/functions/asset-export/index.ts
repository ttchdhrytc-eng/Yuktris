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
    const { format, asset_ids, asset_type, workspace_id } = await req.json();

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
      "apikey": SERVICE_ROLE_KEY,
    };

    let url = `${SUPABASE_URL}/rest/v1/proposal_assets?select=*&order=title.asc`;
    if (workspace_id) url += `&workspace_id=eq.${workspace_id}`;
    if (asset_type) url += `&asset_type=eq.${asset_type}`;
    if (asset_ids && asset_ids.length > 0) url += `&id=in.(${asset_ids.join(',')})`;

    const res = await fetch(url, { headers });
    const assets = await res.json();

    let content = '';
    let mimeType = '';
    let fileExtension = '';

    switch (format) {
      case 'json':
        content = JSON.stringify(assets, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
        break;
      case 'csv':
        const csvHeaders = ['id', 'title', 'description', 'asset_type', 'industry', 'service', 'status', 'approval_status', 'version', 'confidence_score', 'usage_count'];
        const csvRows = (assets ?? []).map((a: Record<string, unknown>) => [
          a.id, `"${(a.title as string ?? '').replace(/"/g, '""')}"`,
          `"${(a.description as string ?? '').replace(/"/g, '""')}"`,
          a.asset_type, a.industry ?? '', a.service ?? '', a.status, a.approval_status,
          a.version, a.confidence_score, a.usage_count,
        ].join(','));
        content = [csvHeaders.join(','), ...csvRows].join('\n');
        mimeType = 'text/csv';
        fileExtension = 'csv';
        break;
      case 'markdown':
        const lines: string[] = ['# Asset Library Export', ''];
        for (const a of (assets ?? [])) {
          lines.push(`## ${(a as Record<string, string>).title}`);
          lines.push(`- **Type:** ${(a as Record<string, string>).asset_type}`);
          lines.push(`- **Industry:** ${(a as Record<string, string>).industry ?? 'N/A'}`);
          lines.push(`- **Status:** ${(a as Record<string, string>).status}`);
          if ((a as Record<string, string>).description) lines.push(`\n${(a as Record<string, string>).description}`);
          lines.push('');
        }
        content = lines.join('\n');
        mimeType = 'text/markdown';
        fileExtension = 'md';
        break;
      default:
        content = JSON.stringify(assets, null, 2);
        mimeType = 'application/json';
        fileExtension = 'json';
    }

    return new Response(JSON.stringify({
      format, mime_type: mimeType, file_extension: fileExtension,
      content, file_size: content.length, asset_count: (assets ?? []).length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
