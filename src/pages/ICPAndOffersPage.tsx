import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pause, Play, RefreshCw, Target } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { CreateICPWithYuktrisModal } from '@/components/icp/CreateICPWithYuktrisModal';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';

type InventoryState = { id: string; name: string; offer_context: { offer?: string }; prospecting_status: string; next_refresh_at: string | null; last_discovery_started_at: string | null; last_discovery_completed_at: string | null; discovery_error: string | null; counts: { verified: number; ready: number } };

export function ICPAndOffersPage() {
  const { workspace } = useWorkspace();
  const accounts = useLinkedInAccounts();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
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
    if (next === 'queued') await request(item.id, 'scheduled_refresh');
  }
  return <div className="space-y-6">
    <PageHeader title="ICP & Offers" description="Reusable audiences that Yuktris keeps supplied with verified prospects." actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create ICP</Button>} />
    <div className="grid gap-4 lg:grid-cols-2">{(inventory.data ?? []).map((item) => <Card key={item.id} className="p-5">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-ink-100">{item.name}</h2><p className="mt-1 text-sm text-ink-400">{item.offer_context?.offer ?? 'Offer context not added'}</p></div><Badge tone={customerState(item).tone}>{customerState(item).label}</Badge></div>
      <div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Verified" value={item.counts.verified} /><Metric label="Ready" value={item.counts.ready} /></div>
      <p className="mt-3 text-xs text-ink-400">{customerState(item).description}</p>
      <p className="mt-2 text-xs text-ink-500">{item.last_discovery_completed_at ? `Last refreshed ${new Date(item.last_discovery_completed_at).toLocaleString()}` : 'Prospecting has not completed yet.'}{item.next_refresh_at && item.prospecting_status !== 'paused' ? ` Next refresh after ${new Date(item.next_refresh_at).toLocaleString()}.` : ''}</p>
      <div className="mt-4 flex gap-2"><Button variant="secondary" onClick={() => void toggle(item)}>{item.prospecting_status === 'paused' ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}{item.prospecting_status === 'paused' ? 'Resume' : 'Pause'}</Button><Button variant="ghost" disabled={item.prospecting_status === 'refreshing'} onClick={() => void request(item.id, 'scheduled_refresh')}><RefreshCw className="h-4 w-4" />Refresh</Button></div>
    </Card>)}</div>
    {!inventory.isLoading && !(inventory.data?.length) && <Card className="p-10 text-center"><Target className="mx-auto h-7 w-7 text-gold-400" /><h2 className="mt-3 font-semibold text-ink-100">Create your first reusable ICP</h2><p className="mt-1 text-sm text-ink-400">Yuktris will automatically build a verified prospect inventory after activation.</p></Card>}
    <CreateICPWithYuktrisModal open={open} onClose={() => setOpen(false)} onCreated={async () => { await queryClient.invalidateQueries({ queryKey: ['autonomous-inventory'] }); }} />
  </div>;
}
function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-lg bg-maroon-900/50 p-3"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-xl font-semibold text-ink-100">{value}</p></div>; }

function customerState(item: InventoryState): { label: string; description: string; tone: 'neutral' | 'error' | 'success' | 'warning' } {
  if (item.prospecting_status === 'paused') return { label: 'Paused', description: 'Automatic prospect discovery is paused.', tone: 'neutral' };
  if (item.prospecting_status === 'refreshing' || (item.last_discovery_started_at && (!item.last_discovery_completed_at || item.last_discovery_started_at > item.last_discovery_completed_at))) return { label: 'Updating', description: 'Yuktris is finding and verifying new prospects.', tone: 'warning' };
  if (item.prospecting_status === 'needs_attention') return { label: 'Needs attention', description: "Prospecting couldn't complete. Yuktris will retry after the issue is resolved.", tone: 'error' };
  if (item.prospecting_status === 'up_to_date' && item.counts.ready > 0) return { label: 'Up to date', description: 'The prospect pool is currently at its configured level.', tone: 'success' };
  return { label: 'Active', description: 'Yuktris is continuously finding matching prospects in bounded batches.', tone: 'success' };
}
