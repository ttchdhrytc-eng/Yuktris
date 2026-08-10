import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

interface SendBody {
  action: "send" | "reply";
  accessToken: string;
  to: string;
  subject: string;
  body: string;
  html?: string;
  cc?: string;
  bcc?: string;
  threadId?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
  gmailAccountId?: string;
  workspaceId?: string;
}

function encodeBase64Url(input: string): string {
  const b64 = btoa(input);
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function buildRawEmail(to: string, subject: string, body: string, html?: string, cc?: string, bcc?: string): string {
  const lines: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);

  if (html) {
    const boundary = `boundary_${Math.random().toString(36).substring(2)}`;
    lines.push("Content-Type: multipart/alternative; boundary=" + boundary);
    lines.push("MIME-Version: 1.0");
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(body);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(html);
    lines.push("");
    lines.push(`--${boundary}--`);
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("MIME-Version: 1.0");
    lines.push("");
    lines.push(body);
  }

  return encodeBase64Url(lines.join("\r\n"));
}

function buildReplyRawEmail(params: {
  to: string;
  subject: string;
  body: string;
  html?: string;
  messageId?: string;
  inReplyTo?: string;
  references?: string;
}): string {
  const { to, subject, body, html, messageId, inReplyTo, references } = params;

  const lines: string[] = [
    `To: ${to}`,
    `Subject: ${subject}`,
  ];

  // Use Message-ID for proper threading (RFC 2822)
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
  }
  if (references) {
    lines.push(`References: ${references}`);
  } else if (inReplyTo) {
    lines.push(`References: ${inReplyTo}`);
  }

  if (html) {
    const boundary = `boundary_${Math.random().toString(36).substring(2)}`;
    lines.push("Content-Type: multipart/alternative; boundary=" + boundary);
    lines.push("MIME-Version: 1.0");
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(body);
    lines.push("");
    lines.push(`--${boundary}`);
    lines.push("Content-Type: text/html; charset=utf-8");
    lines.push("Content-Transfer-Encoding: 7bit");
    lines.push("");
    lines.push(html);
    lines.push("");
    lines.push(`--${boundary}--`);
  } else {
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("MIME-Version: 1.0");
    lines.push("");
    lines.push(body);
  }

  return encodeBase64Url(lines.join("\r\n"));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: SendBody = await req.json();
    const { action, accessToken, to, subject, body: emailBody, html, cc, bcc, threadId, messageId, inReplyTo, references, gmailAccountId, workspaceId } = body;

    if (!accessToken || !to || !subject || !emailBody) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let raw: string;
    let sendBodyObj: Record<string, unknown> = { raw: "" };

    if (action === "reply" && threadId) {
      // Build reply with proper Message-ID headers for threading
      raw = buildReplyRawEmail({
        to,
        subject,
        body: emailBody,
        html,
        messageId,
        inReplyTo: inReplyTo ?? messageId,
        references: references ?? inReplyTo ?? messageId,
      });
      // Pass threadId in the request body so Gmail API associates the reply with the thread
      sendBodyObj = { raw, threadId };
    } else {
      raw = buildRawEmail(to, subject, emailBody, html, cc, bcc);
      sendBodyObj = { raw };
    }

    const sendUrl = `${GMAIL_API_BASE}/messages/send`;
    const sendResponse = await fetch(sendUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(sendBodyObj),
    });

    if (!sendResponse.ok) {
      const errData = await sendResponse.json().catch(() => ({}));
      return new Response(
        JSON.stringify({ error: errData.error?.message ?? `Send failed (${sendResponse.status})` }),
        { status: sendResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sendData = await sendResponse.json();
    const sentMessageId = sendData.id ?? null;
    const sentThreadId = sendData.threadId ?? threadId ?? null;

    // Store the sent email in the database if we have account context
    if (gmailAccountId && workspaceId && sentMessageId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const { createClient } = await import("jsr:@supabase/supabase-js@2");
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Fetch the sent message details to store in database
      try {
        const msgUrl = `${GMAIL_API_BASE}/messages/${sentMessageId}?format=full`;
        const msgResponse = await fetch(msgUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (msgResponse.ok) {
          const msgData = await msgResponse.json();
          const headers = msgData.payload?.headers ?? [];
          const getHeader = (name: string) => headers.find((h: { name: string; value: string }) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null;

          const labelIds = msgData.labelIds ?? [];
          const sentMessageRecord = {
            gmail_account_id: gmailAccountId,
            google_message_id: sentMessageId,
            thread_id: sentThreadId,
            subject,
            from_email: getHeader("From"),
            to_email: to,
            snippet: emailBody.substring(0, 200),
            label_ids: labelIds,
            received_at: new Date().toISOString(),
            is_read: true,
            is_starred: false,
            is_archived: false,
            message_id_header: getHeader("Message-ID"),
            in_reply_to: inReplyTo ?? null,
            references_header: references ?? inReplyTo ?? null,
            body_html: html ?? null,
            body_plain: emailBody,
            has_attachments: false,
            attachments: [],
          };

          await supabase
            .from("gmail_messages")
            .upsert(sentMessageRecord, { onConflict: "gmail_account_id,google_message_id" });

          // Update or create thread
          if (sentThreadId) {
            const participants = [getHeader("From"), to]
              .filter(Boolean)
              .flatMap((s) => s!.split(",").map((e) => e.trim()));

            await supabase
              .from("gmail_threads")
              .upsert({
                gmail_account_id: gmailAccountId,
                google_thread_id: sentThreadId,
                subject,
                participants,
                last_message_at: new Date().toISOString(),
                last_message_snippet: emailBody.substring(0, 200),
              }, { onConflict: "gmail_account_id,google_thread_id" });
          }
        }
      } catch {
        // Best-effort storage — the email was sent successfully
      }
    }

    return new Response(
      JSON.stringify({ messageId: sentMessageId, threadId: sentThreadId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Send failed.";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
