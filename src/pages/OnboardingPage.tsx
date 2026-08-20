import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Sparkles, ArrowRight, ArrowLeft, Check, CheckCircle2,
  Rocket, Globe, Linkedin, Mail, Calendar,
  Target, Zap, Loader2, TrendingUp,
  Users, Search, Activity, RefreshCw, FileText,
  MessageSquare, PartyPopper, Building2, Briefcase,
  DollarSign, Lightbulb, ShieldCheck, AlertCircle, XCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import {
  activationService,
  CAMPAIGN_GOALS,
  type BusinessProfile,
  type ICPRecommendation,
  type ActivationProgress,
} from '@/services/activation';
import { useConnectGoogle, useGoogleConnection } from '@/hooks/useGoogleAuth';
import { useAuthInteractions, useCancelAuthInteraction, useConnectLinkedIn, useLinkedInAccounts, useLinkedInConnectionAttempt, useLinkedInLoginAccess, useRecoverLinkedInAuthSurface } from '@/hooks/useLinkedInBrowser';
import { SecureLinkedInAuthModal } from '@/components/linkedin/SecureLinkedInAuthModal';
import { GOOGLE_SCOPES } from '@/types/google-auth';
import { cn } from '@/lib/utils';

type Step = 'welcome' | 'linkedin' | 'gmail' | 'calendar' | 'business' | 'icp' | 'review' | 'launch';

const stepOrder: Step[] = ['welcome', 'linkedin', 'business', 'icp', 'review', 'launch'];
const stepLabels = ['Welcome', 'LinkedIn', 'Your Business', 'Ideal Customer', 'AI Review', 'Launch'];

const RESEARCH_STAGES = [
  { label: 'Reading your website...', icon: Globe },
  { label: 'Understanding your business...', icon: Building2 },
  { label: 'Identifying your services...', icon: Briefcase },
  { label: 'Finding your competitors...', icon: Activity },
  { label: 'Understanding your customers...', icon: Users },
  { label: 'Generating customer profile...', icon: Target },
];

const GMAIL_SCOPES = [
  GOOGLE_SCOPES.OPENID,
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.GMAIL_READONLY,
  GOOGLE_SCOPES.GMAIL_SEND,
];

const CALENDAR_SCOPES = [
  GOOGLE_SCOPES.OPENID,
  GOOGLE_SCOPES.EMAIL,
  GOOGLE_SCOPES.PROFILE,
  GOOGLE_SCOPES.CALENDAR,
  GOOGLE_SCOPES.CALENDAR_EVENTS,
];

export function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useWorkspace();
  const [step, setStep] = useState<Step>('welcome');
  const [website, setWebsite] = useState('');
  const [businessDesc, setBusinessDesc] = useState('');
  const [icpDesc, setIcpDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true);
  const [activationPhase, setActivationPhase] = useState<'analysis' | 'icp'>('analysis');
  const [researchStage, setResearchStage] = useState(0);
  const [businessProfile, setBusinessProfile] = useState<BusinessProfile | null>(null);
  const [icps, setIcps] = useState<ICPRecommendation[]>([]);
  const [selectedIcp, setSelectedIcp] = useState<string | null>(null);
  const [goal] = useState('book_meetings');
  const [channels] = useState({ linkedin: true, email: true });
  const [progress, setProgress] = useState<ActivationProgress[]>([]);
  const [editing, setEditing] = useState<Record<string, string>>({});
  const [linkedinAccountId, setLinkedinAccountId] = useState<string | null>(null);
  const [linkedinQueueItemId, setLinkedinQueueItemId] = useState<string | null>(null);
  const linkedinCompletionHandledRef = useRef(false);
  const linkedinConnectionIntentRef = useRef<{ id: string; active: boolean } | null>(null);
  const creatingRef = useRef(false);
  const restorationRef = useRef<string | null>(null);

  // Handle Google OAuth callback redirects
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const googleConnected = params.get('google_connected');
    const googleError = params.get('google_error');

    if (googleConnected === 'true') {
      toast.success('Google account connected successfully.');
      googleConnection.refetch();
      // Clean the URL
      window.history.replaceState({}, '', '/onboarding');
    }
    if (googleError) {
      toast.error(`Google connection failed: ${googleError}`);
      window.history.replaceState({}, '', '/onboarding');
    }
  }, []);

  // Google connection state — verified from backend, never faked
  const connectGoogle = useConnectGoogle();
  const googleConnection = useGoogleConnection();
  const connectLinkedIn = useConnectLinkedIn();
  const linkedinAccounts = useLinkedInAccounts();
  const recoverLinkedinSurface = useRecoverLinkedInAuthSurface();
  const linkedinAuthInteractions = useAuthInteractions(linkedinAccountId);
  const linkedinAttempt = useLinkedInConnectionAttempt(linkedinQueueItemId);
  const cancelLinkedinAuth = useCancelAuthInteraction();
  const { workspace, loading: wsLoading } = useWorkspace();

  const linkedinAccount = linkedinAccountId
    ? linkedinAccounts.data?.find((account) => account.id === linkedinAccountId) ?? null
    : null;
  useEffect(() => {
    if (!linkedinAccountId && linkedinAccounts.data?.length) {
      setLinkedinAccountId(linkedinAccounts.data[linkedinAccounts.data.length - 1].id);
    }
  }, [linkedinAccountId, linkedinAccounts.data]);
  const linkedinConnected = linkedinAccount?.connection_state === 'connected'
    && linkedinAccount.session_status === 'connected'
    && linkedinAccount.status === 'active'
    && /^https:\/\/www\.linkedin\.com\/in\/[A-Za-z0-9_%.-]+\/?$/i.test(linkedinAccount.profile_url ?? '');
  const linkedinExpired = !!linkedinAccount && (
    ['session_expired', 'session_invalid', 'disconnected'].includes(linkedinAccount.connection_state)
    || linkedinAccount.session_status === 'expired'
    || linkedinAccount.status === 'expired'
    || (!!linkedinAccount.browser_connected_at
      && ['pending', 'authenticating', 'requires_action'].includes(linkedinAccount.connection_state)
      && Date.now() >= new Date(linkedinAccount.browser_connected_at).getTime() + 30 * 60 * 1000)
  );
  const linkedinFailed = !!linkedinAccount && (
    ['failed', 'restricted'].includes(linkedinAccount.connection_state)
    || linkedinAccount.status === 'restricted'
  );
  const activeLinkedinQueue = !!linkedinAttempt.data && ['pending', 'retry', 'running', 'waiting'].includes(linkedinAttempt.data.status);
  const linkedinWaiting = !!linkedinAccountId && !!linkedinQueueItemId && activeLinkedinQueue && !connectLinkedIn.isPending
    && !linkedinConnected && !linkedinExpired && !linkedinFailed;
  const currentLinkedinInteractions = linkedinAuthInteractions.data
    ?.filter((event) => event.queue_item_id === linkedinQueueItemId) ?? [];
  const linkedinChallenges = currentLinkedinInteractions
    ?.filter((event) => event.interaction_type === 'challenge' && event.status === 'pending') ?? [];
  const linkedinChallenge = linkedinChallenges[linkedinChallenges.length - 1] ?? null;
  const linkedinLoginAccess = useLinkedInLoginAccess(linkedinAccountId, linkedinQueueItemId,
    !!linkedinChallenge || currentLinkedinInteractions.some((event) => event.interaction_type === 'progress' && event.step === 'auth_required' && event.status === 'completed'));
  const latestLinkedinProgress = currentLinkedinInteractions
    ?.filter((event) => event.interaction_type === 'progress')
    .slice(-1)[0] ?? null;
  const linkedinIdentityVerified = currentLinkedinInteractions.some(
    (event) => event.interaction_type === 'progress' && event.step === 'identity_verified' && event.status === 'completed'
  ) ?? false;
  const linkedinSurfaceRecovering = latestLinkedinProgress?.step === 'recovering_auth_surface';
  const linkedinSurfaceFailed = latestLinkedinProgress?.step === 'connection_failed';
  const linkedinAuthRequired = currentLinkedinInteractions.some(
    (event) => event.interaction_type === 'progress' && event.step === 'auth_required' && event.status === 'completed'
  );
  const linkedinPersistentFastPath = currentLinkedinInteractions.some(
    (event) => event.interaction_type === 'progress' && event.step === 'existing_session_authenticated' && event.status === 'completed'
  );
  const linkedinProviderRechallenge = currentLinkedinInteractions.some(
    (event) => event.interaction_type === 'progress' && event.step === 'provider_rechallenge' && event.status === 'completed'
  );
  const linkedinVerifyingIdentity = latestLinkedinProgress?.step === 'verifying_authentication';
  const cancellableLinkedinInteraction = [...(linkedinAuthInteractions.data ?? [])].reverse().find((event) => event.queue_item_id) ?? null;

  useEffect(() => {
    if (linkedinAttempt.data && ['completed', 'failed', 'cancelled'].includes(linkedinAttempt.data.status)
      && linkedinConnectionIntentRef.current) {
      linkedinConnectionIntentRef.current.active = false;
    }
  }, [linkedinAttempt.data]);

  const googleConnected = googleConnection.data?.account?.status === 'connected' && !googleConnection.data.needsReconnect;
  const googleNeedsReconnect = googleConnection.data?.needsReconnect ?? false;

  // Derive Gmail and Calendar connection from the real Google account + scopes
  const grantedScopes = googleConnection.data?.token?.scope?.split(' ') ?? [];
  const gmailConnected = googleConnected && grantedScopes.includes(GOOGLE_SCOPES.GMAIL_SEND);
  const calendarConnected = googleConnected && grantedScopes.includes(GOOGLE_SCOPES.CALENDAR);

  useEffect(() => {
    if (wsLoading || !user) return;
    if (!workspace) {
      setRestoring(false);
      return;
    }
    if (workspace.onboarding_completed || workspace.onboarding_stage === 'completed') {
      navigate('/app', { replace: true });
      return;
    }
    if (restorationRef.current === workspace.id) return;
    restorationRef.current = workspace.id;
    let cancelled = false;
    const restore = async () => {
      try {
        const persisted = await activationService.loadPersistedOnboarding(workspace.id);
        if (cancelled) return;
        setWebsite(workspace.website ?? persisted.analysis?.website ?? '');
        if (persisted.analysis) setBusinessProfile(persisted.analysis);
        if (persisted.icps.length) {
          setIcps(persisted.icps);
          setSelectedIcp(persisted.icps[0].id);
        }
        if (persisted.campaignInitialized || workspace.onboarding_stage === 'setup_ready') {
          setStep('launch');
          return;
        }
        if (persisted.analysisStatus === 'completed' && persisted.analysis) {
          if (persisted.icps.length) {
            setStep(workspace.onboarding_stage === 'ai_review' ? 'review'
              : ['icp_ready', 'icp_generating', 'business_ready'].includes(workspace.onboarding_stage ?? '') ? 'icp' : 'icp');
            return;
          }
          setStep('icp');
          setLoading(true);
          setActivationPhase('icp');
          const generated = await activationService.generateICPs(workspace.id, persisted.analysis);
          if (!cancelled) { setIcps(generated); setSelectedIcp(generated[0]?.id ?? null); setStep('icp'); }
          return;
        }
        if (persisted.analysis && ['queued', 'processing'].includes(persisted.analysisStatus ?? '')) {
          setStep('business');
          setLoading(true);
          setActivationPhase('analysis');
          const profile = await activationService.runBusinessAnalysis(workspace.id, persisted.analysis.website);
          if (cancelled) return;
          setBusinessProfile(profile);
          setActivationPhase('icp');
          const generated = await activationService.generateICPs(workspace.id, profile);
          if (!cancelled) { setIcps(generated); setSelectedIcp(generated[0]?.id ?? null); setStep('icp'); }
          return;
        }
        if (!workspace.onboarding_welcome_completed) setStep('welcome');
        else setStep(linkedinConnected ? 'business' : 'linkedin');
      } catch (error) {
        restorationRef.current = null;
        if (!cancelled) toast.error(error instanceof Error ? error.message : 'Could not restore onboarding. Please retry.');
      } finally {
        if (!cancelled) { setLoading(false); setRestoring(false); }
      }
    };
    void restore();
    return () => { cancelled = true; };
  }, [linkedinConnected, navigate, user, workspace, wsLoading]);

  useEffect(() => {
    const unsub = activationService.subscribe(setProgress);
    return unsub;
  }, []);

  useEffect(() => {
    if (step !== 'linkedin' || !linkedinConnected || linkedinCompletionHandledRef.current) return;
    linkedinCompletionHandledRef.current = true;
    console.info('[linkedin-auth-timing]', { queueItemId: linkedinQueueItemId, stage: 'connected_state_observed', timestamp: new Date().toISOString() });
    console.info('[linkedin-queue-timing]', { queueItemId: linkedinQueueItemId, stage: 'Q4_frontend_connected_observed', timestamp: new Date().toISOString() });
    if (linkedinPersistentFastPath) console.info('[linkedin-persistent-timing]', { queueItemId: linkedinQueueItemId, stage: 'P9_frontend_connected_observed', timestamp: new Date().toISOString() });
    toast.success('LinkedIn connected successfully.');
    requestAnimationFrame(() => {
      console.info('[linkedin-auth-timing]', { queueItemId: linkedinQueueItemId, stage: 'success_ui_rendered', timestamp: new Date().toISOString() });
      if (linkedinPersistentFastPath) console.info('[linkedin-persistent-timing]', { queueItemId: linkedinQueueItemId, stage: 'P10_success_ui_rendered', timestamp: new Date().toISOString() });
    });
  }, [linkedinConnected, linkedinPersistentFastPath, linkedinQueueItemId, step]);

  // Animate research stages during business analysis
  useEffect(() => {
    if (loading && step === 'icp') {
      setResearchStage(0);
      const interval = setInterval(() => {
        setResearchStage((prev) => {
          if (prev >= RESEARCH_STAGES.length - 1) {
            clearInterval(interval);
            return prev;
          }
          return prev + 1;
        });
      }, 1200);
      return () => clearInterval(interval);
    }
  }, [loading, step]);

  const handleBusinessSubmit = async () => {
    if (!website.trim()) {
      toast.error('Please enter your company website.');
      return;
    }
    if (!user) {
      toast.error('Please sign in first.');
      navigate('/login');
      return;
    }

    setLoading(true);
    setActivationPhase('analysis');

    try {
      if (!creatingRef.current) {
        creatingRef.current = true;
        const workspaceId = await activationService.createWorkspaceFromWebsite({
          userId: user.id,
          website: website.trim(),
        });

        const profile = await activationService.runBusinessAnalysis(workspaceId, website.trim());
        setBusinessProfile(profile);

        setActivationPhase('icp');
        const generatedIcps = await activationService.generateICPs(workspaceId, profile);
        setIcps(generatedIcps);
        const primaryIcp = generatedIcps[0];
        if (primaryIcp) {
          setBusinessProfile({
            ...profile,
            decisionMakers: primaryIcp.jobTitles.join(', '),
            painPoints: primaryIcp.painPoints.join(', '),
            goals: primaryIcp.goals.join(', '),
          });
        }

        await refresh();
        setStep('icp');
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
      creatingRef.current = false;
    }
  };

  const handleLaunch = async () => {
    setLoading(true);

    try {
      const workspaceId = localStorage.getItem('revenueai_workspace_id');
      if (!workspaceId) throw new Error('No workspace found.');

      const icp = icps.find((i) => i.id === selectedIcp) ?? icps[0];
      if (!icp) throw new Error('Please select a customer type.');

      // Apply review edits to the business profile before launching
      const finalProfile = applyEdits(businessProfile, editing);

      const result = await activationService.initializeCampaign({
        workspaceId,
        icp,
        goal,
        channels,
        businessProfile: finalProfile ?? undefined,
        linkedinAccountId,
      });

      await activationService.completeActivation(workspaceId);
      await refresh();

      toast.success(result.status === 'ready' ? 'Campaign saved and ready to launch.' : result.message);
      setTimeout(() => navigate('/app'), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to launch.');
      setStep('review');
    } finally {
      setLoading(false);
    }
  };

  // Real Google OAuth connection — redirects to Google consent screen
  const handleConnectGoogle = useCallback(async (scopes: string[], label: string) => {
    if (!user) {
      toast.error('Please sign in first.');
      navigate('/login');
      return;
    }

    if (wsLoading) {
      toast.info('Still loading your workspace. Please try again in a moment.');
      return;
    }

    if (!workspace) {
      toast.error('No workspace found. Please complete the business details step first.');
      setStep('business');
      return;
    }

    try {
      localStorage.setItem('revenueai_onboarding_active', 'true');
      await connectGoogle.mutateAsync();
      toast.info(`Opening Google sign-in for ${label}...`);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to start ${label} connection.`;
      toast.error(message);
    }
  }, [connectGoogle, user, navigate, workspace, wsLoading]);

  const handleReconnectGoogle = useCallback(async () => {
    try {
      await connectGoogle.mutateAsync();
      toast.info('Opening Google sign-in to reconnect...');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reconnect.');
    }
  }, [connectGoogle]);

  const canProceed = () => {
    if (step === 'business') return website.trim().length > 0;
    if (step === 'icp') return true;
    return true;
  };

  const advanceToLinkedIn = async () => {
    if (workspace) await activationService.markOnboardingStage(workspace.id, 'linkedin', { onboarding_welcome_completed: true });
    setStep('linkedin');
  };

  const advanceToBusiness = async () => {
    if (workspace) await activationService.markOnboardingStage(workspace.id, 'business_input');
    setStep('business');
  };

  const advanceToReview = async () => {
    if (workspace) await activationService.markOnboardingStage(workspace.id, 'ai_review');
    setStep('review');
  };

  const goNext = () => {
    const idx = stepOrder.indexOf(step);
    if (idx < stepOrder.length - 1) {
      if (step === 'business') {
        handleBusinessSubmit();
      } else if (step === 'linkedin') {
        void advanceToBusiness();
      } else {
        setStep(stepOrder[idx + 1]);
      }
    }
  };

  const goBack = () => {
    const idx = stepOrder.indexOf(step);
    if (idx > 0) setStep(stepOrder[idx - 1]);
  };

  if (restoring) return <div className="min-h-screen bg-maroon-950 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-gold-400" /></div>;

  return (
    <div className="min-h-screen bg-maroon-950 flex flex-col">
      {/* Header with progress */}
      <header className="flex items-center justify-between px-6 h-16 border-b border-gold-500/12 bg-maroon-900 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-r from-gold-400 to-gold-300 shadow-lg">
            <Sparkles className="h-4.5 w-4.5 text-ink-50" />
          </div>
          <span className="text-sm font-semibold text-ink-50">Yuktris</span>
        </div>

        {/* Progress indicator */}
        {step !== 'welcome' && (
          <div className="flex items-center gap-2">
            {stepLabels.map((label, i) => {
              const stepIdx = stepOrder.indexOf(step);
              const isPast = i < stepIdx;
              const isCurrent = i === stepIdx;
              return (
                <div key={label} className="flex items-center gap-2">
                  <div className={cn(
                    'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-300',
                    isPast && 'bg-success-500/10 text-success-500 border border-success-500/20',
                    isCurrent && 'bg-gradient-to-r from-gold-400 to-gold-300/15 text-brand-300 border border-brand-500/30',
                    !isPast && !isCurrent && 'bg-card-900 text-ink-400 border border-gold-500/12'
                  )}>
                    {isPast ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <span className={cn('h-5 w-5 flex items-center justify-center rounded-full text-[10px] font-bold', isCurrent ? 'bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950' : 'bg-border text-ink-500')}>
                        {i + 1}
                      </span>
                    )}
                    <span className="hidden sm:inline">{label}</span>
                  </div>
                  {i < stepLabels.length - 1 && <div className={cn('h-px w-4 sm:w-6', isPast ? 'bg-success-500/30' : 'bg-border')} />}
                </div>
              );
            })}
          </div>
        )}

        <button
          onClick={async () => {
            if (localStorage.getItem('revenueai_workspace_id')) {
              await refresh();
              navigate('/app');
            } else {
              navigate('/');
            }
          }}
          className="text-xs text-ink-500 hover:text-ink-200 transition-colors"
        >
          Skip →
        </button>
      </header>

      <div className="flex-1 flex items-center justify-center p-6 overflow-y-auto">
        <div className="w-full max-w-2xl animate-fade-in-up" key={step}>

          {/* STEP 1: WELCOME */}
          {step === 'welcome' && (
            <div className="text-center space-y-8">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-gold-400 to-gold-300 shadow-lg mx-auto animate-float">
                <Sparkles className="h-10 w-10 text-ink-50" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-ink-50 tracking-tight">Welcome to Yuktris</h1>
                <p className="text-lg text-ink-500 mt-4 max-w-lg mx-auto leading-relaxed">
                  Hire an AI sales team that finds prospects, sends outreach, handles replies, and books meetings — all on autopilot.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: Target, label: 'Find Prospects' },
                  { icon: MessageSquare, label: 'Send Outreach' },
                  { icon: Calendar, label: 'Book Meetings' },
                ].map((item) => (
                  <div key={item.label} className="flex flex-col items-center gap-2 rounded-xl border border-gold-500/12 bg-maroon-900 p-4">
                    <item.icon className="h-5 w-5 text-brand-300" />
                    <span className="text-xs text-ink-500">{item.label}</span>
                  </div>
                ))}
              </div>
              <Button variant="glow" size="xl" onClick={() => void advanceToLinkedIn()}>
                Get Started <ArrowRight className="h-4 w-4" />
              </Button>
              <p className="text-sm text-ink-400">Takes 3 minutes · No credit card required</p>
            </div>
          )}

          {/* STEP 2: LINKEDIN — Real browser-based connection */}
          {step === 'linkedin' && (
            <><GoogleConnectStep
              icon={Linkedin}
              iconColor="text-[#0A66C2]"
              iconBg="bg-[#0A66C2]/10"
              title="Connect your LinkedIn account"
              description="Sign in to LinkedIn once in a secure browser. Yuktris never sees or stores your password or verification codes."
              benefits={[
                'Find decision-makers at target companies',
                'Send personalized connection requests',
                'Follow up with prospects automatically',
                'Track who accepts and replies',
              ]}
              connected={linkedinConnected}
              needsReconnect={linkedinExpired}
              connecting={connectLinkedIn.isPending}
              waiting={linkedinWaiting}
              loginUrl={linkedinLoginAccess.data?.loginUrl ?? null}
              securityCheckRequired={!!linkedinChallenge && linkedinAccount?.connection_state === 'requires_action'}
              verifyingIdentity={linkedinVerifyingIdentity}
              waitingMessage={latestLinkedinProgress?.step === 'verifying_authentication' ? 'Verifying LinkedIn session...'
                : linkedinAuthRequired ? 'Sign in to LinkedIn once in the secure browser.'
                : latestLinkedinProgress?.step === 'opening_linkedin' ? 'Opening LinkedIn...'
                : latestLinkedinProgress?.step === 'checking_existing_session' ? 'Checking the persistent LinkedIn session...'
                : 'Starting Cloud LinkedIn Agent...'}
              error={connectLinkedIn.error
                ? 'Failed to start LinkedIn connection. Please try again.'
                : linkedinQueueItemId && linkedinAttempt.isFetched && !linkedinAttempt.data
                  ? 'Unable to confirm an active LinkedIn connection attempt. Please try again.'
                : linkedinAttempt.data && ['failed', 'cancelled'].includes(linkedinAttempt.data.status)
                  ? (linkedinAttempt.data.error || `LinkedIn connection attempt ${linkedinAttempt.data.status}. Please try again.`)
                : linkedinFailed ? (linkedinAccount?.last_error || 'LinkedIn authentication failed. Please try again.') : null}
              onConnect={() => {
                console.info('[linkedin-queue-timing]', { stage: 'Q0_connect_clicked', timestamp: new Date().toISOString() });
                if (!workspace) {
                  toast.error('No workspace found. Please complete the business details step first.');
                  setStep('business');
                  return;
                }
                if (linkedinConnectionIntentRef.current?.active || connectLinkedIn.isPending || activeLinkedinQueue) {
                  toast.info('This LinkedIn connection is already in progress.');
                  return;
                }
                const operationId = crypto.randomUUID();
                linkedinConnectionIntentRef.current = { id: operationId, active: true };
                connectLinkedIn.mutate(
                  { existingAccountId: linkedinAccountId ?? undefined, operationId },
                  {
                    onSuccess: ({ accountId, queueItemId }) => {
                      linkedinCompletionHandledRef.current = false;
                      setLinkedinAccountId(accountId);
                      setLinkedinQueueItemId(queueItemId);
                      toast.info('Opening your secure LinkedIn session...');
                    },
                    onError: (err) => {
                      if (linkedinConnectionIntentRef.current?.id === operationId) linkedinConnectionIntentRef.current.active = false;
                      toast.error(err instanceof Error ? err.message : 'Failed to connect LinkedIn.');
                    },
                  }
                );
              }}
              onReconnect={() => {
                console.info('[linkedin-queue-timing]', { stage: 'Q0_connect_clicked', reconnect: true, timestamp: new Date().toISOString() });
                linkedinCompletionHandledRef.current = false;
                if (!linkedinAccountId) return;
                if (linkedinConnectionIntentRef.current?.active || connectLinkedIn.isPending || activeLinkedinQueue) {
                  toast.info('This LinkedIn connection is already in progress.');
                  return;
                }
                const operationId = crypto.randomUUID();
                linkedinConnectionIntentRef.current = { id: operationId, active: true };
                connectLinkedIn.mutate(
                  { existingAccountId: linkedinAccountId, operationId },
                  {
                    onSuccess: ({ accountId, queueItemId }) => {
                      setLinkedinAccountId(accountId);
                      setLinkedinQueueItemId(queueItemId);
                    },
                    onError: (err) => {
                      if (linkedinConnectionIntentRef.current?.id === operationId) linkedinConnectionIntentRef.current.active = false;
                      toast.error(err instanceof Error ? err.message : 'Failed to reconnect LinkedIn.');
                    },
                  }
                );
              }}
              onBack={goBack}
              onNext={goNext}
            />
            <SecureLinkedInAuthModal
              open={!!linkedinAccountId && !linkedinConnected && !linkedinFailed && !linkedinExpired && activeLinkedinQueue && linkedinAuthRequired}
              loginUrl={linkedinLoginAccess.data?.loginUrl ?? null}
              identityVerified={linkedinIdentityVerified}
              queueItemId={linkedinQueueItemId}
              repeatedSecurityChecks={linkedinProviderRechallenge}
              securityCheckRequired={!!linkedinChallenge && linkedinAccount?.connection_state === 'requires_action'}
              recovering={linkedinSurfaceRecovering || recoverLinkedinSurface.isPending}
              connectionFailed={linkedinSurfaceFailed}
              onRecover={() => {
                if (linkedinAccountId && linkedinQueueItemId) recoverLinkedinSurface.mutate({ accountId: linkedinAccountId, queueItemId: linkedinQueueItemId });
              }}
              onCancel={() => {
                if (cancellableLinkedinInteraction) cancelLinkedinAuth.mutate(cancellableLinkedinInteraction);
                setLinkedinAccountId(null);
                setLinkedinQueueItemId(null);
              }}
            /></>
          )}

          {/* STEP 3: GMAIL — Real Google OAuth */}
          {step === 'gmail' && (
            <GoogleConnectStep
              icon={Mail}
              iconColor="text-error-400"
              iconBg="bg-error-500/10"
              title="Connect your Gmail account"
              description="Your AI sales team uses email to send personalized outreach sequences and track replies — automatically."
              benefits={[
                'Send personalized cold emails',
                'Automated follow-up sequences',
                'Track opens, clicks, and replies',
                'Full inbox management',
              ]}
              connected={gmailConnected}
              needsReconnect={googleNeedsReconnect && !gmailConnected}
              connecting={connectGoogle.isPending}
              error={connectGoogle.error ? 'Google authentication failed. Please try again.' : null}
              onConnect={() => handleConnectGoogle(GMAIL_SCOPES, 'Gmail')}
              onReconnect={handleReconnectGoogle}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {/* STEP 4: CALENDAR — Real Google OAuth */}
          {step === 'calendar' && (
            <GoogleConnectStep
              icon={Calendar}
              iconColor="text-brand-300"
              iconBg="bg-brand-300/10"
              title="Connect your calendar"
              description="Your AI sales team books meetings directly on your calendar — no back-and-forth scheduling."
              benefits={[
                'AI schedules meetings automatically',
                'Sends calendar invites to prospects',
                'Sends reminders before meetings',
                'Prepares a briefing for each meeting',
              ]}
              connected={calendarConnected}
              needsReconnect={googleNeedsReconnect && !calendarConnected}
              connecting={connectGoogle.isPending}
              error={connectGoogle.error ? 'Google authentication failed. Please try again.' : null}
              onConnect={() => handleConnectGoogle(CALENDAR_SCOPES, 'Calendar')}
              onReconnect={handleReconnectGoogle}
              onBack={goBack}
              onNext={goNext}
            />
          )}

          {/* STEP 5: BUSINESS */}
          {step === 'business' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-300/10 border border-brand-300/20 mx-auto mb-4">
                  <Building2 className="h-7 w-7 text-brand-300" />
                </div>
                <h2 className="text-2xl font-bold text-ink-50 tracking-tight">Tell us about your business</h2>
                <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto leading-relaxed">
                  Enter your company website. Your AI sales team will learn everything about your business automatically.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-ink-200">Company Website</Label>
                  <div className="relative mt-2">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
                    <Input
                      value={website}
                      onChange={(e) => setWebsite(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !loading && canProceed() && goNext()}
                      placeholder="acmeagency.com"
                      className="pl-10 h-12 text-base"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-ink-500 mt-1.5">Just your website. We'll figure out the rest.</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-ink-200">What does your business do? <span className="text-ink-400">(optional)</span></Label>
                  <Textarea
                    value={businessDesc}
                    onChange={(e) => setBusinessDesc(e.target.value)}
                    placeholder="We help SaaS companies increase their conversion rates through AI-powered sales automation..."
                    className="mt-2 min-h-[100px] text-base"
                  />
                  <p className="text-xs text-ink-500 mt-1.5">The more you tell us, the better your AI sales team performs.</p>
                </div>
              </div>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button variant="glow" size="lg" onClick={goNext} loading={loading} disabled={loading || !canProceed()}>
                  {loading ? (activationPhase === 'analysis' ? 'Analyzing your business...' : 'Building your ideal customer profile...') : 'Continue'}
                  {!loading && <ArrowRight className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* STEP 6: ICP */}
          {step === 'icp' && (
            <div className="space-y-6">
              {loading && (
                <div className="text-center space-y-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-300/10 border border-brand-300/20 mx-auto">
                    <Loader2 className="h-7 w-7 text-brand-300 animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-ink-50">Analyzing your business...</h2>
                    <p className="text-sm text-ink-500 mt-1">This takes about 30 seconds.</p>
                  </div>
                  <Card className="p-5 max-w-md mx-auto">
                    <div className="space-y-2.5">
                      {RESEARCH_STAGES.map((stage, i) => {
                        const StageIcon = stage.icon;
                        return (
                          <div key={i} className={cn(
                            'flex items-center gap-2.5 text-sm transition-all duration-300',
                            i < researchStage && 'text-ink-500',
                            i === researchStage && 'text-ink-100',
                            i > researchStage && 'text-ink-300'
                          )}>
                            {i < researchStage ? <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" /> :
                             i === researchStage ? <Loader2 className="h-4 w-4 text-brand-300 animate-spin shrink-0" /> :
                             <div className="h-4 w-4 rounded-full border border-gold-500/12 shrink-0" />}
                            <StageIcon className={cn('h-3.5 w-3.5', i <= researchStage ? 'text-ink-500' : 'text-ink-300')} />
                            <span>{stage.label}</span>
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                </div>
              )}

              {!loading && icps.length > 0 && (
                <>
                  <div className="text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-300/10 border border-brand-300/20 mx-auto mb-4">
                      <Target className="h-7 w-7 text-brand-300" />
                    </div>
                    <h2 className="text-2xl font-bold text-ink-50 tracking-tight">Describe your ideal customer</h2>
                    <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto leading-relaxed">
                      We found {icps.length} customer types for your business. Pick the one that fits best — your AI sales team will target them automatically.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {icps.map((icp) => (
                      <button
                        key={icp.id}
                        onClick={() => setSelectedIcp(icp.id)}
                        className={cn(
                          'w-full text-left rounded-xl border p-5 transition-all duration-200',
                          (selectedIcp ?? icps[0]?.id) === icp.id
                            ? 'border-brand-300 bg-brand-300/10 shadow-lg'
                            : 'border-gold-500/12 bg-maroon-900 hover:border-gold-500/25'
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className={cn(
                            'flex h-5 w-5 items-center justify-center rounded-full border-2 shrink-0 mt-0.5 transition-colors',
                            (selectedIcp ?? icps[0]?.id) === icp.id ? 'bg-gradient-to-r from-gold-400 to-gold-300 border-brand-600' : 'border-gold-500/12'
                          )}>
                            {(selectedIcp ?? icps[0]?.id) === icp.id && <Check className="h-3 w-3 text-ink-50" />}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-ink-50">{icp.name}</p>
                              {icp.recommended && <Badge tone="brand">Recommended</Badge>}
                              <Badge tone={icp.difficulty === 'Easy' ? 'success' : icp.difficulty === 'Medium' ? 'warning' : 'error'}>
                                {icp.difficulty}
                              </Badge>
                            </div>
                            <p className="text-sm text-ink-500 mt-1.5 leading-relaxed">{icp.description}</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                              <ICPMetric label="Market Size" value={icp.estimatedTam} />
                              <ICPMetric label="Reply Rate" value={icp.estimatedReplyRate} />
                              <ICPMetric label="Meeting Rate" value={icp.estimatedMeetingRate} />
                              <ICPMetric label="Confidence" value={`${icp.confidence}%`} />
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div>
                    <Label className="text-sm font-medium text-ink-200">Anything else about your ideal customer? <span className="text-ink-400">(optional)</span></Label>
                    <Textarea
                      value={icpDesc}
                      onChange={(e) => setIcpDesc(e.target.value)}
                      placeholder="e.g. We prefer companies in North America with 50-500 employees..."
                      className="mt-2 min-h-[80px] text-base"
                    />
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
                    <Button variant="glow" size="lg" onClick={() => void advanceToReview()}>
                      Continue <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              )}

              {!loading && icps.length === 0 && (
                <div className="text-center space-y-4">
                  <p className="text-sm text-ink-500">No customer profiles generated yet. Please go back and enter your website.</p>
                  <Button variant="outline" onClick={() => setStep('business')}><ArrowLeft className="h-4 w-4" /> Back to Business</Button>
                </div>
              )}
            </div>
          )}

          {/* STEP 7: REVIEW AI UNDERSTANDING */}
          {step === 'review' && businessProfile && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-success-500/10 border border-success-500/20 mx-auto mb-4">
                  <CheckCircle2 className="h-7 w-7 text-success-500" />
                </div>
                <h2 className="text-2xl font-bold text-ink-50 tracking-tight">Here's what we understand about your business</h2>
                <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto leading-relaxed">
                  We analyzed your website and built a profile. Edit anything that's wrong — your AI sales team will use this to find the right prospects.
                </p>
              </div>

              <Card className="p-6 space-y-5">
                <ReviewField icon={Building2} label="Company Name" value={editing.name ?? businessProfile.name} onEdit={(v) => setEditing({ ...editing, name: v })} />
                <ReviewField icon={Briefcase} label="Industry" value={editing.industry ?? businessProfile.industry} onEdit={(v) => setEditing({ ...editing, industry: v })} />
                <ReviewField icon={Target} label="Target Market" value={editing.targetCustomers ?? businessProfile.targetCustomers} onEdit={(v) => setEditing({ ...editing, targetCustomers: v })} />
                <ReviewField icon={Users} label="Decision Makers" value={editing.decisionMakers ?? businessProfile.decisionMakers ?? ''} onEdit={(v) => setEditing({ ...editing, decisionMakers: v })} />
                <ReviewField icon={Lightbulb} label="Pain Points" value={editing.painPoints ?? businessProfile.painPoints ?? ''} onEdit={(v) => setEditing({ ...editing, painPoints: v })} />
                <ReviewField icon={TrendingUp} label="Goals" value={editing.goals ?? businessProfile.goals ?? ''} onEdit={(v) => setEditing({ ...editing, goals: v })} />
                <ReviewField icon={DollarSign} label="Pricing Model" value={editing.pricingModel ?? businessProfile.pricingModel} onEdit={(v) => setEditing({ ...editing, pricingModel: v })} />
                <ReviewField icon={Activity} label="Services" value={editing.services ?? businessProfile.services.join(', ')} onEdit={(v) => setEditing({ ...editing, services: v })} />
                {businessProfile.competitors.length > 0 && (
                  <ReviewField icon={ShieldCheck} label="Competitors" value={editing.competitors ?? businessProfile.competitors.join(', ')} onEdit={(v) => setEditing({ ...editing, competitors: v })} />
                )}
              </Card>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button variant="glow" size="lg" onClick={() => setStep('launch')}>
                  Looks Good <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* STEP 8: LAUNCH */}
          {step === 'launch' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-r from-gold-400 to-gold-300 shadow-lg mx-auto animate-float">
                  <Rocket className="h-10 w-10 text-ink-50" />
                </div>
                <h2 className="text-3xl font-bold text-ink-50 tracking-tight mt-6">Review your setup</h2>
                <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto leading-relaxed">
                  Save this configuration now. Outreach starts only after you explicitly launch from Campaigns and all connections are ready.
                </p>
              </div>

              <Card className="p-6">
                <div className="space-y-2 mb-5">
                  <PlanRow label="Target Customer" value={icps.find((i) => i.id === selectedIcp)?.name ?? icps[0]?.name ?? '—'} />
                  <PlanRow label="Goal" value={CAMPAIGN_GOALS.find((g) => g.id === goal)?.label ?? goal} />
                  <PlanRow label="Channels" value={[channels.linkedin ? 'LinkedIn' : null, channels.email ? 'Email' : null].filter(Boolean).join(' + ') || 'None selected'} />
                  <PlanRow label="Connections" value={[
                    gmailConnected ? 'Gmail' : null,
                    calendarConnected ? 'Calendar' : null,
                  ].filter(Boolean).join(', ') || 'None connected'} />
                </div>

                <div className="border-t border-gold-500/8 pt-4">
                  <p className="text-xs font-semibold text-ink-200 mb-3">Your AI sales team will:</p>
                  <div className="space-y-2.5">
                    {[
                      { icon: Search, text: 'Find companies matching your ideal customer profile' },
                      { icon: Users, text: 'Identify decision-makers at each company' },
                      { icon: MessageSquare, text: 'Write personalized messages for each person' },
                      { icon: Mail, text: 'Send connection requests and outreach automatically' },
                      { icon: RefreshCw, text: 'Follow up at the right time, every time' },
                      { icon: MessageSquare, text: 'Handle replies and objections' },
                      { icon: Calendar, text: 'Book meetings directly to your calendar' },
                      { icon: FileText, text: 'Prepare a briefing for each meeting' },
                      { icon: CheckCircle2, text: 'Only notify you when something needs your attention' },
                    ].map((item, i) => {
                      const Icon = item.icon;
                      return (
                        <div key={i} className="flex items-center gap-2.5 text-sm text-ink-500 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                          <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
                          <Icon className="h-4 w-4 text-brand-300 shrink-0" />
                          <span>{item.text}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </Card>

              <div className="flex justify-between pt-2">
                <Button variant="ghost" onClick={goBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
                <Button variant="glow" size="xl" onClick={handleLaunch} loading={loading}>
                  <Rocket className="h-5 w-5" />
                  Save &amp; Finish Setup
                </Button>
              </div>

              {/* Celebration overlay during launch */}
              {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/90 backdrop-blur-md animate-fade-in">
                  <div className="text-center space-y-6">
                    <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-success-500 shadow-lg mx-auto animate-float">
                      <PartyPopper className="h-12 w-12 text-ink-50" />
                    </div>
                    <div>
                      <h2 className="text-3xl font-bold text-ink-50">Saving your campaign setup</h2>
                      <p className="text-sm text-ink-500 mt-2">No outreach will be sent during onboarding.</p>
                    </div>
                    <div className="max-w-md mx-auto space-y-2">
                      {progress.map((p, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-sm animate-fade-in" style={{ animationDelay: `${i * 0.1}s` }}>
                          {p.completed ? <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" /> : <Loader2 className="h-4 w-4 text-brand-300 animate-spin shrink-0" />}
                          <span className={cn(p.completed ? 'text-ink-500' : 'text-ink-100')}>{p.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// GoogleConnectStep — Real OAuth verification
// ============================================================

function GoogleConnectStep({ icon: Icon, iconColor, iconBg, title, description, benefits, connected, needsReconnect, connecting, waiting = false, waitingMessage, loginUrl, securityCheckRequired = false, verifyingIdentity = false, error, onConnect, onReconnect, onBack, onNext }: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  benefits: string[];
  connected: boolean;
  needsReconnect: boolean;
  connecting: boolean;
  waiting?: boolean;
  waitingMessage?: string;
  loginUrl?: string | null;
  securityCheckRequired?: boolean;
  verifyingIdentity?: boolean;
  error: string | null;
  onConnect: () => void;
  onReconnect: () => void;
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4', iconBg)}>
          <Icon className={cn('h-8 w-8', iconColor)} />
        </div>
        <h2 className="text-2xl font-bold text-ink-50 tracking-tight">{title}</h2>
        <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto leading-relaxed">{description}</p>
      </div>

      <Card className="p-6">
        <div className="space-y-3">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-ink-200">
              <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </Card>

      {connected && !needsReconnect && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-success-500/20 bg-success-500/10 p-4">
          <CheckCircle2 className="h-5 w-5 text-success-500" />
          <span className="text-sm font-medium text-success-500">Connected successfully</span>
        </div>
      )}

      {needsReconnect && !connected && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-warning-500/20 bg-warning-500/10 p-4">
            <AlertCircle className="h-5 w-5 text-warning-500" />
            <span className="text-sm font-medium text-warning-500">Connection expired. Please reconnect.</span>
          </div>
          <div className="flex justify-center">
            <Button variant="glow" size="lg" onClick={onReconnect} loading={connecting}>
              <RefreshCw className="h-4 w-4" />
              Reconnect
            </Button>
          </div>
        </div>
      )}

      {waiting && !connected && !needsReconnect && !error && (
        <div className="space-y-3 rounded-xl border border-brand-500/20 bg-brand-500/10 p-4">
          <div className="flex items-center justify-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-brand-400" />
            <div>
              <p className="text-sm font-medium text-brand-300">
                {securityCheckRequired ? 'LinkedIn security verification required' : verifyingIdentity ? 'Verifying LinkedIn identity' : loginUrl ? 'LinkedIn sign-in ready' : 'Starting Cloud LinkedIn Agent...'}
              </p>
              <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-400">
                {securityCheckRequired
                  ? 'LinkedIn needs an additional security check. Complete it directly in the same secure browser and keep it open; Yuktris remains passive and never collects verification codes.'
                  : loginUrl ? 'Sign in directly to LinkedIn in the secure browser. Yuktris never sees or stores your LinkedIn password.' : waitingMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      {error && !connected && !needsReconnect && (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 rounded-xl border border-error-500/20 bg-error-500/10 p-4">
            <XCircle className="h-5 w-5 text-error-500" />
            <span className="text-sm font-medium text-error-500">{error}</span>
          </div>
          <div className="flex justify-center">
            <Button variant="glow" size="lg" onClick={onConnect} loading={connecting}>
              <Zap className="h-4 w-4" />
              Try Again
            </Button>
          </div>
        </div>
      )}

      {!connected && !needsReconnect && !waiting && !error && (
        <div className="flex justify-center">
          <Button variant="glow" size="lg" onClick={onConnect} loading={connecting}>
            <Zap className="h-4 w-4" />
            Connect {title.replace('Connect your ', '').replace(' account', '')}
          </Button>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button variant={connected ? 'glow' : 'outline'} size="lg" onClick={onNext}>
          {connected ? 'Continue' : 'Skip for now'} <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// ComingSoonStep — Honest "not available yet" for integrations
// without real OAuth (LinkedIn)
// ============================================================

function _ComingSoonStep({ icon: Icon, iconColor, iconBg, title, description, benefits, onBack, onNext }: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  benefits: string[];
  onBack: () => void;
  onNext: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl mx-auto mb-4', iconBg)}>
          <Icon className={cn('h-8 w-8', iconColor)} />
        </div>
        <h2 className="text-2xl font-bold text-ink-50 tracking-tight">{title}</h2>
        <p className="text-sm text-ink-500 mt-2 max-w-md mx-auto leading-relaxed">{description}</p>
      </div>

      <Card className="p-6">
        <div className="space-y-3">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-ink-200">
              <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />
              <span>{benefit}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex items-center justify-center gap-2 rounded-xl border border-gold-500/12 bg-card-900 p-4">
        <AlertCircle className="h-5 w-5 text-ink-500" />
        <span className="text-sm font-medium text-ink-600">
          LinkedIn integration is coming soon. You can skip this step and connect later from Settings.
        </span>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4" /> Back</Button>
        <Button variant="outline" size="lg" onClick={onNext}>
          Skip for now <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function applyEdits(profile: BusinessProfile | null, edits: Record<string, string>): BusinessProfile | null {
  if (!profile) return profile;
  return {
    ...profile,
    name: edits.name ?? profile.name,
    industry: edits.industry ?? profile.industry,
    targetCustomers: edits.targetCustomers ?? profile.targetCustomers,
    decisionMakers: edits.decisionMakers ?? profile.decisionMakers,
    painPoints: edits.painPoints ?? profile.painPoints,
    goals: edits.goals ?? profile.goals,
    pricingModel: edits.pricingModel ?? profile.pricingModel,
    services: edits.services ? edits.services.split(',').map((s) => s.trim()).filter(Boolean) : profile.services,
    competitors: edits.competitors ? edits.competitors.split(',').map((s) => s.trim()).filter(Boolean) : profile.competitors,
  };
}

function ICPMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-card-900 px-3 py-2">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="text-sm font-medium text-ink-100 mt-0.5">{value}</p>
    </div>
  );
}

function ReviewField({ icon: Icon, label, value, onEdit }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onEdit: (v: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  return (
    <div className="flex items-start gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-900 text-ink-500 shrink-0 mt-0.5">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink-500 font-medium">{label}</p>
        {isEditing ? (
          <Input
            value={localValue}
            onChange={(e) => setLocalValue(e.target.value)}
            onBlur={() => { setIsEditing(false); onEdit(localValue); }}
            onKeyDown={(e) => e.key === 'Enter' && (() => { setIsEditing(false); onEdit(localValue); })()}
            className="mt-1 h-9 text-sm"
            autoFocus
          />
        ) : (
          <p className="text-sm text-ink-100 mt-1 leading-relaxed">{value || '—'}</p>
        )}
      </div>
      <button
        onClick={() => { setLocalValue(value); setIsEditing(!isEditing); if (isEditing) onEdit(localValue); }}
        className="text-xs text-brand-300 hover:text-brand-300 transition-colors shrink-0 mt-1"
      >
        {isEditing ? 'Save' : 'Edit'}
      </button>
    </div>
  );
}

function PlanRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink-500">{label}</span>
      <span className="text-sm font-medium text-ink-100">{value}</span>
    </div>
  );
}
