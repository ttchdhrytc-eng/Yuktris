import { useQuery } from '@tanstack/react-query';
import { Database, Building2, Users, Send, Calendar, Mail, Reply } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { formatDate, cn } from '@/lib/utils';
import type { Company, Prospect, Campaign, Meeting, Message } from '@/types';

export function CRMPage() {
  const { workspace } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ['crm', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const wsId = workspace.id;
      const [companies, prospects, campaigns, meetings, messages] = await Promise.all([
        supabase.from('companies').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
        supabase.from('prospects').select('*, company:companies(*)').eq('workspace_id', wsId).order('created_at', { ascending: false }),
        supabase.from('campaigns').select('*').eq('workspace_id', wsId).order('created_at', { ascending: false }),
        supabase.from('meetings').select('*, prospect:prospects(*)').eq('workspace_id', wsId).order('scheduled_at', { ascending: false }),
        supabase.from('messages').select('*, prospect:prospects(*)').eq('workspace_id', wsId).order('created_at', { ascending: false }).limit(10),
      ]);
      return {
        companies: (companies.data ?? []) as Company[],
        prospects: (prospects.data ?? []) as Prospect[],
        campaigns: (campaigns.data ?? []) as Campaign[],
        meetings: (meetings.data ?? []) as Meeting[],
        messages: (messages.data ?? []) as Message[],
      };
    },
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="CRM" description="Unified view of your customer relationships." />
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      </div>
    );
  }

  if (!data || (data.companies.length === 0 && data.prospects.length === 0)) {
    return (
      <div>
        <PageHeader title="CRM" description="Unified view of your customer relationships." />
        <EmptyState
          icon={<Database className="h-5 w-5" />}
          title="CRM is empty"
          description="Add companies and prospects to start building your CRM database."
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="CRM" description="Unified view of your customer relationships." />

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Companies" value={data.companies.length} icon={Building2} />
        <StatCard label="Prospects" value={data.prospects.length} icon={Users} />
        <StatCard label="Campaigns" value={data.campaigns.length} icon={Send} />
        <StatCard label="Meetings" value={data.meetings.length} icon={Calendar} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Companies */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Companies</CardTitle>
            <Badge tone="neutral">{data.companies.length}</Badge>
          </CardHeader>
          <CardContent>
            {data.companies.length > 0 ? (
              <div className="space-y-2">
                {data.companies.slice(0, 8).map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2 border-b border-gold-500/8 last:border-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 shrink-0">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-500 truncate">{c.name}</p>
                      <p className="text-xs text-ink-500">{c.industry ?? '—'}</p>
                    </div>
                    <span className="text-xs text-ink-500">{formatDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-ink-500 py-4 text-center">No companies</p>}
          </CardContent>
        </Card>

        {/* Prospects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Prospects</CardTitle>
            <Badge tone="neutral">{data.prospects.length}</Badge>
          </CardHeader>
          <CardContent>
            {data.prospects.length > 0 ? (
              <div className="space-y-2">
                {data.prospects.slice(0, 8).map((p) => (
                  <div key={p.id} className="flex items-center gap-3 py-2 border-b border-gold-500/8 last:border-0">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/20 text-brand-300 text-xs font-medium shrink-0">
                      {((p.first_name ?? '?')[0] ?? '?')}{((p.last_name ?? '')[0] ?? '')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-500 truncate">
                        {`${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Unknown'}
                      </p>
                      <p className="text-xs text-ink-500 truncate">{p.title ?? '—'} · {p.company?.name ?? '—'}</p>
                    </div>
                    <Badge tone="neutral">{p.status}</Badge>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-ink-500 py-4 text-center">No prospects</p>}
          </CardContent>
        </Card>

        {/* Recent messages */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Interactions</CardTitle>
            <Badge tone="neutral">{data.messages.length}</Badge>
          </CardHeader>
          <CardContent>
            {data.messages.length > 0 ? (
              <div className="space-y-2">
                {data.messages.map((msg) => (
                  <div key={msg.id} className="flex items-start gap-3 py-2 border-b border-gold-500/8 last:border-0">
                    <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg shrink-0',
                      msg.direction === 'sent' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' : 'bg-success-500/10 text-success-400'
                    )}>
                      {msg.direction === 'sent' ? <Mail className="h-4 w-4" /> : <Reply className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-ink-500">
                        {msg.prospect ? `${msg.prospect.first_name ?? ''} ${msg.prospect.last_name ?? ''}`.trim() : 'Unknown'}
                        <span className="text-ink-500 ml-2">· {msg.direction}</span>
                      </p>
                      <p className="text-xs text-ink-500 truncate">{msg.body?.slice(0, 100) ?? 'No content'}</p>
                    </div>
                    <span className="text-xs text-ink-500 shrink-0">{formatDate(msg.created_at)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-xs text-ink-500 py-4 text-center">No interactions yet</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon }: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-900 text-ink-500">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-lg font-semibold text-ink-500">{value}</p>
        <p className="text-xs text-ink-500">{label}</p>
      </div>
    </Card>
  );
}
