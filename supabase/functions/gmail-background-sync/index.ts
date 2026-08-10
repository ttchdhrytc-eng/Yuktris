import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const MAX_RETRIES = 3;

async function getGoogleCredentials(supabase: { rpc: (fn: string, args: Record<string, string>) => Promise<{ data: string | null }> }): Promise<{ clientId: string; clientSecret: string } | null> {
  let clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  let clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (clientId && clientSecret) return { clientId, clientSecret };

  const { data: idData } = await supabase.rpc("get_google_secret", { secret_name: "GOOGLE_CLIENT_ID" });
  const { data: secretData } = await supabase.rpc("get_google_secret", { secret_name: "GOOGLE_CLIENT_SECRET" });
  clientId = idData ?? null;
  clientSecret = secretData ?? null;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

async function refreshAccessToken(supabase: any, accountId: string): Promise<string | null> {
  const { data: token } = await supabase
    .from("oauth_tokens")
    .select("refresh_token")
    .eq("google_account_id", accountId)
    .maybeSingle();

  if (!token?.refresh_token) return null;

  const creds = await getGoogleCredentials(supabase);
  if (!creds) return null;

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const isInvalidGrant = errData.error === "invalid_grant";
    await supabase
      .from("google_accounts")
      .update({ status: isInvalidGrant ? "revoked" : "expired" })
      .eq("id", accountId);
    return null;
  }

  const tokenData = await response.json();
  const expiresAt = new Date(Date.now() + (tokenData.expires_in ?? 3600) * 1000).toISOString();

  const newRefreshToken = tokenData.refresh_token ?? token.refresh_token;

  await supabase
    .from("oauth_tokens")
    .update({
      access_token: tokenData.access_token,
      refresh_token: newRefreshToken,
      expires_at: expiresAt,
    })
    .eq("google_account_id", accountId);

  await supabase
    .from("google_accounts")
    .update({ status: "connected" })
    .eq("id", accountId);

  return tokenData.access_token;
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  try { return atob(pad); } catch { return ""; }
}

function extractHeader(headers: { name: string; value: string }[], name: string): string | null {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;
}

function extractAttachments(payload: any): { filename: string; mimeType: string; size: number; attachmentId: string }[] {
  const attachments: { filename: string; mimeType: string; size: number; attachmentId: string }[] = [];
  if (payload?.parts) {
    for (const part of payload.parts) {
      if (part.filename && part.body?.attachmentId) {
        attachments.push({
          filename: part.filename,
          mimeType: part.mimeType ?? "application/octet-stream",
          size: part.body.size ?? 0,
          attachmentId: part.body.attachmentId,
        });
      } else if (part.parts) {
        attachments.push(...extractAttachments(part));
      }
    }
  }
  return attachments;
}

function parseMessage(msg: any, gmailAccountId: string) {
  const headers = msg.payload?.headers ?? [];
  const labelIds = msg.labelIds ?? [];
  const attachments = extractAttachments(msg.payload);

  let snippet = msg.snippet ?? "";
  if (snippet.length > 200) snippet = snippet.substring(0, 200) + "...";

  return {
    gmail_account_id: gmailAccountId,
    google_message_id: msg.id,
    thread_id: msg.threadId ?? null,
    subject: extractHeader(headers, "Subject"),
    from_email: extractHeader(headers, "From"),
    to_email: extractHeader(headers, "To"),
    snippet,
    label_ids: labelIds,
    received_at: extractHeader(headers, "Date") ? new Date(extractHeader(headers, "Date")!).toISOString() : null,
    is_read: !labelIds.includes("UNREAD"),
    is_starred: labelIds.includes("STARRED"),
    is_archived: !labelIds.includes("INBOX") && labelIds.length > 0,
    message_id_header: extractHeader(headers, "Message-ID"),
    in_reply_to: extractHeader(headers, "In-Reply-To"),
    references_header: extractHeader(headers, "References"),
    body_html: null,
    body_plain: null,
    has_attachments: attachments.length > 0,
    attachments,
  };
}

async function syncAccount(supabase: any, gmailAccount: any): Promise<{ synced: number; errors: number }> {
  const { data: googleAccount } = await supabase
    .from("google_accounts")
    .select("id, status")
    .eq("id", gmailAccount.google_account_id)
    .maybeSingle();

  if (!googleAccount || googleAccount.status === "disconnected" || googleAccount.status === "revoked") {
    return { synced: 0, errors: 0 };
  }

  // Get access token
  const { data: token } = await supabase
    .from("oauth_tokens")
    .select("access_token, expires_at, refresh_token")
    .eq("google_account_id", gmailAccount.google_account_id)
    .maybeSingle();

  if (!token) return { synced: 0, errors: 0 };

  let accessToken = token.access_token;
  const isExpired = token.expires_at ? new Date(token.expires_at) <= new Date() : false;

  if (isExpired || !accessToken) {
    accessToken = await refreshAccessToken(supabase, gmailAccount.google_account_id);
    if (!accessToken) {
      await supabase
        .from("gmail_accounts")
        .update({ sync_status: "error", sync_error: "Token refresh failed", sync_retry_count: (gmailAccount.sync_retry_count ?? 0) + 1 })
        .eq("id", gmailAccount.id);
      return { synced: 0, errors: 1 };
    }
  }

  // Skip if already syncing
  if (gmailAccount.sync_status === "syncing") {
    return { synced: 0, errors: 0 };
  }

  // Perform incremental sync
  const startHistoryId = gmailAccount.last_history_id ?? gmailAccount.history_id;

  if (!startHistoryId) {
    // No history ID — do a full sync of inbox
    await supabase.from("gmail_accounts").update({ sync_status: "syncing" }).eq("id", gmailAccount.id);

    const listUrl = `${GMAIL_API_BASE}/messages?maxResults=50&labelIds=INBOX`;
    const listResponse = await fetch(listUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!listResponse.ok) {
      await supabase.from("gmail_accounts").update({ sync_status: "error", sync_error: "Full sync failed" }).eq("id", gmailAccount.id);
      return { synced: 0, errors: 1 };
    }

    const listData = await listResponse.json();
    let synced = 0;
    let errors = 0;

    for (const msgRef of (listData.messages ?? [])) {
      try {
        const msgUrl = `${GMAIL_API_BASE}/messages/${msgRef.id}?format=full`;
        const msgResponse = await fetch(msgUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!msgResponse.ok) { errors++; continue; }

        const msgData = await msgResponse.json();
        const parsed = parseMessage(msgData, gmailAccount.id);

        await supabase.from("gmail_messages").upsert(parsed, { onConflict: "gmail_account_id,google_message_id" });

        if (parsed.thread_id) {
          const participants = [parsed.from_email, parsed.to_email].filter(Boolean).flatMap((s) => s!.split(",").map((e) => e.trim()));
          await supabase.from("gmail_threads").upsert({
            gmail_account_id: gmailAccount.id,
            google_thread_id: parsed.thread_id,
            subject: parsed.subject,
            participants,
            last_message_at: parsed.received_at,
            last_message_snippet: parsed.snippet,
          }, { onConflict: "gmail_account_id,google_thread_id" });
        }

        synced++;
      } catch { errors++; }
    }

    await supabase.from("gmail_accounts").update({
      sync_status: "idle",
      last_synced_at: new Date().toISOString(),
      history_id: listData.historyId,
      last_history_id: listData.historyId,
      full_sync_completed: true,
      sync_error: null,
      sync_retry_count: 0,
    }).eq("id", gmailAccount.id);

    return { synced, errors };
  }

  // Incremental sync using history API
  await supabase.from("gmail_accounts").update({ sync_status: "syncing" }).eq("id", gmailAccount.id);

  const historyUrl = `${GMAIL_API_BASE}/history?startHistoryId=${startHistoryId}&maxResults=100`;
  const historyResponse = await fetch(historyUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

  if (!historyResponse.ok) {
    if (historyResponse.status === 404) {
      // History too old — reset to trigger full sync next time
      await supabase.from("gmail_accounts").update({
        sync_status: "idle",
        last_history_id: null,
        history_id: null,
      }).eq("id", gmailAccount.id);
      return { synced: 0, errors: 0 };
    }
    await supabase.from("gmail_accounts").update({
      sync_status: "error",
      sync_error: "History API error",
      sync_retry_count: (gmailAccount.sync_retry_count ?? 0) + 1,
    }).eq("id", gmailAccount.id);
    return { synced: 0, errors: 1 };
  }

  const historyData = await historyResponse.json();
  const historyRecords = historyData.history ?? [];
  let synced = 0;
  let errors = 0;
  let lastHistoryId = startHistoryId;

  for (const record of historyRecords) {
    lastHistoryId = record.id ?? lastHistoryId;

    for (const added of (record.messagesAdded ?? [])) {
      try {
        const msgUrl = `${GMAIL_API_BASE}/messages/${added.message.id}?format=full`;
        const msgResponse = await fetch(msgUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        if (!msgResponse.ok) { errors++; continue; }

        const msgData = await msgResponse.json();
        const parsed = parseMessage(msgData, gmailAccount.id);

        await supabase.from("gmail_messages").upsert(parsed, { onConflict: "gmail_account_id,google_message_id" });

        if (parsed.thread_id) {
          const participants = [parsed.from_email, parsed.to_email].filter(Boolean).flatMap((s) => s!.split(",").map((e) => e.trim()));
          await supabase.from("gmail_threads").upsert({
            gmail_account_id: gmailAccount.id,
            google_thread_id: parsed.thread_id,
            subject: parsed.subject,
            participants,
            last_message_at: parsed.received_at,
            last_message_snippet: parsed.snippet,
          }, { onConflict: "gmail_account_id,google_thread_id" });
        }

        synced++;
      } catch { errors++; }
    }
  }

  await supabase.from("gmail_accounts").update({
    sync_status: "idle",
    last_synced_at: new Date().toISOString(),
    last_history_id: lastHistoryId,
    history_id: historyData.historyId ?? lastHistoryId,
    sync_error: errors > 0 && synced === 0 ? "Sync had errors" : null,
    sync_retry_count: 0,
  }).eq("id", gmailAccount.id);

  return { synced, errors };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all gmail accounts that need syncing
    // Skip accounts that are already syncing or have too many retries
    const { data: accounts } = await supabase
      .from("gmail_accounts")
      .select("*")
      .in("sync_status", ["idle", "error"])
      .lt("sync_retry_count", MAX_RETRIES);

    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({ message: "No accounts need syncing.", synced: 0, errors: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSynced = 0;
    let totalErrors = 0;
    const results = [];

    for (const account of accounts) {
      const result = await syncAccount(supabase, account);
      totalSynced += result.synced;
      totalErrors += result.errors;
      results.push({ accountId: account.id, ...result });
    }

    return new Response(
      JSON.stringify({
        message: "Background sync complete.",
        accountsProcessed: accounts.length,
        synced: totalSynced,
        errors: totalErrors,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Background sync failed.";
    return new Response(
      JSON.stringify({ error: message, synced: 0, errors: 1 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
