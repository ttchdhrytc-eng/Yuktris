// ============================================================
// LinkedInAutomationPage — LinkedIn browser automation control
// ============================================================
//
// Tabs: Accounts, Sessions, Execution Queue, History,
// Failures, Retry Queue, Dead Letter, Devices, Events,
// Human Behavior Settings

import { useState, useMemo, useEffect } from 'react';
import {
  UserCircle, KeyRound, ListOrdered, History, AlertTriangle,
  RotateCcw, Trash2, Smartphone, Activity, Settings,
  Plus, Shield, Clock, Zap, TrendingUp,
  ExternalLink, Loader2, CheckCircle2, XCircle, AlertOctagon,
  Monitor,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import {
  useLinkedInAccounts, useConnectLinkedIn, useDeleteLinkedInAccount,
  useLinkedInSessions, useDeleteLinkedInSession,
  useLinkedInDevices, useLinkedInSessionEvents,
  useBrowserExecutionQueue, useCancelExecution,
  useBrowserExecutionHistory, useBrowserExecutionFailures,
  useResolveExecutionFailure, useBrowserRetryQueue,
  useBrowserDeadLetterQueue,
  useAuthInteractions, useCancelAuthInteraction,
} from '@/hooks/useLinkedInBrowser';
import type { LinkedInAuthInteraction } from '@/types/linkedin-browser-automation';

type Tab = 'accounts' | 'sessions' | 'queue' | 'history' | 'failures' | 'retry' | 'dlq' | 'devices' | 'events' | 'behavior';

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'accounts', label: 'Accounts', icon: UserCircle },
  { id: 'sessions', label: 'Sessions', icon: KeyRound },
  { id: 'queue', label: 'Execution Queue', icon: ListOrdered },
  { id: 'history', label: 'History', icon: History },
  { id: 'failures', label: 'Failures', icon: AlertTriangle },
  { id: 'retry', label: 'Retry Queue', icon: RotateCcw },
  { id: 'dlq', label: 'Dead Letter', icon: Trash2 },
  { id: 'devices', label: 'Devices', icon: Smartphone },
  { id: 'events', label: 'Events', icon: Activity },
  { id: 'behavior', label: 'Behavior', icon: Settings },
];

function statusTone(status: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (status) {
    case 'active': case 'completed': case 'connected': case 'success': case 'authenticated': return 'success';
    case 'creating_session': case 'session_created': case 'connecting_browser': case 'opening_linkedin': case 'ready_for_login': return 'brand';
    case 'pending': case 'running': case 'waiting': case 'reconnecting': case 'authenticating': case 'pending_login': return 'warning';
    case 'failed': case 'banned': case 'restricted': case 'expired': case 'error': case 'exhausted': case 'session_invalid': case 'session_expired': return 'error';
    case 'retry': case 'escalated': case 'requires_action': return 'brand';
    default: return 'default';
  }
}

export function LinkedInAutomationPage() {
  const [tab, setTab] = useState<Tab>('accounts');

  return (
    <div>
      <PageHeader
        title="LinkedIn Automation"
        description="Securely connect LinkedIn accounts, manage browser sessions, and automate actions through the execution queue."
      />

      <div className="mb-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin border-b border-gold-500/12">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id ? 'border-gold-500 text-gold-400' : 'border-transparent text-ink-500 hover:text-ink-200'
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'accounts' && <AccountsTab />}
      {tab === 'sessions' && <SessionsTab />}
      {tab === 'queue' && <QueueTab />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'failures' && <FailuresTab />}
      {tab === 'retry' && <RetryTab />}
      {tab === 'dlq' && <DeadLetterTab />}
      {tab === 'devices' && <DevicesTab />}
      {tab === 'events' && <EventsTab />}
      {tab === 'behavior' && <BehaviorTab />}
    </div>
  );
}

// ── Accounts Tab ─────────────────────────────────────────────

function AccountsTab() {
  const accounts = useLinkedInAccounts();
  const deleteAccount = useDeleteLinkedInAccount();
  const connect = useConnectLinkedIn();
  const [showForm, setShowForm] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [connectingAccountId, setConnectingAccountId] = useState<string | null>(null);

  const list = accounts.data ?? [];

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Connect LinkedIn Account
        </Button>
      </div>

      {showForm && (
        <Card className="p-4 mb-4 space-y-3">
          <div className="rounded-lg bg-gold-500/5 border border-gold-500/15 p-3">
            <p className="text-xs text-ink-300 leading-relaxed">
              Enter your password and any verification codes only inside the secure LinkedIn browser. Yuktris never receives or stores them.
            </p>
          </div>
          <input
            type="email"
            placeholder="LinkedIn email / username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gold-500/12 bg-maroon-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 input-luxury focus:outline-none"
          />
          <input
            type="url"
            placeholder="LinkedIn profile URL (required)"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            className="w-full rounded-lg border border-gold-500/12 bg-maroon-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 input-luxury focus:outline-none"
          />
          <input
            placeholder="Optional display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-gold-500/12 bg-maroon-950/60 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 input-luxury focus:outline-none"
          />
          <Button
            size="sm"
            onClick={() => {
              connect.mutate(
                { linkedinEmail: email, displayName: displayName || undefined, profileUrl },
                {
                  onSuccess: (data) => {
                    setConnectingAccountId(data.accountId);
                  },
                },
              );
              setEmail(''); setDisplayName(''); setProfileUrl(''); setShowForm(false);
            }}
            disabled={!email || !/^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/[A-Za-z0-9_%.-]+\/?(?:[?#].*)?$/i.test(profileUrl.trim()) || connect.isPending}
            loading={connect.isPending}
          >
            Continue to LinkedIn
          </Button>
        </Card>
      )}

      {accounts.isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      ) : list.length === 0 ? (
        <Card className="p-12 text-center text-sm text-ink-500">No LinkedIn accounts connected yet. Click "Connect LinkedIn Account" to begin.</Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map((a) => (
            <div key={a.id}>
              <AccountCard
                account={a}
                onDelete={() => deleteAccount.mutate(a.id)}
                isConnecting={connectingAccountId === a.id}
                onSetConnecting={(id: string | null) => setConnectingAccountId(id)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Account Card with Live Connection Panel ──────────────────

// ── Connection State Machine Component ──────────────────────────
const STATES: { key: string; label: string }[] = [
  { key: 'creating_session', label: 'Creating Session' },
  { key: 'session_created', label: 'Session Created' },
  { key: 'connecting_browser', label: 'Connecting Browser' },
  { key: 'connected', label: 'Browser Connected' },
  { key: 'opening_linkedin', label: 'Opening LinkedIn' },
  { key: 'ready_for_login', label: 'Ready for Login' },
  { key: 'authenticated', label: 'Authenticated' },
];

function healthTone(status: string): 'success' | 'warning' | 'error' | 'brand' | 'default' {
  switch (status) {
    case 'healthy': case 'active': case 'authenticated': return 'success';
    case 'warning': case 'restoring': case 'verifying': case 'reconnect_required': return 'warning';
    case 'expired': case 'failed': case 'auth_failed': case 'corrupted': return 'error';
    case 'disconnected': case 'browser_lost': case 'browserbase_missing': case 'playwright_lost': return 'brand';
    case 'new': return 'brand';
    default: return 'default';
  }
}

function SessionHealthBadge({ healthStatus, connectionState }: { healthStatus: string; connectionState: string }) {
  const icon = healthStatus === 'healthy' ? <CheckCircle2 className="h-3 w-3" />
    : healthStatus === 'expired' || healthStatus === 'auth_failed' || healthStatus === 'corrupted' ? <XCircle className="h-3 w-3" />
    : healthStatus === 'warning' || connectionState === 'reconnect_required' ? <AlertOctagon className="h-3 w-3" />
    : <Loader2 className="h-3 w-3 animate-spin" />;
  return (
    <Badge tone={healthTone(healthStatus)} size="sm" dot>
      <span className="flex items-center gap-1">{icon}{healthStatus.replace(/_/g, ' ')}</span>
    </Badge>
  );
}

function ConnectionStateMachine({ currentState, lastError }: { currentState: string; lastError?: string | null }) {
  if (currentState === 'idle' || currentState === 'disconnected' || currentState === 'connected') return null;

  const isError = currentState === 'failed' || currentState === 'session_expired' || currentState === 'session_invalid';
  const isChallenge = currentState === 'requires_action';
  const currentIndex = STATES.findIndex(s => s.key === currentState);

  return (
    <div className="mb-4 rounded-xl border border-gold-500/12 bg-card-900/50 p-3">
      <div className="flex items-center gap-1.5 flex-wrap">
        {STATES.map((s, i) => {
          const isDone = currentIndex > i;
          const isActive = currentIndex === i;
          return (
            <div key={s.key} className="flex items-center gap-1.5">
              <div className={cn(
                'flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium transition-colors',
                isDone ? 'text-success-400' : isActive ? 'text-gold-400 bg-gold-500/10' : 'text-ink-600'
              )}>
                {isDone ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : isActive ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <div className="h-3 w-3 rounded-full border border-ink-700" />
                )}
                {s.label}
              </div>
              {i < STATES.length - 1 && <div className={cn('h-px w-3', isDone ? 'bg-success-500/30' : 'bg-ink-700')} />}
            </div>
          );
        })}
      </div>
      {isError && lastError && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-error-400">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span className="font-mono">{lastError}</span>
        </div>
      )}
      {isChallenge && (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-warning-400">
          <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
          <span>LinkedIn verification required — complete the challenge in the browser window.</span>
        </div>
      )}
    </div>
  );
}

function AccountCard({
  account,
  onDelete,
  isConnecting,
  onSetConnecting,
}: {
  account: {
    id: string;
    account_name: string;
    linkedin_email: string;
    status: string;
    session_status: string;
    connection_state: string;
    connections_today: number;
    daily_connection_limit: number;
    messages_today: number;
    daily_message_limit: number;
    profile_visits_today: number;
    daily_profile_visit_limit: number;
    last_login_at: string | null;
    last_error: string | null;
    profile_url: string | null;
    profile_name: string | null;
    browserbase_session_id: string | null;
    browser_connected_at: string | null;
  };
  onDelete: () => void;
  isConnecting: boolean;
  onSetConnecting: (id: string | null) => void;
}) {
  // Determine if this account is in an active connection flow
  const isActiveFlow = [
    'creating_session', 'session_created', 'connecting_browser', 'connected',
    'opening_linkedin', 'ready_for_login', 'authenticated', 'requires_action',
  ].includes(account.connection_state);
  const showPanel = isConnecting || isActiveFlow;

  // Auto-clear connecting state when account becomes connected
  useEffect(() => {
    if (isConnecting && account.connection_state === 'connected') {
      onSetConnecting(null);
    }
  }, [isConnecting, account.connection_state, onSetConnecting]);

  const interactions = useAuthInteractions(showPanel ? account.id : null);
  const cancelInteraction = useCancelAuthInteraction();

  // Extract live URL and progress from interactions
  const { liveUrl, progressSteps, challenge } = useMemo(() => {
    const items = interactions.data ?? [];
    let url: string | null = null;
    const steps: { step: string; message: string; timestamp: string }[] = [];
    let chal: LinkedInAuthInteraction | null = null;

    for (const item of items) {
      steps.push({ step: item.step, message: item.message, timestamp: item.created_at });
      // Look for live URL in metadata
      const meta = item.metadata as Record<string, unknown>;
      if (meta?.browserbase_live_url && typeof meta.browserbase_live_url === 'string') {
        url = meta.browserbase_live_url;
      }
      // Look for pending challenge
      if (item.interaction_type === 'challenge' && item.status === 'pending') {
        chal = item;
      }
    }
    return { liveUrl: url, progressSteps: steps, challenge: chal };
  }, [interactions.data]);

  if (!showPanel) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-ink-500" />
            <span className="text-sm font-semibold text-ink-50">{account.account_name}</span>
          </div>
          <Badge tone={statusTone(account.status)} size="sm" dot>{account.status}</Badge>
        </div>
        <div className="space-y-1.5 text-xs text-ink-500">
          <div className="flex justify-between"><span>Email</span><span className="text-ink-200 truncate max-w-[180px]">{account.linkedin_email}</span></div>
          <div className="flex justify-between"><span>Session</span><Badge tone={statusTone(account.session_status)} size="sm">{account.session_status}</Badge></div>
          <div className="flex justify-between"><span>Connections today</span><span className="text-ink-200">{account.connections_today} / {account.daily_connection_limit}</span></div>
          <div className="flex justify-between"><span>Messages today</span><span className="text-ink-200">{account.messages_today} / {account.daily_message_limit}</span></div>
          <div className="flex justify-between"><span>Profile visits</span><span className="text-ink-200">{account.profile_visits_today} / {account.daily_profile_visit_limit}</span></div>
          {account.last_login_at && <div className="flex justify-between"><span>Last login</span><span className="text-ink-500">{new Date(account.last_login_at).toLocaleString()}</span></div>}
          {account.profile_name && <div className="flex justify-between"><span>Profile</span><span className="text-gold-400 truncate max-w-[180px]">{account.profile_name}</span></div>}
        </div>
        <button
          onClick={onDelete}
          disabled={false}
          className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium text-error-500 hover:bg-error-500/10 transition-colors"
        >
          Disconnect
        </button>
      </Card>
    );
  }

  // ── Live Connection Panel ──────────────────────────────────
  return (
    <Card className="p-4 border-gold-500/25">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <UserCircle className="h-5 w-5 text-gold-400" />
          <span className="text-sm font-semibold text-ink-50">{account.account_name}</span>
        </div>
        <Badge tone={statusTone(account.connection_state)} size="sm" dot>
          {account.connection_state.replace(/_/g, ' ')}
        </Badge>
      </div>

      {/* Connection State Machine */}
      <ConnectionStateMachine currentState={account.connection_state} lastError={account.last_error} />

      {/* Progress Timeline */}
      <div className="space-y-2 mb-4">
        {progressSteps.length === 0 && !interactions.isLoading && (
          <p className="text-xs text-ink-500 italic">Waiting for worker to pick up task...</p>
        )}
        {interactions.isLoading && (
          <div className="flex items-center gap-2 text-xs text-ink-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading progress...
          </div>
        )}
        {progressSteps.map((step, i) => {
          const isLast = i === progressSteps.length - 1;
          const isChallenge = step.step === 'challenge_detected';
          const isError = step.step === 'login_failed' || step.step === 'login_timeout';
          const isSuccess = step.step === 'connected';
          return (
            <div key={i} className="flex items-start gap-2.5">
              <div className="flex flex-col items-center">
                {isSuccess ? (
                  <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
                ) : isError ? (
                  <XCircle className="h-4 w-4 text-error-500 shrink-0" />
                ) : isChallenge ? (
                  <AlertOctagon className="h-4 w-4 text-warning-500 shrink-0" />
                ) : isLast ? (
                  <Loader2 className="h-4 w-4 text-gold-400 animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-ink-600 shrink-0" />
                )}
                {!isLast && <div className="w-px h-4 bg-gold-500/10 mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-xs font-medium',
                  isSuccess ? 'text-success-500' : isError ? 'text-error-500' : isChallenge ? 'text-warning-500' : isLast ? 'text-gold-400' : 'text-ink-300'
                )}>
                  {step.message}
                </p>
                <p className="text-2xs text-ink-500 mt-0.5">{new Date(step.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Live Browser URL Button */}
      {liveUrl && account.connection_state !== 'connected' && (
        <div className="mb-4 rounded-xl border border-gold-500/20 bg-gold-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <Monitor className="h-4 w-4 text-gold-400" />
            <span className="text-xs font-medium text-ink-100">Secure browser ready</span>
          </div>
          <p className="text-xs text-ink-400 mb-3">Click below to open the browser and complete your LinkedIn login.</p>
          <a
            href={liveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2.5 text-sm font-semibold text-maroon-950 hover:shadow-gold-lg transition-all duration-300 btn-gold-glow active:scale-[0.97]"
          >
            <ExternalLink className="h-4 w-4" />
            Open Secure Browser
          </a>
        </div>
      )}

      {/* Challenge UI */}
      {challenge && challenge.status === 'pending' && (
        <div className="mb-4 rounded-xl border border-warning-500/20 bg-warning-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertOctagon className="h-4 w-4 text-warning-500" />
            <span className="text-xs font-medium text-ink-100">LinkedIn Verification Required</span>
          </div>
          <p className="text-xs text-ink-300 mb-1">{challenge.challenge_description || challenge.message}</p>
          <p className="text-2xs text-ink-500 mb-3">Complete the verification in the browser window. The system will detect when you're done.</p>
          <button
            onClick={() => cancelInteraction.mutate(challenge)}
            className="text-xs text-ink-500 hover:text-error-500 transition-colors"
          >
            Cancel authentication
          </button>
        </div>
      )}

      {/* Error Display */}
      {account.last_error && account.connection_state === 'failed' && (
        <div className="mb-4 rounded-xl border border-error-500/20 bg-error-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <XCircle className="h-4 w-4 text-error-500" />
            <span className="text-xs font-medium text-error-500">Connection Failed</span>
          </div>
          <p className="text-xs text-ink-400">{account.last_error}</p>
        </div>
      )}

      {/* Connected State */}
      {account.connection_state === 'connected' && (
        <div className="mb-4 rounded-xl border border-success-500/20 bg-success-500/5 p-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-500" />
            <span className="text-xs font-medium text-success-500">LinkedIn Connected</span>
          </div>
          {account.profile_name && <p className="text-xs text-ink-300 mt-1">{account.profile_name}</p>}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-2xs text-ink-500">Session:</span>
            <Badge tone="success" size="sm" dot>
              <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Authenticated</span>
            </Badge>
          </div>
        </div>
      )}

      {/* Stats (when connected) */}
      {account.connection_state === 'connected' && (
        <div className="space-y-1.5 text-xs text-ink-500 mb-3">
          <div className="flex justify-between"><span>Connections today</span><span className="text-ink-200">{account.connections_today} / {account.daily_connection_limit}</span></div>
          <div className="flex justify-between"><span>Messages today</span><span className="text-ink-200">{account.messages_today} / {account.daily_message_limit}</span></div>
        </div>
      )}

      <button
        onClick={() => { onSetConnecting(null); onDelete(); }}
        className="mt-2 w-full rounded-lg py-1.5 text-xs font-medium text-error-500 hover:bg-error-500/10 transition-colors"
      >
        Disconnect
      </button>
    </Card>
  );
}

// ── Sessions Tab ──────────────────────────────────────────────

function SessionsTab() {
  const sessions = useLinkedInSessions();
  const deleteSession = useDeleteLinkedInSession();
  const list = sessions.data ?? [];

  if (sessions.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No browser sessions saved.</Card>;

  return (
    <Card>
      <div className="divide-y divide-gold-500/8">
        {list.map((s) => (
          <div key={s.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <KeyRound className="h-3.5 w-3.5 text-ink-400" />
                <span className="text-sm font-medium text-ink-50">{s.session_name}</span>
                <SessionHealthBadge healthStatus={s.health_status} connectionState={s.connection_state} />
                {s.encrypted && <Badge tone="brand" size="sm"><Shield className="h-3 w-3 inline mr-1" />Encrypted</Badge>}
                {s.authenticated && <Badge tone="success" size="sm"><CheckCircle2 className="h-3 w-3 inline mr-1" />Verified</Badge>}
              </div>
              <div className="text-xs text-ink-400">
                Last used: {s.last_used_at ? new Date(s.last_used_at).toLocaleString() : 'Never'}
                {s.last_validated_at && ` · Verified: ${new Date(s.last_validated_at).toLocaleString()}`}
                {s.expires_at && ` · Expires: ${new Date(s.expires_at).toLocaleString()}`}
                {s.browser_version && ` · Browser: ${s.browser_version}`}
                {s.failure_reason && <p className="text-error-500 mt-0.5">{s.failure_reason}</p>}
              </div>
            </div>
            <button
              onClick={() => deleteSession.mutate(s.id)}
              disabled={deleteSession.isPending}
              className="rounded-lg p-1.5 text-ink-400 hover:text-error-500 hover:bg-error-500/10 transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Queue Tab ──────────────────────────────────────────────────

function QueueTab() {
  const queue = useBrowserExecutionQueue();
  const cancelExecution = useCancelExecution();
  const list = queue.data ?? [];

  if (queue.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No items in execution queue.</Card>;

  return (
    <Card>
      <div className="divide-y divide-gold-500/8">
        {list.slice(0, 50).map((item) => (
          <div key={item.id} className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge tone={statusTone(item.status)} size="sm" dot>{item.status}</Badge>
                <span className="text-xs font-medium text-ink-200">{item.action_type}</span>
                <span className="text-xs text-ink-400">{item.priority_label}</span>
              </div>
              {item.error && <p className="text-xs text-error-500 mt-1 truncate">{item.error}</p>}
              {item.retry_count > 0 && <p className="text-xs text-warning-500 mt-0.5">Retries: {item.retry_count}/{item.max_retries}</p>}
              {item.next_retry_at && <p className="text-xs text-ink-400 mt-0.5">Next retry: {new Date(item.next_retry_at).toLocaleString()}</p>}
            </div>
            {item.status === 'pending' && (
              <button
                onClick={() => cancelExecution.mutate(item.id)}
                disabled={cancelExecution.isPending}
                className="rounded-lg p-1.5 text-ink-400 hover:text-error-500 hover:bg-error-500/10 transition-colors shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── History Tab ────────────────────────────────────────────────

function HistoryTab() {
  const history = useBrowserExecutionHistory();
  const list = history.data ?? [];

  if (history.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No execution history yet.</Card>;

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gold-500/12 text-xs text-ink-500">
              <th className="px-4 py-2 text-left font-medium">Action</th>
              <th className="px-4 py-2 text-left font-medium">Status</th>
              <th className="px-4 py-2 text-left font-medium">Duration</th>
              <th className="px-4 py-2 text-left font-medium">Retries</th>
              <th className="px-4 py-2 text-left font-medium">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gold-500/8">
            {list.map((h) => (
              <tr key={h.id} className="hover:bg-gold-500/4 table-row-luxury">
                <td className="px-4 py-2 text-xs text-ink-200">{h.action_type}</td>
                <td className="px-4 py-2"><Badge tone={statusTone(h.status)} size="sm">{h.status}</Badge></td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.duration_ms ? `${h.duration_ms}ms` : '—'}</td>
                <td className="px-4 py-2 text-xs text-ink-200">{h.retry_count}</td>
                <td className="px-4 py-2 text-xs text-ink-400">{h.completed_at ? new Date(h.completed_at).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Failures Tab ────────────────────────────────────────────────

function FailuresTab() {
  const failures = useBrowserExecutionFailures();
  const resolveFailure = useResolveExecutionFailure();
  const list = failures.data ?? [];

  if (failures.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No execution failures recorded.</Card>;

  return (
    <Card>
      <div className="divide-y divide-gold-500/8">
        {list.map((f) => (
          <div key={f.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Badge tone={f.resolved ? 'success' : 'error'} size="sm" dot>{f.resolved ? 'Resolved' : 'Open'}</Badge>
                  <span className="text-xs font-medium text-ink-200">{f.error_type}</span>
                </div>
                <p className="text-sm text-ink-400">{f.error_message}</p>
                {f.url && <p className="text-xs text-ink-500 mt-1 truncate">URL: {f.url}</p>}
                <p className="text-xs text-ink-500 mt-1">{new Date(f.created_at).toLocaleString()}</p>
              </div>
              {!f.resolved && (
                <button
                  onClick={() => resolveFailure.mutate(f.id)}
                  disabled={resolveFailure.isPending}
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

// ── Retry Tab ────────────────────────────────────────────────

function RetryTab() {
  const retry = useBrowserRetryQueue();
  const list = retry.data ?? [];

  if (retry.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No items in retry queue.</Card>;

  return (
    <Card>
      <div className="divide-y divide-gold-500/8">
        {list.map((r) => (
          <div key={r.id} className="px-4 py-3 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge tone={statusTone(r.status)} size="sm">{r.status}</Badge>
                <span className="text-xs font-medium text-ink-200">{r.action_type}</span>
              </div>
              <div className="text-xs text-ink-400">
                Retry {r.retry_count}/{r.max_retries} · Next: {new Date(r.next_retry_at).toLocaleString()}
              </div>
              {r.last_error && <p className="text-xs text-error-500 mt-1 truncate">{r.last_error}</p>}
            </div>
            <Clock className="h-4 w-4 text-ink-400" />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Dead Letter Tab ────────────────────────────────────────────

function DeadLetterTab() {
  const dlq = useBrowserDeadLetterQueue();
  const list = dlq.data ?? [];

  if (dlq.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No dead letter items.</Card>;

  return (
    <Card>
      <div className="divide-y divide-gold-500/8">
        {list.map((d) => (
          <div key={d.id} className="px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <Badge tone="error" size="sm">{d.failure_reason}</Badge>
              <span className="text-xs font-medium text-ink-200">{d.action_type}</span>
            </div>
            <p className="text-xs text-error-500 mt-1">{d.last_error}</p>
            <p className="text-xs text-ink-400 mt-1">Retries: {d.retry_count} · {new Date(d.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Devices Tab ────────────────────────────────────────────────

function DevicesTab() {
  const devices = useLinkedInDevices();
  const list = devices.data ?? [];

  if (devices.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No registered devices.</Card>;

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
      {list.map((d) => (
        <Card key={d.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-ink-400" />
              <span className="text-sm font-medium text-ink-50">{d.device_name}</span>
            </div>
            {d.trusted && <Badge tone="success" size="sm">Trusted</Badge>}
          </div>
          <div className="space-y-1 text-xs text-ink-500">
            {d.user_agent && <div className="truncate" title={d.user_agent}>UA: {d.user_agent.slice(0, 50)}...</div>}
            {d.ip_address && <div>IP: {d.ip_address}</div>}
            {d.timezone && <div>TZ: {d.timezone}</div>}
            {d.last_seen_at && <div>Last seen: {new Date(d.last_seen_at).toLocaleString()}</div>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ── Events Tab ────────────────────────────────────────────────

function EventsTab() {
  const events = useLinkedInSessionEvents();
  const list = events.data ?? [];

  if (events.isLoading) return <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>;
  if (list.length === 0) return <Card className="p-12 text-center text-sm text-ink-500">No session events recorded.</Card>;

  return (
    <Card>
      <div className="divide-y divide-gold-500/8 max-h-[600px] overflow-y-auto scrollbar-thin">
        {list.map((e) => (
          <div key={e.id} className="px-4 py-2.5 flex items-start gap-3">
            <Activity className="h-3.5 w-3.5 text-ink-400 mt-0.5 shrink-0" />
            <div className="min-w-0 flex-1">
              <span className="text-xs font-medium text-ink-200">{e.event_type}</span>
              <p className="text-xs text-ink-400">{new Date(e.created_at).toLocaleString()}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ── Behavior Settings Tab ──────────────────────────────────────

function BehaviorTab() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="h-5 w-5 text-gold-400" />
          <h3 className="text-sm font-semibold text-ink-50">Working Hours</h3>
        </div>
        <div className="space-y-2 text-xs text-ink-500">
          <div className="flex justify-between"><span>Start hour</span><span className="text-ink-200">9:00 AM</span></div>
          <div className="flex justify-between"><span>End hour</span><span className="text-ink-200">5:00 PM</span></div>
          <div className="flex justify-between"><span>Lunch break</span><span className="text-ink-200">12:00 - 1:00 PM</span></div>
          <div className="flex justify-between"><span>Working days</span><span className="text-ink-200">Mon - Fri</span></div>
          <div className="flex justify-between"><span>Timezone</span><span className="text-ink-200">America/New_York</span></div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-gold-400" />
          <h3 className="text-sm font-semibold text-ink-50">Action Limits</h3>
        </div>
        <div className="space-y-2 text-xs text-ink-500">
          <div className="flex justify-between"><span>Daily connections</span><span className="text-ink-200">20</span></div>
          <div className="flex justify-between"><span>Daily messages</span><span className="text-ink-200">50</span></div>
          <div className="flex justify-between"><span>Daily profile visits</span><span className="text-ink-200">80</span></div>
          <div className="flex justify-between"><span>Hourly actions</span><span className="text-ink-200">15</span></div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-gold-400" />
          <h3 className="text-sm font-semibold text-ink-50">Pacing</h3>
        </div>
        <div className="space-y-2 text-xs text-ink-500">
          <div className="flex justify-between"><span>Min delay</span><span className="text-ink-200">500ms</span></div>
          <div className="flex justify-between"><span>Max delay</span><span className="text-ink-200">2000ms</span></div>
          <div className="flex justify-between"><span>Reading pause</span><span className="text-ink-200">2-8s</span></div>
          <div className="flex justify-between"><span>Campaign pacing</span><span className="text-ink-200">Enabled</span></div>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-gold-400" />
          <h3 className="text-sm font-semibold text-ink-50">Safety</h3>
        </div>
        <div className="space-y-2 text-xs text-ink-500">
          <div className="flex justify-between"><span>Weekend rules</span><span className="text-success-500">Enforced</span></div>
          <div className="flex justify-between"><span>Captcha detection</span><span className="text-success-500">Active</span></div>
          <div className="flex justify-between"><span>Rate limit detection</span><span className="text-success-500">Active</span></div>
          <div className="flex justify-between"><span>Restriction detection</span><span className="text-success-500">Active</span></div>
        </div>
      </Card>
    </div>
  );
}
