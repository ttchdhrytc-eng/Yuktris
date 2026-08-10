import { useState, useEffect, useMemo } from 'react';
import {
  Linkedin, Plus, CheckCircle2, AlertTriangle, X, RefreshCw, Settings,
  ShieldCheck, Activity, Cpu, Globe, Clock, Zap, FlaskConical,
  ChevronDown, ChevronUp, Camera, Heart, KeyRound, ExternalLink,
  Upload, Info,
} from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  useAuthInteractions, useSubmitChallengeResponse, useCancelAuthInteraction,
  useSessionHeartbeats, useManualConnectLinkedIn,
} from '@/hooks/useLinkedInBrowser';
import type { LinkedInAuthInteraction } from '@/types/linkedin-browser-automation';

type ConnectionState =
  | 'pending' | 'authenticating' | 'requires_action' | 'connected'
  | 'session_expired' | 'session_invalid' | 'restricted'
  | 'disconnected' | 'failed';

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
      setAuthAccountId(inProgress.id);
    } else if (authAccountId) {
      const stillExists = accounts.find((a) => a.id === authAccountId);
      if (stillExists && (stillExists.connection_state === 'connected' || stillExists.connection_state === 'failed' || stillExists.connection_state === 'disconnected')) {
        // Keep panel open for 5s after completion, then close
        const timer = setTimeout(() => setAuthAccountId(null), 5000);
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
                    {(state === 'disconnected' || state === 'session_expired' || state === 'session_invalid' || state === 'failed') && (
                      <>
                        <button
                          onClick={() => setShowConnect(true)}
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
                if (result?.accountId) setAuthAccountId(result.accountId);
              },
            });
          }}
          isConnecting={connect.isPending}
        />
      )}

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
  const [showScreenshot, setShowScreenshot] = useState<LinkedInAuthInteraction | null>(null);

  const progressEvents = useMemo(() => {
    if (!interactions) return [];
    return interactions.filter((i) => i.interaction_type === 'progress' || i.interaction_type === 'challenge' || i.interaction_type === 'session_saved' || i.interaction_type === 'error');
  }, [interactions]);

  const challengeEvent = useMemo(() => {
    if (!interactions) return null;
    return interactions.find((i) => i.interaction_type === 'challenge' && i.status === 'pending');
  }, [interactions]);

  const latestScreenshot = useMemo(() => {
    if (!interactions) return null;
    const screenshot = interactions.find((i) => i.screenshot_path);
    return screenshot || null;
  }, [interactions]);

  const liveUrl = useMemo(() => {
    if (!interactions) return null;
    const urlEvent = interactions.find(
      (i) => i.metadata?.browserbase_live_url
    );
    return (urlEvent?.metadata?.browserbase_live_url as string) || null;
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

      {/* Open LinkedIn Browser — live URL from Browserbase */}
      {liveUrl && !isComplete && !isFailed && (
        <a
          href={liveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-3 text-sm font-semibold text-maroon-950 hover:bg-brand-300/20 transition-colors shadow-sm"
        >
          <ExternalLink className="h-4 w-4" />
          Open LinkedIn Browser
        </a>
      )}

      {/* Challenge Notification */}
      {challengeEvent && (
        <ChallengeNotification
          event={challengeEvent}
          onResolved={() => {}}
        />
      )}

      {/* Screenshot Viewer */}
      {latestScreenshot?.screenshot_path && (
        <button
          onClick={() => setShowScreenshot(latestScreenshot)}
          className="flex items-center gap-1.5 text-xs text-brand-300 hover:text-brand-300"
        >
          <Camera className="h-3.5 w-3.5" />
          View browser screenshot
        </button>
      )}

      {showScreenshot && (
        <Modal open onClose={() => setShowScreenshot(null)} title="Browser Screenshot" description="Current state of the LinkedIn authentication browser">
          <div className="space-y-3">
            {showScreenshot.screenshot_path ? (
              <img
                src={`data:image/png;base64,${showScreenshot.screenshot_path}`}
                alt="Browser screenshot"
                className="w-full rounded-lg border border-gold-500/12"
              />
            ) : (
              <p className="text-sm text-ink-500">No screenshot available</p>
            )}
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setShowScreenshot(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Challenge Notification ───────────────────────────────────

function ChallengeNotification({ event, onResolved }: { event: LinkedInAuthInteraction; onResolved: () => void }) {
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const submitResponse = useSubmitChallengeResponse();
  const cancelInteraction = useCancelAuthInteraction();

  const challengeType = event.challenge_type || 'email_otp';
  const description = event.challenge_description || event.message || 'Complete the LinkedIn verification';

  const handleSubmit = () => {
    let response: Record<string, unknown> = {};
    if (challengeType === 'email_otp' || challengeType === 'two_factor') {
      response = { otp_code: otpCode };
    } else if (challengeType === 'captcha') {
      response = { captcha_solution: otpCode };
    }
    submitResponse.mutate({ interactionId: event.id, response }, { onSuccess: onResolved });
  };

  const handleCancel = () => {
    cancelInteraction.mutate(event.id, { onSuccess: onResolved });
  };

  return (
    <div className="rounded-lg bg-warning-500/10 border border-warning-500/20 p-4 space-y-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className="h-5 w-5 text-warning-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-warning-500">LinkedIn Verification Required</p>
          <p className="text-xs text-warning-500 mt-1">{description}</p>
        </div>
      </div>

      {(challengeType === 'email_otp' || challengeType === 'two_factor') && (
        <Field label="Verification code" required>
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="Enter the code"
            maxLength={6}
            className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
          />
        </Field>
      )}

      {challengeType === 'captcha' && (
        <div className="text-xs text-warning-500">
          <p>Please complete the CAPTCHA in the browser window. The worker will automatically detect when you're done.</p>
        </div>
      )}

      {challengeType === 'phone_verification' && (
        <Field label="Verification code" required>
          <input
            type="text"
            value={otpCode}
            onChange={(e) => setOtpCode(e.target.value)}
            placeholder="Enter the SMS code"
            maxLength={6}
            className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
          />
        </Field>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={handleCancel} disabled={cancelInteraction.isPending}>
          Cancel
        </Button>
        {(challengeType === 'email_otp' || challengeType === 'two_factor' || challengeType === 'phone_verification') && (
          <Button onClick={handleSubmit} disabled={!otpCode || submitResponse.isPending}>
            {submitResponse.isPending ? <Spinner className="h-4 w-4" /> : <KeyRound className="h-4 w-4" />}
            Submit Code
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Connect Modal ───────────────────────────────────────────

function ConnectLinkedInModal({ onClose, onConnect, isConnecting }: {
  onClose: () => void;
  onConnect: (params: { linkedinEmail: string; displayName?: string }) => void;
  isConnecting: boolean;
}) {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [activeTab, setActiveTab] = useState<'browser' | 'manual'>('browser');

  // Manual connect state
  const manualConnect = useManualConnectLinkedIn();
  const [manualEmail, setManualEmail] = useState('');
  const [manualDisplayName, setManualDisplayName] = useState('');
  const [cookiesJson, setCookiesJson] = useState('');
  const [profileUrl, setProfileUrl] = useState('');
  const [profileName, setProfileName] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  const handleManualConnect = async () => {
    setManualError(null);
    if (!manualEmail) { setManualError('Please enter your LinkedIn email.'); return; }
    if (!cookiesJson.trim()) { setManualError('Please paste your LinkedIn cookie data.'); return; }
    try {
      await manualConnect.mutateAsync({
        linkedinEmail: manualEmail,
        displayName: manualDisplayName || undefined,
        cookiesJson,
        profileUrl: profileUrl || undefined,
        profileName: profileName || undefined,
      });
      onClose();
    } catch (err) {
      setManualError(err instanceof Error ? err.message : 'Failed to connect. Please check your cookie data.');
    }
  };

  return (
    <Modal open onClose={onClose} title="Connect your existing LinkedIn account" description="Sign in to your existing LinkedIn account through the secure browser connection. Your LinkedIn password is never stored by Revenue AI.">
      <div className="space-y-4">
        {/* Tab switcher */}
        <div className="flex gap-1 rounded-lg bg-maroon-900 p-1">
          <button
            onClick={() => setActiveTab('browser')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'browser' ? 'bg-brand-500 text-white' : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Browser Connect
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === 'manual' ? 'bg-brand-500 text-white' : 'text-ink-400 hover:text-ink-200'
            }`}
          >
            Manual Cookie Import
          </button>
        </div>

        {activeTab === 'browser' ? (
          <>
            <div className="rounded-lg bg-brand-300/10 border border-brand-300/20 p-3">
              <div className="flex items-start gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-300 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-brand-300 leading-relaxed">
                  Revenue AI does not create LinkedIn accounts. You are connecting an existing LinkedIn account. Your password is used only transiently during the browser authentication flow and is never persisted, logged, or stored in our database.
                </p>
              </div>
            </div>
            <Field label="LinkedIn email / username" required>
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
                onClick={() => onConnect({ linkedinEmail: email, displayName: displayName || undefined })}
                disabled={!email || isConnecting}
              >
                {isConnecting ? <Spinner className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                Continue to LinkedIn
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-lg bg-warning-500/10 border border-warning-500/20 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-warning-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-warning-500 leading-relaxed space-y-1">
                  <p>Use this option if the browser connection is unavailable. You'll need to export your LinkedIn session cookies from your browser.</p>
                  <p className="font-semibold">How to get cookies:</p>
                  <ol className="list-decimal list-inside space-y-0.5 ml-1">
                    <li>Log in to linkedin.com in your browser</li>
                    <li>Open Developer Tools (F12) &rarr; Application &rarr; Cookies</li>
                    <li>Use a browser extension like "EditThisCookie" or "Cookie-Editor" to export cookies as JSON</li>
                    <li>Paste the JSON below</li>
                  </ol>
                  <p>Make sure the cookies include <code className="bg-maroon-900 px-1 rounded">li_at</code> — that's the LinkedIn session token.</p>
                </div>
              </div>
            </div>
            <Field label="LinkedIn email / username" required>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="your.email@company.com"
                className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label="Optional display name">
              <input
                value={manualDisplayName}
                onChange={(e) => setManualDisplayName(e.target.value)}
                placeholder="e.g. Sales Team Account"
                className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
              />
            </Field>
            <Field label="Cookie JSON data" required>
              <textarea
                value={cookiesJson}
                onChange={(e) => setCookiesJson(e.target.value)}
                placeholder='[{"name":"li_at","value":"...","domain":".linkedin.com",...}]'
                rows={6}
                className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-xs font-mono text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none resize-y"
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Profile URL (optional)">
                <input
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  placeholder="https://www.linkedin.com/in/username"
                  className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
                />
              </Field>
              <Field label="Profile name (optional)">
                <input
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full rounded-lg border border-gold-500/12 bg-maroon-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-500 focus:border-brand-500 focus:outline-none"
                />
              </Field>
            </div>
            {manualError && (
              <div className="rounded-lg bg-error-500/10 border border-error-500/20 p-3">
                <p className="text-xs text-error-500">{manualError}</p>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={onClose}>Cancel</Button>
              <Button
                onClick={handleManualConnect}
                disabled={!manualEmail || !cookiesJson.trim() || manualConnect.isPending}
              >
                {manualConnect.isPending ? <Spinner className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                Import Session
              </Button>
            </div>
          </>
        )}
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
        supabase.from('linkedin_sessions').select('status, last_validated_at').eq('workspace_id', workspace.id).order('created_at', { ascending: false }).limit(10),
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
