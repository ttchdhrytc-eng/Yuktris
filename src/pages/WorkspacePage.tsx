import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Building2, Save } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input, Label, Select } from '@/components/ui/Field';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';

const industries = ['SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Manufacturing', 'Consulting', 'Marketing', 'Real Estate', 'Education', 'Other'];
const countries = ['United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Netherlands', 'India', 'Singapore', 'Other'];
const timezones = ['UTC', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Europe/London', 'Europe/Paris', 'Asia/Kolkata', 'Asia/Singapore', 'Australia/Sydney'];

export function WorkspacePage() {
  const { workspace, refresh } = useWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    name: workspace?.name ?? '',
    website: workspace?.website ?? '',
    industry: workspace?.industry ?? 'SaaS',
    country: workspace?.country ?? 'United States',
    timezone: workspace?.timezone ?? 'UTC',
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!workspace) throw new Error('No workspace');
      const { error } = await supabase
        .from('workspaces')
        .update({
          name: form.name,
          website: form.website || null,
          industry: form.industry,
          country: form.country,
          timezone: form.timezone,
        })
        .eq('id', workspace.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspaces'] });
      refresh();
      toast.success('Workspace updated.');
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (form.name.trim().length < 2) {
      toast.error('Workspace name is required.');
      return;
    }
    updateMutation.mutate();
  };

  if (!workspace) {
    return (
      <div>
        <PageHeader title="Workspace" description="Manage your workspace settings." />
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Workspace" description="Manage your workspace settings and company profile." />

      <div className="max-w-2xl">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Company Profile</CardTitle>
              <p className="text-xs text-ink-500 mt-0.5">Update your workspace information</p>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Workspace name</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme Inc." />
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
                  <Label>Country</Label>
                  <Select value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}>
                    {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Select>
                </div>
              </div>
              <div>
                <Label>Timezone</Label>
                <Select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                  {timezones.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </div>
              <div className="flex justify-end pt-2">
                <Button type="submit" loading={updateMutation.isPending}>
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
