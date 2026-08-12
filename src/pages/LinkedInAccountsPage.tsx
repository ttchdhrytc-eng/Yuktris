import { useState, useEffect, useMemo } from 'react';
import {
  Linkedin, Plus, CheckCircle2, AlertTriangle, X, RefreshCw,
  ShieldCheck, Activity, Cpu, Globe, Clock, Zap, FlaskConical,
  ChevronDown, ChevronUp, Heart,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { timeAgo } from '@/lib/utils';
import {
  useConnectLinkedIn, useTestLinkedInConnection, useDisconnectLinkedIn, useToggleDryRun,
  useAuthInteractions, useCancelAuthInteraction, useLinkedInLoginAccess,
} from '@/hooks/useLinkedInBrowser';
import { SecureLinkedInAuthModal } from '@/components/linkedin/SecureLinkedInAuthModal';
import type { LinkedInAuthInteraction } from '@/types/linkedin-browser-automation';

type ConnectionState =
  | 'pending' | 'authenticating' | 'requires_action' | 'connected'
  | 'session_expired' | 'session_invalid' | 'restricted'
  | 'disconnected' | 'failed' | 'cancelled';

const STATE_META: Record<ConnectionState, { label: string; tone: 'success' | 'warning' | 'error' | 'neutral' | 'brand'; description: string }> = {
  connected: { label: 'Connected', tone: 'success', description: 'Session is healthy and authenticated' },
  authenticating: { label: 'Authenticating', tone: 'brand', description: 'Browser authentication in progress' },
  pending: { label: 'Connecting', tone: 'brand', description: 'Connection attempt queued' },
  requires_action: { label: 'Action Required', tone: 'warning', description: 'Complete LinkedIn verification in the browser window' },
  session_expired: { label: 'Session Expired', tone: 'warning', description: 'LinkedIn session has expired. Reconnect your account.' },
  session_invalid: { label: 'Session Invalid', tone: 'error', description: 'Session could not be restored. Please reconnect.' },
  restricted: { label: 'Restricted', tone: 'error', description: 'Account restricted by LinkedIn. Manual review required.' },
  disconnected: { label: 'Not Connected', tone: 'neutral', description: 'Not connected to LinkedIn' },
  failed: { label: 'Failed', tone: 'error', description: 'Connection failed. See error details.' },
  cancelled: { label: 'Cancelled', tone: 'neutral', description: 'Connection attempt cancelled' },
};

const STEP_LABELS: Record<string, string> = {
  creating_session: 'Creating browser session...',
  session_created: 'Browser session created...',
  connecting_browser: 'Attaching to browser...',
  browser_connected: 'Secure browser ready',
  launching_browser: 'Launching browser...',
  opening_linkedin: 'Opening LinkedIn...',
  ready_for_login: 'LinkedIn login page ready',
  waiting_for_login: 'Waiting for login...',
  challenge_detected: 'Verification required',
  waiting_for_user: 'Waiting for verification in secure browser...',
  verifying_authentication: 'Verifying authentication...',
  identity_verified: 'LinkedIn identity verified',
  saving_session: 'Saving session...',
  connected: 'Connected.',
  login_timeout: 'Login timed out',
  login_failed: 'Login failed',
};

const STEP_ICONS: Record<string, typeof Activity> = {
  creating_session: Cpu,
  session_created: Cpu,
  connecting_browser: Globe,
  browser_connected: Globe,
  launching_browser: Globe,
  opening_linkedin: Linkedin,
  ready_for_login: Linkedin,
  waiting_for_login: Clock,
  challenge_detected: AlertTriangle,
  identity_verified: ShieldCheck,
  saving_session: ShieldCheck,
  connected: CheckCircle2,
  login_timeout: AlertTriangle,
  login_failed: AlertTriangle,
};

interface AccountRow {
  id: string;
  workspace_id: string;
  account_name: string;
  linkedin_email: string;
  profile_url: string | null;
  profile_name: string | null;
  profile_headline: string | null;
  status: string;
  session_status: string;
  connection_state: ConnectionState;
  last_validated_at: string | null;
  last_error: string | null;
  last_login_at: string | null;
  dry_run_enabled: boolean;
  created_at: string;
}

export function LinkedInAccountsPage() {
  const { workspace } = useWorkspace();
  const [showConnect, setShowConnect] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState<AccountRow | null>(null);
  const [authAccountId, setAuthAccountId] = useState<string | null>(null);
  const [authQueueItemId, setAuthQueueItemId] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['linkedin-accounts', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase
        .from('linkedin_accounts')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AccountRow[];
    },
    refetchInterval: 5000,
  });

  const connect = useConnectLinkedIn();
  const testConnection = useTestLinkedInConnection();
  const disconnect = useDisconnectLinkedIn();
  const toggleDryRun = useToggleDryRun();

  // Auto-open auth progress panel when an account is in authenticating/pending state
  useEffect(() => {
    if (!accounts) return;
    const inProgress = accounts.find(
      (a) => a.connection_state === 'authenticating' || a.connection_state === 'pending' || a.connection_state === 'requires_action'
    );
    if (inProgress) {
      if (authAccountId !== inProgress.id) setAuthQueueItemId(null);
      setAuthAccountId(inProgress.id);
    } else if (authAccountId) {
      const stillExists = accounts.find((a) => a.id === authAccountId);
      if (stillExists && (stillExists.connection_state === 'connected' || stillExists.connection_state === 'failed' || stillExists.connection_state === 'disconnected' || stillExists.connection_state === 'cancelled')) {
        // Keep panel open for 5s after completion, then close
        const timer = setTimeout(() => {
          setAuthAccountId(null);
          setAuthQueueItemId(null);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [accounts, authAccountId]);

  return (
    <div>
      <PageHeader
        title="LinkedIn Accounts"
        description="Connect existing LinkedIn accounts for outreach and automation. Sessions are encrypted and managed securely through the browser execution engine."
        actions={
          <Button onClick={() => setShowConnect(true)}>
            <Plus className="h-4 w-4" />
            Connect LinkedIn Account
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : accounts && accounts.length > 0 ? (
        <div className="space-y-4">
          {accounts.map((acc) => {
            const state = acc.connection_state as ConnectionState;
            const meta = STATE_META[state] ?? STATE_META.disconnected;
            const showAuthPanel = authAccountId === acc.id && (state === 'authenticating' || state === 'pending' || state === 'requires_action');
            return (
              <Card key={acc.id}>
                <CardContent>
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-300/10 border border-brand-300/20">
                        <Linkedin className="h-5 w-5 text-brand-300" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-ink-50">{acc.profile_name || acc.account_name}</h3>
                        {acc.profile_url && (
                          <a href={acc.profile_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-300 hover:text-brand-300">
                            {acc.profile_url}
                          </a>
                        )}
                        <p className="text-xs text-ink-500 mt-0.5">{acc.linkedin_email}</p>
                      </div>
                    </div>
                    <Badge tone={meta.tone} dot>{meta.label}</Badge>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="space-y-1">
                      <p className="text-xs text-ink-500">Session Health</p>
                      <p className={`text-sm font-medium ${
                        state === 'connected' ? 'text-success-500' :
                        state === 'authenticating' || state === 'pending' ? 'text-brand-300' :
                        'text-warning-500'
                      }`}>
                        {state === 'connected' ? 'Healthy' : state === 'authenticating' ? 'Validating' : state === 'pending' ? 'Queued' : meta.label}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-ink-500">Last Verified</p>
                      <p className="text-sm font-medium text-ink-200">
                        {acc.last_validated_at ? timeAgo(acc.last_validated_at) : 'Never'}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-ink-500">Account Status</p>
                      <p className="text-sm font-medium text-ink-200 capitalize">{acc.status.replace(/_/g, ' ')}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-ink-500">Dry Run</p>
                      <p className={`text-sm font-medium ${acc.dry_run_enabled ? 'text-brand-300' : 'text-ink-500'}`}>
                        {acc.dry_run_enabled ? 'Enabled' : 'Disabled'}
                      </p>
                    </div>
                  </div>

                  {acc.last_error && state !== 'connected' && (
                    <div className="rounded-lg bg-error-500/10 border border-error-100 p-3 mb-4">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-error-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-error-500">Connection Error</p>
                          <p className="text-xs text-error-500 mt-1">{acc.last_error}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {showAuthPanel && (
                    <AuthProgressPanel accountId={acc.id} connectionState={state} />
                  )}

                  {!showAuthPanel && (state === 'authenticating' || state === 'pending') && (
                    <div className="rounded-lg bg-brand-300/10 border border-brand-300/20 p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <Spinner className="h-4 w-4" />
                        <p className="text-xs text-brand-300">
                          {state === 'pending' ? 'Preparing secure LinkedIn browser...' : 'Your secure LinkedIn browser is ready. Complete LinkedIn sign-in in the browser window.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-3 border-t border-gold-500/12">
                    {state === 'connected' && (
                      <>
                        <button
                          onClick={() => testConnection.mutate(acc.id)}
                          disabled={testConnection.isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-gold-500/12 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-card-800 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw className="h-3 w-3" />Test Connection
                        </button>
                        <button
                          onClick={() => toggleDryRun.mutate({ accountId: acc.id, enabled: !acc.dry_run_enabled })}
                          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                            acc.dry_run_enabled
                              ? 'bg-brand-300/10 text-brand-300 hover:bg-brand-300/10'
                              : 'border border-gold-500/12 text-ink-200 hover:bg-card-800'
                          }`}
                        >
                          <FlaskConical className="h-3 w-3" />{acc.dry_run_enabled ? 'Dry Run On' : 'Dry Run Off'}
                        </button>
                        <button
                          onClick={() => setConfirmDisconnect(acc)}
                          className="flex items-center gap-1.5 rounded-lg bg-error-500/10 px-2.5 py-1.5 text-xs font-medium text-error-500 hover:bg-error-100 transition-colors ml-auto"
                        >
                          <X className="h-3 w-3" />Disconnect
                        </button>
                      </>
                    )}
                    {(state === 'disconnected' || state === 'session_expired' || state === 'session_invalid' || state === 'failed' || state === 'cancelled') && (
                      <>
                        <button
                          onClick={() => connect.mutate(
                            { existingAccountId: acc.id },
                            { onSuccess: (result) => {
                              setAuthAccountId(result.accountId);
                              setAuthQueueItemId(result.queueItemId);
                            } }
                          )}
                          disabled={connect.isPending}
                          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-2.5 py-1.5 text-xs font-medium text-maroon-950 hover:bg-brand-300/20 transition-colors"
                        >
                          <RefreshCw className="h-3 w-3" />Reconnect
                        </button>
                        <button
                          onClick={() => setConfirmDisconnect(acc)}
                          className="flex items-center gap-1.5 rounded-lg bg-error-500/10 px-2.5 py-1.5 text-xs font-medium text-error-500 hover:bg-error-100 transition-colors ml-auto"
                        >
                          <X className="h-3 w-3" />Remove
                        </button>
                      </>
                    )}
                    {state === 'restricted' && (
                      <span className="text-xs text-error-500 flex items-center gap-1.5">
                        <AlertTriangle className="h-3 w-3" />Account restricted by LinkedIn. Manual review required.
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          <DiagnosticsPanel />
        </div>
      ) : (
        <div className="space-y-4">
          <Card>
            <EmptyState
              icon={<Linkedin className="h-5 w-5" />}
              title="No LinkedIn accounts connected"
              description="Connect an existing LinkedIn account to Revenue AI. Your LinkedIn password is never stored. The connection uses a secure browser session managed through the execution engine."
              action={
                <Button onClick={() => setShowConnect(true)}>
                  <Plus className="h-4 w-4" />
                  Connect LinkedIn Account
                </Button>
              }
            />
          </Card>
          <DiagnosticsPanel />
        </div>
      )}

      {showConnect && (
        <ConnectLinkedInModal
          onClose={() => setShowConnect(false)}
          onConnect={(params) => {
            connect.mutate(params, {
              onSuccess: (result) => {
                setShowConnect(false);
                if (result?.accountId) {
                  setAuthAccountId(result.accountId);
                  setAuthQueueItemId(result.queueItemId);
                }
              },
            });
          }}
          isConnecting={connect.isPending}
        />
      )}

      {authAccountId && <AccountAuthModal accountId={authAccountId} queueItemId={authQueueItemId} onClose={() => {
        setAuthAccountId(null);
        setAuthQueueItemId(null);
      }} />}

      {confirmDisconnect && (
        <Modal
          open
          onClose={() => setConfirmDisconnect(null)}
          title="Disconnect LinkedIn Account"
          description="This will stop all pending LinkedIn jobs, revoke the stored session, and mark the account as disconnected. This action cannot be undone."
        >
          <div className="space-y-4">
            <div className="rounded-lg bg-card-900 p-3">
              <p className="text-sm font-medium text-ink-50">{confirmDisconnect.profile_name || confirmDisconnect.account_name}</p>
              <p className="text-xs text-ink-500">{confirmDisconnect.linkedin_email}</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setConfirmDisconnect(null)}>Cancel</Button>
              <Button
                variant="danger"
                onClick={() => {
                  disconnect.mutate(confirmDisconnect.id, { onSuccess: () => setConfirmDisconnect(null) });
                }}
              >
                <X className="h-4 w-4" />Disconnect
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Auth Progress Panel ─────────────────────────────────────

function AuthProgressPanel({ accountId, connectionState }: { accountId: string; connectionState: ConnectionState }) {
  const { data: interactions, isLoading } = useAuthInteractions(accountId);

  const progressEvents = useMemo(() => {
    if (!interactions) return [];
    return interactions.filter((i) => i.interaction_type === 'progress' || i.interaction_type === 'challenge' || i.interaction_type === 'session_saved' || i.interaction_type === 'error');
  }, [interactions]);

  const challengeEvent = useMemo(() => {
    if (!interactions) return null;
    return interactions.find((i) => i.interaction_type === 'challenge' && i.status === 'pending');
  }, [interactions]);

  const isComplete = connectionState === 'connected';
  const isFailed = connectionState === 'failed';

  return (
    <div className="rounded-lg border border-brand-300/25 bg-brand-300/10/50 p-4 mb-4 space-y-3">
      <div className="flex items-center gap-2">
        {isComplete ? (
          <CheckCircle2 className="h-4 w-4 text-success-500" />
        ) : isFailed ? (
          <AlertTriangle className="h-4 w-4 text-error-500" />
        ) : (
          <Spinner className="h-4 w-4" />
        )}
        <p className="text-sm font-semibold text-ink-50">
          {isComplete ? 'Connection Complete' : isFailed ? 'Connection Failed' : 'LinkedIn Authentication In Progress'}
        </p>
      </div>

      {/* Progress Steps */}
      {isLoading ? (
        <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
      ) : progressEvents.length > 0 ? (
        <div className="space-y-2">
          {progressEvents.map((event, idx) => {
            const StepIcon = STEP_ICONS[event.step] || Activity;
            const isCurrent = idx === progressEvents.length - 1 && !isComplete && !isFailed;
            const isDone = isComplete || (idx < progressEvents.length - 1);
            return (
              <div key={event.id} className={`flex items-center gap-2.5 ${isCurrent ? 'animate-pulse' : ''}`}>
                <div className={`flex h-7 w-7 items-center justify-center rounded-full flex-shrink-0 ${
                  isDone ? 'bg-success-100' : isCurrent ? 'bg-brand-200' : 'bg-ink-100'
                }`}>
                  <StepIcon className={`h-3.5 w-3.5 ${
                    isDone ? 'text-success-500' : isCurrent ? 'text-brand-300' : 'text-ink-500'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className={`text-xs ${isCurrent ? 'font-semibold text-brand-300' : isDone ? 'text-ink-600' : 'text-ink-500'}`}>
                    {STEP_LABELS[event.step] || event.message || event.step}
                  </p>
                  <p className="text-xs text-ink-400">{timeAgo(event.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-xs text-ink-500">Waiting for progress updates...</p>
      )}

      {/* Challenge Notification */}
      {challengeEvent && (
        <ChallengeNotification
          event={challengeEvent}
          onResolved={() => {}}
        />
      )}

    </div>
  );
}

function AccountAuthModal({ accountId, queueItemId, onClose }: { accountId: string; queueItemId: string | null; onClose: () => void }) {
  const { data: loginAccess } = useLinkedInLoginAccess(accountId);
  const { data: interactions } = useAuthInteractions(accountId);
  const cancelInteraction = useCancelAuthInteraction();
  const currentQueueItemId = queueItemId ?? [...(interactions ?? [])].reverse().find((event) => event.queue_item_id)?.queue_item_id ?? null;
  const identityVerified = interactions?.some(
    (event) => event.queue_item_id === currentQueueItemId && event.interaction_type === 'progress' && event.step === 'identity_verified' && event.status === 'completed'
  ) ?? false;
  const authRequired = interactions?.some(
    (event) => event.queue_item_id === currentQueueItemId && event.interaction_type === 'progress' && event.step === 'auth_required' && event.status === 'completed'
  ) ?? false;
  const securityCheckRequired = interactions?.some(
    (event) => event.queue_item_id === currentQueueItemId && event.interaction_type === 'challenge' && event.status === 'pending'
  ) ?? false;
  const repeatedSecurityChecks = interactions?.some(
    (event) => event.queue_item_id === currentQueueItemId && event.interaction_type === 'progress' && event.step === 'provider_rechallenge' && event.status === 'completed'
  ) ?? false;
  const cancellableInteraction = [...(interactions ?? [])].reverse().find((event) => event.queue_item_id === currentQueueItemId) ?? null;

  return (
    <SecureLinkedInAuthModal
      open={authRequired || identityVerified}
      loginUrl={loginAccess?.loginUrl ?? null}
      identityVerified={identityVerified}
      securityCheckRequired={securityCheckRequired}
      repeatedSecurityChecks={repeatedSecurityChecks}
      onCancel={() => {
        if (cancellableInteraction) cancelInteraction.mutate(cancellableInteraction);
        onClose();
      }}
    />
  );
}

// ── Challenge Notification ───────────────────────────────────

function ChallengeNotification({ event, onResolved }: { event: LinkedInAuthInteraction; onResolved: () => void }) {
  const cancelInteraction = useCancelAuthInteraction();

  const description = event.challenge_description || event.message || 'Complete the LinkedIn verification';

  const handleCancel = () => {
    cancelInteraction.mutate(event, { onSuccess: onResolved });
  };

  return (
    <div className="rounded-lg bg-warning-500/10 border border-warning-500/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-warning-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-warning-500">LinkedIn Verification Required</p>
          <p className="text-xs text-warning-500 mt-1">{description}</p>
          <p className="text-xs text-warning-500 mt-1">Complete the verification in the secure LinkedIn browser window. Yuktris never collects or submits verification codes.</p>
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={handleCancel} disabled={cancelInteraction.isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Connect Modal ───────────────────────────────────────────

function ConnectLinkedInModal({ onClose, onConnect, isConnecting }: {
  onClose: () => void;
  onConnect: (params: { linkedinEmail?: string; displayName?: string }) => void;
  isConnecting: boolean;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');

  return (
    <Modal open onClose={onClose} title="Connect your existing LinkedIn account" description="Sign in directly inside the secure LinkedIn browser. Yuktris never receives your password or verification codes.">
      <div className="space-y-4">
        <>
            <div className="rounded-lg bg-brand-300/10 border border-brand-300/20 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-300 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-brand-300 leading-relaxed">
                  Yuktris does not create LinkedIn accounts. Enter your password, OTP, 2FA code, or CAPTCHA response only inside the secure LinkedIn browser; Yuktris never collects or submits them.
                </p>
              </div>
            </div>
            <Field label="LinkedIn email / username (optional)">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label="Optional display name">
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Sales Team Account"
                className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={() => onConnect({ linkedinEmail: email.trim() || undefined, displayName: displayName || undefined })}
                disabled={isConnecting}
              >
                {isConnecting ? <Spinner className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                Continue to LinkedIn
              </Button>
            </div>
        </>
      </div>
    </Modal>
  );
}

// ── Diagnostics Panel ───────────────────────────────────────

function DiagnosticsPanel() {
  const { workspace } = useWorkspace();
  const [expanded, setExpanded] = useState(false);

  const { data: diag, isLoading } = useQuery({
    queryKey: ['linkedin-diagnostics', workspace?.id],
    enabled: !!workspace?.id && expanded,
    queryFn: async () => {
      if (!workspace) return null;
      const [workers, queue, sessions, events, heartbeats] = await Promise.all([
        supabase.from('browser_workers').select('status').eq('workspace_id', workspace.id).limit(10),
        supabase.from('browser_execution_queue').select('status').eq('workspace_id', workspace.id).limit(50),
        supabase.from('linkedin_session_public_view').select('status, last_validated_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('linkedin_session_events').select('event_type, created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(20),
        supabase.from('linkedin_session_heartbeats').select('status, created_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(5),
      ]);

      const workerStatuses = (workers.data ?? []).map((w: { status: string }) => w.status);
      const hasHealthyWorker = workerStatuses.some((s: string) => s === 'idle' || s === 'busy');
      const queueItems = (queue.data ?? []) as { status: string }[];
      const queueHealthy = !queueItems.some((q: { status: string }) => q.status === 'failed');
      const sessionData = (sessions.data ?? []) as { status: string; last_validated_at: string | null }[];
      const hasValidSession = sessionData.some((s: { status: string }) => s.status === 'active');
      const recentEvents = (events.data ?? []) as { event_type: string; created_at: string }[];
      const lastEvent = recentEvents[0];
      const heartbeatData = (heartbeats.data ?? []) as { status: string; created_at: string }[];
      const lastHeartbeat = heartbeatData[0];

      return {
        browserWorker: hasHealthyWorker ? 'healthy' : 'unavailable',
        playwright: 'installed',
        chromium: 'available',
        linkedinSession: hasValidSession ? 'valid' : 'none',
        identityVerification: hasValidSession ? 'passed' : 'not_run',
        sessionRestore: hasValidSession ? 'passed' : 'not_run',
        executionQueue: queueHealthy ? 'healthy' : 'has_failures',
        lastTest: lastEvent ? timeAgo(lastEvent.created_at) : 'Never',
        lastHeartbeat: lastHeartbeat ? timeAgo(lastHeartbeat.created_at) : 'Never',
        heartbeatStatus: lastHeartbeat?.status || 'none',
      };
    },
    refetchInterval: expanded ? 10000 : false,
  });

  const checks = [
    { label: 'Browser Worker', icon: Cpu, status: diag?.browserWorker ?? 'unknown' },
    { label: 'Playwright', icon: Activity, status: diag?.playwright ?? 'unknown' },
    { label: 'Chromium', icon: Globe, status: diag?.chromium ?? 'unknown' },
    { label: 'LinkedIn Session', icon: ShieldCheck, status: diag?.linkedinSession ?? 'unknown' },
    { label: 'Identity Verification', icon: CheckCircle2, status: diag?.identityVerification ?? 'unknown' },
    { label: 'Session Restore', icon: RefreshCw, status: diag?.sessionRestore ?? 'unknown' },
    { label: 'Execution Queue', icon: Clock, status: diag?.executionQueue ?? 'unknown' },
    { label: 'Session Heartbeat', icon: Heart, status: diag?.heartbeatStatus ?? 'unknown' },
  ];

  return (
    <Card>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center justify-between w-full p-4"
      >
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-300" />
          <span className="text-sm font-semibold text-ink-50">LinkedIn Connection Diagnostics</span>
        </div>
        {expanded ? <ChevronUp className="h-4 w-4 text-ink-500" /> : <ChevronDown className="h-4 w-4 text-ink-500" />}
      </button>
      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          {isLoading ? (
            <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
          ) : (
            <>
              {checks.map((c) => (
                <div key={c.label} className="flex items-center justify-between py-2 border-b border-gold-500/8 last:border-0">
                  <div className="flex items-center gap-2">
                    <c.icon className="h-3.5 w-3.5 text-ink-500" />
                    <span className="text-xs text-ink-200">{c.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${
                      c.status === 'healthy' || c.status === 'valid' || c.status === 'passed' || c.status === 'available' || c.status === 'installed' || c.status === 'alive' ? 'bg-success-500' :
                      c.status === 'none' || c.status === 'not_run' || c.status === 'unknown' ? 'bg-ink-400' :
                      c.status === 'unavailable' || c.status === 'has_failures' || c.status === 'expired' ? 'bg-error-500' : 'bg-warning-500'
                    }`} />
                    <span className="text-xs text-ink-500 capitalize">{c.status.replace(/_/g, ' ')}</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-ink-500" />
                  <span className="text-xs text-ink-200">Last Test</span>
                </div>
                <span className="text-xs text-ink-500">{diag?.lastTest ?? 'Never'}</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Heart className="h-3.5 w-3.5 text-ink-500" />
                  <span className="text-xs text-ink-200">Last Heartbeat</span>
                </div>
                <span className="text-xs text-ink-500">{diag?.lastHeartbeat ?? 'Never'}</span>
              </div>
            </>
          )}
        </div>
      )}
    </Card>
  );
}
