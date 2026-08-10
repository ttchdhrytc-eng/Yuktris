// ============================================================
// BrowserDashboardPage — Browser Automation Control Center
// ============================================================
//
// 8 tabs: Workers, Sessions, Queue, Health, Logs, Screenshots, Errors
// Controls: Launch pool, Close pool, Process queue, Scale pool

import { useState } from 'react';
import {
  Cpu, Globe, Clock, CheckCircle2, XCircle, RotateCcw,
  Activity, Camera, AlertTriangle, Monitor, Zap,
  Play, Square, Trash2, ListOrdered, FileText,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useBrowserWorkers, useBrowserHealth, useBrowserSessions,
  useBrowserQueue, useBrowserLogs, useBrowserErrors,
  useBrowserScreenshots, useLaunchBrowserPool, useCloseBrowserPool,
  useProcessBrowserQueue, useCancelBrowserQueueItem, useRetryBrowserQueueItem,
  useDeleteBrowserSession, useResolveBrowserError,
} from '@/hooks/useBrowser';
import type { QueueStatus } from '@/types/browser-automation';

type Tab = 'workers' | 'sessions' | 'queue' | 'health' | 'logs' | 'screenshots' | 'errors';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'workers', label: 'Workers', icon: Cpu },
  { id: 'sessions', label: 'Sessions', icon: Globe },
  { id: 'queue', label: 'Queue', icon: ListOrdered },
  { id: 'health', label: 'Health', icon: Activity },
  { id: 'logs', label: 'Logs', icon: FileText },
  { id: 'screenshots', label: 'Screenshots', icon: Camera },
  { id: 'errors', label: 'Errors', icon: AlertTriangle },
];

function statusTone(status: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (status) {
    case 'completed': case 'idle': return 'success';
    case 'running': case 'busy': case 'launching': return 'warning';
    case 'failed': case 'crashed': return 'error';
    case 'pending': case 'queued': return 'brand';
    default: return 'default';
  }
}

// Import icons used in TABS
import { ListOrdered, FileText } from 'lucide-react';

export function BrowserDashboardPage() {
  const [tab, setTab] = useState<Tab>('workers');
  const [poolSize, setPoolSize] = useState(5);

  const workers = useBrowserWorkers();
  const health = useBrowserHealth();
  const sessions = useBrowserSessions();
  const queue = useBrowserQueue();
  const logs = useBrowserLogs();
  const errors = useBrowserErrors();
  const screenshots = useBrowserScreenshots();

  const launchPool = useLaunchBrowserPool();
  const closePool = useCloseBrowserPool();
  const processQueue = useProcessBrowserQueue();
  const cancelItem = useCancelBrowserQueueItem();
  const retryItem = useRetryBrowserQueueItem();
  const deleteSession = useDeleteBrowserSession();
  const resolveError = useResolveBrowserError();

  const workerList = workers.data ?? [];
  const idleCount = workerList.filter((w) => w.status === 'idle').length;
  const busyCount = workerList.filter((w) => w.status === 'busy').length;
  const crashedCount = workerList.filter((w) => w.status === 'crashed').length;

  return (
    <div>
      <PageHeader
        title="Browser Automation"
        description="Playwright-powered browser worker pool for LinkedIn automation, web research, and form submission."
        actions={
          <div className="flex items-center gap-2">
            <select
              value={poolSize}
              onChange={(e) => setPoolSize(Number(e.target.value))}
              className="rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2 text-sm text-ink-200"
            >
              <option value={1}>1 browser</option>
              <option value={5}>5 browsers</option>
              <option value={10}>10 browsers</option>
              <option value={20}>20 browsers</option>
            </select>
            <button
              onClick={() => launchPool.mutate(poolSize)}
              disabled={launchPool.isPending}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50 transition-colors"
            >
              <Play className="h-3.5 w-3.5" />
              {launchPool.isPending ? 'Launching...' : 'Launch Pool'}
            </button>
            <button
              onClick={() => closePool.mutate()}
              disabled={closePool.isPending}
              className="flex items-center gap-2 rounded-lg bg-error-500/10 px-3 py-2 text-sm font-medium text-error-500 hover:bg-error-500/20 disabled:opacity-50 transition-colors"
            >
              <Square className="h-3.5 w-3.5" />
              {closePool.isPending ? 'Closing...' : 'Close All'}
            </button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard icon={Cpu} label="Total Workers" value={workerList.length} tone="bg-brand-300/10 text-brand-300" />
        <StatCard icon={CheckCircle2} label="Idle" value={idleCount} tone="bg-success-500/10 text-success-500" />
        <StatCard icon={Activity} label="Busy" value={busyCount} tone="bg-warning-500/10 text-warning-500" />
        <StatCard icon={XCircle} label="Crashed" value={crashedCount} tone="bg-error-500/10 text-error-500" />
        <StatCard icon={Clock} label="Queue Pending" value={(queue.data ?? []).filter((q) => q.status === 'pending').length} tone="bg-card-900 text-ink-600" />
        <StatCard icon={AlertTriangle} label="Unresolved Errors" value={(errors.data ?? []).filter((e) => !e.resolved).length} tone="bg-error-500/10 text-error-500" />
      </div>

      {/* Tabs */}
      <div className="mb-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-gold-500/12">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-brand-500 text-brand-300'
                  : 'border-transparent text-ink-500 hover:text-ink-200'
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {workers.isLoading && tab !== 'sessions' ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : (
        <>
          {tab === 'workers' && <WorkersTab workers={workerList} />}
          {tab === 'sessions' && <SessionsTab sessions={sessions.data ?? []} onDelete={deleteSession} />}
          {tab === 'queue' && <QueueTab queue={queue.data ?? []} onProcess={processQueue} onCancel={cancelItem} onRetry={retryItem} />}
          {tab === 'health' && <HealthTab health={health.data ?? []} />}
          {tab === 'logs' && <LogsTab logs={logs.data ?? []} />}
          {tab === 'screenshots' && <ScreenshotsTab screenshots={screenshots.data ?? []} />}
          {tab === 'errors' && <ErrorsTab errors={errors.data ?? []} onResolve={resolveError} />}
        </>
      )}
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────

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

// ── Workers Tab ────────────────────────────────────────────

function WorkersTab({ workers }: { workers: ReturnType<typeof useBrowserWorkers>['data'] }) {
  if (!workers || workers.length === 0) {
    return <Card className="p-12 text-center text-sm text-ink-500">No browser workers. Launch a pool to get started.</Card>;
  }
  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {workers.map((w) => (
        <Card key={w.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-ink-500" />
              <span className="text-sm font-semibold text-ink-50">{w.worker_id}</span>
            </div>
            <Badge tone={statusTone(w.status)} size="sm" dot>{w.status}</Badge>
          </div>
          <div className="space-y-2 text-xs text-ink-500">
            <div className="flex justify-between">
              <span>Provider</span>
              <span className="text-ink-200">{w.provider}</span>
            </div>
            <div className="flex justify-between">
              <span>Queue Depth</span>
              <span className="text-ink-200">{w.queue_depth}</span>
            </div>
            <div className="flex justify-between">
              <span>Tasks Completed</span>
              <span className="text-success-500">{w.total_tasks}</span>
            </div>
            <div className="flex justify-between">
              <span>Errors</span>
              <span className="text-error-500">{w.total_errors}</span>
            </div>
            <div className="flex justify-between">
              <span>Heartbeat</span>
              <span className="text-ink-200">{w.last_heartbeat ? new Date(w.last_heartbeat).toLocaleTimeString() : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span>Browser</span>
              <span className="text-ink-200">{w.browser_version ?? '—'}</span>
            </div>
            {w.session_id && (
              <div className="flex justify-between gap-2">
                <span>Session</span>
                <span className="text-ink-200 truncate max-w-[180px]" title={w.session_id}>{w.session_id}</span>
              </div>
            )}
            {w.last_activity && (
              <div className="flex justify-between">
                <span>Last Activity</span>
                <span className="text-ink-200">{new Date(w.last_activity).toLocaleString()}</span>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Sessions Tab ───────────────────────────────────────────

function SessionsTab({ sessions, onDelete }: { sessions: NonNullable<ReturnType<typeof useBrowserSessions>['data']>; onDelete: ReturnType<typeof useDeleteBrowserSession> }) {
  if (sessions.length === 0) {
    return <Card className="p-12 text-center text-sm text-ink-500">No saved browser sessions.</Card>;
  }
  return (
    <Card>
      <div className="divide-y divide-border-subtle">
        {sessions.map((s) => (
          <div key={s.id} className="px-4 py-3 flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <Globe className="h-3.5 w-3.5 text-ink-400" />
                <span className="text-sm font-medium text-ink-50">{s.name}</span>
                <Badge tone="default" size="sm">{s.session_type}</Badge>
                {s.encrypted && <Badge tone="brand" size="sm">Encrypted</Badge>}
              </div>
              <div className="text-xs text-ink-400">
                Last used: {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : 'Never'}
              </div>
            </div>
            <button
              onClick={() => onDelete.mutate(s.id)}
              disabled={onDelete.isPending}
              className="rounded-lg p-1.5 text-ink-400 hover:text-error-500 hover:bg-error-500/10 transition-colors"
              title="Delete session"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Queue Tab ──────────────────────────────────────────────

function QueueTab({ queue, onProcess, onCancel, onRetry }: {
  queue: NonNullable<ReturnType<typeof useBrowserQueue>['data']>;
  onProcess: ReturnType<typeof useProcessBrowserQueue>;
  onCancel: ReturnType<typeof useCancelBrowserQueueItem>;
  onRetry: ReturnType<typeof useRetryBrowserQueueItem>;
}) {
  return (
    <Card>
      <div className="border-b border-gold-500/12 px-4 py-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-ink-50">Browser Action Queue</h3>
        <button
          onClick={() => onProcess.mutate()}
          disabled={onProcess.isPending}
          className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs font-medium text-brand-300 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50 transition-colors"
        >
          <Zap className="h-3.5 w-3.5" />
          {onProcess.isPending ? 'Processing...' : 'Process Queue'}
        </button>
      </div>
      <div className="divide-y divide-border-subtle">
        {queue.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-ink-500">No items in browser queue.</div>
        ) : (
          queue.slice(0, 50).map((item) => (
            <div key={item.id} className="px-4 py-3 hover:bg-card-800 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge tone={statusTone(item.status)} size="sm" dot>{item.status}</Badge>
                    <span className="text-xs font-medium text-ink-200">{item.action_type}</span>
                    <span className="text-xs text-ink-400">P{item.priority}</span>
                  </div>
                  {item.error && <p className="text-xs text-error-500 mt-1 truncate">{item.error}</p>}
                  {item.duration_ms !== null && <p className="text-xs text-ink-400 mt-0.5">{item.duration_ms}ms</p>}
                  {item.retry_count > 0 && <p className="text-xs text-warning-500 mt-0.5">Retries: {item.retry_count}/{item.max_retries}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {item.status === 'failed' && (
                    <button onClick={() => onRetry.mutate(item.id)} disabled={onRetry.isPending}
                      className="rounded-lg p-1.5 text-ink-400 hover:text-brand-300 hover:bg-brand-300/10 transition-colors" title="Retry">
                      <RotateCcw className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {item.status === 'pending' && (
                    <button onClick={() => onCancel.mutate(item.id)} disabled={onCancel.isPending}
                      className="rounded-lg p-1.5 text-ink-400 hover:text-error-500 hover:bg-error-500/10 transition-colors" title="Cancel">
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
  );
}

// ── Health Tab ─────────────────────────────────────────────

function HealthTab({ health }: { health: NonNullable<ReturnType<typeof useBrowserHealth>['data']> }) {
  if (health.length === 0) {
    return <Card className="p-12 text-center text-sm text-ink-500">No health data recorded yet.</Card>;
  }
  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold-500/12 text-xs text-ink-500">
              <th className="px-4 py-2 text-left font-medium">Worker</th>
              <th className="px-4 py-2 text-left font-medium">CPU</th>
              <th className="px-4 py-2 text-left font-medium">Memory</th>
              <th className="px-4 py-2 text-left font-medium">URL</th>
              <th className="px-4 py-2 text-left font-medium">Load Time</th>
              <th className="px-4 py-2 text-left font-medium">Net Errors</th>
              <th className="px-4 py-2 text-left font-medium">Crashes</th>
              <th className="px-4 py-2 text-left font-medium">Responsive</th>
              <th className="px-4 py-2 text-left font-medium">Recorded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {health.slice(0, 50).map((h) => (
              <tr key={h.id} className="hover:bg-card-800">
                <td className="px-4 py-2 text-xs text-ink-200">{h.worker_id.slice(0, 8)}</td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.cpu_usage.toFixed(1)}%</td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.memory_usage_mb.toFixed(0)} MB</td>
                <td className="px-4 py-2 text-xs text-ink-500 truncate max-w-[200px]" title={h.current_url ?? ''}>{h.current_url ?? '—'}</td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.page_load_time_ms ? `${h.page_load_time_ms}ms` : '—'}</td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.network_error_count}</td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.crash_count}</td>
                <td className="px-4 py-2"><Badge tone={h.is_responsive ? 'success' : 'error'} size="sm">{h.is_responsive ? 'Yes' : 'No'}</Badge></td>
                <td className="px-4 py-2 text-xs text-ink-400">{new Date(h.recorded_at).toLocaleTimeString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Logs Tab ───────────────────────────────────────────────

function LogsTab({ logs }: { logs: NonNullable<ReturnType<typeof useBrowserLogs>['data']> }) {
  if (logs.length === 0) {
    return <Card className="p-12 text-center text-sm text-ink-500">No browser logs recorded.</Card>;
  }
  return (
    <Card>
      <div className="divide-y divide-border-subtle max-h-[600px] overflow-y-auto">
        {logs.map((log) => (
          <div key={log.id} className="px-4 py-2.5 flex items-start gap-3">
            <Badge tone={log.level === 'error' ? 'error' : log.level === 'warn' ? 'warning' : log.level === 'debug' ? 'default' : 'brand'} size="sm">
              {log.level}
            </Badge>
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-ink-200">{log.category}</span>
              <p className="text-sm text-ink-600">{log.message}</p>
            </div>
            <span className="text-xs text-ink-400 shrink-0">{new Date(log.created_at).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Screenshots Tab ───────────────────────────────────────

function ScreenshotsTab({ screenshots }: { screenshots: NonNullable<ReturnType<typeof useBrowserScreenshots>['data']> }) {
  if (screenshots.length === 0) {
    return <Card className="p-12 text-center text-sm text-ink-500">No screenshots captured yet.</Card>;
  }
  return (
    <div className="grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {screenshots.map((s) => (
        <Card key={s.id} className="overflow-hidden">
          <div className="aspect-video bg-card-900 flex items-center justify-center">
            <Camera className="h-8 w-8 text-ink-400" />
          </div>
          <div className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge tone={s.screenshot_type === 'error' ? 'error' : s.screenshot_type === 'before' ? 'brand' : 'default'} size="sm">
                {s.screenshot_type}
              </Badge>
              <span className="text-xs text-ink-400">{s.file_size_bytes ? `${(s.file_size_bytes / 1024).toFixed(0)} KB` : ''}</span>
            </div>
            <p className="text-xs text-ink-500 truncate" title={s.url ?? ''}>{s.url ?? '—'}</p>
            <p className="text-xs text-ink-400 mt-0.5">{new Date(s.created_at).toLocaleString()}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Errors Tab ────────────────────────────────────────────

function ErrorsTab({ errors, onResolve }: { errors: NonNullable<ReturnType<typeof useBrowserErrors>['data']>; onResolve: ReturnType<typeof useResolveBrowserError> }) {
  if (errors.length === 0) {
    return <Card className="p-12 text-center text-sm text-ink-500">No browser errors recorded.</Card>;
  }
  return (
    <Card>
      <div className="divide-y divide-border-subtle">
        {errors.map((e) => (
          <div key={e.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone={e.resolved ? 'success' : 'error'} size="sm" dot>{e.resolved ? 'Resolved' : 'Open'}</Badge>
                  <span className="text-xs font-medium text-ink-200">{e.error_type}</span>
                </div>
                <p className="text-sm text-ink-600">{e.error_message}</p>
                {e.url && <p className="text-xs text-ink-400 mt-1 truncate">URL: {e.url}</p>}
                {e.stack_trace && <pre className="text-xs text-ink-400 mt-1 p-2 bg-card-900 rounded overflow-x-auto max-h-32">{e.stack_trace}</pre>}
                <p className="text-xs text-ink-400 mt-1">{new Date(e.created_at).toLocaleString()}</p>
              </div>
              {!e.resolved && (
                <button
                  onClick={() => onResolve.mutate(e.id)}
                  disabled={onResolve.isPending}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-success-500 hover:bg-success-500/10 transition-colors shrink-0"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
