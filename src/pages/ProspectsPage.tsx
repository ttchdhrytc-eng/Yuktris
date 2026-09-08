import { Fragment, useMemo, useState } from 'react';
import { ExternalLink, Search, Sparkles, Users } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Field';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';

type InventoryRow = {
  id: string; prospect_id: string; fit_score: number;
  fit_evidence: Record<string, unknown> | null; provenance: Record<string, unknown> | null;
  intent_status: string; intent_evidence: Record<string, unknown> | null;
  readiness: string; verification_status: string;
  icps: { name: string } | null;
  prospects: { id: string; first_name: string | null; last_name: string | null; title: string | null; company_name: string | null; company_website: string | null; normalized_linkedin_url: string | null; status: string } | null;
};

export function ProspectsPage() {
  const { workspace } = useWorkspace();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const inventory = useQuery({
    queryKey: ['prospect-inventory', workspace?.id], enabled: Boolean(workspace),
    queryFn: async (): Promise<InventoryRow[]> => {
      const { data, error } = await supabase.from('icp_prospects').select('id,prospect_id,fit_score,fit_evidence,provenance,intent_status,intent_evidence,readiness,verification_status,icps(name),prospects(id,first_name,last_name,title,company_name,company_website,normalized_linkedin_url,status)').eq('workspace_id', workspace!.id).order('fit_score', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InventoryRow[];
    }, refetchInterval: 10_000,
  });
  const reservations = useQuery({
    queryKey: ['prospect-campaign-bindings', workspace?.id], enabled: Boolean(workspace),
    queryFn: async () => {
      const { data, error } = await supabase.from('campaign_prospect_reservations').select('prospect_id,status,customer_campaigns(name)').eq('workspace_id', workspace!.id).in('status', ['reserved', 'consumed']);
      if (error) throw error;
      return data ?? [];
    },
  });
  const campaignByProspect = useMemo(() => new Map((reservations.data ?? []).map((row: any) => [row.prospect_id, row.customer_campaigns?.name ?? null])), [reservations.data]);
  const rows = useMemo(() => (inventory.data ?? []).filter((row) => {
    const person = row.prospects;
    const haystack = `${person?.first_name ?? ''} ${person?.last_name ?? ''} ${person?.title ?? ''} ${person?.company_name ?? ''} ${row.icps?.name ?? ''}`.toLowerCase();
    if (search && !haystack.includes(search.toLowerCase())) return false;
    if (filter === 'ready') return row.readiness === 'ready' && row.verification_status === 'verified';
    if (filter === 'high_fit') return row.fit_score >= 80 && row.verification_status === 'verified';
    if (filter === 'intent') return row.intent_status === 'evidenced';
    if (filter === 'contacted') return person?.status === 'contacted';
    if (filter === 'connected') return person?.status === 'connected';
    if (filter === 'replied') return person?.status === 'replied';
    if (filter === 'qualified') return person?.status === 'qualified';
    if (filter === 'excluded') return row.readiness === 'excluded' || person?.status === 'disqualified';
    return true;
  }), [filter, inventory.data, search]);
  const all = inventory.data ?? [];

  return <div>
    <PageHeader title="Prospects" description="Real, source-verified prospects Yuktris discovers and maintains for your ICPs." />
    {(inventory.isError || reservations.isError) && <Card className="mb-4 border-error-500/30 p-4 text-sm text-error-300">Prospect inventory could not be loaded. Refresh this page; no prospect or campaign was changed.</Card>}
    <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5"><Metric label="Discovered" value={all.length} /><Metric label="Verified" value={all.filter((row) => row.verification_status === 'verified').length} /><Metric label="High fit" value={all.filter((row) => row.fit_score >= 80 && row.verification_status === 'verified').length} /><Metric label="Intent detected" value={all.filter((row) => row.intent_status === 'evidenced').length} /><Metric label="Ready" value={all.filter((row) => row.readiness === 'ready' && row.verification_status === 'verified').length} /></div>
    <Card>
      <div className="border-b border-gold-500/10 px-4 py-4"><h2 className="flex items-center gap-2 text-sm font-semibold text-ink-100"><Sparkles className="h-4 w-4 text-gold-400" />Autonomous prospect inventory</h2><p className="mt-1 text-xs text-ink-500">Only canonical ICP inventory appears here. Campaign execution history and internal diagnostics remain in their appropriate campaign and system records.</p></div>
      <div className="flex flex-col gap-3 border-b border-gold-500/10 p-4 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, company, role, or ICP" /></div><Select className="sm:max-w-48" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All</option><option value="ready">Ready</option><option value="high_fit">High fit</option><option value="intent">Intent</option><option value="contacted">Contacted</option><option value="connected">Connected</option><option value="replied">Replied</option><option value="qualified">Qualified</option><option value="excluded">Excluded</option></Select></div>
      {inventory.isLoading ? <div className="flex justify-center py-16"><Spinner /></div> : rows.length ? <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gold-500/10 text-left">{['Prospect', 'Company', 'ICP', 'Fit', 'Intent', 'Status', 'Campaign'].map((label) => <th key={label} className="px-4 py-3 text-xs text-ink-500">{label}</th>)}</tr></thead><tbody>{rows.map((row) => {
        const person = row.prospects;
        return <Fragment key={row.id}><tr className="cursor-pointer border-b border-gold-500/8 hover:bg-card-800" onClick={() => setExpanded(expanded === row.id ? null : row.id)}><td className="px-4 py-3"><p className="text-sm text-ink-100">{`${person?.first_name ?? ''} ${person?.last_name ?? ''}`.trim() || 'Verified prospect'}</p><p className="text-xs text-ink-500">{person?.title || 'Current role verified'}</p></td><td className="px-4 py-3"><p className="text-sm text-ink-300">{person?.company_name || 'Verified company'}</p>{person?.company_website && <a href={person.company_website} onClick={(event) => event.stopPropagation()} target="_blank" rel="noopener noreferrer" className="text-xs text-gold-400 hover:underline">Company source</a>}</td><td className="px-4 py-3 text-sm text-ink-300">{row.icps?.name ?? 'ICP'}</td><td className="px-4 py-3 text-sm text-ink-300">{row.fit_score}%</td><td className="px-4 py-3 text-sm text-ink-300">{row.intent_status === 'evidenced' ? 'Evidenced' : 'No intent evidenced'}</td><td className="px-4 py-3 text-sm capitalize text-ink-300">{safeStatus(row)}</td><td className="px-4 py-3 text-sm text-ink-300">{campaignByProspect.get(row.prospect_id) ?? 'Not assigned'}</td></tr>{expanded === row.id && <tr className="border-b border-gold-500/8 bg-maroon-950/30"><td colSpan={7} className="px-4 py-4"><p className="text-xs font-medium uppercase tracking-wide text-ink-500">Why this prospect</p><p className="mt-1 max-w-3xl text-sm text-ink-300">{customerReason(row)}</p>{person?.normalized_linkedin_url && <a href={person.normalized_linkedin_url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-sm text-gold-400 hover:underline">LinkedIn profile <ExternalLink className="h-3.5 w-3.5" /></a>}</td></tr>}</Fragment>;
      })}</tbody></table></div> : <div className="p-8"><EmptyState icon={<Users className="h-5 w-5" />} title="Yuktris is building your prospect inventory" description="Verified prospects will appear here after bounded background discovery completes. Returning zero is valid when candidates do not pass the quality gates." /></div>}
    </Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: number }) { return <Card className="p-4"><p className="text-xs text-ink-500">{label}</p><p className="mt-1 text-2xl font-semibold text-ink-100">{value}</p></Card>; }
function safeStatus(row: InventoryRow): string { if (row.readiness === 'excluded') return 'Excluded'; const status = row.prospects?.status; if (status === 'meeting_booked') return 'Meeting ready'; if (['contacted', 'connected', 'replied', 'qualified', 'disqualified'].includes(status ?? '')) return status!.replace('_', ' '); if (row.readiness === 'ready' && row.verification_status === 'verified') return 'Ready'; return row.verification_status === 'verified' ? 'Verified' : 'Verifying'; }
function customerReason(row: InventoryRow): string { const fit = row.fit_evidence ?? {}; const company = typeof fit.company_fit === 'string' ? fit.company_fit : ''; const person = typeof fit.person_fit === 'string' ? fit.person_fit : ''; return [company, person].filter(Boolean).join(' ') || 'Yuktris verified the current role, company association, canonical LinkedIn identity, and ICP fit from source evidence.'; }
