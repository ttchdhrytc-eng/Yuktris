import { useMemo, useState } from 'react';
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
  const [launching, setLaunching] = useState(false);

  const connectedAccounts = (accounts.data ?? []).filter(a => a.connection_state === 'connected' && ['healthy', 'degraded'].includes(a.health_status) && a.profile_url);
  const selectedIcp = (icps.data ?? []).find(i => i.id === icpId);
  const selectedAccount = connectedAccounts.find(a => a.id === accountId);
  const scopes = new Set(google.data?.token?.scope?.split(' ').filter(Boolean) ?? []);
  const calendarConnected = google.data?.account?.status === 'connected' && !google.data.needsReconnect &&
    (scopes.has(GOOGLE_SCOPES.CALENDAR) || scopes.has(GOOGLE_SCOPES.CALENDAR_EVENTS));
  const canContinue = [name.trim().length > 1, !!selectedIcp, !!selectedAccount, strategy.trim().length > 20, dailyLimit >= 1 && dailyLimit <= 20, true][step];

  const existing = useQuery({
    queryKey: ['customer-campaigns', workspace?.id], enabled: !!workspace,
    queryFn: async () => {
      const { data, error } = await supabase.from('customer_campaigns').select('*').eq('workspace_id', workspace!.id).order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      return data ?? [];
    },
  });

  const payload = useMemo(() => selectedIcp ? mapIcp(selectedIcp) : null, [selectedIcp]);
  async function launch() {
    if (!workspace || !payload || !selectedAccount || !calendarConnected) return;
    setLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: {
        action: 'launch', workspace_id: workspace.id, linkedin_account_id: selectedAccount.id,
        campaign: { name, strategy, daily_limit: dailyLimit, operating_days: days, operating_hours: hours },
        icp: payload, max_prospects: Math.min(dailyLimit, 5), require_calendar: true,
      }});
      if (error || !['launched', 'partially_launched'].includes(data?.status)) throw new Error(data?.error ?? error?.message ?? 'Campaign could not be launched');
      toast.success('Campaign launched. Yuktris will continue working in the background.');
      queryClient.invalidateQueries({ queryKey: ['customer-campaigns'] });
      setStep(0); setName(''); setIcpId(''); setAccountId('');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Campaign could not be launched'); }
    finally { setLaunching(false); }
  }

  if (icps.isLoading || accounts.isLoading || google.isLoading) return <div className="flex justify-center py-24"><Spinner /></div>;
  return <div className="space-y-8">
    <PageHeader title="Campaigns" description="Create and launch a safe LinkedIn outreach campaign." />
    <Card className="p-6">
      <div className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-6">{STEPS.map((label, i) => <div key={label} className="flex items-center gap-2">
        <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${i <= step ? 'bg-gold-500 text-maroon-950' : 'bg-maroon-900 text-ink-500'}`}>{i + 1}</span>
        <span className={`text-xs ${i === step ? 'text-ink-100' : 'text-ink-500'}`}>{label}</span>
      </div>)}</div>
      {step === 0 && <Field label="Campaign name"><Input value={name} onChange={e => setName(e.target.value)} placeholder="Q4 SaaS founders" /></Field>}
      {step === 1 && <div className="space-y-3"><Field label="Ideal customer profile"><Select value={icpId} onChange={e => setIcpId(e.target.value)}><option value="">Select an ICP</option>{(icps.data ?? []).map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</Select></Field><Button variant="secondary" onClick={() => location.assign('/app/audience')}>Create ICP</Button></div>}
      {step === 2 && <Field label="LinkedIn account"><Select value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">Select a connected account</option>{connectedAccounts.map(a => <option key={a.id} value={a.id}>{a.profile_name ?? a.account_name}</option>)}</Select>{connectedAccounts.length === 0 && <Reason text="Connect or re-authenticate LinkedIn before launching." />}</Field>}
      {step === 3 && <Field label="Message strategy"><Textarea className="min-h-40" value={strategy} onChange={e => setStrategy(e.target.value)} /><p className="mt-2 text-xs text-ink-500">Yuktris generates prospect-specific copy from this strategy. You can review the direction here.</p></Field>}
      {step === 4 && <div className="grid gap-4 md:grid-cols-3"><Field label="Daily connection limit"><Input type="number" min={1} max={20} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} /></Field><Field label="Operating days"><Input value={days} onChange={e => setDays(e.target.value)} /></Field><Field label="Operating hours"><Input value={hours} onChange={e => setHours(e.target.value)} /></Field></div>}
      {step === 5 && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-2"><Review label="Campaign" value={name} /><Review label="ICP" value={selectedIcp?.name ?? ''} /><Review label="LinkedIn account" value={selectedAccount?.profile_name ?? selectedAccount?.account_name ?? ''} /><Review label="Estimated target pool" value={`Up to ${Math.min(dailyLimit, 5)} verified prospects in the initial run`} /><Review label="Message strategy" value={strategy} /><Review label="Limits" value={`${dailyLimit}/day · ${days} · ${hours}`} /></div><div className="flex items-center gap-2"><Badge tone={calendarConnected ? 'success' : 'warning'} dot>{calendarConnected ? 'Calendar connected' : 'Calendar connection required'}</Badge></div>{!calendarConnected && <Reason text="Connect Google Calendar to enable automatic meeting booking and launch." />}</div>}
      <div className="mt-8 flex justify-between"><Button variant="secondary" disabled={step === 0} onClick={() => setStep(s => s - 1)}><ChevronLeft className="h-4 w-4" />Back</Button>{step < 5 ? <Button disabled={!canContinue} onClick={() => setStep(s => s + 1)}>Continue<ChevronRight className="h-4 w-4" /></Button> : <Button disabled={!calendarConnected} loading={launching} onClick={launch}><Rocket className="h-4 w-4" />Launch Campaign</Button>}</div>
    </Card>
    {(existing.data?.length ?? 0) > 0 && <section><h2 className="mb-3 text-base font-semibold text-ink-100">Your campaigns</h2><div className="space-y-3">{existing.data!.map((c: Record<string, unknown>) => <Card key={String(c.id)} className="flex items-center justify-between p-4"><div><p className="text-sm font-medium text-ink-100">{String(c.name)}</p><p className="mt-1 text-xs text-ink-500">{String(c.status_reason ?? 'Yuktris is processing this campaign.')}</p></div><Badge tone={c.status === 'running' ? 'success' : c.status === 'action_required' || c.status === 'failed' ? 'warning' : 'neutral'} dot>{String(c.status).replace('_', ' ')}</Badge></Card>)}</div></section>}
  </div>;
}

function mapIcp(icp: FullICP) { return { name: icp.name, description: icp.description ?? '', industry: icp.company_profile?.industry ?? '', companySize: icp.company_profile?.company_size ?? '', jobTitles: icp.decision_makers.map(d => d.job_title).filter(Boolean), painPoints: icp.pain_points.map(p => p.pain_point) }; }
function Review({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-gold-500/10 p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-sm text-ink-200">{value}</p></div>; }
function Reason({ text }: { text: string }) { return <p className="mt-3 flex items-center gap-2 text-sm text-warning-500"><AlertTriangle className="h-4 w-4" />{text}</p>; }
