import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { company_name, website, request_type, workspace_id, analysis_id } = await req.json();

    if (!company_name || company_name.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "company_name is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!workspace_id || !analysis_id) return json({ error: "workspace_id and analysis_id are required" }, 400);
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Authentication required" }, 401);
    const membership = await fetch(`${SUPABASE_URL}/rest/v1/workspace_members?workspace_id=eq.${workspace_id}&user_id=eq.${user.id}&status=eq.active&select=workspace_id`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
    });
    const memberships = membership.ok ? await membership.json() : [];
    if (!memberships.length) return json({ error: "Workspace access denied" }, 403);

    const existingRes = await fetch(`${SUPABASE_URL}/rest/v1/research_requests?business_analysis_id=eq.${analysis_id}&select=*&limit=1`, {
      headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
    });
    const existing = existingRes.ok ? (await existingRes.json())[0] : null;
    const existingAgeMs = existing?.created_at ? Date.now() - new Date(existing.created_at).getTime() : 0;
    if (existing && existing.status === "completed") {
      return json({ request_id: existing.id, status: existing.status, resumed: true });
    }
    if (existing && !["failed", "cancelled"].includes(existing.status) && existingAgeMs < 8 * 60 * 1000) {
      return json({ request_id: existing.id, status: existing.status, resumed: true });
    }

    let requestId = existing?.id as string | undefined;
    const createRes = await fetch(`${SUPABASE_URL}/rest/v1/research_requests${requestId ? `?id=eq.${requestId}` : ""}`, {
      method: requestId ? "PATCH" : "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "Prefer": "return=representation",
      },
      body: JSON.stringify({
        ...(requestId ? { error_message: null, completed_at: null } : { workspace_id: workspace_id ?? null, business_analysis_id: analysis_id }),
        company_name: company_name.trim(),
        website: website ?? null,
        request_type: request_type ?? "full_intelligence",
        status: "pending",
        providers_used: ["firecrawl", "tavily"],
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      return new Response(
        JSON.stringify({ error: `Failed to create request: ${errBody}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const requestData = await createRes.json();
    requestId = requestData[0]?.id ?? requestId;
    if (!requestId) return json({ error: "Research request did not return an id" }, 500);

    const workerRequest = fetch(`${SUPABASE_URL}/functions/v1/research-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
      },
      body: JSON.stringify({
        request_id: requestId,
        company_name: company_name.trim(),
        website: website ?? null,
        request_type: request_type ?? "full_intelligence",
        workspace_id: workspace_id ?? null,
      }),
    }).catch((err) => {
      console.error("[research-start] Failed to trigger worker:", err);
    });
    EdgeRuntime.waitUntil(workerRequest);

    return new Response(
      JSON.stringify({
        request_id: requestId,
        status: "pending",
        message: "Research request created and queued for processing.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function json(data: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
