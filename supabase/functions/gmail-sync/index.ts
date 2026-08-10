import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface SyncBody {
  action: "sync_inbox" | "sync_sent" | "sync_drafts" | "incremental" | "modify_labels";
  accessToken: string;
  gmailAccountId: string;
  workspaceId: string;
  maxResults?: number;
  pageToken?: string;
  messageId?: string;
  addLabels?: string[];
  removeLabels?: string[];
}

function decodeBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  try {
    return atob(pad);
  } catch {
    return "";
  }
}

function extractHeader(headers: { name: string; value: string }[], name: string): string | null {
  const found = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return found?.value ?? null;
}

function extractBody(payload: any): { html: string | null; plain: string | null } {
  let html: string | null = null;
  let plain: string | null = null;

  if (payload?.body?.data) {
    const decoded = decodeBase64Url(payload.body.data);
    if (payload.mimeType?.includes("html")) html = decoded;
    else plain = decoded;
  }

  if (payload?.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        html = decodeBase64Url(part.body.data);
      } else if (part.mimeType === "text/plain" && part.body?.data) {
        plain = decodeBase64Url(part.body.data);
      } else if (part.parts) {
        const nested = extractBody(part);
      }
    }
  }

  return { html, plain };
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
  const subject = extractHeader(headers, "Subject");
  const from = extractHeader(headers, "From");
  const to = extractHeader(headers, "To");
  const dateStr = extractHeader(headers, "Date");
  const messageIdHeader = extractHeader(headers, "Message-ID");
  const inReplyTo = extractHeader(headers, "In-Reply-To");
  const referencesHeader = extractHeader(headers, "References");
  const receivedAt = dateStr ? new Date(dateStr).toISOString() : null;
  const labelIds = msg.labelIds ?? [];
  const isRead = !labelIds.includes("UNREAD");
  const isStarred = labelIds.includes("STARRED");
  const isArchived = !labelIds.includes("INBOX") && labelIds.length > 0;

  let snippet = msg.snippet ?? "";
  if (snippet.length > 200) snippet = snippet.substring(0, 200) + "...";

  const { html, plain } = extractBody(msg.payload);
  const attachments = extractAttachments(msg.payload);

  return {
    gmail_account_id: gmailAccountId,
    google_message_id: msg.id,
    thread_id: msg.threadId ?? null,
    subject,
    from_email: from,
    to_email: to,
    snippet,
    label_ids: labelIds,
    received_at: receivedAt,
    is_read: isRead,
    is_starred: isStarred,
    is_archived: isArchived,
    message_id_header: messageIdHeader,
    in_reply_to: inReplyTo,
    references_header: referencesHeader,
    body_html: html,
    body_plain: plain,
    has_attachments: attachments.length > 0,
    attachments: attachments,
  };
}

async function fetchMessageDetails(accessToken: string, messageId: string, gmailAccountId: string, format: string = "full") {
  const msgUrl = `${GMAIL_API_BASE}/messages/${messageId}?format=${format}`;
  const msgResponse = await fetch(msgUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!msgResponse.ok) return null;

  const msgData = await msgResponse.json();
  return parseMessage(msgData, gmailAccountId);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: SyncBody = await req.json();
    const { action, accessToken, gmailAccountId, workspaceId, maxResults, pageToken, messageId, addLabels, removeLabels } = body;

    if (!action || !accessToken || !gmailAccountId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Handle label modification (archive, mark read/unread, star/unstar)
    if (action === "modify_labels" && messageId) {
      const modifyUrl = `${GMAIL_API_BASE}/messages/${messageId}/modify`;
      const modifyBody: Record<string, unknown> = {};
      if (addLabels) modifyBody.addLabelIds = addLabels;
      if (removeLabels) modifyBody.removeLabelIds = removeLabels;

      const modifyResponse = await fetch(modifyUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(modifyBody),
      });

      if (!modifyResponse.ok) {
        const errData = await modifyResponse.json().catch(() => ({}));
        return new Response(
          JSON.stringify({ error: errData.error?.message ?? `Modify failed (${modifyResponse.status})` }),
          { status: modifyResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updatedMsg = await modifyResponse.json();
      const labelIds = updatedMsg.labelIds ?? [];
      const isRead = !labelIds.includes("UNREAD");
      const isStarred = labelIds.includes("STARRED");
      const isArchived = !labelIds.includes("INBOX");

      // Update local database
      const updateData: Record<string, unknown> = {
        is_read: isRead,
        is_starred: isStarred,
        is_archived: isArchived,
        label_ids: labelIds,
      };

      await supabase
        .from("gmail_messages")
        .update(updateData)
        .eq("google_message_id", messageId)
        .eq("gmail_account_id", gmailAccountId);

      return new Response(
        JSON.stringify({ success: true, isRead, isStarred, isArchived, labelIds }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle incremental sync using history API
    if (action === "incremental") {
      const { data: account } = await supabase
        .from("gmail_accounts")
        .select("history_id, last_history_id")
        .eq("id", gmailAccountId)
        .maybeSingle();

      const startHistoryId = account?.last_history_id ?? account?.history_id;

      if (!startHistoryId) {
        // No history ID — fall back to full sync
        return await fullSync(accessToken, gmailAccountId, "INBOX", maxResults ?? 50, pageToken, supabase);
      }

      let historyUrl = `${GMAIL_API_BASE}/history?startHistoryId=${startHistoryId}&maxResults=${maxResults ?? 100}`;
      const historyResponse = await fetch(historyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!historyResponse.ok) {
        // History API can return 404 if history is too old — fall back to full sync
        if (historyResponse.status === 404) {
          return await fullSync(accessToken, gmailAccountId, "INBOX", maxResults ?? 50, pageToken, supabase);
        }
        const errData = await historyResponse.json().catch(() => ({}));
        await supabase.from("gmail_accounts").update({ sync_status: "error", sync_error: errData.error?.message ?? "History API error" }).eq("id", gmailAccountId);
        return new Response(
          JSON.stringify({ error: errData.error?.message ?? "History API error", synced: 0, errors: 1 }),
          { status: historyResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const historyData = await historyResponse.json();
      const historyRecords = historyData.history ?? [];
      let synced = 0;
      let errors = 0;
      let lastHistoryId = startHistoryId;

      for (const record of historyRecords) {
        lastHistoryId = record.id ?? lastHistoryId;

        // Process messages added
        const messagesAdded = record.messagesAdded ?? [];
        for (const added of messagesAdded) {
          try {
            const parsed = await fetchMessageDetails(accessToken, added.message.id, gmailAccountId, "full");
            if (parsed) {
              await supabase
                .from("gmail_messages")
                .upsert(parsed, { onConflict: "gmail_account_id,google_message_id" });

              if (parsed.thread_id) {
                const participants = [parsed.from_email, parsed.to_email]
                  .filter(Boolean)
                  .flatMap((s) => s!.split(",").map((e) => e.trim()));

                await supabase
                  .from("gmail_threads")
                  .upsert({
                    gmail_account_id: gmailAccountId,
                    google_thread_id: parsed.thread_id,
                    subject: parsed.subject,
                    participants,
                    last_message_at: parsed.received_at,
                    last_message_snippet: parsed.snippet,
                  }, { onConflict: "gmail_account_id,google_thread_id" });
              }

              synced++;
            }
          } catch {
            errors++;
          }
        }

        // Process messages deleted
        const messagesDeleted = record.messagesDeleted ?? [];
        for (const deleted of messagesDeleted) {
          try {
            await supabase
              .from("gmail_messages")
              .update({ label_ids: [] })
              .eq("google_message_id", deleted.message.id)
              .eq("gmail_account_id", gmailAccountId);
          } catch {
            // Best-effort
          }
        }
      }

      // Update account with latest history ID
      await supabase
        .from("gmail_accounts")
        .update({
          sync_status: "idle",
          last_synced_at: new Date().toISOString(),
          last_history_id: lastHistoryId,
          history_id: historyData.historyId ?? lastHistoryId,
          sync_error: null,
          sync_retry_count: 0,
        })
        .eq("id", gmailAccountId);

      return new Response(
        JSON.stringify({ synced, errors, historyId: lastHistoryId, nextPageToken: null, hasMore: false }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle full sync (inbox/sent/drafts)
    let label = "INBOX";
    if (action === "sync_sent") label = "SENT";
    if (action === "sync_drafts") label = "DRAFT";

    return await fullSync(accessToken, gmailAccountId, label, maxResults ?? 50, pageToken, supabase);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed.";
    return new Response(
      JSON.stringify({ error: message, synced: 0, errors: 1 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function fullSync(accessToken: string, gmailAccountId: string, label: string, maxResults: number, pageToken: string | undefined, supabase: any) {
  await supabase
    .from("gmail_accounts")
    .update({ sync_status: "syncing" })
    .eq("id", gmailAccountId);

  let listUrl = `${GMAIL_API_BASE}/messages?maxResults=${maxResults}&labelIds=${encodeURIComponent(label)}`;
  if (pageToken) listUrl += `&pageToken=${encodeURIComponent(pageToken)}`;

  const listResponse = await fetch(listUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!listResponse.ok) {
    const errData = await listResponse.json().catch(() => ({}));
    await supabase.from("gmail_accounts").update({ sync_status: "error", sync_error: errData.error?.message ?? "Gmail API error" }).eq("id", gmailAccountId);
    return new Response(
      JSON.stringify({ error: errData.error?.message ?? `Gmail API error (${listResponse.status})`, synced: 0, errors: 1, nextPageToken: null, hasMore: false }),
      { status: listResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const listData = await listResponse.json();
  const messages = listData.messages ?? [];
  const nextPageToken = listData.nextPageToken ?? null;

  let synced = 0;
  let errors = 0;
  let historyId: string | null = null;

  for (const msgRef of messages) {
    try {
      const parsed = await fetchMessageDetails(accessToken, msgRef.id, gmailAccountId, "full");
      if (!parsed) {
        errors++;
        continue;
      }

      if (!historyId && parsed.received_at) historyId = msgRef.threadId;

      const { error: upsertError } = await supabase
        .from("gmail_messages")
        .upsert(parsed, { onConflict: "gmail_account_id,google_message_id" });

      if (upsertError) {
        errors++;
      } else {
        synced++;
      }

      if (parsed.thread_id) {
        const participants = [parsed.from_email, parsed.to_email]
          .filter(Boolean)
          .flatMap((s) => s!.split(",").map((e) => e.trim()));

        await supabase
          .from("gmail_threads")
          .upsert({
            gmail_account_id: gmailAccountId,
            google_thread_id: parsed.thread_id,
            subject: parsed.subject,
            participants,
            last_message_at: parsed.received_at,
            last_message_snippet: parsed.snippet,
          }, { onConflict: "gmail_account_id,google_thread_id" });
      }
    } catch {
      errors++;
    }
  }

  // Update sync status
  await supabase
    .from("gmail_accounts")
    .update({
      sync_status: errors > 0 && synced === 0 ? "error" : "idle",
      last_synced_at: new Date().toISOString(),
      history_id: historyId,
      next_page_token: nextPageToken,
      full_sync_completed: nextPageToken ? false : true,
      sync_error: errors > 0 && synced === 0 ? "Sync failed" : null,
      sync_retry_count: 0,
    })
    .eq("id", gmailAccountId);

  return new Response(
    JSON.stringify({ synced, errors, historyId, nextPageToken, hasMore: !!nextPageToken }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}
