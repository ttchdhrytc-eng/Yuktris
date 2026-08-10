// ============================================================
// ExecutionQueuePage — Universal Execution Queue UI
// ============================================================
//
// Shows the single queue that every AI agent action flows through.
// AI → Queue → Integration → Execution → Result → Memory → Knowledge Graph

import { useState } from 'react';
import {
  ListOrdered, Clock, CheckCircle2, XCircle, RotateCcw,
  Activity, Zap, AlertTriangle, Cpu, Globe, Server,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useExecutionQueue, useExecutionQueueStats,
  useCancelExecutionItem, useRetryExecutionItem,
  useBrowserWorkers, useIntegrationFailures,
} from '@/hooks/useExecutionQueue';
import { useProcessQueue } from '@/hooks/useQueueWorker';
import type { ExecutionQueueStatus } from '@/types/universal-execution-queue';

const STATUS_FILTERS: { id: ExecutionQueueStatus | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'queued', label: 'Queued' },
  { id: 'processing', label: 'Processing' },
  { id: 'completed', label: 'Completed' },
  { id: 'failed', label: 'Failed' },
  { id: 'retrying', label: 'Retrying' },
];

function statusTone(status: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (status) {
    case 'completed': return 'success';
    case 'queued': return 'brand';
    case 'processing': return 'warning';
    case 'failed': return 'error';
    case 'retrying': return 'warning';
    case 'cancelled': return 'default';
    default: return 'default';
  }
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string | number; tone: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs font-medium text-ink-500">{label}</p>
          <p className="text-xl font-bold text-ink-50">{value}</p>
        </div>
      </div>
    </Card>
  );
}

export function ExecutionQueuePage() {
  const [filter, setFilter] = useState<ExecutionQueueStatus | 'all'>('all');
  const stats = useExecutionQueueStats();
  const queue = useExecutionQueue(filter === 'all' ? undefined : { status: filter });
  const cancelItem = useCancelExecutionItem();
  const retryItem = useRetryExecutionItem();
  const workers = useBrowserWorkers();
  const failures = useIntegrationFailures();
  const processQueue = useProcessQueue();

  if (stats.isLoading || queue.isLoading) {
    return (
      <div>
        <PageHeader title="Execution Queue" description="Every AI agent action flows through this single queue before reaching an external integration." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  const s = stats.data;
  const items = queue.data ?? [];

  return (
    <div>
      <PageHeader
        title="Execution Queue"
        description="Every AI agent action flows through this single queue before reaching an external integration."
        actions={
          <button
            onClick={() => processQueue.mutate()}
            disabled={processQueue.isPending}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50 transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            {processQueue.isPending ? 'Processing...' : 'Process Queue'}
          </button>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={ListOrdered} label="Total" value={s?.total ?? 0} tone="bg-brand-300/10 text-brand-300" />
        <StatCard icon={Clock} label="Queued" value={s?.queued ?? 0} tone="bg-card-900 text-ink-600" />
        <StatCard icon={Activity} label="Processing" value={s?.processing ?? 0} tone="bg-warning-500/10 text-warning-500" />
        <StatCard icon={CheckCircle2} label="Completed" value={s?.completed ?? 0} tone="bg-success-500/10 text-success-500" />
        <StatCard icon={XCircle} label="Failed" value={s?.failed ?? 0} tone="bg-error-500/10 text-error-500" />
        <StatCard icon={Zap} label="Success Rate" value={s ? `${Math.round(s.successRate * 100)}%` : '—'} tone="bg-accent-50 text-accent-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Queue */}
        <div className="lg:col-span-2">
          <Card>
            <div className="border-b border-gold-500/12 px-4 py-3">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
                {STATUS_FILTERS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id)}
                    className={cn(
                      'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap',
                      filter === f.id ? 'bg-brand-300/10 text-brand-300' : 'text-ink-500 hover:bg-card-800'
                    )}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-border-subtle">
              {items.length === 0 ? (
                <div className="px-6 py-12 text-center text-sm text-ink-500">No items in queue.</div>
              ) : (
                items.slice(0, 50).map((item) => (
                  <div key={item.id} className="px-4 py-3 hover:bg-card-800 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge tone={statusTone(item.status)} size="sm" dot>
                            {item.status}
                          </Badge>
                          <span className="text-xs font-medium text-ink-200">{item.integration}</span>
                          {item.provider && <span className="text-xs text-ink-400">/ {item.provider}</span>}
                        </div>
                        <p className="text-sm text-ink-200 truncate">{item.action_type}</p>
                        {item.agent_name && (
                          <p className="text-xs text-ink-400 mt-0.5">Agent: {item.agent_name}</p>
                        )}
                        {item.error && (
                          <p className="text-xs text-error-500 mt-1 truncate">{item.error}</p>
                        )}
                        {item.duration_ms !== null && (
                          <p className="text-xs text-ink-400 mt-0.5">{item.duration_ms}ms</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {item.status === 'failed' && (
                          <button
                            onClick={() => retryItem.mutate(item.id)}
                            disabled={retryItem.isPending}
                            className="rounded-lg p-1.5 text-ink-400 hover:text-brand-300 hover:bg-brand-300/10 transition-colors"
                            title="Retry"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {(item.status === 'queued' || item.status === 'retrying') && (
                          <button
                            onClick={() => cancelItem.mutate(item.id)}
                            disabled={cancelItem.isPending}
                            className="rounded-lg p-1.5 text-ink-400 hover:text-error-500 hover:bg-error-500/10 transition-colors"
                            title="Cancel"
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        {/* Sidebar: Workers + Failures */}
        <div className="space-y-6">
          {/* Browser Workers */}
          <Card>
            <div className="px-5 py-4 border-b border-gold-500/8">
              <div className="flex items-center gap-2">
                <Cpu className="h-4 w-4 text-ink-500" />
                <h3 className="text-sm font-semibold text-ink-50">Browser Workers</h3>
              </div>
            </div>
            <div className="divide-y divide-border-subtle">
              {(workers.data ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-ink-500">No browser workers registered.</div>
              ) : (
                (workers.data ?? []).slice(0, 10).map((w) => (
                  <div key={w.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-200 truncate">{w.worker_id}</span>
                      <Badge tone={statusTone(w.status)} size="sm">{w.status}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-ink-400">
                      <span>{w.provider}</span>
                      <span>Queue: {w.queue_depth}</span>
                      <span>Tasks: {w.total_tasks}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Recent Failures */}
          <Card>
            <div className="px-5 py-4 border-b border-gold-500/8">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-error-500" />
                <h3 className="text-sm font-semibold text-ink-50">Recent Failures</h3>
              </div>
            </div>
            <div className="divide-y divide-border-subtle">
              {(failures.data ?? []).length === 0 ? (
                <div className="px-5 py-8 text-center text-xs text-ink-500">No recent failures.</div>
              ) : (
                (failures.data ?? []).slice(0, 10).map((f) => (
                  <div key={f.id} className="px-5 py-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-ink-200">{f.integration}</span>
                      <Badge tone={f.status === 'resolved' ? 'success' : f.status === 'dead_letter' ? 'error' : 'warning'} size="sm">
                        {f.status}
                      </Badge>
                    </div>
                    <p className="text-xs text-ink-500 truncate">{f.error_message}</p>
                    <p className="text-xs text-ink-400 mt-0.5">Retry {f.retry_count}/{f.max_retries}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
