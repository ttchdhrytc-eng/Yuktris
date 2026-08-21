import { Component, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ChevronLeft, ChevronRight, Pause, Play, Rocket, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useGoogleConnection } from '@/hooks/useGoogleAuth';
import { useICP } from '@/hooks/useICPIntelligence';
import { useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';
import { supabase } from '@/lib/supabase';
import { GOOGLE_SCOPES } from '@/types/google-auth';
import type { FullICP } from '@/types/icp-intelligence';
import { buildCampaignMetrics } from '@/services/campaign-metrics';
import { fetchCampaignProspects } from '@/services/campaign-prospects';
import { CAMPAIGN_SENDING_DAYS, CAMPAIGN_WEEKDAYS, formatCampaignWindow, isIanaTimezone, nextCampaignSendingWindow, normalizeIanaTimezone, parseCampaignDays, parseCampaignHours } from '@/services/campaign-schedule';

const STEPS = ['Campaign', 'ICP', 'LinkedIn account', 'Outreach', 'Limits & Schedule', 'Review & Launch'];
const SENDING_DAYS = CAMPAIGN_SENDING_DAYS;
const WEEKDAYS = CAMPAIGN_WEEKDAYS;
const TIMEZONE_SUGGESTIONS = ['Asia/Kolkata', 'America/New_York', 'Europe/London', 'America/Los_Angeles', 'Asia/Singapore', 'Australia/Sydney', 'UTC'];
type ScheduleDraft = { campaignId: string; days: string[]; start: string; end: string; timezone: string };

export function CampaignsPage() {
  const { workspace, members } = useWorkspace();
  const { user } = useAuth();
  const icps = useICP();
  const accounts = useLinkedInAccounts();
  const google = useGoogleConnection();
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
  const [outreachTimezone, setOutreachTimezone] = useState(() => normalizeIanaTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'));
  const [launching, setLaunching] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [existingProspectId, setExistingProspectId] = useState('');
  const [associating, setAssociating] = useState(false);
  const [acceptanceConfirmation, setAcceptanceConfirmation] = useState<{ campaignId: string; contactId: string } | null>(null);
  const [preparingAcceptance, setPreparingAcceptance] = useState(false);
  const [acceptanceGeneration, setAcceptanceGeneration] = useState<{ id: string; campaignId: string; contactId: string } | null>(null);
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const initializationKey = useRef(crypto.randomUUID());

  const connectedAccounts = (accounts.data ?? []).filter((a) => a.connection_state === 'connected' && ['healthy', 'degraded'].includes(a.health_status) && a.profile_url);
  const selectedIcp = (icps.data ?? []).find((i) => i.id === icpId);
  const selectedAccount = connectedAccounts.find((a) => a.id === accountId);
  const scopes = new Set(google.data?.token?.scope?.split(' ').filter(Boolean) ?? []);
  const calendarConnected = google.data?.account?.status === 'connected' && !google.data.needsReconnect && (scopes.has(GOOGLE_SCOPES.CALENDAR) || scopes.has(GOOGLE_SCOPES.CALENDAR_EVENTS));
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
      if (error && error.code !== '42P01') throw error;
      const ids = (data ?? []).map((c) => c.id);
      if (!ids.length) return { campaigns: data ?? [], metrics: {} };
      const [campaignContacts, jobs, conversations, messages, confirmations] = await Promise.all([supabase.from('customer_campaign_contacts').select('customer_campaign_id,contact_id').eq('workspace_id', workspace!.id).in('customer_campaign_id', ids), supabase.from('linkedin_execution_jobs').select('contact_id,action_type,status,action_payload').eq('workspace_id', workspace!.id), supabase.from('linkedin_conversations').select('id,stage,metadata,prospect_profile_url').eq('workspace_id', workspace!.id), supabase.from('linkedin_messages').select('conversation_id,direction,classification,metadata').eq('workspace_id', workspace!.id), supabase.from('linkedin_meeting_confirmations').select('id,metadata').eq('workspace_id', workspace!.id)]);
      if (campaignContacts.error) throw campaignContacts.error;
      return {
        campaigns: data ?? [],
        metrics: buildCampaignMetrics({
          campaignIds: ids,
          campaignContacts: campaignContacts.data ?? [],
          jobs: jobs.error ? undefined : (jobs.data ?? []),
          conversations: conversations.error ? undefined : (conversations.data ?? []),
          messages: messages.error ? undefined : (messages.data ?? []),
          confirmations: confirmations.error ? undefined : (confirmations.data ?? []),
        }),
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

  const payload = useMemo(() => (selectedIcp ? mapIcp(selectedIcp) : null), [selectedIcp]);
  async function launch() {
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
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: paused ? 'pause_campaign' : 'resume_campaign', workspace_id: workspace.id, campaign_id: campaignId } });
      if (error) throw new Error(await edgeFunctionError(error));
      toast.success(paused ? 'Campaign paused. No future writes can run.' : data?.scheduled_at ? `Campaign resumed. Next window: ${new Date(data.scheduled_at).toLocaleString()}` : 'Campaign resumed.');
      await queryClient.invalidateQueries({ queryKey: ['customer-campaigns'] });
      await queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Campaign state could not be changed'); }
  }

  async function prepareControlledAcceptance(campaignId: string, contactId: string) {
    if (!workspace || preparingAcceptance) return;
    setPreparingAcceptance(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', {
        body: {
          action: 'prepare_controlled_acceptance',
          workspace_id: workspace.id,
          campaign_id: campaignId,
          contact_id: contactId,
        },
      });
      if (error) {
        toast.error(await edgeFunctionError(error));
        return;
      }
      toast.success(`One connection request prepared${data?.scheduled_at ? ` for ${new Date(data.scheduled_at).toLocaleString()}` : ''}.`);
      setAcceptanceConfirmation(null);
      await queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
    } catch (error) {
      console.error('[controlled-acceptance-prepare-failed]', { message: error instanceof Error ? error.message : 'unknown_error' });
      toast.error('The one-write acceptance could not be prepared. No retry was started.');
    } finally {
      setPreparingAcceptance(false);
    }
  }

  async function startControlledAcceptanceGeneration(campaignId: string, contactId: string) {
    if (!workspace || preparingAcceptance) return;
    setPreparingAcceptance(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: {
        action: 'start_controlled_acceptance_generation', workspace_id: workspace.id, campaign_id: campaignId, contact_id: contactId,
      } });
      if (error) throw new Error(await edgeFunctionError(error));
      setAcceptanceGeneration({ id: data.generation_id, campaignId, contactId });
      setAcceptanceConfirmation(null);
      toast.success('Immutable generation created. A read-only relationship check is running; no LinkedIn control was clicked.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Generation could not be started.'); }
    finally { setPreparingAcceptance(false); }
  }

  async function classifyAcceptanceGeneration() {
    if (!workspace || !acceptanceGeneration || preparingAcceptance) return;
    setPreparingAcceptance(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: {
        action: 'advance_controlled_acceptance_generation', workspace_id: workspace.id, generation_id: acceptanceGeneration.id,
      } });
      if (error) throw new Error(await edgeFunctionError(error));
      if (data.status === 'relationship_check_pending') toast.info('The read-only relationship check is still running.');
      else if (data.status === 'write_prepared') toast.success(`Relationship classified eligible. Exactly one terminal attempt is scheduled for ${new Date(data.scheduled_at).toLocaleString()}.`);
      else toast.info(`No write prepared. Relationship classification: ${data.status}.`);
      if (data.status !== 'relationship_check_pending') setAcceptanceGeneration(null);
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

  const initialBootstrapLoading = (icps.isLoading && !icps.data) || (accounts.isLoading && !accounts.data) || (google.isLoading && !google.data);
  if (initialBootstrapLoading)
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  return (
    <div className="space-y-8">
      <PageHeader title="Campaigns" description="Create and launch a safe LinkedIn outreach campaign." />
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
            <ScheduleEditor days={days} start={startTime} end={endTime} timezone={outreachTimezone} onDays={setDays} onStart={setStartTime} onEnd={setEndTime} onTimezone={setOutreachTimezone} />
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
            <div className="flex items-center gap-2">
              <Badge tone={calendarConnected ? 'success' : 'neutral'} dot>
                {calendarConnected ? 'Calendar connected' : 'Calendar optional'}
              </Badge>
            </div>
            {!calendarConnected && <p className="text-sm text-ink-500">LinkedIn outreach can launch now. Connect Calendar before enabling automatic meeting booking.</p>}
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
            <Button loading={launching} onClick={launch}>
              <Rocket className="h-4 w-4" />
              Launch Campaign
            </Button>
          )}
        </div>
      </Card>
      {(existing.data?.campaigns.length ?? 0) > 0 && (
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
              const derivedStatus = c.status === 'paused' ? 'Paused' : ['failed', 'action_required', 'blocked_prerequisite'].includes(String(c.status)) ? 'Needs Attention' : campaignNextWindow && campaignNextWindow.getTime() > Date.now() + 5000 ? 'Waiting for sending window' : 'Running';
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
                      {c.status === 'paused' ? <Button variant="ghost" size="sm" onClick={() => void changeCampaignPause(id, false)}><Play className="h-4 w-4" />Resume</Button> : !['failed', 'completed'].includes(String(c.status)) ? <Button variant="ghost" size="sm" onClick={() => void changeCampaignPause(id, true)}><Pause className="h-4 w-4" />Pause</Button> : null}
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
                        rows.map((p) => (
                          <div key={p.jobId} className="rounded-lg bg-maroon-900/50 p-3">
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
                              acceptanceGeneration?.campaignId === id && acceptanceGeneration.contactId === p.contactId ? (
                                <div className="mt-2 rounded-lg border border-warning-500/30 p-3">
                                  <Reason text="Read-only relationship classification must finish before any attempt can be prepared." />
                                  <Button className="mt-2" size="sm" loading={preparingAcceptance} onClick={() => void classifyAcceptanceGeneration()}>Classify relationship / continue safely</Button>
                                </div>
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
                          </div>
                        ))
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
