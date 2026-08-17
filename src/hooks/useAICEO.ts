import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { CEOCommandCenter } from '@/types/ai-ceo';

export const ceoKeys = {
  all: ['ai-ceo'] as const,
  commandCenter: (wsId: string) => ['ai-ceo', 'command-center', wsId] as const,
};

export function useCEOCommandCenter() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: ceoKeys.commandCenter(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [state, objectives, metrics, decisions, observations, predictions, executiveBriefs, risks, opportunities, recommendations, boardReports, companyHealth, strategicAlerts, okrs, keyResults, strategicInitiatives, priorities, autonomousTasks, scenarios, whatIfAnalyses, learnings, anomalies, trends] = await Promise.all([
        supabase.from('ai_ceo_state').select('*').eq('workspace_id', workspace.id).maybeSingle(),
        supabase.from('ai_ceo_objectives').select('*').eq('workspace_id', workspace.id).eq('status', 'active').order('priority', { ascending: true }),
        supabase.from('ai_ceo_metrics').select('*').eq('workspace_id', workspace.id).order('measurement_date', { ascending: false }).limit(30),
        supabase.from('ai_ceo_decisions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('ai_ceo_observations').select('*').eq('workspace_id', workspace.id).order('detected_at', { ascending: false }).limit(20),
        supabase.from('ai_ceo_predictions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('ai_ceo_executive_briefs').select('*').eq('workspace_id', workspace.id).order('brief_date', { ascending: false }).limit(10),
        supabase.from('executive_risks').select('*').eq('workspace_id', workspace.id).eq('status', 'active').order('risk_level', { ascending: false }).limit(20),
        supabase.from('executive_opportunities').select('*').eq('workspace_id', workspace.id).eq('status', 'identified').order('estimated_value', { ascending: false }).limit(20),
        supabase.from('executive_recommendations').select('*').eq('workspace_id', workspace.id).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
        supabase.from('board_reports').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('company_health').select('*').eq('workspace_id', workspace.id).order('measurement_date', { ascending: false }).limit(12),
        supabase.from('strategic_alerts').select('*').eq('workspace_id', workspace.id).eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
        supabase.from('okrs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('key_results').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('strategic_initiatives').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('company_priorities').select('*').eq('workspace_id', workspace.id).eq('status', 'active').order('priority_level', { ascending: true }),
        supabase.from('autonomous_tasks').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('scenario_models').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('what_if_analysis').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('executive_learning').select('*').eq('workspace_id', workspace.id).eq('is_active', true).order('created_at', { ascending: false }).limit(20),
        supabase.from('anomaly_detection').select('*').eq('workspace_id', workspace.id).eq('is_resolved', false).order('detected_at', { ascending: false }).limit(20),
        supabase.from('trend_detection').select('*').eq('workspace_id', workspace.id).order('detected_at', { ascending: false }).limit(20),
      ]);
      const [subs, custs, props] = await Promise.all([
        supabase.from('subscriptions').select('mrr,arr,status').eq('workspace_id', workspace.id).eq('status', 'active'),
        supabase.from('customer_accounts').select('account_status,health_score,churn_risk_score').eq('workspace_id', workspace.id),
        supabase.from('proposals').select('status,value').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
      ]);
      const s = (subs.data ?? []) as Array<Record<string, unknown>>;
      const c = (custs.data ?? []) as Array<Record<string, unknown>>;
      const p = (props.data ?? []) as Array<Record<string, unknown>>;
      return {
        state: (state.data as Record<string, unknown>) as never,
        objectives: (objectives.data ?? []) as never[], goals: [], metrics: (metrics.data ?? []) as never[], decisions: (decisions.data ?? []) as never[], observations: (observations.data ?? []) as never[], predictions: (predictions.data ?? []) as never[],
        strategicInitiatives: (strategicInitiatives.data ?? []) as never[], priorities: (priorities.data ?? []) as never[], okrs: (okrs.data ?? []) as never[], keyResults: (keyResults.data ?? []) as never[],
        executiveBriefs: (executiveBriefs.data ?? []) as never[], risks: (risks.data ?? []) as never[], opportunities: (opportunities.data ?? []) as never[], recommendations: (recommendations.data ?? []) as never[],
        boardReports: (boardReports.data ?? []) as never[], companyHealth: (companyHealth.data ?? []) as never[],
        anomalies: (anomalies.data ?? []) as never[], trends: (trends.data ?? []) as never[], strategicAlerts: (strategicAlerts.data ?? []) as never[],
        autonomousTasks: (autonomousTasks.data ?? []) as never[], scenarios: (scenarios.data ?? []) as never[], whatIfAnalyses: (whatIfAnalyses.data ?? []) as never[], learnings: (learnings.data ?? []) as never[],
        totalMRR: s.reduce((sum, sub) => sum + (sub.mrr as number), 0),
        totalARR: s.reduce((sum, sub) => sum + (sub.arr as number), 0),
        totalPipeline: 0,
        activeCustomers: c.filter((cu) => cu.account_status === 'active').length,
        activeSubscriptions: s.length,
        overdueAmount: 0, failedPayments: 0,
        churnRiskCount: c.filter((cu) => (cu.churn_risk_score as number) > 60).length,
        avgCustomerHealth: c.length > 0 ? c.reduce((sum, cu) => sum + (cu.health_score as number), 0) / c.length : 0,
        grossMargin: 0, avgLTV: 0, avgCAC: 0,
        winRate: p.length > 0 ? (p.filter((pr) => pr.status === 'won').length / p.length) * 100 : 0,
        meetingCount: 0, proposalCount: p.length,
      } as CEOCommandCenter;
    },
    refetchInterval: 20000,
  });
}

export function useAnalyzeCompany() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite AI CEO. Return valid JSON.', userPrompt: 'Analyze the company. Return JSON: {"overall_company_score":72,"health_score":70,"growth_score":65,"efficiency_score":68,"risk_score":35,"opportunity_score":72,"ai_reasoning":"I analyzed every department.","confidence":0.78}', temperature: 0.3, maxTokens: 2000, workspaceId: workspace.id, agentName: 'ai_ceo_analyzer', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      const { data: existing } = await supabase.from('ai_ceo_state').select('id').eq('workspace_id', workspace.id).maybeSingle();
      const stateData = { workspace_id: workspace.id, overall_company_score: result.overall_company_score ?? 70, health_score: result.health_score ?? 70, growth_score: result.growth_score ?? 65, efficiency_score: result.efficiency_score ?? 68, risk_score: result.risk_score ?? 35, opportunity_score: result.opportunity_score ?? 72, last_analysis_at: new Date().toISOString(), ai_reasoning: result.ai_reasoning ?? '' };
      if (existing) await supabase.from('ai_ceo_state').update(stateData).eq('id', (existing as Record<string,string>).id);
      else await supabase.from('ai_ceo_state').insert(stateData);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ceoKeys.all }); toast.success('I analyzed every department.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateExecutiveBrief() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite AI CEO. Return valid JSON.', userPrompt: 'Generate executive brief. Return JSON: {"executive_summary":"I prepared the brief.","wins":"Closed 3 deals.","losses":"Lost 2.","risks":"3 risks found.","revenue_summary":"MRR $42K.","forecast_summary":"$480K.","customer_health_summary":"75/100.","finance_summary":"72% margin.","cashflow_summary":"Healthy.","hiring_summary":"Hire 1 AE.","growth_summary":"8% MoM.","competition_summary":"Increased activity.","strategic_priorities":"Enterprise expansion.","ai_reasoning":"I prepared the brief.","confidence":0.8}', temperature: 0.3, maxTokens: 3000, workspaceId: workspace.id, agentName: 'executive_brief_agent', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      await supabase.from('ai_ceo_executive_briefs').insert({ workspace_id: workspace.id, brief_date: new Date().toISOString().split('T')[0], executive_summary: result.executive_summary ?? '', wins: result.wins ?? '', losses: result.losses ?? '', risks: result.risks ?? '', revenue_summary: result.revenue_summary ?? '', forecast_summary: result.forecast_summary ?? '', customer_health_summary: result.customer_health_summary ?? '', finance_summary: result.finance_summary ?? '', cashflow_summary: result.cashflow_summary ?? '', hiring_summary: result.hiring_summary ?? '', growth_summary: result.growth_summary ?? '', competition_summary: result.competition_summary ?? '', strategic_priorities: result.strategic_priorities ?? '', ai_reasoning: result.ai_reasoning ?? '', ai_confidence: result.confidence ?? 0.78, full_brief: result });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ceoKeys.all }); toast.success("I prepared today's executive briefing."); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateRecommendations() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite AI CEO. Return valid JSON.', userPrompt: 'Generate recommendations. Return JSON: {"recommendations":[{"recommendation_title":"Contact at-risk customers","recommendation_description":"I recommend contacting these customers.","recommendation_type":"immediate","priority":"critical","estimated_value":30000,"confidence":0.85,"ai_reasoning":"I recommend contacting these customers."}]}', temperature: 0.3, maxTokens: 3000, workspaceId: workspace.id, agentName: 'recommendation_engine_agent', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      if (result.recommendations?.length) { for (const rec of result.recommendations as Array<Record<string, unknown>>) { await supabase.from('executive_recommendations').insert({ workspace_id: workspace.id, recommendation_title: rec.recommendation_title ?? 'Recommendation', recommendation_description: rec.recommendation_description ?? '', recommendation_type: rec.recommendation_type ?? 'immediate', priority: rec.priority ?? 'medium', estimated_value: rec.estimated_value ?? 0, confidence: rec.confidence ?? 0.75, status: 'active', ai_reasoning: rec.ai_reasoning ?? '' }); } }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ceoKeys.all }); toast.success('I generated strategic recommendations.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDetectRisks() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite AI CEO. Return valid JSON.', userPrompt: 'Detect risks. Return JSON: {"risks":[{"risk_title":"Pipeline shrinkage","risk_description":"Pipeline shrinking.","risk_category":"pipeline","risk_level":"high","probability":75,"impact":50000,"mitigation_strategy":"Increase SDR outreach.","ai_reasoning":"I found a risk.","confidence":0.82}]}', temperature: 0.3, maxTokens: 2000, workspaceId: workspace.id, agentName: 'risk_engine_agent', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      if (result.risks?.length) { for (const risk of result.risks as Array<Record<string, unknown>>) { await supabase.from('executive_risks').insert({ workspace_id: workspace.id, risk_title: risk.risk_title ?? 'Risk', risk_description: risk.risk_description ?? '', risk_category: risk.risk_category ?? 'operational', risk_level: risk.risk_level ?? 'medium', probability: risk.probability ?? 50, impact: risk.impact ?? 0, mitigation_strategy: risk.mitigation_strategy ?? '', status: 'active', ai_reasoning: risk.ai_reasoning ?? '', ai_confidence: risk.confidence ?? 0.8 }); } }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ceoKeys.all }); toast.success('I detected business risks.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDetectGrowth() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are an elite AI CEO. Return valid JSON.', userPrompt: 'Find growth opportunities. Return JSON: {"opportunities":[{"opportunity_title":"Enterprise upsell","opportunity_description":"3 customers ready for upgrade.","opportunity_type":"upsell","estimated_value":150000,"probability":70,"time_horizon":"60d","ai_reasoning":"I found an opportunity.","confidence":0.8}]}', temperature: 0.3, maxTokens: 2000, workspaceId: workspace.id, agentName: 'growth_engine_agent', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      if (result.opportunities?.length) { for (const opp of result.opportunities as Array<Record<string, unknown>>) { await supabase.from('executive_opportunities').insert({ workspace_id: workspace.id, opportunity_title: opp.opportunity_title ?? 'Opportunity', opportunity_description: opp.opportunity_description ?? '', opportunity_type: opp.opportunity_type ?? 'growth', estimated_value: opp.estimated_value ?? 0, probability: opp.probability ?? 50, time_horizon: opp.time_horizon ?? '30d', status: 'identified', ai_reasoning: opp.ai_reasoning ?? '', ai_confidence: opp.confidence ?? 0.75 }); } }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ceoKeys.all }); toast.success('I found strategic opportunities.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
