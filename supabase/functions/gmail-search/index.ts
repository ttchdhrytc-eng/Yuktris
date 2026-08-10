import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface SearchBody {
  accessToken: string;
  query: string;
  label?: string;
  maxResults?: number;
  gmailAccountId: string;
  workspaceId?: string;
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
    const body: SearchBody = await req.json();
    const { accessToken, query, label, maxResults, gmailAccountId, workspaceId } = body;

    if (!accessToken || !query) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const limit = maxResults ?? 20;

    // Build search URL
    const params = new URLSearchParams({
      q: query,
      maxResults: String(limit),
    });
    if (label) params.set("labelIds", label);

    const listUrl = `${GMAIL_API_BASE}/messages?${params}`;
    const listResponse = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listResponse.ok) {
      const errData = await listResponse.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: errData.error?.message ?? `Gmail API error (${listResponse.status})` }),
        { status: listResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const listData = await listResponse.json();
    const messages = listData.messages ?? [];
    const results = [];

    // Create Supabase client for persistence
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const { createClient } = await import("jsr:@supabase/supabase-js@2");
    const supabase = createClient(supabaseUrl, supabaseKey);

    for (const msgRef of messages) {
      try {
        const msgUrl = `${GMAIL_API_BASE}/messages/${msgRef.id}?format=full`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!msgResponse.ok) continue;

        const msgData = await msgResponse.json();
        const parsed = parseMessage(msgData, gmailAccountId);
        results.push(parsed);

        // Persist search results to database (upsert avoids duplicates)
        await supabase
          .from("gmail_messages")
          .upsert(parsed, { onConflict: "gmail_account_id,google_message_id" });

        // Update threads
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
        // skip individual failures
      }
    }

    return new Response(
      JSON.stringify({ messages: results, count: results.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Search failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
