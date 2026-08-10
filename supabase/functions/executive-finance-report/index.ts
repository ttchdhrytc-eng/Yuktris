import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, invRes, revRes, profitRes, ltvRes, cacRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/invoices?workspace_id=eq.${workspace_id}&order=invoice_date.desc&limit=50&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/recognized_revenue?workspace_id=eq.${workspace_id}&order=recognition_date.desc&limit=50&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/profitability?workspace_id=eq.${workspace_id}&order=period.desc&limit=12&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_ltv?workspace_id=eq.${workspace_id}&order=calculation_date.desc&limit=20&select=*`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_cac?workspace_id=eq.${workspace_id}&order=calculation_date.desc&limit=10&select=*`, { headers }),
    ]);
    const [subscriptions, invoices, revenue, profitability, ltv, cac] = await Promise.all([subsRes.json(), invRes.json(), revRes.json(), profitRes.json(), ltvRes.json(), cacRes.json()]);
    const totalMRR = subscriptions.reduce((s: number, sub: any) => s + (sub.mrr || 0), 0);
    const totalARR = subscriptions.reduce((s: number, sub: any) => s + (sub.arr || 0), 0);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "executive_finance_agent",
        system_prompt: "You are an elite executive finance report generator AI. Speak in first person. Return valid JSON.",
        user_prompt: `Generate an executive finance report.\n\nMRR: ${totalMRR}\nARR: ${totalARR}\nActive Subscriptions: ${subscriptions.length}\nInvoices: ${invoices.length}\nRevenue Records: ${revenue.length}\nProfitability: ${JSON.stringify(profitability[0] || {})}\nLTV: ${JSON.stringify(ltv[0] || {})}\nCAC: ${JSON.stringify(cac[0] || {})}\n\nReturn JSON: { "executive_summary":"...","key_metrics":{},"revenue_analysis":"...","profitability_analysis":"...","cash_flow_analysis":"...","recommendations":[],"ai_reasoning":"...","confidence":0.85 }`,
        temperature: 0.3, max_tokens: 4000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    return new Response(JSON.stringify({ generated: true, report: result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
