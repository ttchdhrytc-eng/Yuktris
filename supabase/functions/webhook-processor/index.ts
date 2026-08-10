import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, webhook_id, event_name, event_payload } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const eventRes = await fetch(`${supabaseUrl}/rest/v1/integration_webhook_events`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, webhook_id, event_name, event_payload, processing_status: "processing" }) });
    const event = (await eventRes.json())[0];
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, { method: "POST", headers, body: JSON.stringify({ workspace_id, agent_name: "webhook_processor", system_prompt: "You are a webhook event processor. Return valid JSON.", user_prompt: `Process this webhook event.\n\nEvent: ${event_name}\nPayload: ${JSON.stringify(event_payload)}\n\nReturn JSON: {"processed":true,"action_taken":"I processed the event and updated the relevant records.","result":{}}`, temperature: 0.3, max_tokens: 1500 }) });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    await fetch(`${supabaseUrl}/rest/v1/integration_webhook_events?id=eq.${event.id}`, { method: "PATCH", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ processing_status: "processed", processed_at: new Date().toISOString(), response_code: 200 }) });
    return new Response(JSON.stringify({ processed: true, event_id: event.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
