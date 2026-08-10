import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

export interface LinkedInAuthorization {
  admin: SupabaseClient;
  userId: string | null;
  internalService: boolean;
}

export async function authorizeLinkedInWorkspace(
  req: Request,
  workspaceId: unknown,
  options: { allowServiceRole?: boolean } = {},
): Promise<LinkedInAuthorization> {
  if (typeof workspaceId !== "string" || !workspaceId) throw new Error("workspace_id is required");
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) throw new Error("Server authentication is not configured");

  const authorization = req.headers.get("Authorization") || "";
  const bearer = authorization.replace(/^Bearer\s+/i, "");
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  if (options.allowServiceRole && bearer && bearer === serviceKey) {
    return { admin, userId: null, internalService: true };
  }
  if (!bearer) throw new Error("Unauthorized");

  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${bearer}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("Unauthorized");
  const { data: membership, error: membershipError } = await admin.from("workspace_members")
    .select("workspace_id").eq("workspace_id", workspaceId).eq("user_id", data.user.id).maybeSingle();
  if (membershipError || !membership) throw new Error("Forbidden");
  return { admin, userId: data.user.id, internalService: false };
}

export function authorizationStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : "";
  if (message === "Unauthorized") return 401;
  if (message === "Forbidden") return 403;
  return 500;
}
