import {
  Linkedin, Plus, Trash2, Activity, Clock, Zap, AlertTriangle,
  CheckCircle2, XCircle, Shield, Gauge, TrendingUp, Users, Building2,
  Send, Mail, MessageSquare, Radio, Brain, Bell, Coffee, RefreshCw,
  Play, Pause, RotateCcw, Eye, Heart, ThumbsUp, MessageCircle,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, timeAgo } from '@/lib/utils';
import type {
  LinkedInOperationsDashboard, LinkedInAccount, LinkedInExecutionJob,
  LinkedInActionHistory, LinkedInFailure, LinkedInExecutionLog,
  LinkedInSequence, LinkedInSequenceState, LinkedInQueueItem,
  LinkedInAccountHealth, LinkedInDailyUsage, LinkedInRateLimit,
  AIMonitorStatus,
} from '@/types/linkedin-operations';

// ============================================================
// AIMonitorCard
// ============================================================
export function AIMonitorCard({ monitor }: { monitor: AIMonitorStatus | null }) {
  if (!monitor) return null;
  const statusColor = {
    idle: 'text-ink-500',
    sending_connections: 'text-success-400',
    sending_messages: 'text-brand-400',
    waiting: 'text-warning-500',
    monitoring_replies: 'text-brand-400',
    respecting_limits: 'text-warning-500',
    processing_queue: 'text-brand-400',
    cooldown: 'text-error-400',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
          <Brain className={cn('h-5 w-5', statusColor[monitor.status] ?? 'text-ink-500')} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink-500">{monitor.message}</p>
          <p className="text-xs text-ink-500">{monitor.detail}</p>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// AccountsSection
// ============================================================
export function AccountsSection({ accounts, onConnect, onDelete }: {
  accounts: LinkedInAccount[];
  onConnect: () => void;
  onDelete: (id: string) => void;
}) {
  const statusTone = { active: 'success', warming_up: 'brand', restricted: 'error', cooldown: 'warning', disconnected: 'neutral' } as const;
  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={onConnect}><Plus className="h-3.5 w-3.5" />Connect Account</Button>
      </div>
      {accounts.length === 0 && !onConnect ? (
        <div className="text-center py-8 text-sm text-ink-500">No LinkedIn accounts connected.</div>
      ) : (
        accounts.map((account) => (
          <Card key={account.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Linkedin className="h-5 w-5 text-brand-400" /></div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{account.display_name ?? 'Unknown'}</p>
                  <p className="text-xs text-ink-500">{account.headline ?? '—'}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone={statusTone[account.connection_status] ?? 'neutral'} dot>{account.connection_status.replace(/_/g, ' ')}</Badge>
                    {account.warmup_status === 'in_progress' && <Badge tone="brand">Warmup Day {account.warmup_day}</Badge>}
                  </div>
                </div>
              </div>
              <button onClick={() => onDelete(account.id)} className="text-ink-500 hover:text-error-400"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3 text-xs">
              <div><span className="text-ink-500">Daily Conn:</span> <span className="text-ink-500">{account.daily_connection_limit}</span></div>
              <div><span className="text-ink-500">Daily Msg:</span> <span className="text-ink-500">{account.daily_message_limit}</span></div>
              <div><span className="text-ink-500">Risk:</span> <span className="text-ink-500">{Math.round(account.risk_score * 100)}%</span></div>
              <div><span className="text-ink-500">Hours:</span> <span className="text-ink-500">{account.working_hours_start}-{account.working_hours_end}</span></div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}

// ============================================================
// ConnectAccountModal
// ============================================================
export function ConnectAccountModal({ show, onClose, onConnect }: {
  show: boolean;
  onClose: () => void;
  onConnect: (params: { profile_url: string; display_name: string; headline?: string; session_token?: string }) => void;
}) {
  const [profileUrl, setProfileUrl] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [headline, setHeadline] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  if (!show) return null;

  const handleConnect = () => {
    if (!profileUrl.trim() || !displayName.trim()) return;
    onConnect({ profile_url: profileUrl, display_name: displayName, headline: headline || undefined, session_token: sessionToken || undefined });
    setProfileUrl(''); setDisplayName(''); setHeadline(''); setSessionToken('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/50" onClick={onClose}>
      <Card className="w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-ink-500">Connect LinkedIn Account</h3>
        <div className="space-y-3">
          <div><label className="text-xs text-ink-500">Profile URL</label><input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500" placeholder="https://linkedin.com/in/username" value={profileUrl} onChange={(e) => setProfileUrl(e.target.value)} /></div>
          <div><label className="text-xs text-ink-500">Display Name</label><input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500" placeholder="John Doe" value={displayName} onChange={(e) => setDisplayName(e.target.value)} /></div>
          <div><label className="text-xs text-ink-500">Headline (optional)</label><input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500" placeholder="VP Sales at Acme" value={headline} onChange={(e) => setHeadline(e.target.value)} /></div>
          <div><label className="text-xs text-ink-500">Session Token (optional)</label><input className="w-full mt-1 rounded-lg bg-card-900 border border-gold-500/12 px-3 py-2 text-sm text-ink-500" placeholder="Paste session token" value={sessionToken} onChange={(e) => setSessionToken(e.target.value)} /></div>
        </div>
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="glow" onClick={handleConnect}>Connect</Button>
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// QueueSection
// ============================================================
export function QueueSection({ queue }: { queue: LinkedInQueueItem[] }) {
  if (queue.length === 0) return <div className="text-center py-8 text-sm text-ink-500">Queue is empty.</div>;
  const statusTone = { queued: 'neutral', processing: 'brand', completed: 'success', failed: 'error', cancelled: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {queue.map((item) => (
        <Card key={item.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-ink-500" />
              <span className="text-sm text-ink-500 capitalize">{item.action_type.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={statusTone[item.status] ?? 'neutral'} dot>{item.status}</Badge>
              {item.scheduled_at && <span className="text-xs text-ink-500">{timeAgo(item.scheduled_at)}</span>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// TodayActivitySection
// ============================================================
export function TodayActivitySection({ history }: { history: LinkedInActionHistory[] }) {
  if (history.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No activity today.</div>;
  const resultTone = { success: 'success', failed: 'error', pending: 'neutral', rate_limited: 'warning', policy_violation: 'error', already_connected: 'neutral', not_found: 'neutral', blocked: 'error' } as const;
  return (
    <div className="space-y-2">
      {history.map((h) => (
        <Card key={h.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {h.action_result === 'success' ? <CheckCircle2 className="h-4 w-4 text-success-400" /> : <XCircle className="h-4 w-4 text-error-400" />}
              <span className="text-sm text-ink-500 capitalize">{h.action_type.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={resultTone[h.action_result] ?? 'neutral'}>{h.action_result.replace(/_/g, ' ')}</Badge>
              <span className="text-xs text-ink-500">{timeAgo(h.created_at)}</span>
            </div>
          </div>
          {h.duration_ms && <p className="text-xs text-ink-500 mt-1">{h.duration_ms}ms</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// SequenceMonitorSection
// ============================================================
export function SequenceMonitorSection({ sequences, states }: { sequences: LinkedInSequence[]; states: LinkedInSequenceState[] }) {
  if (sequences.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No sequences running.</div>;
  const statusTone = { active: 'success', paused: 'warning', completed: 'neutral', draft: 'neutral' } as const;
  const stepTone = { pending: 'neutral', in_progress: 'brand', completed: 'success', failed: 'error', skipped: 'neutral', stopped: 'neutral' } as const;
  return (
    <div className="space-y-3">
      {sequences.map((seq) => {
        const seqStates = states.filter((s) => s.sequence_id === seq.id);
        return (
          <Card key={seq.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-ink-500">{seq.sequence_name}</p>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[seq.status] ?? 'neutral'} dot>{seq.status}</Badge>
                <span className="text-xs text-ink-500">{seq.total_steps} steps</span>
              </div>
            </div>
            {seqStates.length > 0 && (
              <div className="space-y-1.5">
                {seqStates.slice(0, 5).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-ink-500">Step {s.current_step + 1}/{seq.total_steps}</span>
                    <div className="flex items-center gap-2">
                      <Badge tone={stepTone[s.step_status] ?? 'neutral'}>{s.step_status}</Badge>
                      {s.stopped_reason && <span className="text-ink-500 capitalize">{s.stopped_reason.replace(/_/g, ' ')}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// SafetyMonitorSection
// ============================================================
export function SafetyMonitorSection({ health, limits }: { health: LinkedInAccountHealth[]; limits: LinkedInRateLimit[] }) {
  if (health.length === 0 && limits.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No safety data yet.</div>;
  const healthTone = { healthy: 'success', warning: 'warning', critical: 'error', down: 'error' } as const;
  return (
    <div className="space-y-3">
      {health.map((h) => (
        <Card key={h.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Account Health</span></div>
            <Badge tone={healthTone[h.health_status] ?? 'neutral'} dot>{h.health_status}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-3 text-xs">
            <div><span className="text-ink-500">Risk Score:</span> <span className="text-ink-500">{Math.round(h.risk_score * 100)}%</span></div>
            <div><span className="text-ink-500">Accept Rate:</span> <span className="text-ink-500">{Math.round(h.invitation_acceptance_rate * 100)}%</span></div>
            <div><span className="text-ink-500">Reply Ratio:</span> <span className="text-ink-500">{Math.round(h.reply_ratio * 100)}%</span></div>
          </div>
          {h.cooldown_until && new Date(h.cooldown_until) > new Date() && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-warning-500"><Clock className="h-3.5 w-3.5" />Cooldown until {timeAgo(h.cooldown_until)}</div>
          )}
        </Card>
      ))}
      {limits.map((l) => (
        <Card key={l.id} className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-500 capitalize">{l.action_type.replace(/_/g, ' ')} Limits</span>
            <Badge tone={l.daily_used >= l.daily_limit ? 'error' : l.daily_used >= l.daily_limit * 0.8 ? 'warning' : 'success'}>
              {l.daily_used}/{l.daily_limit} daily
            </Badge>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-card-900 overflow-hidden">
            <div className={cn('h-full rounded-full', l.daily_used >= l.daily_limit ? 'bg-error-500' : l.daily_used >= l.daily_limit * 0.8 ? 'bg-warning-500' : 'bg-success-500')} style={{ width: `${Math.min((l.daily_used / l.daily_limit) * 100, 100)}%` }} />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// DailyUsageSection
// ============================================================
export function DailyUsageSection({ usage }: { usage: LinkedInDailyUsage[] }) {
  if (usage.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No usage data yet.</div>;
  return (
    <div className="space-y-2">
      {usage.slice(0, 14).map((u) => (
        <Card key={u.id} className="p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-500">{u.usage_date}</span>
            <span className="text-sm font-bold text-ink-500">{u.total_actions} actions</span>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-ink-500">
            <span>{u.connections_sent} conn</span>
            <span>{u.messages_sent} msg</span>
            <span>{u.profile_visits} visits</span>
            <span>{u.posts_liked} likes</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// HistorySection
// ============================================================
export function HistorySection({ history }: { history: LinkedInActionHistory[] }) {
  if (history.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No execution history yet.</div>;
  const resultTone = { success: 'success', failed: 'error', pending: 'neutral', rate_limited: 'warning', policy_violation: 'error', already_connected: 'neutral', not_found: 'neutral', blocked: 'error' } as const;
  return (
    <div className="space-y-2">
      {history.map((h) => (
        <Card key={h.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {h.action_result === 'success' ? <CheckCircle2 className="h-4 w-4 text-success-400" /> : <XCircle className="h-4 w-4 text-error-400" />}
              <span className="text-sm text-ink-500 capitalize">{h.action_type.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={resultTone[h.action_result] ?? 'neutral'}>{h.action_result.replace(/_/g, ' ')}</Badge>
              <span className="text-xs text-ink-500">{timeAgo(h.created_at)}</span>
            </div>
          </div>
          {h.error_message && <p className="text-xs text-error-400 mt-1">{h.error_message}</p>}
          {h.duration_ms != null && <p className="text-xs text-ink-500 mt-1">{h.duration_ms}ms · {h.retry_count} retries</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// FailuresSection
// ============================================================
export function FailuresSection({ failures }: { failures: LinkedInFailure[] }) {
  if (failures.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No failures recorded.</div>;
  const typeTone = { network: 'warning', rate_limit: 'warning', policy_violation: 'error', authentication: 'error', session_expired: 'error', captcha: 'error', unknown: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {failures.map((f) => (
        <Card key={f.id} className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-error-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-ink-500">{f.failure_message}</p>
                <p className="text-xs text-ink-500 mt-0.5 capitalize">{f.failure_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={typeTone[f.failure_type] ?? 'neutral'}>{f.failure_type.replace(/_/g, ' ')}</Badge>
              {f.is_retryable ? <Badge tone="brand">Retryable</Badge> : <Badge tone="neutral">No Retry</Badge>}
            </div>
          </div>
          <p className="text-xs text-ink-500 mt-1">{timeAgo(f.created_at)}</p>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// RetriesSection
// ============================================================
export function RetriesSection({ retries }: { retries: unknown[] }) {
  if (retries.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No retry history.</div>;
  return (
    <div className="space-y-2">
      {retries.map((r, i) => {
        const retry = r as Record<string, unknown>;
        return (
          <Card key={i} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-brand-400" /><span className="text-sm text-ink-500">Retry #{retry.retry_attempt as number}</span></div>
              <Badge tone={retry.retry_result === 'success' ? 'success' : retry.retry_result === 'failed' ? 'error' : 'neutral'}>{(retry.retry_result as string) ?? 'pending'}</Badge>
            </div>
            {retry.retry_reason && <p className="text-xs text-ink-500 mt-1">{retry.reason as string}</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// LiveActivitySection
// ============================================================
export function LiveActivitySection({ logs }: { logs: LinkedInExecutionLog[] }) {
  if (logs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No live activity.</div>;
  const levelColor = { info: 'text-ink-500', warning: 'text-warning-500', error: 'text-error-400', debug: 'text-ink-500' };
  return (
    <div className="space-y-1.5">
      {logs.map((log) => (
        <div key={log.id} className="flex items-start gap-2 p-2 rounded-lg bg-card-900/30">
          {log.log_level === 'error' ? <AlertTriangle className="h-3.5 w-3.5 text-error-400 shrink-0 mt-0.5" /> : log.log_level === 'warning' ? <Clock className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" /> : <Activity className="h-3.5 w-3.5 text-ink-500 shrink-0 mt-0.5" />}
          <div className="flex-1 min-w-0">
            <p className={cn('text-sm', levelColor[log.log_level] ?? 'text-ink-500')}>{log.log_message}</p>
            <p className="text-xs text-ink-500">{timeAgo(log.created_at)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// NotificationsSection
// ============================================================
export function NotificationsSection({ notifications }: { notifications: LinkedInOperationsDashboard['recentNotifications'] }) {
  if (!notifications || notifications.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No notifications.</div>;
  const sevTone = { info: 'neutral', warning: 'warning', error: 'error', success: 'success' } as const;
  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Card key={n.id} className={cn('p-3', !n.is_read && 'border-brand-500/20')}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2"><Bell className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{n.notification_title}</p><p className="text-xs text-ink-500">{n.notification_message}</p></div></div>
            <Badge tone={sevTone[n.severity] ?? 'neutral'}>{n.severity}</Badge>
          </div>
          <p className="text-xs text-ink-500 mt-1">{timeAgo(n.created_at)}</p>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function LinkedInOpsEmpty({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Linkedin className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">LinkedIn Execution Engine</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">Connect a LinkedIn account and start executing approved outreach actions. The engine respects safety limits, uses randomized delays, and retries failures automatically.</p>
      </div>
      <Button variant="glow" size="lg" onClick={onStart}><Zap className="h-4 w-4" />Start Execution</Button>
    </div>
  );
}
