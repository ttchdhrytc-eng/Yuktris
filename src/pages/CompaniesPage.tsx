import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Plus, Globe, Search, Trash2, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatDate } from '@/lib/utils';
import type { Company } from '@/types';

const sizes = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'];
const industries = ['SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Manufacturing', 'Consulting', 'Marketing', 'Other'];

export function CompaniesPage() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '', website: '', industry: 'SaaS', size: '11-50', country: '', linkedin_url: '', description: '',
  });

  const { data: companies, isLoading } = useQuery({
    queryKey: ['companies', workspace?.id, search],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      let q = supabase.from('companies').select('*').eq('workspace_id', workspace.id);
      if (search) q = q.ilike('name', `%${search}%`);
      const { data } = await q.order('created_at', { ascending: false });
      return (data ?? []) as Company[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('companies').insert({
        workspace_id: workspace.id,
        name: form.name,
        website: form.website || null,
        industry: form.industry,
        size: form.size,
        country: form.country || null,
        linkedin_url: form.linkedin_url || null,
        description: form.description || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company added.');
      setModalOpen(false);
      setForm({ name: '', website: '', industry: 'SaaS', size: '11-50', country: '', linkedin_url: '', description: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('companies').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['companies'] });
      toast.success('Company removed.');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error('Company name is required.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Companies"
        description="Target accounts in your outreach pipeline."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Add Company
          </Button>
        }
      />

      <div className="mb-4 relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-500" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search companies..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : companies && companies.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Card key={company.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <button
                    onClick={() => deleteMutation.mutate(company.id)}
                    className="text-ink-500 hover:text-error-400 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <h3 className="text-sm font-semibold text-ink-500">{company.name}</h3>
                {company.website && (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1 mt-0.5"
                  >
                    <Globe className="h-3 w-3" />
                    {company.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {company.industry && <Badge tone="brand">{company.industry}</Badge>}
                  {company.size && <Badge tone="neutral">{company.size}</Badge>}
                  {company.country && <Badge tone="neutral">{company.country}</Badge>}
                </div>
                {company.description && (
                  <p className="text-xs text-ink-500 mt-3 line-clamp-2">{company.description}</p>
                )}
                <p className="text-[10px] text-ink-500 mt-3">Added {formatDate(company.created_at)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title="No companies yet"
          description="Add target companies to start building your outreach pipeline."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Add Company</Button>}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add Company"
        description="Add a target company to your workspace."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending}>Add Company</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Company name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Inc." autoFocus />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Industry</Label>
              <Select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}>
                {industries.map((i) => <option key={i} value={i}>{i}</option>)}
              </Select>
            </div>
            <div>
              <Label>Company size</Label>
              <Select value={form.size} onChange={(e) => setForm({ ...form, size: e.target.value })}>
                {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Country</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} placeholder="United States" />
          </div>
          <div>
            <Label>LinkedIn URL</Label>
            <Input value={form.linkedin_url} onChange={(e) => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/company/acme" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
