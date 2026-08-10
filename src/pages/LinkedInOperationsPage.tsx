import { useState } from 'react';
import {
  Linkedin, Activity, Zap, Shield, Gauge, Clock, Radio,
  AlertTriangle, Bell, RotateCcw, Brain, ListOrdered,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useLinkedInOpsDashboard, useLinkedInMonitor,
  useStartLinkedInExecution, useConnectLinkedInAccount, useDeleteLinkedInAccount,
} from '@/hooks/useLinkedInOperations';
import {
  AIMonitorCard, AccountsSection, ConnectAccountModal,
  QueueSection, TodayActivitySection, SequenceMonitorSection,
  SafetyMonitorSection, DailyUsageSection, HistorySection,
  FailuresSection, RetriesSection, LiveActivitySection,
  NotificationsSection, LinkedInOpsEmpty,
} from '@/components/linkedin-operations';

const TABS = [
  { id: 'accounts', label: 'Connected Accounts', icon: Linkedin },
  { id: 'queue', label: 'Execution Queue', icon: ListOrdered },
  { id: 'today', label: "Today's Activity", icon: Activity },
  { id: 'sequences', label: 'Sequence Monitor', icon: Radio },
  { id: 'safety', label: 'Safety Monitor', icon: Shield },
  { id: 'usage', label: 'Daily Usage', icon: Gauge },
  { id: 'history', label: 'Execution History', icon: Clock },
  { id: 'failures', label: 'Failures', icon: AlertTriangle },
  { id: 'retries', label: 'Retries', icon: RotateCcw },
  { id: 'feed', label: 'Live Activity', icon: Zap },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function LinkedInOperationsPage() {
  const { data: dashboard, isLoading } = useLinkedInOpsDashboard();
  const { data: monitor } = useLinkedInMonitor();
  const startExecution = useStartLinkedInExecution();
  const connectAccount = useConnectLinkedInAccount();
  const deleteAccount = useDeleteLinkedInAccount();

  const [tab, setTab] = useState<TabId>('accounts');
  const [showConnect, setShowConnect] = useState(false);

  if (isLoading) {
    return (
      <div>
        <PageHeader title="LinkedIn Operations" description="Execute approved LinkedIn outreach with safety and intelligence." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dashboard || dashboard.totalAccounts === 0) {
    return (
      <div>
        <PageHeader title="LinkedIn Operations" description="Execute approved LinkedIn outreach with safety and intelligence." />
        <Card className="p-6">
          <LinkedInOpsEmpty onStart={() => startExecution.mutate()} />
        </Card>
        <ConnectAccountModal show={showConnect} onClose={() => setShowConnect(false)} onConnect={(p) => connectAccount.mutate(p)} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="LinkedIn Operations"
        description="Execute approved LinkedIn outreach with safety and intelligence."
        actions={
          <button onClick={() => startExecution.mutate()} disabled={startExecution.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />
            {startExecution.isPending ? 'Starting...' : 'Start Execution'}
          </button>
        }
      />

      {/* AI Monitor */}
      {monitor && (
        <div className="mb-4">
          <AIMonitorCard monitor={monitor} />
        </div>
      )}

      {/* Status banner */}
      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Activity className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-500">{dashboard.totalAccounts}</span> accounts
            {' · '}<span className="font-semibold text-ink-500">{dashboard.activeAccounts}</span> active
            {' · '}<span className="font-semibold text-ink-500">{dashboard.queuedJobs}</span> queued
            {' · '}<span className="font-semibold text-ink-500">{dashboard.runningJobs}</span> running
            {' · '}<span className="font-semibold text-ink-500">{dashboard.todayActions}</span> actions today
            {' · '}Risk: <span className="font-semibold text-ink-500">{Math.round(dashboard.avgRiskScore * 100)}%</span>
          </p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'accounts' && (
            <AccountsSection
              accounts={dashboard.accounts}
              onConnect={() => setShowConnect(true)}
              onDelete={(id) => deleteAccount.mutate(id)}
            />
          )}
          {tab === 'queue' && <QueueSection queue={dashboard.queueItems} />}
          {tab === 'today' && <TodayActivitySection history={dashboard.recentHistory.filter((h) => h.created_at.startsWith(new Date().toISOString().split('T')[0]))} />}
          {tab === 'sequences' && <SequenceMonitorSection sequences={dashboard.sequences} states={dashboard.sequenceStates} />}
          {tab === 'safety' && <SafetyMonitorSection health={dashboard.healthRecords} limits={dashboard.rateLimits} />}
          {tab === 'usage' && <DailyUsageSection usage={dashboard.dailyUsage} />}
          {tab === 'history' && <HistorySection history={dashboard.recentHistory} />}
          {tab === 'failures' && <FailuresSection failures={dashboard.recentFailures} />}
          {tab === 'retries' && <RetriesSection retries={dashboard.retryHistory} />}
          {tab === 'feed' && <LiveActivitySection logs={dashboard.recentLogs} />}
          {tab === 'notifications' && <NotificationsSection notifications={dashboard.recentNotifications} />}
        </div>
      </Card>

      <ConnectAccountModal show={showConnect} onClose={() => setShowConnect(false)} onConnect={(p) => connectAccount.mutate(p)} />
    </div>
  );
}
