import { useQuery } from '@tanstack/react-query';
import {
  TrendingUp,
  Send,
  Reply,
  Calendar,
  Target,
  Users,
  Building2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn } from '@/lib/utils';

export function AnalyticsPage() {
  const { workspace } = useWorkspace();

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const wsId = workspace.id;
      const [
        companies, prospects, messagesSent, messagesReceived, meetings, campaigns,
      ] = await Promise.all([
        supabase.from('companies').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
        supabase.from('prospects').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('direction', 'sent'),
        supabase.from('messages').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('direction', 'received'),
        supabase.from('meetings').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
        supabase.from('campaigns').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
      ]);

      return {
        companies: companies.count ?? 0,
        prospects: prospects.count ?? 0,
        messagesSent: messagesSent.count ?? 0,
        replies: messagesReceived.count ?? 0,
        meetings: meetings.count ?? 0,
        campaigns: campaigns.count ?? 0,
      };
    },
  });

  const { data: weeklyData } = useQuery({
    queryKey: ['analytics-weekly', workspace?.id],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return [];
      const wsId = workspace.id;
      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

      const [sentMsgs, receivedMsgs, meetingsData] = await Promise.all([
        supabase.from('messages').select('created_at').eq('workspace_id', wsId).eq('direction', 'sent').gte('created_at', sixWeeksAgo.toISOString()),
        supabase.from('messages').select('created_at').eq('workspace_id', wsId).eq('direction', 'received').gte('created_at', sixWeeksAgo.toISOString()),
        supabase.from('meetings').select('created_at').eq('workspace_id', wsId).gte('created_at', sixWeeksAgo.toISOString()),
      ]);

      const weeks: Record<string, { sent: number; replies: number; meetings: number }> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i * 7);
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = `W${6 - i}`;
        weeks[key] = { sent: 0, replies: 0, meetings: 0 };
      }

      const getWeekKey = (dateStr: string, idx: number) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now.getTime() - d.getTime()) / (7 * 24 * 60 * 60 * 1000));
        return `W${6 - diff}`;
      };

      for (const m of (sentMsgs.data ?? []) as { created_at: string }[]) {
        const key = getWeekKey(m.created_at, 0);
        if (weeks[key]) weeks[key].sent++;
      }
      for (const m of (receivedMsgs.data ?? []) as { created_at: string }[]) {
        const key = getWeekKey(m.created_at, 0);
        if (weeks[key]) weeks[key].replies++;
      }
      for (const m of (meetingsData.data ?? []) as { created_at: string }[]) {
        const key = getWeekKey(m.created_at, 0);
        if (weeks[key]) weeks[key].meetings++;
      }

      return Object.entries(weeks).map(([week, val]) => ({ week, ...val }));
    },
  });

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Analytics" description="Deep insights into your revenue operations." />
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      </div>
    );
  }

  const d = data!;
  const replyRate = d.messagesSent > 0 ? ((d.replies / d.messagesSent) * 100).toFixed(1) : '0';
  const meetingRate = d.replies > 0 ? ((d.meetings / d.replies) * 100).toFixed(1) : '0';
  const conversionRate = d.prospects > 0 ? ((d.meetings / d.prospects) * 100).toFixed(1) : '0';

  const chartWeekly = weeklyData && weeklyData.length > 0
    ? weeklyData
    : [{ week: 'W1', sent: 0, replies: 0, meetings: 0 }];

  const channelData = [
    { name: 'Email', value: d.messagesSent, fill: '#3b82f6' },
  ];

  const contactedCount = d.prospects > 0 ? Math.min(d.prospects, d.messagesSent) : 0;

  const statusData = [
    { status: 'New', count: d.prospects, fill: '#3b82f6' },
    { status: 'Contacted', count: contactedCount, fill: '#60a5fa' },
    { status: 'Replied', count: d.replies, fill: '#22c55e' },
    { status: 'Meetings', count: d.meetings, fill: '#eab308' },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Deep insights into your revenue operations."
        actions={<Badge tone="brand" dot>Live</Badge>}
      />

      {/* Key metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <MetricBox label="Reply Rate" value={`${replyRate}%`} icon={Reply} tone="success" />
        <MetricBox label="Meeting Rate" value={`${meetingRate}%`} icon={Calendar} tone="brand" />
        <MetricBox label="Conversion Rate" value={`${conversionRate}%`} icon={Target} tone="warning" />
        <MetricBox label="Active Campaigns" value={String(d.campaigns)} icon={TrendingUp} tone="neutral" />
      </div>

      {/* Weekly trend */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Weekly Performance Trend</CardTitle>
          <p className="text-xs text-ink-500 mt-0.5">Messages sent, replies, and meetings over the last 6 weeks</p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chartWeekly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="aSent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="aReplies" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="week" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="sent" stroke="#3b82f6" strokeWidth={2} fill="url(#aSent)" name="Sent" />
              <Area type="monotone" dataKey="replies" stroke="#22c55e" strokeWidth={2} fill="url(#aReplies)" name="Replies" />
              <Area type="monotone" dataKey="meetings" stroke="#eab308" strokeWidth={2} fill="none" name="Meetings" />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Channel distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Channel Distribution</CardTitle>
            <p className="text-xs text-ink-500 mt-0.5">Messages by outreach channel</p>
          </CardHeader>
          <CardContent>
            {d.messagesSent > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={channelData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={85} paddingAngle={2}>
                    {channelData.map((e, i) => <Cell key={i} fill={e.fill} stroke="none" />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }} />
                  <Legend wrapperStyle={{ fontSize: '12px', color: '#a1a1aa' }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[240px] text-sm text-ink-500">
                No messages sent yet
              </div>
            )}
          </CardContent>
        </Card>

        {/* Funnel */}
        <Card>
          <CardHeader>
            <CardTitle>Conversion Funnel</CardTitle>
            <p className="text-xs text-ink-500 mt-0.5">Prospects through each pipeline stage</p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 20, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
                <XAxis type="number" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="status" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} width={70} />
                <Tooltip contentStyle={{ background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '12px' }} cursor={{ fill: '#27272a20' }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {statusData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Companies" value={d.companies} icon={Building2} />
        <SummaryCard label="Total Prospects" value={d.prospects} icon={Users} />
        <SummaryCard label="Messages Sent" value={d.messagesSent} icon={Send} />
        <SummaryCard label="Meetings Booked" value={d.meetings} icon={Calendar} />
      </div>
    </div>
  );
}

function MetricBox({ label, value, icon: Icon, tone }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warning' | 'neutral';
}) {
  const tones = {
    brand: 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400',
    success: 'bg-success-500/10 text-success-400',
    warning: 'bg-warning-500/10 text-warning-500',
    neutral: 'bg-card-900 text-ink-500',
  };
  return (
    <Card className="p-4">
      <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg mb-3', tones[tone])}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-2xl font-semibold text-ink-500">{value}</p>
      <p className="text-xs text-ink-500 mt-0.5">{label}</p>
    </Card>
  );
}

function SummaryCard({ label, value, icon: Icon }: {
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
