import { useState } from 'react';
import { Activity, Zap, Clock, CheckCircle2, XCircle, AlertTriangle, TrendingUp, DollarSign, Brain, Target, RefreshCw, Play, Pause, Shield, BookOpen, Cpu, Sparkles, Rocket, ChevronRight, Settings } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import { useAutopilotDashboard, useUpdateAutopilotMode, useApproveRequest, useDenyRequest, useApproveRecommendation, useDismissRecommendation, useApprovePlan, useCancelPlan, useRetryAction, useCancelAction, useCreatePlaybook, useExecutePlaybook, useImplementOptimization, useApplyLearning, useCreateEventRule, useToggleEventRule, useUpdateModuleConfig } from '@/hooks/useAutonomousExecution';
import type { AutopilotMode } from '@/types/autonomous-execution';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Activity },
  { id: 'executions', label: 'Current Executions', icon: Cpu },
  { id: 'events', label: 'Business Events', icon: Zap },
  { id: 'plans', label: 'Execution Plans', icon: Target },
  { id: 'history', label: 'Execution History', icon: Clock },
  { id: 'recommendations', label: 'Recommendations', icon: Sparkles },
  { id: 'decisions', label: 'Decision Engine', icon: Brain },
  { id: 'optimization', label: 'Optimization', icon: TrendingUp },
  { id: 'learning', label: 'Learning', icon: BookOpen },
  { id: 'playbooks', label: 'Playbooks', icon: Rocket },
  { id: 'approvals', label: 'Approvals', icon: Shield },
  { id: 'failures', label: 'Failures', icon: AlertTriangle },
  { id: 'roi', label: 'ROI', icon: DollarSign },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

type TabId = (typeof TABS)[number]['id'];

const MODE_OPTIONS: { value: AutopilotMode; label: string; description: string; color: string }[] = [
  { value: 'off', label: 'Off', description: 'No autonomous actions', color: 'text-ink-500' },
  { value: 'advisory', label: 'Advisory', description: 'AI recommends, humans decide', color: 'text-brand-400' },
  { value: 'semi_autonomous', label: 'Semi-Autonomous', description: 'AI executes approved actions', color: 'text-warning-400' },
  { value: 'fully_autonomous', label: 'Fully Autonomous', description: 'AI runs the company', color: 'text-success-400' },
];

export function AutopilotPage() {
  const { data: dash, isLoading } = useAutopilotDashboard();
  const updateMode = useUpdateAutopilotMode();
  const [tab, setTab] = useState<TabId>('overview');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Company Autopilot" description="The AI Revenue Operating System — autonomous business monitoring, decision-making, and execution." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dash) {
    return (
      <div>
        <PageHeader title="Company Autopilot" description="The AI Revenue Operating System — autonomous business monitoring, decision-making, and execution." />
        <Card className="p-6">
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20">
              <Activity className="h-8 w-8 text-brand-400" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-lg font-semibold text-ink-500">Autonomous Revenue Execution Engine</h3>
              <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">Transform your platform into an AI Revenue Operating System. The AI CEO continuously monitors the business, detects opportunities, creates execution plans, executes approved actions, measures outcomes, and learns from results.</p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  const modeColor = dash.autopilotMode === 'fully_autonomous' ? 'bg-success-500/10 border-success-500/20' : dash.autopilotMode === 'semi_autonomous' ? 'bg-warning-500/10 border-warning-500/20' : dash.autopilotMode === 'advisory' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border-brand-500/20' : 'bg-gray-500/10 border-gray-500/20';

  return (
    <div>
      <PageHeader title="Company Autopilot" description="The AI Revenue Operating System — autonomous business monitoring, decision-making, and execution." actions={
        <div className="flex items-center gap-2">
          {MODE_OPTIONS.map((m) => (
            <button key={m.value} onClick={() => updateMode.mutate({ mode: m.value })} disabled={updateMode.isPending} className={cn('flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors', dash.autopilotMode === m.value ? 'bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950' : 'bg-card-900 text-ink-500 hover:text-ink-500')}>
              <span className={cn('h-2 w-2 rounded-full', m.value === 'off' ? 'bg-gray-500' : m.value === 'advisory' ? 'bg-gradient-to-r from-gold-400 to-gold-300' : m.value === 'semi_autonomous' ? 'bg-warning-500' : 'bg-success-500')} />
              {m.label}
            </button>
          ))}
        </div>
      } />
      <div className={cn('flex items-center gap-3 mb-6 rounded-xl border p-4', modeColor)}>
        <Activity className={cn('h-5 w-5 shrink-0', MODE_OPTIONS.find(m => m.value === dash.autopilotMode)?.color ?? 'text-ink-500')} />
        <div className="flex-1">
          <p className="text-sm text-ink-500">Autopilot Mode: <span className="font-bold capitalize">{dash.autopilotMode.replace(/_/g, ' ')}</span> — {MODE_OPTIONS.find(m => m.value === dash.autopilotMode)?.description}</p>
          <p className="text-xs text-ink-500 mt-0.5">{dash.activeCycles} active cycles · {dash.activePlans} active plans · {dash.pendingActions} pending actions · {dash.pendingApprovals} pending approvals · Total ROI: ${dash.totalROI.toFixed(2)}</p>
        </div>
      </div>
      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />{t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="p-4">
          {tab === 'overview' && <OverviewTab dash={dash} />}
          {tab === 'executions' && <ExecutionsTab dash={dash} />}
          {tab === 'events' && <EventsTab dash={dash} />}
          {tab === 'plans' && <PlansTab dash={dash} />}
          {tab === 'history' && <HistoryTab dash={dash} />}
          {tab === 'recommendations' && <RecommendationsTab dash={dash} />}
          {tab === 'decisions' && <DecisionsTab dash={dash} />}
          {tab === 'optimization' && <OptimizationTab dash={dash} />}
          {tab === 'learning' && <LearningTab dash={dash} />}
          {tab === 'playbooks' && <PlaybooksTab dash={dash} />}
          {tab === 'approvals' && <ApprovalsTab dash={dash} />}
          {tab === 'failures' && <FailuresTab dash={dash} />}
          {tab === 'roi' && <RoiTab dash={dash} />}
          {tab === 'settings' && <SettingsTab dash={dash} />}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; sub?: string; tone?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', tone ?? 'text-brand-400')} />
        <span className="text-xs text-ink-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-ink-500">{value}</p>
      {sub && <p className="text-xs text-ink-500 mt-0.5">{sub}</p>}
    </Card>
  );
}

function OverviewTab({ dash }: { dash: any }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Activity} label="Active Cycles" value={dash.activeCycles} sub={`${dash.cycles.length} total`} />
        <StatCard icon={Target} label="Active Plans" value={dash.activePlans} sub={`${dash.plans.length} total`} />
        <StatCard icon={Cpu} label="Pending Actions" value={dash.pendingActions} sub={`${dash.executingActions} executing`} tone={dash.pendingActions > 0 ? 'text-warning-400' : 'text-ink-500'} />
        <StatCard icon={DollarSign} label="Total ROI" value={`$${dash.totalROI.toFixed(2)}`} tone="text-success-400" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Shield} label="Pending Approvals" value={dash.pendingApprovals} tone={dash.pendingApprovals > 0 ? 'text-warning-400' : 'text-success-400'} />
        <StatCard icon={Sparkles} label="Recommendations" value={dash.totalRecommendations} sub={`${dash.pendingRecommendations} pending`} />
        <StatCard icon={Brain} label="Decisions" value={dash.totalDecisions} sub={`${dash.avgDecisionAccuracy.toFixed(1)}% accuracy`} />
        <StatCard icon={TrendingUp} label="Success Rate" value={`${dash.successRate.toFixed(1)}%`} tone={dash.successRate >= 80 ? 'text-success-400' : dash.successRate >= 50 ? 'text-warning-400' : 'text-error-400'} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Execution History</h4>
          <div className="space-y-2">
            {dash.history.length === 0 ? <p className="text-xs text-ink-500">No execution history yet.</p> : dash.history.slice(0, 6).map((h: any) => (
              <div key={h.id} className="flex items-start gap-2 rounded-lg bg-card-900 p-2.5">
                <div className={cn('flex h-6 w-6 items-center justify-center rounded shrink-0', h.event_type.includes('completed') || h.event_type.includes('granted') ? 'bg-success-500/10' : h.event_type.includes('failed') || h.event_type.includes('denied') ? 'bg-error-500/10' : 'bg-gradient-to-r from-gold-400 to-gold-300/10')}>
                  {h.event_type.includes('completed') ? <CheckCircle2 className="h-3 w-3 text-success-400" /> : h.event_type.includes('failed') ? <XCircle className="h-3 w-3 text-error-400" /> : <Activity className="h-3 w-3 text-brand-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-ink-500">{h.event_description}</p>
                  <p className="text-[10px] text-ink-500">{h.event_type.replace(/_/g, ' ')} · {timeAgo(h.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-ink-500 mb-3">Pending Recommendations</h4>
          <div className="space-y-2">
            {dash.recommendations.filter((r: any) => !r.is_approved && !r.is_dismissed).length === 0 ? <p className="text-xs text-ink-500">No pending recommendations.</p> : dash.recommendations.filter((r: any) => !r.is_approved && !r.is_dismissed).slice(0, 6).map((r: any) => (
              <div key={r.id} className="flex items-start justify-between rounded-lg bg-card-900 p-2.5">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-ink-500">{r.recommendation_title}</p>
                  <p className="text-[10px] text-ink-500">{r.recommendation_type.replace(/_/g, ' ')} · {r.priority} · {timeAgo(r.created_at)}</p>
                </div>
                <Badge tone={r.priority === 'critical' ? 'error' : r.priority === 'high' ? 'warning' : 'neutral'}>{r.priority}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ExecutionsTab({ dash }: { dash: any }) {
  const retryAction = useRetryAction();
  const cancelAction = useCancelAction();
  const actions = dash.actions as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Pending" value={dash.pendingActions} tone="text-warning-400" />
        <StatCard icon={Cpu} label="Executing" value={dash.executingActions} tone="text-brand-400" />
        <StatCard icon={CheckCircle2} label="Completed" value={dash.completedActions} tone="text-success-400" />
        <StatCard icon={XCircle} label="Failed" value={dash.failedActions} tone="text-error-400" />
      </div>
      <div className="space-y-2">
        {actions.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No execution actions recorded.</p> : actions.slice(0, 30).map((a: any) => (
          <Card key={a.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', a.action_status === 'completed' ? 'bg-success-500/10' : a.action_status === 'failed' ? 'bg-error-500/10' : a.action_status === 'executing' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10' : 'bg-gray-500/10')}>
                  {a.action_status === 'completed' ? <CheckCircle2 className="h-4 w-4 text-success-400" /> : a.action_status === 'failed' ? <XCircle className="h-4 w-4 text-error-400" /> : a.action_status === 'executing' ? <Cpu className="h-4 w-4 text-brand-400" /> : <Clock className="h-4 w-4 text-ink-500" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-500">{a.action_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink-500">{a.target_module ?? 'N/A'} · priority {a.priority} · attempt {a.attempts}/{a.max_attempts} · {timeAgo(a.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={a.action_status === 'completed' ? 'success' : a.action_status === 'failed' ? 'error' : a.action_status === 'executing' ? 'brand' : 'warning'} dot>{a.action_status}</Badge>
                {a.action_status === 'failed' && <button onClick={() => retryAction.mutate(a.id)} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-2 py-1 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><RefreshCw className="h-3 w-3" /></button>}
                {(a.action_status === 'pending' || a.action_status === 'queued') && <button onClick={() => cancelAction.mutate(a.id)} className="rounded-lg bg-error-500/10 px-2 py-1 text-xs text-error-400 hover:bg-error-500/20"><XCircle className="h-3 w-3" /></button>}
              </div>
            </div>
            {a.error_message && <p className="mt-1.5 text-xs text-error-400 font-mono">{a.error_message}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function EventsTab({ dash }: { dash: any }) {
  const createRule = useCreateEventRule();
  const toggleRule = useToggleEventRule();
  const events = dash.businessEvents as any[];
  const rules = dash.businessEventRules as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Zap} label="Total Events" value={events.length} />
        <StatCard icon={Clock} label="Unprocessed" value={dash.unprocessedEvents} tone={dash.unprocessedEvents > 0 ? 'text-warning-400' : 'text-success-400'} />
        <StatCard icon={Target} label="Active Rules" value={rules.filter((r: any) => r.is_active).length} />
        <StatCard icon={Activity} label="Queue Items" value={(dash.businessEventQueue as any[]).length} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Business Events</h4>
        <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
          {events.length === 0 ? <p className="text-xs text-ink-500">No business events recorded.</p> : events.slice(0, 20).map((e: any) => (
            <div key={e.id} className="flex items-center gap-2 rounded-lg bg-card-900 p-2 text-xs">
              <Zap className={cn('h-3.5 w-3.5 shrink-0', e.event_severity === 'critical' ? 'text-error-400' : e.event_severity === 'high' ? 'text-warning-400' : 'text-brand-400')} />
              <span className="text-ink-500 flex-1">{e.event_type.replace(/_/g, ' ')}</span>
              <span className="text-ink-500">{e.event_source} · {timeAgo(e.created_at)}</span>
              <Badge tone={e.is_processed ? 'success' : 'warning'}>{e.is_processed ? 'Processed' : 'Pending'}</Badge>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Event Rules</h4>
        <div className="space-y-2">
          {rules.length === 0 ? <p className="text-xs text-ink-500">No event rules configured. <button onClick={() => createRule.mutate({ name: 'Default Rule', triggerEventType: 'lead_created', actionType: 'create_plan' })} className="text-brand-400 hover:underline">Create one</button></p> : rules.map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div>
                <p className="text-sm font-medium text-ink-500">{r.rule_name}</p>
                <p className="text-xs text-ink-500">{r.trigger_event_type} → {r.action_type} · {r.trigger_count} triggers</p>
              </div>
              <button onClick={() => toggleRule.mutate({ ruleId: r.id, active: !r.is_active })} className={cn('rounded-lg px-2.5 py-1 text-xs', r.is_active ? 'bg-success-500/10 text-success-400' : 'bg-gray-500/10 text-ink-500')}>{r.is_active ? 'Active' : 'Inactive'}</button>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PlansTab({ dash }: { dash: any }) {
  const approvePlan = useApprovePlan();
  const cancelPlan = useCancelPlan();
  const plans = dash.plans as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Total Plans" value={plans.length} />
        <StatCard icon={Activity} label="Active" value={dash.activePlans} tone="text-brand-400" />
        <StatCard icon={CheckCircle2} label="Completed" value={plans.filter((p: any) => p.plan_status === 'completed').length} tone="text-success-400" />
        <StatCard icon={Clock} label="Pending Approval" value={plans.filter((p: any) => p.plan_status === 'pending_approval').length} tone="text-warning-400" />
      </div>
      <div className="space-y-2">
        {plans.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No execution plans created yet.</p> : plans.slice(0, 20).map((p: any) => (
          <Card key={p.id} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{p.plan_name}</p>
                  <p className="text-xs text-ink-500">{p.plan_type.replace(/_/g, ' ')} · priority {p.priority} · {p.estimated_roi ? `ROI: $${p.estimated_roi.toFixed(0)}` : 'No ROI estimate'} · {timeAgo(p.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.plan_status === 'completed' ? 'success' : p.plan_status === 'executing' ? 'brand' : p.plan_status === 'failed' ? 'error' : p.plan_status === 'pending_approval' ? 'warning' : 'neutral'} dot>{p.plan_status.replace(/_/g, ' ')}</Badge>
                {p.plan_status === 'pending_approval' && <button onClick={() => approvePlan.mutate(p.id)} className="rounded-lg bg-success-500/10 px-2.5 py-1 text-xs text-success-400 hover:bg-success-500/20">Approve</button>}
                {(p.plan_status === 'draft' || p.plan_status === 'pending_approval') && <button onClick={() => cancelPlan.mutate(p.id)} className="rounded-lg bg-error-500/10 px-2.5 py-1 text-xs text-error-400 hover:bg-error-500/20">Cancel</button>}
              </div>
            </div>
            {p.plan_description && <p className="mt-1.5 text-xs text-ink-500">{p.plan_description}</p>}
          </Card>
        ))}
      </div>
    </div>
  );
}

function HistoryTab({ dash }: { dash: any }) {
  const history = dash.history as any[];
  return (
    <div className="space-y-4">
      <StatCard icon={Clock} label="Total Events" value={history.length} />
      <div className="space-y-1.5 max-h-[600px] overflow-y-auto scrollbar-thin">
        {history.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No execution history recorded.</p> : history.slice(0, 50).map((h: any) => (
          <div key={h.id} className="flex items-start gap-2 rounded-lg bg-card-900 p-2.5">
            <div className={cn('flex h-6 w-6 items-center justify-center rounded shrink-0', h.event_type.includes('completed') || h.event_type.includes('granted') ? 'bg-success-500/10' : h.event_type.includes('failed') || h.event_type.includes('denied') ? 'bg-error-500/10' : h.event_type.includes('started') || h.event_type.includes('queued') ? 'bg-gradient-to-r from-gold-400 to-gold-300/10' : 'bg-gray-500/10')}>
              {h.event_type.includes('completed') ? <CheckCircle2 className="h-3 w-3 text-success-400" /> : h.event_type.includes('failed') ? <XCircle className="h-3 w-3 text-error-400" /> : <Activity className="h-3 w-3 text-brand-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-ink-500">{h.event_description}</p>
              <p className="text-[10px] text-ink-500">{h.event_type.replace(/_/g, ' ')} · {timeAgo(h.created_at)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RecommendationsTab({ dash }: { dash: any }) {
  const approveRec = useApproveRecommendation();
  const dismissRec = useDismissRecommendation();
  const recs = dash.recommendations as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Sparkles} label="Total" value={dash.totalRecommendations} />
        <StatCard icon={Clock} label="Pending" value={dash.pendingRecommendations} tone="text-warning-400" />
        <StatCard icon={CheckCircle2} label="Approved" value={dash.approvedRecommendations} tone="text-success-400" />
        <StatCard icon={Rocket} label="Implemented" value={dash.implementedRecommendations} tone="text-brand-400" />
      </div>
      <div className="space-y-2">
        {recs.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No recommendations generated yet.</p> : recs.slice(0, 20).map((r: any) => (
          <Card key={r.id} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-500">{r.recommendation_title}</p>
                {r.recommendation_description && <p className="text-xs text-ink-500 mt-0.5">{r.recommendation_description}</p>}
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <Badge tone="brand">{r.recommendation_type.replace(/_/g, ' ')}</Badge>
                  <Badge tone={r.priority === 'critical' ? 'error' : r.priority === 'high' ? 'warning' : 'neutral'}>{r.priority}</Badge>
                  {r.estimated_roi != null && <Badge tone="success">ROI: ${r.estimated_roi.toFixed(0)}</Badge>}
                  <Badge tone={r.risk_level === 'critical' ? 'error' : r.risk_level === 'high' ? 'warning' : 'neutral'}>Risk: {r.risk_level}</Badge>
                  <span className="text-[10px] text-ink-500">{(r.confidence_score * 100).toFixed(0)}% confidence · {timeAgo(r.created_at)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {!r.is_approved && !r.is_dismissed && (
                  <>
                    <button onClick={() => approveRec.mutate(r.id)} className="rounded-lg bg-success-500/10 px-2.5 py-1 text-xs text-success-400 hover:bg-success-500/20">Approve</button>
                    <button onClick={() => dismissRec.mutate(r.id)} className="rounded-lg bg-gray-500/10 px-2.5 py-1 text-xs text-ink-500 hover:bg-gray-500/20">Dismiss</button>
                  </>
                )}
                {r.is_approved && <Badge tone="success" dot>Approved</Badge>}
                {r.is_dismissed && <Badge tone="neutral">Dismissed</Badge>}
                {r.is_implemented && <Badge tone="brand" dot>Implemented</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function DecisionsTab({ dash }: { dash: any }) {
  const decisions = dash.decisions as any[];
  const models = dash.decisionModels as any[];
  const outcomes = dash.decisionOutcomes as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Brain} label="Total Decisions" value={dash.totalDecisions} />
        <StatCard icon={Clock} label="Pending" value={dash.pendingDecisions} tone="text-warning-400" />
        <StatCard icon={CheckCircle2} label="Completed" value={dash.completedDecisions} tone="text-success-400" />
        <StatCard icon={TrendingUp} label="Avg Accuracy" value={`${dash.avgDecisionAccuracy.toFixed(1)}%`} tone={dash.avgDecisionAccuracy >= 80 ? 'text-success-400' : 'text-warning-400'} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Decisions</h4>
        <div className="space-y-2">
          {decisions.length === 0 ? <p className="text-xs text-ink-500">No decisions recorded.</p> : decisions.slice(0, 15).map((d: any) => (
            <div key={d.id} className="rounded-lg bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-ink-500">{d.decision_title}</p>
                <Badge tone={d.decision_status === 'completed' ? 'success' : d.decision_status === 'pending' ? 'warning' : d.decision_status === 'failed' ? 'error' : 'brand'} dot>{d.decision_status}</Badge>
              </div>
              <p className="text-xs text-ink-500">{d.decision_reason}</p>
              <div className="flex flex-wrap gap-2 mt-1.5">
                <Badge tone="brand">{d.decision_type}</Badge>
                <span className="text-[10px] text-ink-500">Confidence: {(d.confidence_score * 100).toFixed(0)}% · Risk: {(d.risk_score * 100).toFixed(0)}%{d.expected_roi ? ` · Expected ROI: $${d.expected_roi.toFixed(0)}` : ''} · {timeAgo(d.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Decision Models</h4>
        <div className="space-y-2">
          {models.length === 0 ? <p className="text-xs text-ink-500">No decision models configured.</p> : models.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div>
                <p className="text-sm font-medium text-ink-500">{m.model_name}</p>
                <p className="text-xs text-ink-500">{m.model_type} · v{m.model_version} · {m.training_data_count} training samples</p>
              </div>
              <div className="flex items-center gap-2">
                {m.accuracy_score != null && <Badge tone={m.accuracy_score >= 0.8 ? 'success' : 'warning'}>{(m.accuracy_score * 100).toFixed(1)}% accuracy</Badge>}
                <Badge tone={m.is_active ? 'success' : 'neutral'} dot>{m.is_active ? 'Active' : 'Inactive'}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function OptimizationTab({ dash }: { dash: any }) {
  const implementOpt = useImplementOptimization();
  const opportunities = dash.optimizationOpportunities as any[];
  const history = dash.optimizationHistory as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={TrendingUp} label="Opportunities" value={dash.totalOptimizations} />
        <StatCard icon={CheckCircle2} label="Implemented" value={dash.implementedOptimizations} tone="text-success-400" />
        <StatCard icon={Clock} label="Pending" value={dash.totalOptimizations - dash.implementedOptimizations} tone="text-warning-400" />
        <StatCard icon={Activity} label="History Records" value={history.length} />
      </div>
      <div className="space-y-2">
        {opportunities.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No optimization opportunities identified yet.</p> : opportunities.slice(0, 20).map((o: any) => (
          <Card key={o.id} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-500">{o.opportunity_title}</p>
                {o.opportunity_description && <p className="text-xs text-ink-500 mt-0.5">{o.opportunity_description}</p>}
                <div className="flex flex-wrap gap-2 mt-1.5">
                  <Badge tone="brand">{o.optimization_area}</Badge>
                  {o.estimated_gain != null && <Badge tone="success">Est. gain: {o.estimated_gain.toFixed(1)}</Badge>}
                  <Badge tone="neutral">Effort: {o.implementation_effort}</Badge>
                  <span className="text-[10px] text-ink-500">{(o.confidence_score * 100).toFixed(0)}% confidence · {timeAgo(o.created_at)}</span>
                </div>
              </div>
              {!o.is_implemented && <button onClick={() => implementOpt.mutate(o.id)} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-2.5 py-1 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 shrink-0">Implement</button>}
              {o.is_implemented && <Badge tone="success" dot>Implemented</Badge>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function LearningTab({ dash }: { dash: any }) {
  const applyLearning = useApplyLearning();
  const learnings = dash.learnings as any[];
  const snapshots = dash.learningSnapshots as any[];
  const improvements = dash.recommendationImprovements as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={BookOpen} label="Total Learnings" value={dash.totalLearnings} />
        <StatCard icon={CheckCircle2} label="Applied" value={dash.appliedLearnings} tone="text-success-400" />
        <StatCard icon={Activity} label="Snapshots" value={snapshots.length} />
        <StatCard icon={TrendingUp} label="Improvements" value={improvements.length} />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Learning Records</h4>
        <div className="space-y-2">
          {learnings.length === 0 ? <p className="text-xs text-ink-500">No learnings recorded yet.</p> : learnings.slice(0, 15).map((l: any) => (
            <div key={l.id} className="flex items-start justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-500">{l.learning_title}</p>
                {l.learning_description && <p className="text-xs text-ink-500 mt-0.5">{l.learning_description}</p>}
                <div className="flex flex-wrap gap-2 mt-1">
                  <Badge tone="brand">{l.learning_type.replace(/_/g, ' ')}</Badge>
                  {l.estimated_gain != null && <span className="text-[10px] text-ink-500">Est. gain: {l.estimated_gain.toFixed(1)} · {(l.confidence_score * 100).toFixed(0)}% confidence · {timeAgo(l.created_at)}</span>}
                </div>
              </div>
              {!l.is_applied && <button onClick={() => applyLearning.mutate(l.id)} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-2.5 py-1 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 shrink-0">Apply</button>}
              {l.is_applied && <Badge tone="success" dot>Applied</Badge>}
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Learning Snapshots</h4>
        <div className="space-y-2">
          {snapshots.length === 0 ? <p className="text-xs text-ink-500">No learning snapshots.</p> : snapshots.slice(0, 10).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div>
                <p className="text-sm font-medium text-ink-500">{s.snapshot_name}</p>
                <p className="text-xs text-ink-500">{s.snapshot_type.replace(/_/g, ' ')} · {s.total_actions_analyzed} actions analyzed · {s.successful_patterns} success patterns · {s.failed_patterns} failure patterns</p>
              </div>
              <div className="flex items-center gap-2">
                {s.confidence_trend > 0 && <Badge tone="success">+{(s.confidence_trend * 100).toFixed(1)}% conf</Badge>}
                {s.accuracy_trend > 0 && <Badge tone="success">+{(s.accuracy_trend * 100).toFixed(1)}% acc</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PlaybooksTab({ dash }: { dash: any }) {
  const createPlaybook = useCreatePlaybook();
  const executePlaybook = useExecutePlaybook();
  const playbooks = dash.playbooks as any[];
  const executions = dash.playbookExecutions as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Rocket} label="Total Playbooks" value={dash.totalPlaybooks} />
        <StatCard icon={Activity} label="Active Executions" value={dash.activePlaybookExecutions} tone="text-brand-400" />
        <StatCard icon={CheckCircle2} label="Completed" value={executions.filter((e: any) => e.execution_status === 'completed').length} tone="text-success-400" />
        <StatCard icon={Clock} label="Pending" value={executions.filter((e: any) => e.execution_status === 'pending').length} tone="text-warning-400" />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Available Playbooks</h4>
        <div className="space-y-2">
          {playbooks.length === 0 ? <div className="text-center py-8 space-y-2"><p className="text-xs text-ink-500">No playbooks created yet.</p><button onClick={() => createPlaybook.mutate({ name: 'Churn Recovery Playbook', category: 'churn_recovery' })} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-xs text-maroon-950 hover:bg-brand-300/15">Create Default Playbook</button></div> : playbooks.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between rounded-lg bg-card-900 p-3">
              <div className="flex items-center gap-2">
                <Rocket className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{p.playbook_name}</p>
                  <p className="text-xs text-ink-500">{p.playbook_category.replace(/_/g, ' ')} · {p.required_agents?.length ?? 0} agents · {p.required_approvals?.length ?? 0} approvals needed{p.estimated_roi ? ` · ROI: $${p.estimated_roi.toFixed(0)}` : ''}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={p.is_active ? 'success' : 'neutral'} dot>{p.is_active ? 'Active' : 'Inactive'}</Badge>
                <button onClick={() => executePlaybook.mutate(p.id)} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-2.5 py-1 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20">Execute</button>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Recent Executions</h4>
        <div className="space-y-2">
          {executions.length === 0 ? <p className="text-xs text-ink-500">No playbook executions recorded.</p> : executions.slice(0, 10).map((e: any) => (
            <div key={e.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div>
                <p className="text-sm font-medium text-ink-500">{e.execution_name}</p>
                <p className="text-xs text-ink-500">Step {e.current_step}/{e.total_steps} · {timeAgo(e.created_at)}{e.actual_roi ? ` · ROI: $${e.actual_roi.toFixed(0)}` : ''}</p>
              </div>
              <Badge tone={e.execution_status === 'completed' ? 'success' : e.execution_status === 'executing' ? 'brand' : e.execution_status === 'failed' ? 'error' : 'warning'} dot>{e.execution_status}</Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function ApprovalsTab({ dash }: { dash: any }) {
  const approve = useApproveRequest();
  const deny = useDenyRequest();
  const approvals = dash.approvals as any[];
  const pending = approvals.filter((a: any) => a.approval_status === 'pending');
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Shield} label="Total" value={approvals.length} />
        <StatCard icon={Clock} label="Pending" value={pending.length} tone={pending.length > 0 ? 'text-warning-400' : 'text-success-400'} />
        <StatCard icon={CheckCircle2} label="Approved" value={approvals.filter((a: any) => a.approval_status === 'approved').length} tone="text-success-400" />
        <StatCard icon={XCircle} label="Denied" value={approvals.filter((a: any) => a.approval_status === 'denied').length} tone="text-error-400" />
      </div>
      <div className="space-y-2">
        {pending.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No pending approvals. All clear.</p> : pending.map((a: any) => (
          <Card key={a.id} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-ink-500">{a.approval_type.replace(/_/g, ' ')} Approval</p>
                {a.approval_reason && <p className="text-xs text-ink-500 mt-0.5">{a.approval_reason}</p>}
                <p className="text-[10px] text-ink-500 mt-1">Requested by {a.requested_by} · {timeAgo(a.requested_at)}</p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => approve.mutate(a.id)} className="rounded-lg bg-success-500/10 px-3 py-1.5 text-xs text-success-400 hover:bg-success-500/20">Approve</button>
                <button onClick={() => deny.mutate(a.id)} className="rounded-lg bg-error-500/10 px-3 py-1.5 text-xs text-error-400 hover:bg-error-500/20">Deny</button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function FailuresTab({ dash }: { dash: any }) {
  const failures = dash.failures as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={AlertTriangle} label="Total Failures" value={failures.length} />
        <StatCard icon={RefreshCw} label="Retried" value={failures.filter((f: any) => f.is_retried).length} tone="text-warning-400" />
        <StatCard icon={AlertTriangle} label="Escalated" value={failures.filter((f: any) => f.is_escalated).length} tone="text-error-400" />
        <StatCard icon={CheckCircle2} label="Resolved" value={failures.filter((f: any) => f.resolved_at).length} tone="text-success-400" />
      </div>
      <div className="space-y-2">
        {failures.length === 0 ? <p className="text-center py-8 text-sm text-ink-500">No execution failures recorded.</p> : failures.slice(0, 20).map((f: any) => (
          <Card key={f.id} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', f.failure_severity === 'critical' ? 'bg-error-500/10' : f.failure_severity === 'high' ? 'bg-warning-500/10' : 'bg-gray-500/10')}>
                  <AlertTriangle className={cn('h-4 w-4', f.failure_severity === 'critical' ? 'text-error-400' : f.failure_severity === 'high' ? 'text-warning-400' : 'text-ink-500')} />
                </div>
                <div>
                  <p className="text-sm font-medium text-ink-500">{f.failure_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink-500">{f.error_message}</p>
                  <p className="text-[10px] text-ink-500 mt-0.5">Retry {f.retry_count}/{f.max_retries} · {timeAgo(f.created_at)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={f.failure_severity === 'critical' ? 'error' : f.failure_severity === 'high' ? 'warning' : 'neutral'}>{f.failure_severity}</Badge>
                {f.is_escalated && <Badge tone="error" dot>Escalated</Badge>}
                {f.resolved_at && <Badge tone="success" dot>Resolved</Badge>}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function RoiTab({ dash }: { dash: any }) {
  const roiTracking = dash.roiTracking as any[];
  const roiSnapshots = dash.roiSnapshots as any[];
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Total ROI" value={`$${dash.totalROI.toFixed(2)}`} tone="text-success-400" />
        <StatCard icon={Activity} label="ROI Records" value={roiTracking.length} />
        <StatCard icon={CheckCircle2} label="Realized" value={roiTracking.filter((r: any) => r.roi_status === 'realized').length} tone="text-success-400" />
        <StatCard icon={Clock} label="Measuring" value={roiTracking.filter((r: any) => r.roi_status === 'measuring').length} tone="text-warning-400" />
      </div>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">ROI Tracking</h4>
        <div className="space-y-2">
          {roiTracking.length === 0 ? <p className="text-xs text-ink-500">No ROI tracking records.</p> : roiTracking.slice(0, 15).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{r.entity_type} · {r.roi_type}</p>
                  <p className="text-xs text-ink-500">Investment: ${r.investment_amount.toFixed(2)} · Return: ${r.return_amount.toFixed(2)} · {r.measurement_window_days}d window</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {r.roi_percentage != null && <span className={cn('text-sm font-bold', r.roi_percentage >= 0 ? 'text-success-400' : 'text-error-400')}>{r.roi_percentage >= 0 ? '+' : ''}{r.roi_percentage.toFixed(1)}%</span>}
                <Badge tone={r.roi_status === 'realized' ? 'success' : r.roi_status === 'measuring' ? 'warning' : r.roi_status === 'failed' ? 'error' : 'neutral'} dot>{r.roi_status}</Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">ROI Snapshots</h4>
        <div className="space-y-2">
          {roiSnapshots.length === 0 ? <p className="text-xs text-ink-500">No ROI snapshots recorded.</p> : roiSnapshots.slice(0, 10).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between rounded-lg bg-card-900 p-2.5">
              <div>
                <p className="text-sm font-medium text-ink-500">{s.snapshot_period}</p>
                <p className="text-xs text-ink-500">Investment: ${s.total_investment.toFixed(2)} · Return: ${s.total_return.toFixed(2)} · {s.plans_measured} plans · {s.actions_measured} actions</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-bold', s.total_roi >= 0 ? 'text-success-400' : 'text-error-400')}>{s.total_roi >= 0 ? '+' : ''}${s.total_roi.toFixed(2)}</span>
                {s.total_roi_percentage != null && <Badge tone={s.total_roi_percentage >= 0 ? 'success' : 'error'}>{s.total_roi_percentage.toFixed(1)}%</Badge>}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function SettingsTab({ dash }: { dash: any }) {
  const updateSettings = useUpdateAutopilotMode();
  const updateModuleConfig = useUpdateModuleConfig();
  const settings = dash.autopilotSettings as any;
  const modules = dash.moduleConfigs as any[];
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Autopilot Mode</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {MODE_OPTIONS.map((m) => (
            <button key={m.value} onClick={() => updateSettings.mutate({ mode: m.value })} className={cn('flex flex-col items-start rounded-lg border p-3 text-left transition-colors', dash.autopilotMode === m.value ? 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/5' : 'border-gold-500/12 bg-card-900 hover:border-brand-500/50')}>
              <div className="flex items-center gap-2">
                <span className={cn('h-2.5 w-2.5 rounded-full', m.value === 'off' ? 'bg-gray-500' : m.value === 'advisory' ? 'bg-gradient-to-r from-gold-400 to-gold-300' : m.value === 'semi_autonomous' ? 'bg-warning-500' : 'bg-success-500')} />
                <span className="text-sm font-medium text-ink-500">{m.label}</span>
              </div>
              <p className="text-xs text-ink-500 mt-1">{m.description}</p>
            </button>
          ))}
        </div>
      </Card>
      {settings && (
        <Card className="p-4">
          <h4 className="text-sm font-semibold text-ink-500 mb-3">Global Limits</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-xs text-ink-500">Max Daily Actions</p><p className="text-lg font-bold text-ink-500">{settings.max_daily_actions}</p></div>
            <div><p className="text-xs text-ink-500">Max Daily Cost</p><p className="text-lg font-bold text-ink-500">${settings.max_daily_cost}</p></div>
            <div><p className="text-xs text-ink-500">Max Concurrent</p><p className="text-lg font-bold text-ink-500">{settings.max_concurrent_executions}</p></div>
            <div><p className="text-xs text-ink-500">Approval Threshold</p><p className="text-lg font-bold text-ink-500">${settings.requires_approval_threshold}</p></div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
            <div><p className="text-xs text-ink-500">Auto-Approve Confidence</p><p className="text-lg font-bold text-ink-500">{(settings.auto_approval_confidence_threshold * 100).toFixed(0)}%</p></div>
            <div><p className="text-xs text-ink-500">Auto-Approve Risk</p><p className="text-lg font-bold text-ink-500">{(settings.auto_approval_risk_threshold * 100).toFixed(0)}%</p></div>
            <div><p className="text-xs text-ink-500">Total Cycles</p><p className="text-lg font-bold text-ink-500">{settings.total_cycles}</p></div>
            <div><p className="text-xs text-ink-500">Total Actions</p><p className="text-lg font-bold text-ink-500">{settings.total_actions_executed}</p></div>
          </div>
        </Card>
      )}
      <Card className="p-4">
        <h4 className="text-sm font-semibold text-ink-500 mb-3">Module Configurations</h4>
        <div className="space-y-2">
          {modules.length === 0 ? <p className="text-xs text-ink-500">No module configurations. These define what AI may do automatically per module, what requires approval, and what always requires humans.</p> : modules.map((m: any) => (
            <div key={m.id} className="rounded-lg bg-card-900 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-ink-500">{m.module_display_name}</p>
                <button onClick={() => updateModuleConfig.mutate({ configId: m.id, updates: { is_enabled: !m.is_enabled } })} className={cn('rounded-lg px-2.5 py-1 text-xs', m.is_enabled ? 'bg-success-500/10 text-success-400' : 'bg-gray-500/10 text-ink-500')}>{m.is_enabled ? 'Enabled' : 'Disabled'}</button>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-ink-500 mb-1">Auto Allowed</p>
                  <div className="flex flex-wrap gap-1">
                    {(m.allowed_actions as string[]).slice(0, 3).map((a: string) => <Badge key={a} tone="success">{a}</Badge>)}
                    {(m.allowed_actions as string[]).length > 3 && <span className="text-ink-500 text-[10px]">+{(m.allowed_actions as string[]).length - 3} more</span>}
                  </div>
                </div>
                <div>
                  <p className="text-ink-500 mb-1">Requires Approval</p>
                  <div className="flex flex-wrap gap-1">
                    {(m.approval_required_actions as string[]).slice(0, 3).map((a: string) => <Badge key={a} tone="warning">{a}</Badge>)}
                    {(m.approval_required_actions as string[]).length > 3 && <span className="text-ink-500 text-[10px]">+{(m.approval_required_actions as string[]).length - 3} more</span>}
                  </div>
                </div>
                <div>
                  <p className="text-ink-500 mb-1">Human Only</p>
                  <div className="flex flex-wrap gap-1">
                    {(m.human_only_actions as string[]).slice(0, 3).map((a: string) => <Badge key={a} tone="error">{a}</Badge>)}
                    {(m.human_only_actions as string[]).length > 3 && <span className="text-ink-500 text-[10px]">+{(m.human_only_actions as string[]).length - 3} more</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
