import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const projectRef = "vdiqfiuqckaxdjkadinu";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    const workspaceId = required(body.workspace_id, "workspace_id");
    const accountId = required(body.linkedin_account_id, "linkedin_account_id");
    const target = normalizeLinkedInProfile(required(body.linkedin_profile_url, "linkedin_profile_url"));
    const { admin, userId } = await authorizeLinkedInWorkspace(req, workspaceId);
    if (!userId) throw new Error("Forbidden");
    const { data: member } = await admin.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", userId).maybeSingle();
    if (!member || !["owner", "admin"].includes(member.role)) throw new Error("Forbidden");
    const { data: account } = await admin.from("linkedin_accounts").select("id,connection_state,health_status,profile_url,expected_profile_url")
      .eq("id", accountId).eq("workspace_id", workspaceId).maybeSingle();
    if (!account || account.connection_state !== "connected" || !["healthy", "degraded"].includes(account.health_status) || !account.profile_url || !account.expected_profile_url) {
      return response({ error: "Selected LinkedIn account is not connected and identity-verified." }, 409);
    }
    await admin.from("linkedin_write_acceptance_overrides").update({ disabled_at: new Date().toISOString() })
      .eq("workspace_id", workspaceId).is("consumed_at", null).is("disabled_at", null);
    const { error: targetError } = await admin.from("linkedin_safe_write_targets").upsert({
      workspace_id: workspaceId, linkedin_account_id: accountId, project_ref: projectRef,
      target_identifier: target, allowed_action_types: ["connection_request"], enabled: true,
    }, { onConflict: "workspace_id,linkedin_account_id,project_ref,target_identifier" });
    if (targetError) throw new Error("Could not authorize the controlled target.");
    const { data: override, error: overrideError } = await admin.from("linkedin_write_acceptance_overrides").insert({
      project_ref: projectRef, workspace_id: workspaceId, linkedin_account_id: accountId,
      target_identifier: target, action_type: "connection_request", purpose: "controlled_write_acceptance",
      expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
    }).select("id,expires_at").single();
    if (overrideError) throw new Error("Could not create the one-time authorization.");
    return response({ authorized: true, authorization_id: override.id, expires_at: override.expires_at, action_type: "connection_request", uses: 1 });
  } catch (error) {
    return response({ error: error instanceof Error ? error.message : "Authorization failed" }, authorizationStatus(error));
  }
});

function required(value: unknown, name: string) { if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`); return value.trim(); }
function normalizeLinkedInProfile(value: string) {
  const url = new URL(value);
  if (!/(^|\.)linkedin\.com$/i.test(url.hostname) || !/^\/in\/[A-Za-z0-9_%.-]+\/?$/.test(url.pathname)) throw new Error("A canonical LinkedIn member profile URL is required");
  return `https://www.linkedin.com${url.pathname.replace(/\/$/, "")}`.toLowerCase();
}
function response(body: Record<string, unknown>, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } }); }
