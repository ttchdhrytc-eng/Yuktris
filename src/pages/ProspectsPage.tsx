import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Users, Plus, Search, Trash2, Mail, Linkedin } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatDate } from '@/lib/utils';
import type { Prospect, ProspectStatus, Company } from '@/types';
import { fetchCampaignProspects } from '@/services/campaign-prospects';

export function ProspectsPage() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', title: '', email: '', linkedin_url: '', phone: '', company_id: '',
  });

  const { data: companies, isError: companiesError } = useQuery({
    queryKey: ['companies', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data, error } = await supabase.from('companies').select('*').eq('workspace_id', workspace.id);
      if (error) throw error;
      return (data ?? []) as Company[];
    },
  });

  const { data: prospects, isLoading, isError: prospectsError } = useQuery({
    queryKey: ['prospects', workspace?.id, search, statusFilter],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      let q = supabase
        .from('prospects')
        .select('*, company:companies(*)')
        .eq('workspace_id', workspace.id);
      if (search) q = q.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`);
      if (statusFilter) q = q.eq('status', statusFilter);
      const { data, error } = await q.order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as Prospect[];
    },
  });
  const { data: campaignProspects, isLoading: campaignProspectsLoading, isError: campaignProspectsError } = useQuery({
    queryKey: ['campaign-prospects', workspace?.id], enabled: !!workspace?.id,
    queryFn: () => fetchCampaignProspects(workspace!.id),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('prospects').insert({
        workspace_id: workspace.id,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        title: form.title || null,
        email: form.email || null,
        linkedin_url: form.linkedin_url || null,
        phone: form.phone || null,
        company_id: form.company_id || null,
        status: 'new',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success('Prospect added.');
      setModalOpen(false);
      setForm({ first_name: '', last_name: '', title: '', email: '', linkedin_url: '', phone: '', company_id: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('prospects').delete().eq('workspace_id', workspace.id).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
      toast.success('Prospect removed.');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = async (id: string, status: ProspectStatus) => {
    if (!workspace) return;
    const { error } = await supabase.from('prospects').update({ status }).eq('workspace_id', workspace.id).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['prospects'] });
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.first_name && !form.last_name && !form.email) {
      toast.error('Please enter at least a name or email.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Prospects"
        description="Individual contacts in your outreach pipeline."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Prospect
          </Button>
        }
      />

      {(companiesError || prospectsError || campaignProspectsError) && <Card className="mb-4 border-error-500/30 p-4 text-sm text-error-300">Prospect data could not be loaded. Refresh this page; no prospect was added or changed.</Card>}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search prospects..." className="pl-9" />
        </div>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[160px]">
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="replied">Replied</option>
          <option value="meeting_booked">Meeting Booked</option>
          <option value="qualified">Qualified</option>
          <option value="disqualified">Disqualified</option>
        </Select>
      </div>

      {(campaignProspectsLoading || (campaignProspects?.length ?? 0) > 0) && <Card className="mb-4">
        <div className="border-b border-gold-500/10 px-4 py-3"><h2 className="text-sm font-semibold text-ink-100">Campaign prospects</h2><p className="text-xs text-ink-500">Prospects genuinely discovered for your campaigns.</p></div>
        {campaignProspectsLoading ? <div className="flex justify-center py-8"><Spinner className="h-5 w-5" /></div> : <div className="overflow-x-auto"><table className="w-full"><thead><tr className="border-b border-gold-500/10 text-left"><th className="px-4 py-3 text-xs text-ink-500">Name</th><th className="px-4 py-3 text-xs text-ink-500">Company</th><th className="px-4 py-3 text-xs text-ink-500">Outreach status</th><th className="px-4 py-3 text-xs text-ink-500">Last / next action</th><th className="px-4 py-3 text-xs text-ink-500">Discovered</th></tr></thead><tbody>{campaignProspects?.map(p => <tr key={p.jobId} className="border-b border-gold-500/8 last:border-0"><td className="px-4 py-3"><p className="text-sm text-ink-100">{p.name}</p><p className="text-xs text-ink-500">{p.title ?? 'Title unavailable'}</p>{p.linkedinUrl && <a href={p.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:underline">LinkedIn profile</a>}</td><td className="px-4 py-3 text-sm text-ink-300">{p.company ?? 'Company unavailable'}</td><td className="px-4 py-3 text-sm text-ink-300">{p.status}</td><td className="px-4 py-3 text-xs text-ink-500"><p>{p.lastAction ?? 'No action yet'}</p><p>Next: {p.nextAction ?? 'None scheduled'}</p></td><td className="px-4 py-3 text-xs text-ink-500">{formatDate(p.createdAt)}</td></tr>)}</tbody></table></div>}
      </Card>}

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : prospects && prospects.length > 0 ? (
        <Card>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gold-500/12 text-left">
                  <th className="px-4 py-3 text-xs font-medium text-ink-500">Name</th>
                  <th className="px-4 py-3 text-xs font-medium text-ink-500">Title</th>
                  <th className="px-4 py-3 text-xs font-medium text-ink-500">Company</th>
                  <th className="px-4 py-3 text-xs font-medium text-ink-500">Status</th>
                  <th className="px-4 py-3 text-xs font-medium text-ink-500">Added</th>
                  <th className="px-4 py-3 text-xs font-medium text-ink-500 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {prospects.map((p) => (
                  <tr key={p.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/20 text-brand-300 text-xs font-medium">
                          {((p.first_name ?? '?')[0] ?? '?')}{((p.last_name ?? '')[0] ?? '')}
                        </div>
                        <div>
                          <p className="text-sm text-ink-500">{`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown'}</p>
                          {p.email && <p className="text-xs text-ink-500">{p.email}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-ink-500">{p.title ?? '—'}</td>
                    <td className="px-4 py-3 text-sm text-ink-500">{p.company?.name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={p.status}
                        onChange={(e) => updateStatus(p.id, e.target.value as ProspectStatus)}
                        className="bg-transparent text-xs border-0 cursor-pointer"
                        style={{ color: 'inherit' }}
                      >
                        {(['new', 'contacted', 'replied', 'meeting_booked', 'qualified', 'disqualified'] as ProspectStatus[]).map((s) => (
                          <option key={s} value={s} className="bg-maroon-900">{s.replace('_', ' ')}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-500">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {p.email && (
                          <a href={`mailto:${p.email}`} className="p-1.5 text-ink-500 hover:text-ink-500 transition-colors">
                            <Mail className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {p.linkedin_url && (
                          <a href={p.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-ink-500 hover:text-ink-500 transition-colors">
                            <Linkedin className="h-3.5 w-3.5" />
                          </a>
                        )}
                        <button onClick={() => deleteMutation.mutate(p.id)} className="p-1.5 text-ink-500 hover:text-error-400 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (campaignProspects?.length ?? 0) === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No prospects yet"
          description="Add prospects individually or import them to start your outreach campaigns."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Add Prospect</Button>}
        />
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Prospect"
        description="Add a new prospect to your workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending}>Add Prospect</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>First name</Label>
              <Input value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} placeholder="Jane" autoFocus />
            </div>
            <div>
              <Label>Last name</Label>
              <Input value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} placeholder="Doe" />
            </div>
          </div>
          <div>
            <Label>Job title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="VP of Sales" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@acme.com" />
          </div>
          <div>
            <Label>Company</Label>
            <Select value={form.company_id} onChange={(e) => setForm({ ...form, company_id: e.target.value })}>
              <option value="">No company</option>
              {companies?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>LinkedIn URL</Label>
              <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/jane" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0000" />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
