import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface RefreshBody {
  accessToken: string;
  gmailAccountId: string;
  workspaceId: string;
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
    body_html: null,
    body_plain: null,
    has_attachments: attachments.length > 0,
    attachments: attachments,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: RefreshBody = await req.json();
    const { accessToken, gmailAccountId } = body;

    if (!accessToken || !gmailAccountId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the current history ID from the account
    const { data: account } = await supabase
      .from("gmail_accounts")
      .select("history_id, last_history_id")
      .eq("id", gmailAccountId)
      .maybeSingle();

    const startHistoryId = account?.last_history_id ?? account?.history_id;

    let unreadCount = 0;
    let newMessages = 0;

    // Get unread count from labels API
    const labelUrl = `${GMAIL_API_BASE}/labels`;
    const labelResponse = await fetch(labelUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (labelResponse.ok) {
      const labelData = await labelResponse.json();
      const inboxLabel = (labelData.labels ?? []).find((l: any) => l.id === "INBOX");
      if (inboxLabel?.messagesUnread !== undefined) {
        unreadCount = inboxLabel.messagesUnread;
      }
    }

    // Perform incremental sync if we have a history ID
    if (startHistoryId) {
      let historyUrl = `${GMAIL_API_BASE}/history?startHistoryId=${startHistoryId}&maxResults=100`;
      const historyResponse = await fetch(historyUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        const historyRecords = historyData.history ?? [];
        let lastHistoryId = startHistoryId;

        for (const record of historyRecords) {
          lastHistoryId = record.id ?? lastHistoryId;

          const messagesAdded = record.messagesAdded ?? [];
          for (const added of messagesAdded) {
            try {
              const msgUrl = `${GMAIL_API_BASE}/messages/${added.message.id}?format=full`;
              const msgResponse = await fetch(msgUrl, {
                headers: { Authorization: `Bearer ${accessToken}` },
              });

              if (!msgResponse.ok) continue;

              const msgData = await msgResponse.json();
              const parsed = parseMessage(msgData, gmailAccountId);

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

              newMessages++;
            } catch {
              // skip individual failures
            }
          }
        }

        // Update account with latest history ID
        await supabase
          .from("gmail_accounts")
          .update({
            last_synced_at: new Date().toISOString(),
            sync_status: "idle",
            last_history_id: lastHistoryId,
            history_id: historyData.historyId ?? lastHistoryId,
            sync_error: null,
            sync_retry_count: 0,
          })
          .eq("id", gmailAccountId);
      } else if (historyResponse.status === 404) {
        // History too old — need full sync, just update timestamp
        await supabase
          .from("gmail_accounts")
          .update({
            last_synced_at: new Date().toISOString(),
            sync_status: "idle",
          })
          .eq("id", gmailAccountId);
      }
    } else {
      // No history ID — just update timestamp
      await supabase
        .from("gmail_accounts")
        .update({
          last_synced_at: new Date().toISOString(),
          sync_status: "idle",
        })
        .eq("id", gmailAccountId);
    }

    return new Response(
      JSON.stringify({ refreshed: true, unreadCount, newMessages }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Refresh failed.";
    return new Response(
      JSON.stringify({ refreshed: false, unreadCount: 0, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
