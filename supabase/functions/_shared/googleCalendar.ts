import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface WorkspaceGoogleCalendarContext {
  accountId: string;
  email: string;
  accessToken: string;
  calendarId: string;
}

interface OAuthTokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
}

async function getGoogleCredentials(admin: SupabaseClient): Promise<{ clientId: string; clientSecret: string }> {
  let clientId = Deno.env.get("GOOGLE_CLIENT_ID") ?? null;
  let clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") ?? null;

  if (!clientId) {
    const { data } = await admin.rpc("get_google_secret", { secret_name: "GOOGLE_CLIENT_ID" });
    clientId = typeof data === "string" ? data : null;
  }
  if (!clientSecret) {
    const { data } = await admin.rpc("get_google_secret", { secret_name: "GOOGLE_CLIENT_SECRET" });
    clientSecret = typeof data === "string" ? data : null;
  }
  if (!clientId || !clientSecret) throw new Error("Google OAuth credentials are not configured");
  return { clientId, clientSecret };
}

async function refreshAccessToken(admin: SupabaseClient, accountId: string, token: OAuthTokenRow): Promise<string> {
  if (!token.refresh_token) throw new Error("Google Calendar connection requires reconnection");
  const credentials = await getGoogleCredentials(admin);
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || typeof payload.access_token !== "string") {
    await admin.from("google_accounts").update({ status: "expired" }).eq("id", accountId);
    throw new Error("Google Calendar token refresh failed; reconnect Google Calendar");
  }
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  await admin.from("oauth_tokens").update({
    access_token: payload.access_token,
    refresh_token: typeof payload.refresh_token === "string" ? payload.refresh_token : token.refresh_token,
    expires_at: expiresAt,
    scope: typeof payload.scope === "string" ? payload.scope : token.scope,
  }).eq("google_account_id", accountId);
  await admin.from("google_accounts").update({ status: "connected", last_synced_at: new Date().toISOString() }).eq("id", accountId);
  return payload.access_token;
}

export async function getWorkspaceGoogleCalendarContext(admin: SupabaseClient, workspaceId: string): Promise<WorkspaceGoogleCalendarContext> {
  const { data: accounts, error: accountError } = await admin.from("google_accounts")
    .select("id,email,is_primary,status")
    .eq("workspace_id", workspaceId)
    .in("status", ["connected", "expired"])
    .order("is_primary", { ascending: false })
    .order("connected_at", { ascending: true })
    .limit(1);
  if (accountError) throw new Error(`Unable to load Google Calendar account: ${accountError.message}`);
  const account = accounts?.[0] as { id: string; email: string; status: string } | undefined;
  if (!account) throw new Error("No connected Google account with Calendar access");

  const { data: tokenData, error: tokenError } = await admin.from("oauth_tokens")
    .select("access_token,refresh_token,expires_at,scope")
    .eq("google_account_id", account.id)
    .maybeSingle();
  if (tokenError || !tokenData) throw new Error("Google Calendar OAuth token is missing");
  const token = tokenData as OAuthTokenRow;
  const scopes = (token.scope ?? "").split(/\s+/).filter(Boolean);
  const hasCalendar = scopes.includes("https://www.googleapis.com/auth/calendar") || scopes.includes("https://www.googleapis.com/auth/calendar.events");
  if (!hasCalendar) throw new Error("Google account is missing Calendar permission; reconnect Google with Calendar access");

  const expiresAt = token.expires_at ? new Date(token.expires_at).getTime() : 0;
  let accessToken = token.access_token;
  if (!accessToken || !expiresAt || expiresAt < Date.now() + 60_000) {
    accessToken = await refreshAccessToken(admin, account.id, token);
  }

  return { accountId: account.id, email: account.email, accessToken, calendarId: "primary" };
}

async function googleRequest<T>(url: string, accessToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => ({})) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data?.error?.message ?? `Google Calendar API error (${response.status})`);
  return data;
}

export async function queryFreeBusy(params: {
  context: WorkspaceGoogleCalendarContext;
  timeMin: string;
  timeMax: string;
  timezone?: string;
}): Promise<Array<{ start: string; end: string }>> {
  const data = await googleRequest<{ calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }> }>(
    `${GOOGLE_CALENDAR_API}/freeBusy`,
    params.context.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        timeMin: params.timeMin,
        timeMax: params.timeMax,
        timeZone: params.timezone ?? "UTC",
        items: [{ id: params.context.calendarId }],
      }),
    },
  );
  return data.calendars?.[params.context.calendarId]?.busy ?? [];
}

export interface CreatedCalendarEvent {
  externalEventId: string;
  meetLink: string | null;
  htmlLink: string | null;
  status: string;
}

export async function createGoogleCalendarEvent(params: {
  context: WorkspaceGoogleCalendarContext;
  summary: string;
  description?: string;
  start: string;
  end: string;
  timezone?: string;
  attendeeEmails?: string[];
  requestId?: string;
}): Promise<CreatedCalendarEvent> {
  const calendarId = encodeURIComponent(params.context.calendarId);
  const requestId = params.requestId ?? crypto.randomUUID();
  const attendees = [...new Set((params.attendeeEmails ?? []).filter(Boolean))].map((email) => ({ email }));
  const data = await googleRequest<Record<string, unknown>>(
    `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events?conferenceDataVersion=1&sendUpdates=all`,
    params.context.accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        summary: params.summary,
        description: params.description ?? "Scheduled automatically by Yuktris",
        start: { dateTime: params.start, timeZone: params.timezone ?? "UTC" },
        end: { dateTime: params.end, timeZone: params.timezone ?? "UTC" },
        attendees,
        guestsCanInviteOthers: false,
        guestsCanModify: false,
        conferenceData: {
          createRequest: {
            requestId,
            conferenceSolutionKey: { type: "hangoutsMeet" },
          },
        },
      }),
    },
  );
  const conferenceData = data.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
  const meetLink = typeof data.hangoutLink === "string"
    ? data.hangoutLink
    : conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ?? null;
  if (typeof data.id !== "string") throw new Error("Google Calendar did not return an event id");
  return {
    externalEventId: data.id,
    meetLink,
    htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : null,
    status: typeof data.status === "string" ? data.status : "confirmed",
  };
}

export async function updateGoogleCalendarEvent(params: {
  context: WorkspaceGoogleCalendarContext;
  eventId: string;
  start?: string;
  end?: string;
  timezone?: string;
  summary?: string;
  description?: string;
}): Promise<CreatedCalendarEvent> {
  const calendarId = encodeURIComponent(params.context.calendarId);
  const eventId = encodeURIComponent(params.eventId);
  const body: Record<string, unknown> = {};
  if (params.start) body.start = { dateTime: params.start, timeZone: params.timezone ?? "UTC" };
  if (params.end) body.end = { dateTime: params.end, timeZone: params.timezone ?? "UTC" };
  if (params.summary) body.summary = params.summary;
  if (params.description) body.description = params.description;
  const data = await googleRequest<Record<string, unknown>>(
    `${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${eventId}?conferenceDataVersion=1&sendUpdates=all`,
    params.context.accessToken,
    { method: "PATCH", body: JSON.stringify(body) },
  );
  const conferenceData = data.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined;
  return {
    externalEventId: typeof data.id === "string" ? data.id : params.eventId,
    meetLink: typeof data.hangoutLink === "string" ? data.hangoutLink : conferenceData?.entryPoints?.find((entry) => entry.entryPointType === "video")?.uri ?? null,
    htmlLink: typeof data.htmlLink === "string" ? data.htmlLink : null,
    status: typeof data.status === "string" ? data.status : "confirmed",
  };
}

export async function deleteGoogleCalendarEvent(context: WorkspaceGoogleCalendarContext, eventId: string): Promise<void> {
  const calendarId = encodeURIComponent(context.calendarId);
  const response = await fetch(`${GOOGLE_CALENDAR_API}/calendars/${calendarId}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${context.accessToken}` },
  });
  if (!response.ok && response.status !== 404 && response.status !== 410) {
    const data = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(data.error?.message ?? `Google Calendar delete failed (${response.status})`);
  }
}
