import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { aiGateway } from '@/services/ai/AIGateway';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import type { WorkforceDashboard } from '@/types/autonomous-workforce';

export const workforceKeys = {
  all: ['workforce'] as const,
  dashboard: (wsId: string) => ['workforce', 'dashboard', wsId] as const,
};

export function useWorkforceDashboard() {
  const { workspace } = useWorkspace();
  return useQuery({
    queryKey: workforceKeys.dashboard(workspace?.id ?? ''),
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const [profiles, statuses, health, objectives, tasks, taskHistory, workflows, workflowSteps, approvals, collaborations, handoffs, learnings, feedback, performance, results, errors, logs, schedules, decisions, recommendations, notifications, metrics, memories, reasoning] = await Promise.all([
        supabase.from('agent_profiles').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: true }),
        supabase.from('agent_status').select('*').eq('workspace_id', workspace.id),
        supabase.from('agent_health').select('*').eq('workspace_id', workspace.id),
        supabase.from('agent_objectives').select('*').eq('workspace_id', workspace.id).eq('status', 'active'),
        supabase.from('agent_tasks').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('agent_task_history').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('agent_workflows').select('*').eq('workspace_id', workspace.id),
        supabase.from('agent_workflow_steps').select('*').eq('workspace_id', workspace.id).order('step_number', { ascending: true }),
        supabase.from('agent_approvals').select('*').eq('workspace_id', workspace.id).eq('approval_status', 'pending').order('created_at', { ascending: false }),
        supabase.from('agent_collaboration').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_handoffs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_learning').select('*').eq('workspace_id', workspace.id).eq('is_active', true).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_feedback').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_performance').select('*').eq('workspace_id', workspace.id).order('performance_date', { ascending: false }).limit(20),
        supabase.from('agent_results').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_errors').select('*').eq('workspace_id', workspace.id).eq('is_resolved', false).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_logs').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(30),
        supabase.from('agent_schedules').select('*').eq('workspace_id', workspace.id).eq('is_active', true),
        supabase.from('agent_decisions').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_recommendations').select('*').eq('workspace_id', workspace.id).eq('status', 'active').order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_notifications').select('*').eq('workspace_id', workspace.id).eq('is_read', false).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_metrics').select('*').eq('workspace_id', workspace.id).order('measurement_date', { ascending: false }).limit(30),
        supabase.from('agent_memory').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('agent_reasoning').select('*').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
      ]);
      const allProfiles = (profiles.data ?? []) as Array<Record<string, unknown>>;
      const allTasks = (tasks.data ?? []) as Array<Record<string, unknown>>;
      const allStatuses = (statuses.data ?? []) as Array<Record<string, unknown>>;
      const allHealth = (health.data ?? []) as Array<Record<string, unknown>>;
      const allApprovals = (approvals.data ?? []) as Array<Record<string, unknown>>;
      return {
        profiles: allProfiles as never[], skills: [], statuses: allStatuses as never[], health: allHealth as never[],
        objectives: (objectives.data ?? []) as never[], tasks: allTasks as never[], taskHistory: (taskHistory.data ?? []) as never[],
        workflows: (workflows.data ?? []) as never[], workflowSteps: (workflowSteps.data ?? []) as never[],
        approvals: allApprovals as never[], collaborations: (collaborations.data ?? []) as never[],
        handoffs: (handoffs.data ?? []) as never[], learnings: (learnings.data ?? []) as never[],
        feedback: (feedback.data ?? []) as never[], performance: (performance.data ?? []) as never[],
        results: (results.data ?? []) as never[], errors: (errors.data ?? []) as never[],
        logs: (logs.data ?? []) as never[], schedules: (schedules.data ?? []) as never[],
        decisions: (decisions.data ?? []) as never[], recommendations: (recommendations.data ?? []) as never[],
        notifications: (notifications.data ?? []) as never[], metrics: (metrics.data ?? []) as never[],
        memories: (memories.data ?? []) as never[], reasoning: (reasoning.data ?? []) as never[],
        totalAgents: allProfiles.length, activeAgents: allProfiles.filter((p) => p.is_active).length,
        totalTasks: allTasks.length,
        pendingTasks: allTasks.filter((t) => ['pending','assigned'].includes(t.status as string)).length,
        runningTasks: allTasks.filter((t) => t.status === 'running').length,
        completedTasks: allTasks.filter((t) => t.status === 'completed').length,
        failedTasks: allTasks.filter((t) => t.status === 'failed').length,
        pendingApprovals: allApprovals.length,
        avgConfidence: allTasks.length > 0 ? allTasks.reduce((s, t) => s + (t.confidence as number), 0) / allTasks.length : 0,
        avgHealthScore: allHealth.length > 0 ? allHealth.reduce((s, h) => s + (h.health_score as number), 0) / allHealth.length : 100,
        totalWorkload: allStatuses.reduce((s, st) => s + (st.workload_percent as number), 0),
      } as WorkforceDashboard;
    },
    refetchInterval: 15000,
  });
}

export function useInitializeAgents() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const AGENTS = [
        { type: 'sales', name: 'Sales Agent', emoji: '🎯', description: 'Responsible for prospect discovery, lead qualification, outreach, follow-ups, conversation handling, meeting booking, and proposal triggering.' },
        { type: 'sdr', name: 'SDR Agent', emoji: '📞', description: 'Responsible for outbound execution across LinkedIn, email, and cold outreach with daily quotas and sequence optimization.' },
        { type: 'research', name: 'Research Agent', emoji: '🔬', description: 'Responsible for company research, industry research, competitor research, buying signals, intent signals, and market intelligence.' },
        { type: 'proposal', name: 'Proposal Agent', emoji: '📄', description: 'Responsible for proposal creation, pricing, ROI, business case, packages, negotiation support, and proposal revisions.' },
        { type: 'customer_success', name: 'Customer Success Agent', emoji: '🤝', description: 'Responsible for customer onboarding, health monitoring, renewals, expansion, case studies, testimonials, and referrals.' },
        { type: 'finance', name: 'Finance Agent', emoji: '💰', description: 'Responsible for invoices, billing, collections, subscriptions, revenue recognition, failed payment recovery, and financial reporting.' },
        { type: 'marketing', name: 'Marketing Agent', emoji: '📢', description: 'Responsible for campaign creation, audience selection, messaging, lead magnets, content recommendations, and growth experiments.' },
        { type: 'executive_assistant', name: 'Executive Assistant Agent', emoji: '🗓️', description: 'Responsible for calendar management, task management, meeting preparation, reports, executive briefings, and daily agenda.' },
        { type: 'ai_ceo', name: 'AI CEO Agent', emoji: '👑', description: 'Responsible for company strategy, task assignment, approvals, monitoring, decision making, goal tracking, and prioritization.' },
      ];
      for (const def of AGENTS) {
        const { data: existing } = await supabase.from('agent_profiles').select('id').eq('workspace_id', workspace.id).eq('agent_type', def.type).maybeSingle();
        if (existing) continue;
        const { data: profile } = await supabase.from('agent_profiles').insert({ workspace_id: workspace.id, agent_type: def.type, agent_name: def.name, agent_description: def.description, avatar_emoji: def.emoji, is_active: true, auto_execute: def.type === 'ai_ceo', confidence_threshold_auto: def.type === 'ai_ceo' ? 90 : 95, confidence_threshold_approval: 80, max_concurrent_tasks: def.type === 'ai_ceo' ? 10 : 5 }).select('*').single();
        if (!profile) continue;
        const agentId = (profile as Record<string, string>).id;
        await supabase.from('agent_status').insert({ workspace_id: workspace.id, agent_id: agentId, status: 'idle' });
        await supabase.from('agent_health').insert({ workspace_id: workspace.id, agent_id: agentId, health_score: 100, health_status: 'healthy' });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('I initialized all 9 AI agents.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useAssignTask() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (task: { title: string; description: string; taskType?: string; priority?: string }) => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are the AI CEO. Return valid JSON.', userPrompt: `Assign task: ${task.title}\nReturn JSON: {"agent_type":"research","confidence":85,"reasoning":"I assigned this to the Research Agent."}`, temperature: 0.3, maxTokens: 1000, workspaceId: workspace.id, agentName: 'ai_ceo', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      const { data: agent } = await supabase.from('agent_profiles').select('id').eq('workspace_id', workspace.id).eq('agent_type', result.agent_type).maybeSingle();
      const confidence = result.confidence as number ?? 70;
      const approvalRequired = confidence < 80;
      const { data: t } = await supabase.from('agent_tasks').insert({ workspace_id: workspace.id, agent_id: (agent as Record<string, string>)?.id ?? null, task_title: task.title, task_description: task.description, task_type: task.taskType ?? 'execution', status: approvalRequired ? 'pending' : 'assigned', priority: task.priority ?? 'medium', confidence, approval_required: approvalRequired, approval_level: approvalRequired ? 'human' : 'automatic', ai_reasoning: result.reasoning ?? '', requested_by: 'ai_ceo' }).select('*').single();
      const taskId = (t as Record<string, string>).id;
      if (approvalRequired) { await supabase.from('agent_approvals').insert({ workspace_id: workspace.id, task_id: taskId, agent_id: (agent as Record<string, string>)?.id ?? null, approval_level: 'human', approval_status: 'pending', confidence_at_request: confidence, expires_at: new Date(Date.now() + 7 * 86400000).toISOString() }); }
      return taskId;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('I assigned the task to the best agent.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useExecuteTask() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!workspace) throw new Error('No workspace');
      const { data: task } = await supabase.from('agent_tasks').select('*').eq('id', taskId).maybeSingle();
      const t = task as Record<string, unknown> | null;
      if (!t || !t.agent_id) return;
      await supabase.from('agent_tasks').update({ status: 'running', started_at: new Date().toISOString() }).eq('id', taskId);
      await supabase.from('agent_status').update({ status: 'busy', current_task_id: taskId }).eq('agent_id', t.agent_id as string);
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are a specialized AI agent. Return valid JSON.', userPrompt: `Execute: ${t.task_title as string}\nReturn JSON: {"summary":"I completed the task.","result":{},"confidence":85,"reasoning":"I executed the task."}`, temperature: 0.4, maxTokens: 2000, workspaceId: workspace.id, agentName: `agent_${t.task_type as string}`, schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      await supabase.from('agent_tasks').update({ status: 'completed', completed_at: new Date().toISOString(), result_data: result }).eq('id', taskId);
      await supabase.from('agent_status').update({ status: 'idle', current_task_id: null }).eq('agent_id', t.agent_id as string);
      await supabase.from('agent_results').insert({ workspace_id: workspace.id, task_id: taskId, agent_id: t.agent_id as string, result_type: 'success', result_summary: result.summary as string ?? 'Completed', result_data: result, confidence: result.confidence as number ?? 70, ai_reasoning: result.reasoning as string ?? '' });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('Task executed.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useApproveTask() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { taskId: string; userId: string }) => {
      if (!workspace) throw new Error('No workspace');
      await supabase.from('agent_tasks').update({ approved_by: params.userId, approved_at: new Date().toISOString(), approval_required: false }).eq('id', params.taskId);
      await supabase.from('agent_approvals').update({ approval_status: 'approved', approved_by: params.userId, approved_at: new Date().toISOString() }).eq('task_id', params.taskId).eq('approval_status', 'pending');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('Task approved and execution started.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRejectTask() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { taskId: string; userId: string; reason: string }) => {
      if (!workspace) throw new Error('No workspace');
      await supabase.from('agent_tasks').update({ status: 'cancelled' }).eq('id', params.taskId);
      await supabase.from('agent_approvals').update({ approval_status: 'rejected', approved_by: params.userId, approved_at: new Date().toISOString(), rejection_reason: params.reason }).eq('task_id', params.taskId).eq('approval_status', 'pending');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('Task rejected.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useRetryTask() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => { if (!workspace) throw new Error('No workspace'); await supabase.from('agent_tasks').update({ status: 'retrying' }).eq('id', taskId); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('Task retry initiated.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useCancelTask() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async (taskId: string) => { if (!workspace) throw new Error('No workspace'); await supabase.from('agent_tasks').update({ status: 'cancelled' }).eq('id', taskId); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('Task cancelled.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useGenerateWorkPlan() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const response = await aiGateway.generateStructured({ systemPrompt: 'You are the AI CEO. Return valid JSON.', userPrompt: 'Generate work plan. Return JSON: {"tasks":[{"title":"Research 5 prospects","description":"Find 5 new prospects.","task_type":"research","priority":"high"}]}', temperature: 0.3, maxTokens: 2000, workspaceId: workspace.id, agentName: 'ai_ceo', schema: { type: 'object' } });
      const result = (response.structuredData ?? JSON.parse(response.content)) as Record<string, unknown>;
      if (result.tasks?.length) { for (const task of result.tasks as Array<Record<string, unknown>>) {
        const { data: agent } = await supabase.from('agent_profiles').select('id').eq('workspace_id', workspace.id).eq('agent_type', task.task_type ?? 'research').maybeSingle();
        await supabase.from('agent_tasks').insert({ workspace_id: workspace.id, agent_id: (agent as Record<string,string>)?.id ?? null, task_title: task.title as string, task_description: task.description as string, task_type: task.task_type as string ?? 'execution', status: 'assigned', priority: task.priority as string ?? 'medium', confidence: 75, approval_required: false, ai_reasoning: 'Generated by work plan.', requested_by: 'ai_ceo' });
      } }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('I generated a work plan for all agents.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function usePrioritizeQueue() {
  const { workspace } = useWorkspace(); const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { data: queue } = await supabase.from('agent_task_queue').select('id').eq('workspace_id', workspace.id).order('priority_score', { ascending: false });
      for (let i = 0; i < (queue ?? []).length; i++) { await supabase.from('agent_task_queue').update({ queue_position: i + 1 }).eq('id', (queue as Record<string, string>[])[i].id); }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: workforceKeys.all }); toast.success('I reprioritized the task queue.'); },
    onError: (err: Error) => toast.error(err.message),
  });
}
