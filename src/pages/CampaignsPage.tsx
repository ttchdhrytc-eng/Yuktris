import { useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, Input, Select, Textarea } from '@/components/ui/Field';
import { PageHeader } from '@/components/ui/PageHeader';
import { Spinner } from '@/components/ui/Spinner';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useGoogleConnection } from '@/hooks/useGoogleAuth';
import { useICP } from '@/hooks/useICPIntelligence';
import { useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';
import { supabase } from '@/lib/supabase';
import { GOOGLE_SCOPES } from '@/types/google-auth';
import type { FullICP } from '@/types/icp-intelligence';
import { buildCampaignMetrics, CAMPAIGN_STATUS_LABELS } from '@/services/campaign-metrics';
import { fetchCampaignProspects } from '@/services/campaign-prospects';

const STEPS = ['Campaign', 'ICP', 'LinkedIn account', 'Outreach', 'Limits & Schedule', 'Review & Launch'];

export function CampaignsPage() {
  const { workspace } = useWorkspace();
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
  const [days, setDays] = useState('Monday–Friday');
  const [hours, setHours] = useState('09:00–17:00');
  const [outreachTimezone, setOutreachTimezone] = useState('');
  const [launching, setLaunching] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [existingProspectId, setExistingProspectId] = useState('');
  const initializationKey = useRef(crypto.randomUUID());

  const connectedAccounts = (accounts.data ?? []).filter((a) => a.connection_state === 'connected' && ['healthy', 'degraded'].includes(a.health_status) && a.profile_url);
  const selectedIcp = (icps.data ?? []).find((i) => i.id === icpId);
  const selectedAccount = connectedAccounts.find((a) => a.id === accountId);
  const scopes = new Set(google.data?.token?.scope?.split(' ').filter(Boolean) ?? []);
  const calendarConnected = google.data?.account?.status === 'connected' && !google.data.needsReconnect && (scopes.has(GOOGLE_SCOPES.CALENDAR) || scopes.has(GOOGLE_SCOPES.CALENDAR_EVENTS));
  const canContinue = [name.trim().length > 1, !!selectedIcp, !!selectedAccount, strategy.trim().length > 20, dailyLimit >= 1 && dailyLimit <= 20 && outreachTimezone.includes('/'), true][step];

  const existing = useQuery({
    queryKey: ['customer-campaigns', workspace?.id],
    enabled: !!workspace,
    queryFn: async () => {
      await Promise.all(
        ['reconcile_prerequisites', 'reconcile_campaign_state'].map((action) =>
          supabase.functions.invoke('linkedin-v1-pipeline', {
            body: { action, workspace_id: workspace!.id },
          }),
        ),
      );
      const { data, error } = await supabase.from('customer_campaigns').select('*').eq('workspace_id', workspace!.id).order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      const ids = (data ?? []).map((c) => c.id);
      if (!ids.length) return { campaigns: data ?? [], metrics: {} };
      const [jobs, conversations, messages, confirmations] = await Promise.all([supabase.from('linkedin_execution_jobs').select('contact_id,action_type,status,action_payload').eq('workspace_id', workspace!.id), supabase.from('linkedin_conversations').select('id,stage,metadata,prospect_profile_url').eq('workspace_id', workspace!.id), supabase.from('linkedin_messages').select('conversation_id,direction,classification,metadata').eq('workspace_id', workspace!.id), supabase.from('linkedin_meeting_confirmations').select('id,metadata').eq('workspace_id', workspace!.id)]);
      return {
        campaigns: data ?? [],
        metrics: buildCampaignMetrics({
          campaignIds: ids,
          jobs: jobs.error ? undefined : (jobs.data ?? []),
          conversations: conversations.error ? undefined : (conversations.data ?? []),
          messages: messages.error ? undefined : (messages.data ?? []),
          confirmations: confirmations.error ? undefined : (confirmations.data ?? []),
        }),
      };
    },
  });
  const campaignProspects = useQuery({
    queryKey: ['campaign-prospects', workspace?.id],
    enabled: !!workspace,
    queryFn: () => fetchCampaignProspects(workspace!.id),
  });
  const workspaceProspects = useQuery({
    queryKey: ['selectable-prospects', workspace?.id], enabled: !!workspace,
    queryFn: async () => {
      const { data, error } = await supabase.from('prospects').select('id,first_name,last_name,title,linkedin_url').eq('workspace_id', workspace!.id).not('linkedin_url', 'is', null).order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
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
            operating_days: days,
            operating_hours: hours,
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

  async function prepareControlledAcceptance(campaignId: string, contactId: string) {
    if (!workspace || !window.confirm('Prepare exactly one staging connection request for this prospect? It will run automatically only inside the campaign sending window.')) return;
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
    queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
  }

  async function associateExistingProspect(campaignId: string) {
    if (!workspace || !existingProspectId) return;
    const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'associate_existing_prospect', workspace_id: workspace.id, campaign_id: campaignId, prospect_id: existingProspectId } });
    if (error) return toast.error(await edgeFunctionError(error));
    toast.success(data?.job_created === false ? 'Prospect associated. No outreach was launched.' : 'Prospect associated.');
    setExistingProspectId('');
    queryClient.invalidateQueries({ queryKey: ['campaign-prospects'] });
  }

  if (icps.isLoading || accounts.isLoading || google.isLoading)
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
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Daily connection limit">
              <Input type="number" min={1} max={20} value={dailyLimit} onChange={(e) => setDailyLimit(Number(e.target.value))} />
            </Field>
            <Field label="Outreach timezone (IANA)">
              <Input value={outreachTimezone} onChange={(e) => setOutreachTimezone(e.target.value)} placeholder="America/New_York" />
              <p className="mt-2 text-xs text-ink-500">Required. Campaign hours are interpreted only in this timezone.</p>
            </Field>
            <Field label="Operating days">
              <Input value={days} onChange={(e) => setDays(e.target.value)} />
            </Field>
            <Field label="Operating hours">
              <Input value={hours} onChange={(e) => setHours(e.target.value)} />
            </Field>
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
              <Review label="Limits" value={`${dailyLimit}/day · ${days} · ${hours}`} />
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
          <div className="space-y-3">
            {existing.data!.campaigns.map((c: Record<string, unknown>) => {
              const id = String(c.id);
              const m = existing.data!.metrics[id] ?? {};
              const rows = (campaignProspects.data ?? []).filter((p) => p.campaignId === id);
              return (
                <Card key={id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-ink-100">{String(c.name)}</p>
                      <p className="mt-1 text-xs text-ink-500">{String(c.status_reason ?? 'Campaign status is available below.')}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setExpandedCampaign(expandedCampaign === id ? null : id)}>
                        {expandedCampaign === id ? 'Hide prospects' : 'View prospects'}
                      </Button>
                      <Badge tone={c.status === 'running' ? 'success' : ['action_required', 'blocked_prerequisite', 'failed'].includes(String(c.status)) ? 'warning' : 'neutral'} dot>
                        {CAMPAIGN_STATUS_LABELS[String(c.status)] ?? String(c.status)}
                      </Badge>
                    </div>
                  </div>
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
                        <Button variant="secondary" size="sm" disabled={!existingProspectId} onClick={() => associateExistingProspect(id)}>Associate prospect</Button>
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
                            {p.acceptanceEligible && <Button className="mt-2" variant="secondary" size="sm" onClick={() => prepareControlledAcceptance(id, p.contactId)}>
                              Prepare one-write acceptance
                            </Button>}
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
