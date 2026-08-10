// linkedin-conversation-engine — AI conversation analysis
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { authorizeLinkedInWorkspace } from "../_shared/linkedinAuthorization.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const body = await req.json();
    const { action, workspace_id, conversation_id } = body as Record<string, unknown>;

    if (!workspace_id) return jsonError("workspace_id is required", 400);
    const { admin: supabase } = await authorizeLinkedInWorkspace(req, workspace_id);

    switch (action) {
      case "analyze": {
        if (!conversation_id) return jsonError("conversation_id is required", 400);
        const { data: messages } = await supabase.from("linkedin_messages").select("*").eq("conversation_id", conversation_id).eq("workspace_id", workspace_id).order("created_at", { ascending: false }).limit(1);
        if (!messages || messages.length === 0) return jsonError("No messages found", 404);
        const lastMsg = messages[0] as Record<string, unknown>;
        const messageText = (lastMsg.body as string) ?? "";

        // Intent detection
        const lower = messageText.toLowerCase();
        let intent = "general_message";
        let category = "neutral";
        const buyingSignals: string[] = [];
        const signals = ["budget","timeline","decision","implement","solution","problem","challenge","looking for","interested in","pricing","cost","demo","call","meeting"];
        for (const s of signals) { if (lower.includes(s)) buyingSignals.push(s); }
        if (/budget|pricing|cost|quote/.test(lower)) { intent = "budget_inquiry"; category = "buying"; }
        else if (/demo|call|meeting|schedule/.test(lower)) { intent = "meeting_request"; category = "meeting_request"; }
        else if (/expensive|not now|already use/.test(lower)) { intent = "objection"; category = "objection"; }
        else if (/yes|interested|sounds good/.test(lower)) { intent = "positive_response"; category = "positive"; }
        else if (/no|not interested|stop/.test(lower)) { intent = "negative_response"; category = "negative"; }

        // Store analysis
        await supabase.from("linkedin_conversation_intents").insert({
          workspace_id, conversation_id, message_id: lastMsg.id, detected_intent: intent, intent_category: category,
          confidence: Math.min(0.5 + buyingSignals.length * 0.15, 0.95), buying_signals: buyingSignals,
        });

        return jsonResponse({ intent, category, buyingSignals, confidence: Math.min(0.5 + buyingSignals.length * 0.15, 0.95) });
      }
      case "list_conversations": {
        const { data, error } = await supabase.from("linkedin_conversations").select("*").eq("workspace_id", workspace_id).order("last_message_at", { ascending: false, nullsFirst: false });
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ conversations: data });
      }
      case "get_messages": {
        if (!conversation_id) return jsonError("conversation_id is required", 400);
        const { data, error } = await supabase.from("linkedin_messages").select("*").eq("conversation_id", conversation_id).eq("workspace_id", workspace_id).order("created_at", { ascending: true });
        if (error) return jsonError(error.message, 400);
        return jsonResponse({ messages: data });
      }
      default:
        return jsonError(`Unknown action: ${action}`, 400);
    }
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Conversation engine failed", 500);
  }
});

function jsonResponse(d: Record<string, unknown>): Response { return new Response(JSON.stringify(d), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
function jsonError(m: string, s: number): Response { return new Response(JSON.stringify({ error: m }), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
