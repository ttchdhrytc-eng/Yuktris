import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Send, Plus, Play, Pause, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatDate } from '@/lib/utils';
import type { Campaign, CampaignStatus } from '@/types';

const statusTone: Record<CampaignStatus, 'neutral' | 'success' | 'warning' | 'brand'> = {
  draft: 'neutral',
  active: 'success',
  paused: 'warning',
  completed: 'brand',
};

export function CampaignsPage() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', start_date: '', end_date: '' });

  const { data: campaigns, isLoading } = useQuery({
    queryKey: ['campaigns', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false });
      return (data ?? []) as Campaign[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('campaigns').insert({
        workspace_id: workspace.id,
        name: form.name,
        description: form.description || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created.');
      setModalOpen(false);
      setForm({ name: '', description: '', start_date: '', end_date: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = async (id: string, status: CampaignStatus) => {
    const { error } = await supabase.from('campaigns').update({ status }).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success(`Campaign ${status}.`);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign deleted.');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error('Campaign name is required.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Outreach campaigns targeting your prospects."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            New Campaign
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : campaigns && campaigns.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {campaigns.map((c) => (
            <Card key={c.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
                    <Send className="h-5 w-5" />
                  </div>
                  <Badge tone={statusTone[c.status]} dot>{c.status}</Badge>
                </div>
                <h3 className="text-sm font-semibold text-ink-500">{c.name}</h3>
                {c.description && <p className="text-xs text-ink-500 mt-1 line-clamp-2">{c.description}</p>}
                <div className="flex items-center gap-3 mt-3 text-xs text-ink-500">
                  <span>{c.start_date ? formatDate(c.start_date) : 'No start'}</span>
                  <span>→</span>
                  <span>{c.end_date ? formatDate(c.end_date) : 'No end'}</span>
                </div>
                <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gold-500/8">
                  {c.status === 'active' ? (
                    <Button variant="ghost" size="sm" onClick={() => updateStatus(c.id, 'paused')}>
                      <Pause className="h-3.5 w-3.5" /> Pause
                    </Button>
                  ) : c.status === 'paused' ? (
                    <Button variant="primary" size="sm" onClick={() => updateStatus(c.id, 'active')}>
                      <Play className="h-3.5 w-3.5" /> Resume
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={() => updateStatus(c.id, 'active')}>
                      <Play className="h-3.5 w-3.5" /> Launch
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => deleteMutation.mutate(c.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title="No campaigns yet"
          description="Create your first outreach campaign to start engaging prospects."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />New Campaign</Button>}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="New Campaign"
        description="Create a new outreach campaign."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending}>Create Campaign</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Campaign name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Q1 SaaS Outreach" autoFocus />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Targeting VP Sales at SaaS companies..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            </div>
            <div>
              <Label>End date</Label>
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
