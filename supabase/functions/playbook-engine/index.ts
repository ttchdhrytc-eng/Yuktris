import "jsr:@supabase/functions-js/edge-runtime.d.ts";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey" };
const TEMPLATES = [
  { name: 'Recover Churned Customer', category: 'churn_recovery', steps: [{ step: 1, action: 'enrich_company', description: 'Research why customer left' }, { step: 2, action: 'send_email', description: 'Send win-back email' }, { step: 3, action: 'book_meeting', description: 'Schedule recovery call' }], agents: ['research_agent', 'outreach_agent'], approvals: ['manager'], roi: 5000 },
  { name: 'Recover Lost Proposal', category: 'lost_proposal_recovery', steps: [{ step: 1, action: 'score_prospect', description: 'Analyze why proposal was lost' }, { step: 2, action: 'generate_content', description: 'Generate improved proposal' }, { step: 3, action: 'send_email', description: 'Send revised proposal' }], agents: ['proposal_agent', 'outreach_agent'], approvals: ['manager'], roi: 3000 },
  { name: 'Increase Reply Rate', category: 'reply_rate_increase', steps: [{ step: 1, action: 'generate_content', description: 'A/B test new messaging' }, { step: 2, action: 'send_linkedin', description: 'Deploy improved sequences' }], agents: ['outreach_agent', 'personalization_agent'], approvals: [], roi: 2000 },
  { name: 'Generate More Meetings', category: 'meeting_generation', steps: [{ step: 1, action: 'score_prospect', description: 'Identify high-intent prospects' }, { step: 2, action: 'book_meeting', description: 'Auto-book meetings' }], agents: ['meeting_agent', 'outreach_agent'], approvals: [], roi: 4000 },
  { name: 'Recover Failed Payment', category: 'failed_payment_recovery', steps: [{ step: 1, action: 'notify_user', description: 'Alert customer about failed payment' }, { step: 2, action: 'send_email', description: 'Send payment retry instructions' }], agents: ['finance_agent'], approvals: ['manager'], roi: 1500 },
  { name: 'Upsell Customer', category: 'customer_upsell', steps: [{ step: 1, action: 'enrich_company', description: 'Analyze usage for upsell signals' }, { step: 2, action: 'send_email', description: 'Send targeted upsell offer' }], agents: ['customer_success_agent', 'outreach_agent'], approvals: ['manager'], roi: 6000 },
  { name: 'Renew Customer', category: 'customer_renewal', steps: [{ step: 1, action: 'notify_user', description: 'Send renewal reminder' }, { step: 2, action: 'book_meeting', description: 'Schedule renewal call' }], agents: ['customer_success_agent'], approvals: [], roi: 8000 },
  { name: 'Expand Account', category: 'account_expansion', steps: [{ step: 1, action: 'enrich_company', description: 'Identify expansion opportunities' }, { step: 2, action: 'create_proposal', description: 'Create expansion proposal' }], agents: ['proposal_agent', 'customer_success_agent'], approvals: ['manager'], roi: 10000 },
];
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  try {
    const { workspace_id, action } = await req.json();
    const url = Deno.env.get("SUPABASE_URL")!; const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const h = { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" };
    if (action === 'seed_templates') {
      const existing = await fetch(`${url}/rest/v1/execution_playbooks?workspace_id=eq.${workspace_id}&is_template=eq.true&select=id`, { headers: h }).then(r => r.json());
      if (existing.length > 0) return new Response(JSON.stringify({ seeded: false, reason: 'Templates already exist' }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const records = TEMPLATES.map(t => ({ workspace_id, playbook_name: t.name, playbook_description: `AI playbook: ${t.name}`, playbook_category: t.category, playbook_steps: t.steps, required_agents: t.agents, required_approvals: t.approvals, estimated_roi: t.roi, is_active: true, is_template: true }));
      await fetch(`${url}/rest/v1/execution_playbooks`, { method: 'POST', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify(records) });
      return new Response(JSON.stringify({ seeded: records.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'execute') {
      const { playbook_id, target_entity_type, target_entity_id } = await req.json();
      const pbRes = await fetch(`${url}/rest/v1/execution_playbooks?id=eq.${playbook_id}&select=*`, { headers: h }).then(r => r.json());
      const pb = pbRes[0];
      if (!pb) return new Response(JSON.stringify({ error: 'Playbook not found' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const execRes = await fetch(`${url}/rest/v1/playbook_executions`, { method: 'POST', headers: { ...h, Prefer: 'return=representation' }, body: JSON.stringify({ workspace_id, playbook_id, execution_name: `${pb.playbook_name} - ${new Date().toISOString()}`, execution_status: 'pending', target_entity_type: target_entity_type ?? null, target_entity_id: target_entity_id ?? null, total_steps: (pb.playbook_steps as any[]).length, estimated_roi: pb.estimated_roi }) }).then(r => r.json());
      return new Response(JSON.stringify({ execution_id: execRes[0].id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } else if (action === 'advance') {
      const { execution_id } = await req.json();
      const execRes = await fetch(`${url}/rest/v1/playbook_executions?id=eq.${execution_id}&select=*`, { headers: h }).then(r => r.json());
      const exec = execRes[0];
      if (!exec) return new Response(JSON.stringify({ error: 'Execution not found' }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const nextStep = exec.current_step + 1;
      if (nextStep >= exec.total_steps) {
        await fetch(`${url}/rest/v1/playbook_executions?id=eq.${execution_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ execution_status: 'completed', completed_at: new Date().toISOString(), current_step: nextStep }) });
        return new Response(JSON.stringify({ completed: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      await fetch(`${url}/rest/v1/playbook_executions?id=eq.${execution_id}`, { method: 'PATCH', headers: { ...h, Prefer: 'return=minimal' }, body: JSON.stringify({ current_step: nextStep, execution_status: 'executing', started_at: new Date().toISOString() }) });
      return new Response(JSON.stringify({ advanced: true, step: nextStep }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
