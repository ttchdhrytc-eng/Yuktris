import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { AutopilotDashboard, AutopilotMode } from '@/types/autonomous-execution';

export const autopilotKeys = {
  all: ['autopilot'] as const,
  dashboard: (wsId: string) => ['autopilot', 'dashboard', wsId] as const,
};

export function useAutopilotDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: autopilotKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [
        cycles, plans, sessions, actions, results, metrics, failures,
        learnings, recommendations, confidence, approvals, history,
        businessEvents, businessEventRules, businessEventActions, businessEventQueue,
        decisions, decisionModels, decisionEvidence, decisionOutcomes, decisionAccuracy,
        optimizationOpportunities, optimizationHistory,
        learningSnapshots, learningHistory, recommendationImprovements,
        playbooks, playbookExecutions,
        autopilotSettings, moduleConfigs, roiTracking, roiSnapshots,
      ] = await Promise.all([
        supabase.from('autonomous_execution_cycles').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_plans').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_sessions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_actions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('execution_results').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_metrics').select('*').eq('workspace_id', workspace.id).order('recorded_at', { ascending: false }).limit(50),
        supabase.from('execution_failures').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_learning').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_recommendations').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_confidence').select('*').eq('workspace_id', workspace.id).order('computed_at', { ascending: false }).limit(50),
        supabase.from('execution_approvals').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('autopilot_execution_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('business_events').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('business_event_rules').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('business_event_actions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('business_event_queue').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('decision_engine').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('decision_models').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('decision_evidence').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('decision_outcomes').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('decision_accuracy').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('optimization_opportunities').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('optimization_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('learning_snapshots').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('learning_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('recommendation_improvements').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('execution_playbooks').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('playbook_executions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('autopilot_settings').select('*').eq('workspace_id', workspace.id).maybeSingle(),
        supabase.from('autopilot_module_configs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }),
        supabase.from('roi_tracking').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('roi_snapshots').select('*').eq('workspace_id', workspace.id).order('recorded_at', { ascending: false }).limit(20),
      ]);

      const allCycles = (cycles.data ?? []) as Array<Record<string, unknown>>;
      const allPlans = (plans.data ?? []) as Array<Record<string, unknown>>;
      const allSessions = (sessions.data ?? []) as Array<Record<string, unknown>>;
      const allActions = (actions.data ?? []) as Array<Record<string, unknown>>;
      const allApprovals = (approvals.data ?? []) as Array<Record<string, unknown>>;
      const allRecs = (recommendations.data ?? []) as Array<Record<string, unknown>>;
      const allEvents = (businessEvents.data ?? []) as Array<Record<string, unknown>>;
      const allDecisions = (decisions.data ?? []) as Array<Record<string, unknown>>;
      const allAccuracy = (decisionAccuracy.data ?? []) as Array<Record<string, unknown>>;
      const allOptimizations = (optimizationOpportunities.data ?? []) as Array<Record<string, unknown>>;
      const allLearnings = (learnings.data ?? []) as Array<Record<string, unknown>>;
      const allConfidence = (confidence.data ?? []) as Array<Record<string, unknown>>;
      const allRoi = (roiTracking.data ?? []) as Array<Record<string, unknown>>;
      const settings = (autopilotSettings.data ?? null) as Record<string, unknown> | null;
      const allPlaybookExecs = (playbookExecutions.data ?? []) as Array<Record<string, unknown>>;

      const successRate = allActions.length > 0
        ? (allActions.filter(a => a.action_status === 'completed').length / allActions.length) * 100
        : 0;
      const avgConf = allConfidence.length > 0
        ? allConfidence.reduce((s, c) => s + (c.confidence_score as number), 0) / allConfidence.length
        : 0;
      const avgAcc = allAccuracy.length > 0
        ? allAccuracy.reduce((s, a) => s + (a.accuracy_percentage as number ?? 0), 0) / allAccuracy.length
        : 0;
      const totalRoi = allRoi.reduce((s, r) => s + (r.return_amount as number) - (r.investment_amount as number), 0);

      return {
        cycles: allCycles as never[],
        plans: allPlans as never[],
        sessions: allSessions as never[],
        actions: allActions as never[],
        results: (results.data ?? []) as never[],
        metrics: (metrics.data ?? []) as never[],
        failures: (failures.data ?? []) as never[],
        learnings: allLearnings as never[],
        recommendations: allRecs as never[],
        confidence: allConfidence as never[],
        approvals: allApprovals as never[],
        history: (history.data ?? []) as never[],
        businessEvents: allEvents as never[],
        businessEventRules: (businessEventRules.data ?? []) as never[],
        businessEventActions: (businessEventActions.data ?? []) as never[],
        businessEventQueue: (businessEventQueue.data ?? []) as never[],
        decisions: allDecisions as never[],
        decisionModels: (decisionModels.data ?? []) as never[],
        decisionEvidence: (decisionEvidence.data ?? []) as never[],
        decisionOutcomes: (decisionOutcomes.data ?? []) as never[],
        decisionAccuracy: allAccuracy as never[],
        optimizationOpportunities: allOptimizations as never[],
        optimizationHistory: (optimizationHistory.data ?? []) as never[],
        learningSnapshots: (learningSnapshots.data ?? []) as never[],
        learningHistory: (learningHistory.data ?? []) as never[],
        recommendationImprovements: (recommendationImprovements.data ?? []) as never[],
        playbooks: (playbooks.data ?? []) as never[],
        playbookExecutions: allPlaybookExecs as never[],
        autopilotSettings: settings as never,
        moduleConfigs: (moduleConfigs.data ?? []) as never[],
        roiTracking: allRoi as never[],
        roiSnapshots: (roiSnapshots.data ?? []) as never[],
        activeCycles: allCycles.filter(c => c.cycle_status === 'running').length,
        activePlans: allPlans.filter(p => p.plan_status === 'executing' || p.plan_status === 'approved').length,
        activeSessions: allSessions.filter(s => s.session_status === 'running').length,
        pendingActions: allActions.filter(a => a.action_status === 'pending' || a.action_status === 'queued').length,
        executingActions: allActions.filter(a => a.action_status === 'executing').length,
        completedActions: allActions.filter(a => a.action_status === 'completed').length,
        failedActions: allActions.filter(a => a.action_status === 'failed').length,
        pendingApprovals: allApprovals.filter(a => a.approval_status === 'pending').length,
        totalROI: totalRoi,
        avgConfidence: avgConf,
        totalRecommendations: allRecs.length,
        pendingRecommendations: allRecs.filter(r => !r.is_approved && !r.is_dismissed).length,
        approvedRecommendations: allRecs.filter(r => r.is_approved).length,
        implementedRecommendations: allRecs.filter(r => r.is_implemented).length,
        totalPlaybooks: (playbooks.data ?? []).length,
        activePlaybookExecutions: allPlaybookExecs.filter(e => e.execution_status === 'executing' || e.execution_status === 'approved').length,
        unprocessedEvents: allEvents.filter(e => !e.is_processed).length,
        totalDecisions: allDecisions.length,
        pendingDecisions: allDecisions.filter(d => d.decision_status === 'pending').length,
        completedDecisions: allDecisions.filter(d => d.decision_status === 'completed').length,
        avgDecisionAccuracy: avgAcc,
        totalOptimizations: allOptimizations.length,
        implementedOptimizations: allOptimizations.filter(o => o.is_implemented).length,
        totalLearnings: allLearnings.length,
        appliedLearnings: allLearnings.filter(l => l.is_applied).length,
        autopilotMode: (settings?.autopilot_mode ?? 'off') as AutopilotMode,
        successRate,
      } as AutopilotDashboard;
    },
    refetchInterval: 10000,
  });
}

// Autopilot mode mutations
export function useUpdateAutopilotMode() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { mode: AutopilotMode; isActive?: boolean }) => {
      if (!workspace) throw new Error('No workspace');
      const existing = await supabase.from('autopilot_settings').select('*').eq('workspace_id', workspace.id).maybeSingle();
      if (existing.data) {
        const { error } = await supabase.from('autopilot_settings').update({ autopilot_mode: params.mode, is_active: params.isActive ?? params.mode !== 'off', updated_at: new Date().toISOString() }).eq('id', existing.data.id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await supabase.from('autopilot_settings').insert({ workspace_id: workspace.id, autopilot_mode: params.mode, is_active: params.isActive ?? params.mode !== 'off' });
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Autopilot mode updated.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateAutopilotSettings() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Record<string, unknown>) => {
      if (!workspace) throw new Error('No workspace');
      const existing = await supabase.from('autopilot_settings').select('*').eq('workspace_id', workspace.id).maybeSingle();
      if (existing.data) {
        const { error } = await supabase.from('autopilot_settings').update({ ...params, updated_at: new Date().toISOString() }).eq('id', existing.data.id);
        if (error) throw new Error(error.message);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Autopilot settings updated.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Approval mutations
export function useApproveRequest() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (approvalId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_approvals').update({ approval_status: 'approved', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', approvalId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Request approved.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDenyRequest() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (approvalId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_approvals').update({ approval_status: 'denied', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', approvalId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Request denied.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Recommendation mutations
export function useApproveRecommendation() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_recommendations').update({ is_approved: true, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', recId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Recommendation approved.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDismissRecommendation() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (recId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_recommendations').update({ is_dismissed: true, dismissed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', recId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Recommendation dismissed.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Plan mutations
export function useApprovePlan() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_plans').update({ plan_status: 'approved', approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', planId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Plan approved.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelPlan() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_plans').update({ plan_status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', planId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Plan cancelled.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Action mutations
export function useRetryAction() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_actions').update({ action_status: 'pending', attempts: 0, error_message: null, updated_at: new Date().toISOString() }).eq('id', actionId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Action retried.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelAction() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (actionId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_actions').update({ action_status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', actionId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Action cancelled.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Playbook mutations
export function useCreatePlaybook() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; description?: string; category: string; steps?: unknown[]; estimatedRoi?: number }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('execution_playbooks').insert({
        workspace_id: workspace.id,
        playbook_name: params.name,
        playbook_description: params.description ?? null,
        playbook_category: params.category,
        playbook_steps: params.steps ?? [],
        estimated_roi: params.estimatedRoi ?? null,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Playbook created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useExecutePlaybook() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (playbookId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('playbook_executions').insert({
        workspace_id: workspace.id,
        playbook_id: playbookId,
        execution_name: `Execution ${new Date().toISOString()}`,
        execution_status: 'pending',
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Playbook execution started.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Optimization mutations
export function useImplementOptimization() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (opportunityId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('optimization_opportunities').update({ is_implemented: true, implemented_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', opportunityId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Optimization implemented.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Learning mutations
export function useApplyLearning() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (learningId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('execution_learning').update({ is_applied: true, applied_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', learningId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Learning applied.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Business event rule mutations
export function useCreateEventRule() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { name: string; triggerEventType: string; actionType: string; description?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const { data, error } = await supabase.from('business_event_rules').insert({
        workspace_id: workspace.id,
        rule_name: params.name,
        rule_description: params.description ?? null,
        trigger_event_type: params.triggerEventType,
        action_type: params.actionType,
      }).select('*').single();
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Event rule created.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useToggleEventRule() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { ruleId: string; active: boolean }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('business_event_rules').update({ is_active: params.active, updated_at: new Date().toISOString() }).eq('id', params.ruleId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Event rule toggled.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

// Module config mutations
export function useUpdateModuleConfig() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { configId: string; updates: Record<string, unknown> }) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('autopilot_module_configs').update({ ...params.updates, updated_at: new Date().toISOString() }).eq('id', params.configId).eq('workspace_id', workspace.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: autopilotKeys.all }); toast.success('Module configuration updated.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
