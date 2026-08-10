import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, invRes, revRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/invoices?workspace_id=eq.${workspace_id}&order=invoice_date.desc&limit=50&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/recognized_revenue?workspace_id=eq.${workspace_id}&order=recognition_date.desc&limit=50&select=*`, { headers }),
    ]);
    const [subscriptions, invoices, revenue] = await Promise.all([subsRes.json(), invRes.json(), revRes.json()]);
    const totalMRR = subscriptions.reduce((s: number, sub: any) => s + (sub.mrr || 0), 0);
    const totalARR = subscriptions.reduce((s: number, sub: any) => s + (sub.arr || 0), 0);
    const totalOutstanding = invoices.filter((i: any) => ["sent", "partial", "overdue"].includes(i.status)).reduce((s: number, i: any) => s + (i.amount_due || 0), 0);
    const totalOverdue = invoices.filter((i: any) => i.status === "overdue").reduce((s: number, i: any) => s + (i.amount_due || 0), 0);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "finance_insights_agent",
        system_prompt: "You are an elite finance intelligence AI. Speak in first person. Return valid JSON.",
        user_prompt: `Generate finance insights.\n\nMRR: ${totalMRR}\nARR: ${totalARR}\nOutstanding: ${totalOutstanding}\nOverdue: ${totalOverdue}\nActive Subscriptions: ${subscriptions.length}\nRevenue Records: ${revenue.length}\n\nReturn JSON: { "insights": [{"insight_type":"revenue_trend","insight_title":"...","insight_text":"...","severity":"info","confidence":0.85}] }`,
        temperature: 0.3, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    if (result.insights?.length) {
      for (const ins of result.insights) {
        await fetch(`${supabaseUrl}/rest/v1/finance_insights`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, insight_type: ins.insight_type ?? "recommendation", insight_title: ins.insight_title ?? "Finance Insight", insight_text: ins.insight_text ?? "", insight_data: ins.insight_data ?? {}, severity: ins.severity ?? "info", confidence: ins.confidence ?? 0.75 }) });
      }
    }
    return new Response(JSON.stringify({ generated: true, insights: result.insights?.length ?? 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
