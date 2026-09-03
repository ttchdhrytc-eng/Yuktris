import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pause, Play, RefreshCw, Target } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';

type InventoryState = { id: string; name: string; offer_context: { offer?: string }; prospecting_status: string; last_discovery_completed_at: string | null; discovery_error: string | null; counts: { verified: number; ready: number } };

export function ICPAndOffersPage() {
  const { workspace } = useWorkspace();
  const accounts = useLinkedInAccounts();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', offer: '', market: '', roles: '', pain: '' });
  const inventory = useQuery({
    queryKey: ['autonomous-inventory', workspace?.id], enabled: !!workspace,
    queryFn: async (): Promise<InventoryState[]> => {
      const { data, error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'inventory_status', workspace_id: workspace!.id } });
      if (error) throw error;
      return data?.inventory ?? [];
    }, refetchInterval: 10_000,
  });
  const account = (accounts.data ?? []).find((item) => item.connection_state === 'connected' && ['healthy', 'degraded'].includes(item.health_status));

  async function request(icpId: string, reason: string) {
    if (!workspace || !account) return toast.error('Connect a healthy LinkedIn sender before prospecting.');
    const { error } = await supabase.functions.invoke('linkedin-v1-pipeline', { body: { action: 'request_replenishment', workspace_id: workspace.id, icp_id: icpId, linkedin_account_id: account.id, reason } });
    if (error) return toast.error('Prospecting could not be queued. No outreach was started.');
    toast.success('Prospecting is running in the background.');
    await queryClient.invalidateQueries({ queryKey: ['autonomous-inventory'] });
  }
  async function toggle(item: InventoryState) {
    const next = item.prospecting_status === 'paused' ? 'queued' : 'paused';
    const { error } = await supabase.from('icps').update({ prospecting_status: next, updated_at: new Date().toISOString() }).eq('workspace_id', workspace!.id).eq('id', item.id);
    if (error) return toast.error(error.message);
    await queryClient.invalidateQueries({ queryKey: ['autonomous-inventory'] });
    if (next === 'queued') await request(item.id, 'icp_activated');
  }
  async function create() {
    if (!workspace || !form.name.trim() || !form.offer.trim() || !form.market.trim() || !form.roles.trim()) return;
    setSaving(true);
    try {
      const { data: icp, error } = await supabase.from('icps').insert({ workspace_id: workspace.id, name: form.name.trim(), description: `${form.offer.trim()} for ${form.market.trim()}`, offer_context: { offer: form.offer.trim(), target_market: form.market.trim() }, status: 'completed', priority: 'secondary', prospecting_status: 'queued' }).select('id').single();
      if (error) throw error;
      const roles = form.roles.split(',').map((value) => value.trim()).filter(Boolean);
      const writes = [
        supabase.from('icp_company_profile').insert({ icp_id: icp.id, industry: form.market.trim() }),
        roles.length ? supabase.from('icp_decision_makers').insert(roles.map((job_title, index) => ({ icp_id: icp.id, job_title, seniority: 'decision maker', authority_score: Math.max(60, 100 - index * 5), priority: index ? 'medium' : 'high' }))) : Promise.resolve({ error: null }),
        form.pain.trim() ? supabase.from('icp_pain_points').insert({ icp_id: icp.id, pain_point: form.pain.trim(), severity: 'high', urgency: 'high' }) : Promise.resolve({ error: null }),
      ];
      const results = await Promise.all(writes);
      const childError = results.find((result) => result.error)?.error;
      if (childError) throw childError;
      setOpen(false); setForm({ name: '', offer: '', market: '', roles: '', pain: '' });
      await queryClient.invalidateQueries({ queryKey: ['autonomous-inventory'] });
      await request(icp.id, 'icp_activated');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'ICP could not be created.'); }
    finally { setSaving(false); }
  }

  return <div className="space-y-6">
    <PageHeader title="ICP & Offers" description="Reusable audiences that Yuktris keeps supplied with verified prospects." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create ICP</Button>} />
    <div className="grid gap-4 lg:grid-cols-2">{(inventory.data ?? []).map((item) => <Card key={item.id} className="p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-ink-100">{item.name}</h2><p className="mt-1 text-sm text-ink-400">{item.offer_context?.offer ?? 'Offer context not added'}</p></div><Badge tone={item.prospecting_status === 'needs_attention' ? 'danger' : 'neutral'}>{item.prospecting_status.replaceAll('_', ' ')}</Badge></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Verified" value={item.counts.verified} /><Metric label="Ready" value={item.counts.ready} /></div>
      <p className="mt-4 text-xs text-ink-500">{item.last_discovery_completed_at ? `Last refreshed ${new Date(item.last_discovery_completed_at).toLocaleString()}` : 'Prospecting has not completed yet.'}</p>
      {item.discovery_error && <p className="mt-2 text-xs text-error-300">Needs attention: {item.discovery_error}</p>}
      <div className="mt-4 flex gap-2"><Button variant="secondary" onClick={() => void toggle(item)}>{item.prospecting_status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{item.prospecting_status === 'paused' ? 'Activate Prospecting' : 'Pause Prospecting'}</Button><Button variant="ghost" disabled={item.prospecting_status === 'refreshing'} onClick={() => void request(item.id, 'scheduled_refresh')}><RefreshCw className="h-4 w-4" />Refresh</Button></div>
    </Card>)}</div>
    {!inventory.isLoading && !(inventory.data?.length) && <Card className="p-10 text-center"><Target className="mx-auto h-7 w-7 text-gold-400" /><h2 className="mt-3 font-semibold text-ink-100">Create your first reusable ICP</h2><p className="mt-1 text-sm text-ink-400">Yuktris will automatically build a verified prospect inventory after activation.</p></Card>}
    <Modal open={open} onClose={() => setOpen(false)} title="Create ICP" description="Describe one offer and the audience it serves." footer={<><Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button loading={saving} onClick={() => void create()}>Save & activate</Button></>}><div className="space-y-4"><div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="IT services decision makers" /></div><div><Label>Offer</Label><Input value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} placeholder="AI LinkedIn lead generation" /></div><div><Label>Target market</Label><Input value={form.market} onChange={(e) => setForm({ ...form, market: e.target.value })} placeholder="IT Service Providers" /></div><div><Label>Decision-maker roles</Label><Input value={form.roles} onChange={(e) => setForm({ ...form, roles: e.target.value })} placeholder="Founder, CEO, VP Sales" /></div><div><Label>Primary pain point</Label><Textarea value={form.pain} onChange={(e) => setForm({ ...form, pain: e.target.value })} /></div></div></Modal>
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-maroon-900/50 p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-xl font-semibold text-ink-100">{value}</p></div>; }
