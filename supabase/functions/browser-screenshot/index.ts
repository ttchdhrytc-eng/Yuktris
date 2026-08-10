// ============================================================
// browser-screenshot — List and retrieve browser screenshots
// ============================================================

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
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get("workspace_id");
    const screenshotType = url.searchParams.get("type");
    const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

    let query = supabase
      .from("browser_screenshots")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (workspaceId) query = query.eq("workspace_id", workspaceId);
    if (screenshotType) query = query.eq("screenshot_type", screenshotType);

    const { data, error } = await query;

    if (error) {
      return jsonError(error.message, 400);
    }

    // Generate signed URLs for each screenshot
    const screenshots = await Promise.all((data ?? []).map(async (s) => {
      const { data: urlData } = await supabase.storage
        .from("browser-screenshots")
        .createSignedUrl(s.storage_path, 3600);

      return { ...s, signed_url: urlData?.signedUrl ?? null };
    }));

    return jsonResponse({ screenshots });
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Screenshot fetch failed", 500);
  }
});

function jsonResponse(data: Record<string, unknown>): Response {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
