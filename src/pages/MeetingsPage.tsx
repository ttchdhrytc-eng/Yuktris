import { useState, type FormEvent } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Calendar, Plus, Clock, MapPin, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input, Label, Textarea, Select } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatDateTime } from '@/lib/utils';
import type { Meeting, MeetingStatus, Prospect } from '@/types';

const statusTone: Record<MeetingStatus, 'brand' | 'success' | 'error' | 'neutral'> = {
  scheduled: 'brand',
  completed: 'success',
  cancelled: 'error',
  no_show: 'neutral',
};

export function MeetingsPage() {
  const { workspace } = useWorkspace();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', scheduled_at: '', duration_minutes: '30', location: '', prospect_id: '',
  });

  const { data: prospects } = useQuery({
    queryKey: ['prospects', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase.from('prospects').select('*').eq('workspace_id', workspace.id);
      return (data ?? []) as Prospect[];
    },
  });

  const { data: meetings, isLoading } = useQuery({
    queryKey: ['meetings', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const { data } = await supabase
        .from('meetings')
        .select('*, prospect:prospects(*)')
        .eq('workspace_id', workspace.id)
        .order('scheduled_at', { ascending: true });
      return (data ?? []) as Meeting[];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase.from('meetings').insert({
        workspace_id: workspace.id,
        title: form.title,
        description: form.description || null,
        scheduled_at: form.scheduled_at,
        duration_minutes: parseInt(form.duration_minutes) || 30,
        location: form.location || null,
        prospect_id: form.prospect_id || null,
        status: 'scheduled',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting scheduled.');
      setModalOpen(false);
      setForm({ title: '', description: '', scheduled_at: '', duration_minutes: '30', location: '', prospect_id: '' });
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      toast.success('Meeting removed.');
    },
    onError: (err) => toast.error(err.message),
  });

  const updateStatus = async (id: string, status: MeetingStatus) => {
    const { error } = await supabase.from('meetings').update({ status }).eq('id', id);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Meeting title is required.');
      return;
    }
    if (!form.scheduled_at) {
      toast.error('Please select a date and time.');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Booked meetings with your prospects."
        actions={
          <Button onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" />
            Schedule Meeting
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : meetings && meetings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {meetings.map((mtg) => (
            <Card key={mtg.id}>
              <CardContent>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <select
                    value={mtg.status}
                    onChange={(e) => updateStatus(mtg.id, e.target.value as MeetingStatus)}
                    className="bg-transparent text-xs border-0 cursor-pointer"
                  >
                    {(['scheduled', 'completed', 'cancelled', 'no_show'] as MeetingStatus[]).map((s) => (
                      <option key={s} value={s} className="bg-maroon-900">{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <h3 className="text-sm font-semibold text-ink-500">{mtg.title}</h3>
                {mtg.prospect && (
                  <p className="text-xs text-ink-500 mt-0.5">
                    {`${mtg.prospect.first_name ?? ''} ${mtg.prospect.last_name ?? ''}`.trim()}
                  </p>
                )}
                <div className="space-y-1.5 mt-3">
                  <div className="flex items-center gap-2 text-xs text-ink-500">
                    <Clock className="h-3.5 w-3.5 text-ink-500" />
                    {formatDateTime(mtg.scheduled_at)} · {mtg.duration_minutes}m
                  </div>
                  {mtg.location && (
                    <div className="flex items-center gap-2 text-xs text-ink-500">
                      <MapPin className="h-3.5 w-3.5 text-ink-500" />
                      {mtg.location}
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gold-500/8">
                  <Badge tone={statusTone[mtg.status]} dot>{mtg.status.replace('_', ' ')}</Badge>
                  <button onClick={() => deleteMutation.mutate(mtg.id)} className="text-ink-500 hover:text-error-400 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Calendar className="h-5 w-5" />}
          title="No meetings yet"
          description="Scheduled meetings with prospects will appear here."
          action={<Button onClick={() => setModalOpen(true)}><Plus className="h-4 w-4" />Schedule Meeting</Button>}
        />
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule Meeting"
        description="Book a meeting with a prospect."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} loading={createMutation.isPending}>Schedule</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Discovery Call" autoFocus />
          </div>
          <div>
            <Label>Prospect</Label>
            <Select value={form.prospect_id} onChange={(e) => setForm({ ...form, prospect_id: e.target.value })}>
              <option value="">No prospect</option>
              {prospects?.map((p) => (
                <option key={p.id} value={p.id}>
                  {`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown'}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Date & Time</Label>
              <Input type="datetime-local" value={form.scheduled_at} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} />
            </div>
            <div>
              <Label>Duration (minutes)</Label>
              <Select value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}>
                {[15, 30, 45, 60, 90].map((d) => <option key={d} value={d}>{d} minutes</option>)}
              </Select>
            </div>
          </div>
          <div>
            <Label>Location</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Zoom link or address" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Meeting agenda..." />
          </div>
        </div>
      </Modal>
    </div>
  );
}
