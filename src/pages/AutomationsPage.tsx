import { useQuery } from '@tanstack/react-query';
import {
  Zap, Bot, Activity, CheckCircle2, AlertTriangle,
  Clock, Cpu, Brain, Search, Target, Mail, MessageSquare,
  Calendar, FileText, BarChart3, RefreshCw,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn, timeAgo } from '@/lib/utils';

type AgentRun = {
  id: string;
  agent_type: string;
  status: string;
  created_at: string;
  duration_ms: number | null;
  workspace_id: string;
};

const AGENT_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  business_analyst: { label: 'Business Analyst', icon: Brain, color: 'text-brand-400' },
  icp_generator: { label: 'ICP Generator', icon: Target, color: 'text-brand-400' },
  prospect_discovery: { label: 'Prospect Discovery', icon: Search, color: 'text-brand-400' },
  research: { label: 'Research', icon: Search, color: 'text-violet-400' },
  lead_scoring: { label: 'Lead Scoring', icon: Cpu, color: 'text-violet-400' },
  buying_intent: { label: 'Buying Intent', icon: Activity, color: 'text-warning-500' },
  personalization: { label: 'Personalization', icon: Bot, color: 'text-brand-400' },
  outreach_linkedin: { label: 'LinkedIn Outreach', icon: MessageSquare, color: 'text-[#0A66C2]' },
  outreach_email: { label: 'Email Outreach', icon: Mail, color: 'text-error-400' },
  reply_detection: { label: 'Reply Detection', icon: MessageSquare, color: 'text-brand-400' },
  objection_handling: { label: 'Objection Handling', icon: Bot, color: 'text-warning-500' },
  meeting: { label: 'Meeting Agent', icon: Calendar, color: 'text-success-400' },
  post_meeting: { label: 'Post-Meeting', icon: Calendar, color: 'text-success-400' },
  proposal: { label: 'Proposal Agent', icon: FileText, color: 'text-violet-400' },
  crm_update: { label: 'CRM Update', icon: RefreshCw, color: 'text-ink-500' },
  analytics: { label: 'Analytics', icon: BarChart3, color: 'text-brand-400' },
  signal_monitor: { label: 'Signal Monitor', icon: Activity, color: 'text-warning-500' },
};

export function AutomationsPage() {
  const { workspace } = useWorkspace();

  const { data: runs, isLoading } = useQuery({
    queryKey: ['automations-runs', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('agent_executions')
        .select('id, agent_type, status, created_at, duration_ms, workspace_id')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(30);
      return (data ?? []) as AgentRun[];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['automations-stats', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return { total: 0, completed: 0, running: 0, failed: 0 };
      const { count: total } = await supabase
        .from('agent_executions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id);
      const { count: completed } = await supabase
        .from('agent_executions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .eq('status', 'completed');
      const { count: running } = await supabase
        .from('agent_executions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .eq('status', 'running');
      const { count: failed } = await supabase
        .from('agent_executions')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspace.id)
        .eq('status', 'failed');
      return { total: total ?? 0, completed: completed ?? 0, running: running ?? 0, failed: failed ?? 0 };
    },
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Automations" description="What your AI SDR is doing behind the scenes" />
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automations"
        description="What your AI SDR is doing behind the scenes"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Runs" value={stats?.total ?? 0} icon={Zap} tone="brand" />
        <StatCard label="Completed" value={stats?.completed ?? 0} icon={CheckCircle2} tone="success" />
        <StatCard label="Running" value={stats?.running ?? 0} icon={Activity} tone="warning" />
        <StatCard label="Failed" value={stats?.failed ?? 0} icon={AlertTriangle} tone="error" />
      </div>

      {/* Agent Monitor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-brand-400" />
            Agent Monitor
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!runs || runs.length === 0 ? (
            <EmptyState
              icon={<Bot className="h-5 w-5" />}
              title="No AI activity yet"
              description="Your AI SDR will start working automatically when you launch a campaign."
            />
          ) : (
            <div className="divide-y divide-border-subtle">
              {runs.map((run) => {
                const meta = AGENT_META[run.agent_type] ?? { label: run.agent_type, icon: Bot, color: 'text-ink-500' };
                const Icon = meta.icon;
                return (
                  <div key={run.id} className="flex items-center gap-3 px-5 py-3">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg bg-card-900 shrink-0', meta.color)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-500 truncate">{meta.label}</p>
                      <p className="text-[10px] text-ink-500 capitalize">{run.status}</p>
                    </div>
                    {run.duration_ms && (
                      <span className="text-[10px] text-ink-500 hidden sm:block">
                        {(run.duration_ms / 1000).toFixed(1)}s
                      </span>
                    )}
                    <span className="text-xs text-ink-500 shrink-0">{timeAgo(run.created_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info card */}
      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 shrink-0">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink-500">How automations work</p>
              <p className="text-xs text-ink-500 mt-1 leading-relaxed">
                Your AI SDR runs automatically in the background. When you launch a campaign, it discovers prospects,
                researches them, scores leads, sends outreach, handles replies, and books meetings — all without
                manual intervention. This page shows what the AI has been doing. You don't need to configure anything.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, tone }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warning' | 'error';
}) {
  const tones = {
    brand: 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400',
    success: 'bg-success-500/10 text-success-400',
    warning: 'bg-warning-500/10 text-warning-500',
    error: 'bg-error-500/10 text-error-400',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xl font-semibold text-ink-500">{value}</p>
          <p className="text-xs text-ink-500 mt-0.5">{label}</p>
        </div>
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </Card>
  );
}
