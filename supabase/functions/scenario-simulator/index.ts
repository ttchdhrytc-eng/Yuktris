import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, question } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const headers = { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey, "Content-Type": "application/json" };
    const [subsRes, custRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/subscriptions?workspace_id=eq.${workspace_id}&status=eq.active&select=mrr,arr`, { headers }),
      fetch(`${supabaseUrl}/rest/v1/customer_accounts?workspace_id=eq.${workspace_id}&select=account_status,churn_risk_score`, { headers }),
    ]);
    const [subs, custs] = await Promise.all([subsRes.json(), custRes.json()]);
    const aiRes = await fetch(`${supabaseUrl}/functions/v1/ai-generate`, {
      method: "POST", headers,
      body: JSON.stringify({
        workspace_id, agent_name: "scenario_simulator_agent",
        system_prompt: "You are an elite AI CEO simulating business scenarios. Speak in first person. Return valid JSON.",
        user_prompt: `Simulate this scenario.\n\nQuestion: ${question}\n\nMRR: ${subs.reduce((s:number,x:any)=>s+(x.mrr||0),0)}\nARR: ${subs.reduce((s:number,x:any)=>s+(x.arr||0),0)}\nCustomers: ${custs.length}\n\nReturn JSON: {"input_parameters":{},"output_projections":{},"assumptions":[],"variable_changed":"hiring","change_value":"5 SDRs","baseline_metric":1200000,"projected_metric":2050000,"impact_delta":850000,"impact_percent":70.8,"time_horizon":"180d","ai_reasoning":"I estimate...","confidence":0.75}`,
        temperature: 0.4, max_tokens: 3000,
      }),
    });
    const aiResult = await aiRes.json();
    const result = aiResult.structuredData ?? (typeof aiResult.content === "string" ? JSON.parse(aiResult.content) : aiResult.content);
    const scRes = await fetch(`${supabaseUrl}/rest/v1/scenario_models`, { method: "POST", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify({ workspace_id, scenario_name: question.slice(0, 200), scenario_description: question, scenario_type: "what_if", input_parameters: result.input_parameters ?? {}, output_projections: result.output_projections ?? {}, assumptions: result.assumptions ?? [], confidence: result.confidence ?? 0.7, ai_reasoning: result.ai_reasoning ?? "" }) });
    const scenario = (await scRes.json())[0];
    if (scenario) {
      await fetch(`${supabaseUrl}/rest/v1/what_if_analysis`, { method: "POST", headers: { ...headers, Prefer: "return=minimal" }, body: JSON.stringify({ workspace_id, scenario_model_id: scenario.id, question, variable_changed: result.variable_changed ?? "", change_value: result.change_value ?? "", baseline_metric: result.baseline_metric ?? 0, projected_metric: result.projected_metric ?? 0, impact_delta: result.impact_delta ?? 0, impact_percent: result.impact_percent ?? 0, time_horizon: result.time_horizon ?? "90d", ai_reasoning: result.ai_reasoning ?? "", ai_confidence: result.confidence ?? 0.7 }) });
    }
    return new Response(JSON.stringify({ simulated: true, ...result }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
