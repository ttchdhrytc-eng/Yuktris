import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Pause, Play, Plus, Rocket, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useICP } from '@/hooks/useICPIntelligence';
import { useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';
import { supabase } from '@/lib/supabase';
import { isLinkedInOutboundEnabled } from '@/lib/linkedinExecutionMode';
import type { FullICP } from '@/types/icp-intelligence';
import { fetchCampaignMetrics } from '@/services/campaign-reporting';
import { fetchCampaignProspects } from '@/services/campaign-prospects';
import { CAMPAIGN_SENDING_DAYS, CAMPAIGN_WEEKDAYS, detectBrowserIanaTimezone, formatCampaignWindow, isIanaTimezone, nextCampaignSendingWindow, normalizeIanaTimezone, parseCampaignDays, parseCampaignHours, resolveNewCampaignTimezone } from '@/services/campaign-schedule';
import { readCampaignUiState, writeCampaignUiState, type PersistedScheduleDraft } from '@/services/campaign-ui-state';

const STEPS = ['Campaign', 'ICP', 'LinkedIn account', 'Outreach', 'Limits & Schedule', 'Review & Launch'];
const SENDING_DAYS = CAMPAIGN_SENDING_DAYS;
const WEEKDAYS = CAMPAIGN_WEEKDAYS;
const TIMEZONE_SUGGESTIONS = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];
type ScheduleDraft = PersistedScheduleDraft;
type DiscoveryPreview = { company_name: string; company_website: string; contact_name: string; contact_title: string; linkedin_url: string; evidence: string; company_fit: string; person_fit: string; confidence_score: number };
type AcceptanceGeneration = {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: string;
  relationship_queue_id: string | null;
  write_job_id: string | null;
  relationship_evidence: Record<string, unknown>;
  created_at: string;
  probeStatus: string | null;
};

export function CampaignsPage() {
  const { workspace, members } = useWorkspace();
  const { user } = useAuth();
  const icps = useICP();
  const accounts = useLinkedInAccounts();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [icpId, setIcpId] = useState('');
  const [accountId, setAccountId] = useState('');
  const [strategy, setStrategy] = useState('Start with a concise, personalized connection request. After acceptance, send a value-led first message and up to two respectful follow-ups.');
  const [dailyLimit, setDailyLimit] = useState(10);
  const [days, setDays] = useState<string[]>(WEEKDAYS);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [outreachTimezone, setOutreachTimezone] = useState(() => detectBrowserIanaTimezone());
  const [launching, setLaunching] = useState(false);
  const restoredUi = useMemo(() => readCampaignUiState(workspace?.id), [workspace?.id]);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(() => restoredUi.expandedCampaign);
  const [existingProspectId, setExistingProspectId] = useState('');
  const [associating, setAssociating] = useState(false);
  const [acceptanceConfirmation, setAcceptanceConfirmation] = useState<{ campaignId: string; contactId: string } | null>(null);
  const [preparingAcceptance, setPreparingAcceptance] = useState(false);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(() => restoredUi.scheduleDraft);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [discoveryPreview, setDiscoveryPreview] = useState<DiscoveryPreview[]>([]);
  const [selectedProspectUrls, setSelectedProspectUrls] = useState<Set<string>>(new Set());
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const initializationKey = useRef(crypto.randomUUID());
  const campaignBuilderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = readCampaignUiState(workspace?.id);
    writeCampaignUiState(workspace?.id, { ...current, expandedCampaign, scheduleDraft });
  }, [workspace?.id, expandedCampaign, scheduleDraft]);

  useEffect(() => {
    if (!workspace?.id) return;
    const persisted = readCampaignUiState(workspace.id).newCampaignTimezone;
    setOutreachTimezone(resolveNewCampaignTimezone(persisted, Intl.DateTimeFormat().resolvedOptions().timeZone));
  }, [workspace?.id]);

  useEffect(() => { setDiscoveryPreview([]); setSelectedProspectUrls(new Set()); setDiscoveryError(null); }, [icpId]);

  const updateNewCampaignTimezone = (value: string) => {
    const timezone = normalizeIanaTimezone(value);
    setOutreachTimezone(timezone);
    if (workspace?.id) writeCampaignUiState(workspace.id, { ...readCampaignUiState(workspace.id), newCampaignTimezone: timezone });
  };

  const connectedAccounts = (accounts.data ?? []).filter((a) => a.connection_state === 'connected' && ['healthy', 'degraded'].includes(a.health_status) && a.profile_url);
  const selectedIcp = (icps.data ?? []).find((i) => i.id === icpId);
  const selectedAccount = connectedAccounts.find((a) => a.id === accountId);
  const outboundEnabled = isLinkedInOutboundEnabled();
  const scheduleValid = days.length > 0 && startTime < endTime && isIanaTimezone(outreachTimezone);
  const canContinue = [name.trim().length > 1, !!selectedIcp, !!selectedAccount, strategy.trim().length > 20, dailyLimit >= 1 && dailyLimit <= 20 && scheduleValid, true][step];
  const nextWindow = useMemo(() => nextCampaignSendingWindow(days, startTime, endTime, outreachTimezone), [days, startTime, endTime, outreachTimezone]);
  const mayManageAcceptance = import.meta.env.VITE_SUPABASE_URL?.includes('vdiqfiuqckaxdjkadinu') === true
    && members.some((member) => member.user_id === user?.id && member.status === 'active' && ['owner', 'admin'].includes(member.role));

  const existing = useQuery({
    queryKey: ['customer-campaigns', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_campaigns').select('*').eq('workspace_id', workspace!.id).order('created_at', { ascending: false });
      if (error) throw error;
      const ids = (data ?? []).map((c) => c.id);
      if (!ids.length) return { campaigns: data ?? [], metrics: {} };
      return {
        campaigns: data ?? [],
        metrics: await fetchCampaignMetrics(workspace!.id),
      };
    },
    placeholderData: (previous) => previous,
  });
  const campaignProspects = useQuery({
    queryKey: ['campaign-prospects', workspace?.id],
    enabled: !!workspace,
    queryFn: () => fetchCampaignProspects(workspace!.id),
    placeholderData: (previous) => previous,
  });
  const workspaceProspects = useQuery({
    queryKey: ['selectable-prospects', workspace?.id], enabled: !!workspace,
    queryFn: async () => {
      const { data, error } = await supabase.from('prospects').select('id,first_name,last_name,title,linkedin_url').eq('workspace_id', workspace!.id).not('linkedin_url', 'is', null).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    placeholderData: (previous) => previous,
  });
  const acceptanceGenerations = useQuery({
    queryKey: ['controlled-acceptance-generations', workspace?.id],
    enabled: !!workspace && mayManageAcceptance,
    queryFn: async (): Promise<AcceptanceGeneration[]> => {
      const { data: generations, error } = await supabase
        .from('controlled_acceptance_generations')
        .select('id,campaign_id,contact_id,status,relationship_queue_id,write_job_id,relationship_evidence,created_at')
        .eq('workspace_id', workspace!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const queueIds = (generations ?? []).map((generation) => generation.relationship_queue_id).filter((id): id is string => typeof id === 'string');
      const queues = queueIds.length
        ? await supabase.from('browser_execution_queue').select('id,status').in('id', queueIds)
        : { data: [], error: null };
      if (queues.error) throw queues.error;
      const queueStatus = new Map((queues.data ?? []).map((queue) => [queue.id, queue.status]));
      return (generations ?? []).map((generation) => ({
        ...generation,
        relationship_evidence: generation.relationship_evidence as Record<string, unknown>,
        probeStatus: generation.relationship_queue_id ? queueStatus.get(generation.relationship_queue_id) ?? null : null,
      }));
    },
    placeholderData: (previous) => previous,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
  });
  const latestGeneration = (campaignId: string, contactId: string) =>
    acceptanceGenerations.data?.find((generation) => generation.campaign_id === campaignId && generation.contact_id === contactId) ?? null;

  const payload = useMemo(() => (selectedIcp ? mapIcp(selectedIcp) : null), [selectedIcp]);
  async function findProspects() {
    if (!workspace || !payload || discovering) return;
    setDiscovering(true);
    setDiscoveryError(null);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'preview_discovery', workspace_id: workspace.id, linkedin_account_id: selectedAccount?.id, icp: payload, max_prospects: Math.min(dailyLimit, 5) } });
      if (error) throw new Error(await edgeFunctionError(error));
      const prospects = Array.isArray(data?.prospects) ? data.prospects as DiscoveryPreview[] : [];
      if (!prospects.length) throw new Error(data?.reason ?? 'No source-verified LinkedIn prospects were found. Adjust the ICP and try again.');
      setDiscoveryPreview(prospects);
      setSelectedProspectUrls(new Set());
      toast.success(`${prospects.length} source-verified prospects found. Review them before launch.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Prospect discovery failed';
      setDiscoveryError(message);
      setDiscoveryPreview([]);
      setSelectedProspectUrls(new Set());
    } finally { setDiscovering(false); }
  }
  async function launch() {
    if (!outboundEnabled) {
      toast.info('LinkedIn outbound is globally disabled. Campaign configuration remains saved.');
      return;
    }
    if (!workspace || !payload || !selectedAccount) return;
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', {
        body: {
          action: 'launch',
          workspace_id: workspace.id,
          linkedin_account_id: selectedAccount.id,
          campaign: {
            name,
            strategy,
            daily_limit: dailyLimit,
            operating_days: days.join(','),
            operating_hours: `${startTime}–${endTime}`,
            outreach_timezone: outreachTimezone,
            initialization_key: initializationKey.current,
          },
          icp: payload,
          max_prospects: Math.min(dailyLimit, 5),
          reviewed_linkedin_urls: [...selectedProspectUrls],
          require_calendar: false,
          require_gmail: false,
        },
      });
      if (error) throw new Error(await edgeFunctionError(error));
      if (!['launched', 'partially_launched'].includes(data?.status)) throw new Error(data?.error ?? 'Campaign could not be launched');
      toast.success('Campaign launched. Yuktris will continue working in the background.');
      queryClient.invalidateQueries({ queryKey: ['customer-campaigns'] });
      initializationKey.current = crypto.randomUUID();
      setStep(0);
      setName('');
      setIcpId('');
      setAccountId('');
      setDiscoveryPreview([]);
      setSelectedProspectUrls(new Set());
      setDiscoveryError(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Campaign could not be launched');
    } finally {
      setLaunching(false);
    }
  }

  async function saveSchedule() {
    if (!workspace || !scheduleDraft || savingSchedule) return;
    setSavingSchedule(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: {
        action: 'update_schedule', workspace_id: workspace.id, campaign_id: scheduleDraft.campaignId,
        operating_days: scheduleDraft.days.join(','), start_time: scheduleDraft.start, end_time: scheduleDraft.end,
        outreach_timezone: scheduleDraft.timezone,
      } });
      if (error) throw new Error(await edgeFunctionError(error));
      toast.success(data?.scheduled_at ? `Schedule updated. Next window: ${formatCampaignWindow(data.scheduled_at, scheduleDraft.timezone)}` : 'Schedule updated.');
      setScheduleDraft(null);
      await queryClient.invalidateQueries({ queryKey: ['customer-campaigns'] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Schedule could not be updated'); }
    finally { setSavingSchedule(false); }
  }

  async function changeCampaignPause(campaignId: string, paused: boolean) {
    if (!workspace) return;
    if (!outboundEnabled && !paused) {
      toast.info('LinkedIn outbound is globally disabled. The saved campaign remains ready.');
      return;
    }
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: paused ? 'pause_campaign' : 'resume_campaign', workspace_id: workspace.id, campaign_id: campaignId } });
      if (error) throw new Error(await edgeFunctionError(error));
      toast.success(paused ? 'Campaign paused. No future writes can run.' : data?.scheduled_at ? `Campaign resumed. Next window: ${new Date(data.scheduled_at).toLocaleString()}` : 'Campaign resumed.');
      await queryClient.invalidateQueries({ queryKey: ['customer-campaigns'] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Campaign state could not be changed'); }
  }

  async function startControlledAcceptanceGeneration(campaignId: string, contactId: string) {
    if (!workspace || preparingAcceptance) return;
    setPreparingAcceptance(true);
    try {
      const { error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: {
        action: 'start_controlled_acceptance_generation', workspace_id: workspace.id, campaign_id: campaignId, contact_id: contactId,
      } });
      if (error) throw new Error(await edgeFunctionError(error));
      setAcceptanceConfirmation(null);
      await queryClient.invalidateQueries({ queryKey: ['controlled-acceptance-generations', workspace.id] });
      toast.success('Immutable generation created. A read-only relationship check is running; no LinkedIn control was clicked.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Generation could not be started.'); }
    finally { setPreparingAcceptance(false); }
  }

  async function classifyAcceptanceGeneration(generationId: string) {
    if (!workspace || preparingAcceptance) return;
    setPreparingAcceptance(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: {
        action: 'advance_controlled_acceptance_generation', workspace_id: workspace.id, generation_id: generationId,
      } });
      if (error) throw new Error(await edgeFunctionError(error));
      if (data.status === 'relationship_check_pending') toast.info('The read-only relationship check is still running.');
      else if (data.status === 'write_prepared') toast.success(`Relationship classified eligible. Exactly one terminal attempt is scheduled for ${new Date(data.scheduled_at).toLocaleString()}.`);
      else toast.info(`No write prepared. Relationship classification: ${data.status}.`);
      await queryClient.invalidateQueries({ queryKey: ['controlled-acceptance-generations', workspace.id] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Relationship could not be classified. No write was prepared.'); }
    finally { setPreparingAcceptance(false); }
  }

  async function associateExistingProspect(campaignId: string) {
    if (!workspace || !existingProspectId) return;
    setAssociating(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'associate_existing_prospect', workspace_id: workspace.id, campaign_id: campaignId, prospect_id: existingProspectId } });
      if (error) {
        toast.error(await edgeFunctionError(error));
        return;
      }
      toast.success(data?.job_created === false ? 'Prospect associated. No outreach was launched.' : 'Prospect associated.');
      setExistingProspectId('');
      await queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
    } catch (error) {
      console.error('[campaign-prospect-association-failed]', { message: error instanceof Error ? error.message : 'unknown_error' });
      toast.error('Prospect could not be associated. No outreach was started.');
    } finally {
      setAssociating(false);
    }
  }

  const initialBootstrapLoading = (icps.isLoading && !icps.data) || (accounts.isLoading && !accounts.data);
  if (initialBootstrapLoading)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  return (
    <div className="space-y-8">
      <PageHeader title="Campaigns" description="Create and launch a safe LinkedIn outreach campaign." actions={<Button onClick={() => { setStep(0); campaignBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Plus className="h-4 w-4" />Create Campaign</Button>} />
      {(accounts.isError || icps.isError) && <Reason text="Campaign prerequisites could not be loaded. Refresh this page; no campaign was launched." />}
      <div ref={campaignBuilderRef}>
      <Card className="p-6">
        <div className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-6">
          {STEPS.map((label, i) => (
            <div key={label} className="flex items-center gap-2">
              <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i <= step ? 'bg-gold-500 text-maroon-950' : 'bg-maroon-900 text-ink-500'}`}>{i + 1}</span>
              <span className={`text-xs ${i === step ? 'text-ink-100' : 'text-ink-500'}`}>{label}</span>
            </div>
          ))}
        </div>
        {step === 0 && (
          <Field label="Campaign name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q4 SaaS founders" />
          </Field>
        )}
        {step === 1 && (
          <div className="space-y-3">
            <Field label="Ideal customer profile">
              <Select value={icpId} onChange={(e) => setIcpId(e.target.value)}>
                <option value="">Select an ICP</option>
                {(icps.data ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button variant="secondary" onClick={() => location.assign('/app/audience')}>
              Create ICP
            </Button>
          </div>
        )}
        {step === 2 && (
          <Field label="LinkedIn account">
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select a connected account</option>
              {connectedAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.profile_name ?? a.account_name}
                </option>
              ))}
            </Select>
            {connectedAccounts.length === 0 && <Reason text="Connect or re-authenticate LinkedIn before launching." />}
          </Field>
        )}
        {step === 3 && (
          <Field label="Message strategy">
            <Textarea className="min-h-40" value={strategy} onChange={(e) => setStrategy(e.target.value)} />
            <p className="mt-2 text-xs text-ink-500">Yuktris generates prospect-specific copy from this strategy. You can review the direction here.</p>
          </Field>
        )}
        {step === 4 && (
          <div className="space-y-5">
            <Field label="Daily connection limit">
              <Input type="number" min={1} max={20} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
            </Field>
            <ScheduleEditor days={days} start={startTime} end={endTime} timezone={outreachTimezone} onDays={setDays} onStart={setStartTime} onEnd={setEndTime} onTimezone={updateNewCampaignTimezone} />
            {nextWindow && <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-3 text-sm text-ink-200"><CalendarClock className="mr-2 inline h-4 w-4" />Next outreach window: {formatCampaignWindow(nextWindow.toISOString(), outreachTimezone)}</div>}
          </div>
        )}
        {step === 5 && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Review label="Campaign" value={name} />
              <Review label="ICP" value={selectedIcp?.name ?? ''} />
              <Review label="LinkedIn account" value={selectedAccount?.profile_name ?? selectedAccount?.account_name ?? ''} />
              <Review label="Estimated target pool" value={`Up to ${Math.min(dailyLimit, 5)} verified prospects in the initial run`} />
              <Review label="Message strategy" value={strategy} />
              <Review label="Sending schedule" value={`${dailyLimit}/day · ${days.map((d) => SENDING_DAYS.find(([value]) => value === d)?.[1]).join(', ')} · ${startTime}–${endTime} · ${outreachTimezone}`} />
              <Review label="Next outreach window" value={nextWindow ? formatCampaignWindow(nextWindow.toISOString(), outreachTimezone) : 'Invalid schedule'} />
            </div>
            {!outboundEnabled && <p className="rounded-lg border border-warning-500/20 bg-warning-500/5 p-3 text-sm text-warning-300">LinkedIn outbound is globally disabled. Your campaign will be saved without executing outreach.</p>}
            <div className="rounded-xl border border-gold-500/15 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-medium text-ink-100">AI prospect discovery</p><p className="mt-1 text-xs text-ink-500">Find real, source-backed LinkedIn prospects matching this ICP. Nothing is queued until you explicitly launch.</p></div><Button type="button" variant="secondary" loading={discovering} onClick={() => void findProspects()}>Find Prospects with AI</Button></div>
              {discoveryError && <Reason text={discoveryError} />}
              {discoveryPreview.length > 0 && <div className="mt-4 space-y-2"><p className="text-xs font-medium text-success-400">{discoveryPreview.length} verified prospects found · {selectedProspectUrls.size} selected</p>{discoveryPreview.map((prospect) => { const selected = selectedProspectUrls.has(prospect.linkedin_url); return <label key={prospect.linkedin_url} className="block cursor-pointer rounded-lg bg-maroon-900/50 p-3"><div className="flex items-start gap-3"><input type="checkbox" checked={selected} onChange={() => setSelectedProspectUrls((current) => { const next = new Set(current); if (next.has(prospect.linkedin_url)) next.delete(prospect.linkedin_url); else next.add(prospect.linkedin_url); return next; })} className="mt-1 h-4 w-4 accent-gold-500" aria-label={`Include ${prospect.contact_name}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-ink-100">{prospect.contact_name}</p><p className="text-xs text-ink-500">{prospect.contact_title} · {prospect.company_name}</p></div><Badge tone="neutral">{Math.round(prospect.confidence_score * 100)}% fit</Badge></div><p className="mt-2 text-xs text-ink-300"><span className="font-medium">ICP fit:</span> {prospect.company_fit}</p><p className="mt-1 text-xs text-ink-400"><span className="font-medium">Why selected:</span> {prospect.person_fit}</p><p className="mt-1 break-all text-xs text-brand-400">LinkedIn: {prospect.linkedin_url}</p><p className="mt-1 break-all text-xs text-brand-400">Company source: {prospect.company_website}</p></div></div></label>; })}</div>}
            </div>
          </div>
        )}
        <div className="mt-8 flex justify-between">
          <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {step < 5 ? (
            <Button disabled={!canContinue} onClick={() => setStep((s) => s + 1)}>
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button loading={launching} disabled={!outboundEnabled || selectedProspectUrls.size === 0 || !selectedAccount || !isIanaTimezone(outreachTimezone) || days.length === 0 || !nextWindow} onClick={launch}>
              <Rocket className="h-4 w-4" />
              Launch Campaign
            </Button>
          )}
        </div>
      </Card>
      </div>
      {existing.isLoading && !existing.data ? <div className="flex justify-center py-12"><Spinner /></div> : existing.isError ? (
        <Reason text="Campaigns could not be loaded. Refresh this page; no campaign was created or launched." />
      ) : (existing.data?.campaigns.length ?? 0) === 0 ? (
        <Card className="p-6 text-center"><h2 className="text-base font-semibold text-ink-100">No campaigns yet</h2><p className="mt-2 text-sm text-ink-400">Create a LinkedIn campaign, configure its prospects and sending schedule, then review it before launch.</p><Button className="mt-4" onClick={() => { setStep(0); campaignBuilderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}><Plus className="h-4 w-4" />Create Campaign</Button></Card>
      ) : (
        <section>
          <h2 className="mb-3 text-base font-semibold text-ink-100">Your campaigns</h2>
          {campaignProspects.isError && <Reason text="Campaign prospect identities could not be loaded. Retry this page; no outreach was started." />}
          <div className="space-y-3">
            {existing.data!.campaigns.map((c: Record<string, unknown>) => {
              const id = String(c.id);
              const m = existing.data!.metrics[id] ?? {};
              const rows = (campaignProspects.data ?? []).filter((p) => p.campaignId === id);
              const campaignDays = parseCampaignDays(String(c.operating_days ?? ''));
              const [campaignStart, campaignEnd] = parseCampaignHours(c.operating_hours);
              const campaignTimezone = normalizeIanaTimezone(String(c.outreach_timezone ?? 'UTC'));
              const campaignNextWindow = nextCampaignSendingWindow(campaignDays, campaignStart, campaignEnd, campaignTimezone);
              const derivedStatus = !outboundEnabled ? 'Outbound Disabled' : c.status === 'ready' ? 'Ready' : c.status === 'paused' ? 'Paused' : ['failed', 'action_required', 'blocked_prerequisite'].includes(String(c.status)) ? 'Needs Attention' : campaignNextWindow && campaignNextWindow.getTime() > Date.now() + 5000 ? 'Waiting for sending window' : 'Running';
              return (
                <Card key={id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-100">{String(c.name)}</p>
                      <p className="mt-1 text-xs text-ink-500">{derivedStatus === 'Waiting for sending window' && campaignNextWindow ? `Waiting for next sending window — ${formatCampaignWindow(campaignNextWindow.toISOString(), campaignTimezone)}` : String(c.status_reason ?? 'Campaign status is available below.')}</p>
                      <p className="mt-1 text-xs text-ink-500">{campaignDays.map((d) => SENDING_DAYS.find(([value]) => value === d)?.[1]).join(', ')} · {campaignStart}–{campaignEnd} · {campaignTimezone}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setExpandedCampaign(expandedCampaign === id ? null : id)}>
                        {expandedCampaign === id ? 'Hide prospects' : 'View prospects'}
                      </Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setScheduleDraft({ campaignId: id, days: [...campaignDays], start: campaignStart, end: campaignEnd, timezone: campaignTimezone })}>Schedule / Edit</Button>
                      {outboundEnabled && (c.status === 'paused' ? <Button variant="ghost" size="sm" onClick={() => void changeCampaignPause(id, false)}><Play className="h-4 w-4" />Resume</Button> : !['failed', 'completed', 'ready'].includes(String(c.status)) ? <Button variant="ghost" size="sm" onClick={() => void changeCampaignPause(id, true)}><Pause className="h-4 w-4" />Pause</Button> : null)}
                      <Badge tone={derivedStatus === 'Running' ? 'success' : derivedStatus === 'Needs Attention' ? 'warning' : 'neutral'} dot>
                        {derivedStatus}
                      </Badge>
                    </div>
                  </div>
                  {scheduleDraft?.campaignId === id && <ScheduleEditorBoundary onClose={() => setScheduleDraft(null)}><div className="mt-4 rounded-xl border border-gold-500/15 p-4"><ScheduleEditor days={scheduleDraft.days} start={scheduleDraft.start} end={scheduleDraft.end} timezone={scheduleDraft.timezone} onDays={(value) => setScheduleDraft({ ...scheduleDraft, days: value })} onStart={(value) => setScheduleDraft({ ...scheduleDraft, start: value })} onEnd={(value) => setScheduleDraft({ ...scheduleDraft, end: value })} onTimezone={(value) => setScheduleDraft({ ...scheduleDraft, timezone: normalizeIanaTimezone(value) })} /><div className="mt-3 flex gap-2"><Button type="button" variant="secondary" size="sm" onClick={() => setScheduleDraft(null)}>Cancel</Button><Button type="button" size="sm" loading={savingSchedule} disabled={!scheduleDraft.days.length || scheduleDraft.start >= scheduleDraft.end || !isIanaTimezone(scheduleDraft.timezone)} onClick={() => void saveSchedule()}><Save className="h-4 w-4" />Save schedule</Button></div></div></ScheduleEditorBoundary>}
                  <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
                    {(
                      [
                        ['Prospects', m.prospects],
                        ['Connections Sent', m.connectionsSent],
                        ['Connections Accepted', m.connectionsAccepted],
                        ['Messages Sent', m.messagesSent],
                        ['Replies', m.replies],
                        ['Positive Replies', m.positiveReplies],
                        ['Qualified Leads', m.qualifiedLeads],
                        ['Meetings Booked', m.meetingsBooked],
                      ] as const
                    ).map(([label, value]) => (
                      <button type="button" key={label} onClick={label === 'Prospects' ? () => setExpandedCampaign(id) : undefined} className="rounded-lg border border-gold-500/8 bg-maroon-900/50 px-2.5 py-2 text-left">
                        <p className="text-xs text-ink-500">{label}</p>
                        <p className="mt-0.5 text-sm font-semibold text-ink-300">{value ?? 0}</p>
                      </button>
                    ))}
                  </div>
                  {expandedCampaign === id && (
                    <div className="mt-4 space-y-2 border-t border-gold-500/10 pt-4">
                      <div className="flex flex-col gap-2 rounded-lg border border-gold-500/10 p-3 md:flex-row">
                        <Select value={existingProspectId} onChange={(e) => setExistingProspectId(e.target.value)}>
                          <option value="">Select an existing workspace prospect</option>
                          {(workspaceProspects.data ?? []).map((p) => <option key={p.id} value={p.id}>{`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || p.linkedin_url}</option>)}
                        </Select>
                        <Button type="button" variant="secondary" size="sm" loading={associating} disabled={!existingProspectId} onClick={() => void associateExistingProspect(id)}>Associate prospect</Button>
                      </div>
                      {rows.length ? (
                        rows.map((p) => {
                          const generation = latestGeneration(id, p.contactId);
                          return <div key={p.jobId} className="rounded-lg bg-maroon-900/50 p-3">
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="text-sm font-medium text-ink-100">{p.name}</p>
                                <p className="text-xs text-ink-500">{[p.title, p.company].filter(Boolean).join(' · ') || 'Campaign prospect'}</p>
                              </div>
                              <Badge tone={p.status.startsWith('Needs attention') ? 'warning' : p.status === 'Connection sent' ? 'success' : 'neutral'}>{p.status}</Badge>
                            </div>
                            {p.linkedinUrl && (
                              <a className="mt-2 block text-xs text-brand-400 hover:underline" href={p.linkedinUrl} target="_blank" rel="noopener noreferrer">
                                View LinkedIn profile
                              </a>
                            )}
                            <div className="mt-2 grid gap-1 text-xs text-ink-500 md:grid-cols-2">
                              <p>Source: {p.source}</p>
                              <p>Discovered: {new Date(p.createdAt).toLocaleString()}</p>
                              <p>Last action: {p.lastAction ?? 'No action yet'}</p>
                              <p>Next action: {p.nextAction ?? 'None scheduled'}</p>
                            </div>
                            {mayManageAcceptance && p.linkedinUrl?.replace(/\?.*$/, '').replace(/\/+$/, '').toLowerCase() === 'https://www.linkedin.com/in/tarun-chaudhary' && (
                              generation && ['relationship_check_pending', 'eligible'].includes(generation.status) ? (
                                <div className="mt-2 rounded-lg border border-warning-500/30 p-3">
                                  <Reason text={generation.probeStatus === 'completed' ? 'Read-only relationship check completed. Continue to classify the persisted result safely.' : 'Read-only relationship classification must finish before any attempt can be prepared.'} />
                                  <Button className="mt-2" size="sm" loading={preparingAcceptance} onClick={() => void classifyAcceptanceGeneration(generation.id)}>Classify relationship / continue safely</Button>
                                </div>
                              ) : generation?.status === 'write_prepared' ? (
                                <Reason text="A controlled acceptance attempt is already prepared for this immutable generation." />
                              ) : generation && ['connected', 'pending', 'succeeded', 'outcome_unknown'].includes(generation.status) ? (
                                <Reason text={`Controlled acceptance generation is terminal: ${generation.status}.`} />
                              ) :
                              acceptanceConfirmation?.campaignId === id && acceptanceConfirmation.contactId === p.contactId ? (
                                <div className="mt-2 rounded-lg border border-warning-500/30 p-3">
                                  <Reason text="Create a new immutable staging generation. This first step performs only a read-only relationship check." />
                                  <div className="mt-2 flex gap-2">
                                    <Button variant="secondary" size="sm" disabled={preparingAcceptance} onClick={() => setAcceptanceConfirmation(null)}>Cancel</Button>
                                    <Button size="sm" loading={preparingAcceptance} onClick={() => void startControlledAcceptanceGeneration(id, p.contactId)}>Start new controlled acceptance generation</Button>
                                  </div>
                                </div>
                              ) : (
                                <Button className="mt-2" variant="secondary" size="sm" onClick={() => setAcceptanceConfirmation({ campaignId: id, contactId: p.contactId })}>
                                  Start new controlled acceptance generation
                                </Button>
                              )
                            )}
                          </div>;
                        })
                      ) : (
                        <p className="text-sm text-ink-500">No genuine campaign prospects.</p>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function mapIcp(icp: FullICP) {
  return {
    name: icp.name,
    description: icp.description ?? '',
    industry: icp.company_profile?.industry ?? '',
    companySize: icp.company_profile?.company_size ?? '',
    jobTitles: icp.decision_makers.map((d) => d.job_title).filter(Boolean),
    painPoints: icp.pain_points.map((p) => p.pain_point),
    subIndustry: icp.company_profile?.sub_industry ?? '',
    geography: [...new Set([icp.company_profile?.country, icp.company_profile?.region, ...(icp.sales_navigator_filters?.location ?? [])].filter((value): value is string => Boolean(value)))],
    keywords: [...new Set([...(icp.sales_navigator_filters?.keywords ?? []), ...(icp.sales_navigator_filters?.industry ?? [])])],
  };
}
function Review({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gold-500/10 p-3">
      <p className="text-xs text-ink-500">{label}</p>
      <p className="mt-1 text-sm text-ink-200">{value}</p>
    </div>
  );
}
function Reason({ text }: { text: string }) {
  return (
    <p className="mt-3 flex items-center gap-2 text-sm text-warning-500">
      <AlertTriangle className="h-4 w-4" />
      {text}
    </p>
  );
}

function ScheduleEditor({ days, start, end, timezone, onDays, onStart, onEnd, onTimezone }: {
  days: string[]; start: string; end: string; timezone: string;
  onDays: (value: string[]) => void; onStart: (value: string) => void; onEnd: (value: string) => void; onTimezone: (value: string) => void;
}) {
  const toggle = (day: string) => onDays(days.includes(day) ? days.filter((value) => value !== day) : [...days, day]);
  const editorNextWindow = useMemo(() => nextCampaignSendingWindow(days, start, end, timezone), [days, start, end, timezone]);
  return <div className="space-y-4 rounded-xl border border-gold-500/10 p-4">
    <div>
      <p className="text-sm font-medium text-ink-200">Sending Schedule</p>
      <p className="mt-1 text-xs text-ink-500">The campaign runs only during the days and local hours you choose.</p>
    </div>
    <div className="flex flex-wrap gap-2">
      {SENDING_DAYS.map(([value, label]) => <button type="button" key={value} aria-pressed={days.includes(value)} onClick={() => toggle(value)} className={`rounded-full border px-3 py-1.5 text-sm ${days.includes(value) ? 'border-brand-400 bg-brand-500/15 text-brand-300' : 'border-gold-500/15 text-ink-500'}`}>{label}</button>)}
    </div>
    <div className="flex gap-2">
      <Button type="button" size="sm" variant="secondary" onClick={() => onDays([...WEEKDAYS])}>Weekdays</Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => onDays(SENDING_DAYS.map(([value]) => value))}>Every day</Button>
    </div>
    {!days.length && <Reason text="Select at least one sending day." />}
    <div className="grid gap-4 md:grid-cols-2">
      <Field label="Start time"><Input type="time" value={start} onChange={(event) => onStart(event.target.value)} /></Field>
      <Field label="End time"><Input type="time" value={end} onChange={(event) => onEnd(event.target.value)} /></Field>
    </div>
    {start >= end && <Reason text="End time must be later than start time." />}
    <Field label="Timezone (IANA)">
      <Input list="campaign-timezones" value={timezone} onChange={(event) => onTimezone(event.target.value)} placeholder="Asia/Kolkata" />
      <datalist id="campaign-timezones">{TIMEZONE_SUGGESTIONS.map((value) => <option value={value} key={value} />)}</datalist>
      <p className="mt-2 text-xs text-ink-500">Detected from your browser for new campaigns. You can change it.</p>
    </Field>
    {!isIanaTimezone(timezone) && <Reason text="Enter a valid IANA timezone such as Asia/Kolkata." />}
    {editorNextWindow && <div className="rounded-lg border border-brand-500/20 bg-brand-500/5 p-3 text-sm text-ink-200"><CalendarClock className="mr-2 inline h-4 w-4" />Next outreach window: {formatCampaignWindow(editorNextWindow.toISOString(), timezone)}</div>}
  </div>;
}

function _legacyParseCampaignDays(value: string): string[] {
  if (/^monday[–-]friday$/i.test(value.trim())) return [...WEEKDAYS];
  return value.toLowerCase().replace(/\s/g, '').split(',').filter((day) => SENDING_DAYS.some(([candidate]) => candidate === day));
}

function _legacyParseHours(value: string): [string, string] {
  const [start = '09:00', end = '17:00'] = value.replace('–', '-').split('-');
  return [start, end];
}

class ScheduleEditorBoundary extends Component<{ children: ReactNode; onClose: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('[campaign-schedule-editor-error]', { name: error.name, message: error.message }); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="mt-4 rounded-xl border border-warning-500/30 p-4"><Reason text="This campaign schedule could not be displayed. The campaign was not changed." /><Button type="button" className="mt-3" variant="secondary" size="sm" onClick={this.props.onClose}>Close editor</Button></div>;
  }
}

async function edgeFunctionError(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'Campaign could not be launched';
  const context = (error as { context?: Response })?.context;
  if (!context) return fallback;
  try {
    const body = (await context.clone().json()) as {
      error?: string;
      code?: string;
    };
    if (body.error) return body.code ? `${body.error} (${body.code})` : body.error;
  } catch {
    /* The response was not JSON. */
  }
  return fallback;
}
