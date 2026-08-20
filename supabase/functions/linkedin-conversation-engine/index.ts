// linkedin-conversation-engine — autonomous reply, objection, qualification and meeting handoff
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace, authorizationStatus } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};
type Json = Record<string, unknown>;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonError("Method not allowed", 405);

  try {
    const body = await req.json() as Json;
    const workspaceId = requireString(body.workspace_id, "workspace_id");
    const action = typeof body.action === "string" ? body.action : "process_pending";
    const { admin } = await authorizeLinkedInWorkspace(req, workspaceId, { allowServiceRole: true });

    if (action === "process_pending") {
      const { data: replies, error } = await admin.from("linkedin_inbound_replies")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("match_status", "matched")
        .order("received_at", { ascending: true })
        .limit(25);
      if (error) throw new Error(error.message);

      let processed = 0;
      let responsesQueued = 0;
      let meetingsOffered = 0;
      let meetingsBooked = 0;

      for (const reply of replies ?? []) {
        const metadata = (reply.metadata ?? {}) as Json;
        if (metadata.ai_processed_at) continue;
        if (!reply.conversation_id || !reply.contact_id) continue;

        const terminal = ["not_interested", "do_not_contact", "wrong_person"].includes(String(reply.classification));
        if (terminal) {
          await markProcessed(admin, reply.id, metadata, { action: "stop", qualification_state: "disqualified" });
          processed++;
          continue;
        }

        const { data: conversation } = await admin.from("linkedin_conversations").select("*")
          .eq("id", reply.conversation_id).eq("workspace_id", workspaceId).maybeSingle();
        if (!conversation) continue;
        const { data: contact } = await admin.from("contacts").select("*")
          .eq("id", reply.contact_id).eq("workspace_id", workspaceId).maybeSingle();
        const { data: messages } = await admin.from("linkedin_messages").select("direction,body,sent_at,created_at")
          .eq("conversation_id", reply.conversation_id).eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true }).limit(30);

        const { data: openRequest } = await admin.from("linkedin_meeting_requests").select("*")
          .eq("workspace_id", workspaceId).eq("conversation_id", reply.conversation_id)
          .in("status", ["pending", "slots_generated"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
        let slots: Json[] = [];
        if (openRequest) {
          const { data } = await admin.from("linkedin_meeting_slots").select("id,start_time,end_time,timezone,status")
            .eq("workspace_id", workspaceId).eq("meeting_request_id", openRequest.id)
            .in("status", ["available", "proposed"]).order("start_time", { ascending: true }).limit(8);
          slots = (data ?? []) as Json[];
        }

        const decision = await decideReply({
          replyBody: String(reply.body ?? ""),
          classification: String(reply.classification ?? "unknown"),
          prospectName: String(conversation.prospect_name ?? contact?.full_name ?? "Prospect"),
          history: messages ?? [],
          availableSlots: slots,
        });

        if (decision.action === "stop") {
          await admin.from("linkedin_conversations").update({ stage: "closed", health: "inactive", updated_at: new Date().toISOString() })
            .eq("id", reply.conversation_id).eq("workspace_id", workspaceId);
        } else if (decision.action === "confirm_meeting" && openRequest && decision.selected_slot_id && slots.some((s) => s.id === decision.selected_slot_id)) {
          const meeting = await invokeFunction("linkedin-meeting-engine", {
            action: "confirm_meeting",
            workspace_id: workspaceId,
            slot_id: decision.selected_slot_id,
          });
          const meetingUrl = typeof meeting.meeting_url === "string" ? meeting.meeting_url : null;
          const confirmationText = decision.reply_text || (meetingUrl
            ? `Perfect — you're booked. Here is the meeting link: ${meetingUrl}`
            : "Perfect — the meeting is booked. You will receive the calendar details shortly.");
          await queueReply(admin, workspaceId, conversation, contact, reply, confirmationText);
          await admin.from("linkedin_conversations").update({ stage: "meeting_scheduled", health: "active", updated_at: new Date().toISOString() })
            .eq("id", reply.conversation_id).eq("workspace_id", workspaceId);
          meetingsBooked++;
          responsesQueued++;
        } else if (decision.action === "offer_meeting") {
          let request = openRequest;
          if (!request) {
            const { data, error: requestError } = await admin.from("linkedin_meeting_requests").insert({
              workspace_id: workspaceId,
              conversation_id: reply.conversation_id,
              account_id: reply.linkedin_account_id,
              prospect_name: conversation.prospect_name ?? contact?.full_name ?? "Prospect",
              prospect_email: contact?.email ?? contact?.public_email ?? null,
              prospect_timezone: null,
              meeting_type: "discovery",
              duration_minutes: 30,
              preferred_dates: [],
              status: "pending",
              notes: "Meeting intent detected automatically from LinkedIn conversation.",
              metadata: { contact_id: reply.contact_id, inbound_reply_id: reply.id, qualification_state: decision.qualification_state },
            }).select("*").single();
            if (requestError) throw new Error(requestError.message);
            request = data;
          }

          if (!slots.length) {
            const start = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const end = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
            const slotResult = await invokeFunction("linkedin-meeting-engine", {
              action: "generate_slots",
              workspace_id: workspaceId,
              meeting_request_id: request.id,
              start_date: start.toISOString(),
              end_date: end.toISOString(),
              duration_minutes: 30,
              timezone: "UTC",
            });
            slots = Array.isArray(slotResult.slots) ? slotResult.slots as Json[] : [];
          }

          const offered = slots.slice(0, 3);
          if (!offered.length) throw new Error("No available meeting slots could be generated");
          const options = offered.map((s, i) => `${i + 1}) ${formatSlot(String(s.start_time), String(s.timezone ?? "UTC"))}`).join("\n");
          const message = decision.reply_text
            ? `${decision.reply_text}\n\n${options}\n\nWhich works best?`
            : `Happy to set this up. Here are a few options:\n${options}\n\nWhich works best?`;
          await queueReply(admin, workspaceId, conversation, contact, reply, message);
          await admin.from("linkedin_meeting_slots").update({ status: "proposed" })
            .in("id", offered.map((s) => s.id));
          await admin.from("linkedin_conversations").update({ stage: "qualified", updated_at: new Date().toISOString() })
            .eq("id", reply.conversation_id).eq("workspace_id", workspaceId);
          meetingsOffered++;
          responsesQueued++;
        } else if (["reply", "nurture"].includes(decision.action) && decision.reply_text) {
          await queueReply(admin, workspaceId, conversation, contact, reply, decision.reply_text);
          responsesQueued++;
        }

        const contactStatus = decision.qualification_state === "qualified" ? "qualified" :
          decision.qualification_state === "disqualified" ? "disqualified" : "engaged";
        await admin.from("contacts").update({ status: contactStatus, updated_at: new Date().toISOString() })
          .eq("id", reply.contact_id).eq("workspace_id", workspaceId);
        await markProcessed(admin, reply.id, metadata, decision as unknown as Json);
        processed++;
      }

      return jsonResponse({ processed, responses_queued: responsesQueued, meetings_offered: meetingsOffered, meetings_booked: meetingsBooked });
    }

    if (action === "list_conversations") {
      const { data, error } = await admin.from("linkedin_conversations").select("*").eq("workspace_id", workspaceId)
        .order("last_message_at", { ascending: false, nullsFirst: false });
      if (error) throw new Error(error.message);
      return jsonResponse({ conversations: data ?? [] });
    }

    if (action === "get_messages") {
      const conversationId = requireString(body.conversation_id, "conversation_id");
      const { data, error } = await admin.from("linkedin_messages").select("*").eq("conversation_id", conversationId)
        .eq("workspace_id", workspaceId).order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return jsonResponse({ messages: data ?? [] });
    }

    return jsonError(`Unknown action: ${action}`, 400);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Conversation engine failed", authorizationStatus(error));
  }
});

async function decideReply(input: { replyBody: string; classification: string; prospectName: string; history: unknown[]; availableSlots: Json[] }): Promise<{
  action: "stop" | "reply" | "offer_meeting" | "confirm_meeting" | "nurture" | "manual_review";
  qualification_state: "qualified" | "engaged" | "nurture" | "disqualified" | "unknown";
  reply_text: string | null;
  selected_slot_id: string | null;
  confidence: number;
}> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY is not configured");
  const prompt = `Analyze the latest LinkedIn reply and decide the next sales action. Never invent pricing, case studies, guarantees, product capabilities, or calendar availability. If the prospect asks a question that cannot be answered from the conversation, reply briefly and ask one clarifying question. If they clearly want a meeting, offer a meeting. If meeting slots are already listed and the prospect chooses one, return that exact slot id.\n\nProspect: ${input.prospectName}\nLatest reply: ${input.replyBody}\nExisting classifier: ${input.classification}\nConversation history: ${JSON.stringify(input.history)}\nAvailable/proposed slots: ${JSON.stringify(input.availableSlots)}\n\nReturn strict JSON: {"action":"stop|reply|offer_meeting|confirm_meeting|nurture|manual_review","qualification_state":"qualified|engaged|nurture|disqualified|unknown","reply_text":"short natural LinkedIn reply or null","selected_slot_id":"exact provided slot id or null","confidence":0.0}`;
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_CONVERSATION_MODEL") ?? "gpt-4.1-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a conservative B2B sales conversation agent. Respect opt-outs. Output JSON only." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI conversation analysis failed (${res.status})`);
  const data = await res.json();
  const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
  const action = ["stop", "reply", "offer_meeting", "confirm_meeting", "nurture", "manual_review"].includes(parsed.action) ? parsed.action : "manual_review";
  return {
    action,
    qualification_state: ["qualified", "engaged", "nurture", "disqualified", "unknown"].includes(parsed.qualification_state) ? parsed.qualification_state : "unknown",
    reply_text: typeof parsed.reply_text === "string" && parsed.reply_text.trim() ? parsed.reply_text.trim().slice(0, 1200) : null,
    selected_slot_id: typeof parsed.selected_slot_id === "string" && parsed.selected_slot_id ? parsed.selected_slot_id : null,
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence ?? 0.5))),
  } as any;
}

async function queueReply(admin: any, workspaceId: string, conversation: Json, contact: Json | null, inboundReply: Json, message: string): Promise<void> {
  if (!contact?.id) throw new Error("Matched contact is required to queue a LinkedIn reply");
  const { data: job, error } = await admin.from("linkedin_execution_jobs").insert({
    workspace_id: workspaceId,
    linkedin_account_id: conversation.account_id,
    company_id: contact.company_id ?? null,
    contact_id: contact.id,
    campaign_id: inboundReply.campaign_id ?? null,
    sequence_id: inboundReply.sequence_id ?? null,
    sequence_step: 99,
    action_type: "follow_up_message",
    status: "queued",
    priority: 1,
    scheduled_at: new Date().toISOString(),
    action_payload: {
      message,
      conversation_id: conversation.id,
      automated_reply: true,
      inbound_reply_id: inboundReply.id,
    },
  }).select("id").single();
  if (error) throw new Error(`Unable to queue LinkedIn reply: ${error.message}`);
  const { error: markError } = await admin.from("linkedin_inbound_replies").update({
    metadata: { ...((inboundReply.metadata ?? {}) as Json), response_job_id: job.id },
  }).eq("id", inboundReply.id).eq("workspace_id", workspaceId);
  if (markError) throw new Error(markError.message);
}

async function markProcessed(admin: any, replyId: string, previousMetadata: Json, decision: Json): Promise<void> {
  await admin.from("linkedin_inbound_replies").update({
    metadata: { ...previousMetadata, ai_processed_at: new Date().toISOString(), ai_decision: decision },
  }).eq("id", replyId);
}

async function invokeFunction(name: string, body: Json): Promise<Json> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${url}/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, apikey: key },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const payload = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${name} failed (${res.status}): ${payload.error ?? text}`);
  return payload as Json;
}
function formatSlot(value: string, timezone: string): string {
  try { return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: timezone, timeZoneName: "short" }).format(new Date(value)); }
  catch { return new Date(value).toISOString(); }
}
function requireString(value: unknown, name: string): string { if (typeof value !== "string" || !value.trim()) throw new Error(`${name} is required`); return value.trim(); }
function jsonResponse(data: Json): Response { return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(message: string, status: number): Response { return new Response(JSON.stringify({ error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
