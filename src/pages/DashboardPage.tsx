import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Calendar, MessageSquare, Rocket, ArrowRight,
  CheckCircle2, AlertTriangle, TrendingUp, Sparkles,
  ChevronRight, Users, Send, Target, DollarSign,
  PlayCircle, Linkedin, Mail, Hand, FileText, RefreshCw,
  Zap, Award, Clock3, BarChart3,
  Video, Activity,
} from 'lucide-react';
import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { supabase } from '@/lib/supabase';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { timeAgo, formatNumber, cn } from '@/lib/utils';
import { useGoogleConnection } from '@/hooks/useGoogleAuth';
import { useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';
import { GOOGLE_SCOPES } from '@/types/google-auth';
import { buildCampaignMetrics, CAMPAIGN_STATUS_LABELS, type CampaignMetricSet } from '@/services/campaign-metrics';

type DateRange = 'today' | 'week' | 'month' | 'all';

export function DashboardPage() {
  const navigate = useNavigate();
  const { workspace } = useWorkspace();
  const { user } = useAuth();
  const googleConnection = useGoogleConnection();
  const linkedinAccounts = useLinkedInAccounts();
  const [range, setRange] = useState<DateRange>('week');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['exec-dashboard-v2', workspace?.id, range],
    enabled: !!workspace?.id,
    queryFn: async () => {
      if (!workspace) return null;
      const wsId = workspace.id;

      const [
        campaigns, prospects, meetings, messages, upcomingMeetings,
        repliedProspects, proposals, executionJobs, linkedinMessages,
        linkedinConversations, qualifiedContacts, meetingConfirmations, customerCampaigns,
      ] = await Promise.all([
        supabase.from('customer_campaigns').select('id, name, status, created_at').eq('workspace_id', wsId).order('created_at', { ascending: false }),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId),
        supabase.from('meetings').select('id, status', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'scheduled'),
        supabase.from('messages').select('id, direction').eq('workspace_id', wsId),
        supabase.from('meetings').select('id, title, scheduled_at, duration_minutes, prospect_id').eq('workspace_id', wsId).eq('status', 'scheduled').gte('scheduled_at', new Date().toISOString()).order('scheduled_at', { ascending: true }).limit(5),
        supabase.from('prospects').select('id, first_name, last_name, title, company_name, status, created_at').eq('workspace_id', wsId).eq('status', 'replied').order('created_at', { ascending: false }).limit(5),
        supabase.from('proposal_approvals').select('id, approval_status, approval_notes, created_at').eq('workspace_id', wsId).eq('approval_status', 'pending').order('created_at', { ascending: false }).limit(5),
        supabase.from('linkedin_execution_jobs').select('contact_id,action_type,status,action_payload').eq('workspace_id', wsId),
        supabase.from('linkedin_messages').select('conversation_id,direction,classification,metadata').eq('workspace_id', wsId),
        supabase.from('linkedin_conversations').select('id,stage,metadata,prospect_profile_url').eq('workspace_id', wsId),
        supabase.from('contacts').select('id', { count: 'exact', head: true }).eq('workspace_id', wsId).eq('status', 'qualified'),
        supabase.from('linkedin_meeting_confirmations').select('id,metadata').eq('workspace_id', wsId),
        supabase.from('customer_campaigns').select('id,status').eq('workspace_id', wsId),
      ]);

      const sent = messages.data?.filter(m => m.direction === 'sent').length ?? 0;
      const received = messages.data?.filter(m => m.direction === 'received').length ?? 0;
      const replyRate = sent > 0 ? Math.round((received / sent) * 100) : 0;
      const activeCampaigns = campaigns.data?.filter(c => c.status === 'running') ?? [];
      const campaignMetrics = buildCampaignMetrics({
        campaignIds: (campaigns.data ?? []).map(c => c.id),
        jobs: executionJobs.error ? undefined : executionJobs.data ?? [],
        conversations: linkedinConversations.error ? undefined : linkedinConversations.data ?? [],
        messages: linkedinMessages.error ? undefined : linkedinMessages.data ?? [],
        confirmations: meetingConfirmations.error ? undefined : meetingConfirmations.data ?? [],
      });
      const canonicalTotals = Object.values(campaignMetrics).reduce((totals, metric) => ({
        prospects: totals.prospects + (metric.prospects ?? 0),
        connectionsSent: totals.connectionsSent + (metric.connectionsSent ?? 0),
        connectionsAccepted: totals.connectionsAccepted + (metric.connectionsAccepted ?? 0),
        messagesSent: totals.messagesSent + (metric.messagesSent ?? 0),
        replies: totals.replies + (metric.replies ?? 0),
        positiveReplies: totals.positiveReplies + (metric.positiveReplies ?? 0),
        qualifiedLeads: totals.qualifiedLeads + (metric.qualifiedLeads ?? 0),
        meetingsBooked: totals.meetingsBooked + (metric.meetingsBooked ?? 0),
      }), { prospects: 0, connectionsSent: 0, connectionsAccepted: 0, messagesSent: 0, replies: 0, positiveReplies: 0, qualifiedLeads: 0, meetingsBooked: 0 });

      return {
        campaigns: campaigns.data ?? [],
        prospectCount: prospects.count ?? 0,
        meetingCount: meetings.count ?? 0,
        sentCount: sent,
        receivedCount: received,
        replyRate,
        upcoming: upcomingMeetings.data ?? [],
        hotProspects: repliedProspects.data ?? [],
        pendingApprovals: proposals.data ?? [],
        activeCampaignCount: activeCampaigns.length,
        campaignMetrics,
        metrics: {
          activeCampaigns: customerCampaigns.data?.filter(c => c.status === 'running').length ?? activeCampaigns.length,
          prospectsDiscovered: canonicalTotals.prospects,
          prospectsContacted: canonicalTotals.prospects,
          connectionsSent: canonicalTotals.connectionsSent,
          connectionsAccepted: canonicalTotals.connectionsAccepted,
          messagesSent: canonicalTotals.messagesSent,
          replies: canonicalTotals.replies,
          positiveReplies: canonicalTotals.positiveReplies,
          qualifiedLeads: canonicalTotals.qualifiedLeads,
          meetingsBooked: canonicalTotals.meetingsBooked,
        },
      };
    },
  });

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <div className="h-10 w-72 rounded-xl skeleton mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl skeleton" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl skeleton" />
          <div className="h-64 rounded-2xl skeleton" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <EmptyState
        icon={<AlertTriangle className="h-5 w-5" />}
        title="Unable to load dashboard"
        description="Something went wrong fetching your data. Please try again."
        action={<Button onClick={() => window.location.reload()}><RefreshCw className="h-3.5 w-3.5" />Retry</Button>}
      />
    );
  }

  if (!workspace) {
    return (
      <EmptyState
        icon={<Rocket className="h-5 w-5" />}
        title="Your AI sales team is ready"
        description="Create a workspace to launch your first campaign and start booking meetings."
        action={<Button onClick={() => navigate('/onboarding')}><Sparkles className="h-3.5 w-3.5" />Get Started</Button>}
      />
    );
  }

  const d = data!;
  const firstName = user?.email?.split('@')[0]?.split('.')[0]?.replace(/^\w/, c => c.toUpperCase()) ?? 'there';

  const tasks: { icon: React.ComponentType<{ className?: string }>; title: string; desc: string; tone: 'warning' | 'error' | 'brand'; action: string; onClick: () => void }[] = [];

  if (d.pendingApprovals.length > 0) {
    d.pendingApprovals.forEach((p) => {
      tasks.push({
        icon: FileText, title: 'Approve Proposal',
        desc: p.approval_notes ?? 'A proposal is waiting for your review',
        tone: 'warning', action: 'Review', onClick: () => navigate('/app/proposals'),
      });
    });
  }

  const linkedinConnected = (linkedinAccounts.data ?? []).some(a => a.connection_state === 'connected' && ['healthy', 'degraded'].includes(a.health_status));
  const googleScopes = new Set(googleConnection.data?.token?.scope?.split(' ').filter(Boolean) ?? []);
  const googleReady = googleConnection.data?.account?.status === 'connected' && !googleConnection.data?.needsReconnect;
  const gmailConnected = googleReady && googleScopes.has(GOOGLE_SCOPES.GMAIL_SEND);
  const calendarConnected = googleReady && (googleScopes.has(GOOGLE_SCOPES.CALENDAR) || googleScopes.has(GOOGLE_SCOPES.CALENDAR_EVENTS));

  if (!linkedinConnected) {
    tasks.push({ icon: Linkedin, title: 'Reconnect LinkedIn', desc: 'Your LinkedIn account needs to be reconnected to continue outreach', tone: 'error', action: 'Reconnect', onClick: () => navigate('/app/integrations') });
  }
  if (!gmailConnected) {
    tasks.push({ icon: Mail, title: 'Reconnect Gmail', desc: 'Your Gmail account needs to be reconnected to send emails', tone: 'error', action: 'Reconnect', onClick: () => navigate('/app/integrations') });
  }
  if (!calendarConnected) {
    tasks.push({ icon: Calendar, title: 'Connect Calendar', desc: 'Connect your calendar so your AI can book meetings automatically', tone: 'brand', action: 'Connect', onClick: () => navigate('/app/integrations') });
  }
  if (d.campaigns.length === 0) {
    tasks.push({ icon: Rocket, title: 'Launch Your First Campaign', desc: 'Your AI sales team is ready. Launch a campaign to start finding prospects.', tone: 'brand', action: 'Launch', onClick: () => navigate('/app/campaigns') });
  }

  return (
    <div className="space-y-8 animate-fade-in-up">
      {/* ─── Header ─── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-ink-50 tracking-tight">Good {greeting()}, {firstName}.</h1>
          <p className="text-sm text-ink-400 mt-1.5">
            {d.activeCampaignCount > 0 ? 'Your campaigns are running. Here\'s what\'s happening.' : 'Welcome to Revenue AI. Launch a campaign to get started.'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <DateRangeSelector range={range} onChange={setRange} />
          <Button size="sm" onClick={() => navigate('/app/campaigns')}>
            <Rocket className="h-3.5 w-3.5" /> New Campaign
          </Button>
        </div>
      </div>

      {/* ─── KPI Summary ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <SummaryCard label="Active Campaigns" value={formatNumber(d.metrics.activeCampaigns)} icon={Rocket} tone="brand" />
        <SummaryCard label="Prospects Discovered" value={formatNumber(d.metrics.prospectsDiscovered)} icon={Target} tone="gold" />
        <SummaryCard label="Prospects Contacted" value={formatNumber(d.metrics.prospectsContacted)} icon={Users} tone="gold" />
        <SummaryCard label="Connections Sent" value={formatNumber(d.metrics.connectionsSent)} icon={Linkedin} tone="brand" />
        <SummaryCard label="Connections Accepted" value={formatNumber(d.metrics.connectionsAccepted)} icon={CheckCircle2} tone="success" />
        <SummaryCard label="Messages Sent" value={formatNumber(d.metrics.messagesSent)} icon={Send} tone="gold" />
        <SummaryCard label="Replies" value={formatNumber(d.metrics.replies)} icon={MessageSquare} tone="brand" />
        <SummaryCard label="Positive Replies" value={formatNumber(d.metrics.positiveReplies)} icon={TrendingUp} tone="success" />
        <SummaryCard label="Qualified Leads" value={formatNumber(d.metrics.qualifiedLeads)} icon={Award} tone="warning" />
        <SummaryCard label="Meetings Booked" value={formatNumber(d.metrics.meetingsBooked)} icon={Calendar} tone="success" />
      </div>

      {/* ─── Campaigns ─── */}
      <section>
        <SectionHeader title="Campaign Overview" icon={Rocket} action={() => navigate('/app/campaigns')} />
        {d.campaigns.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Rocket className="h-5 w-5" />}
              title="No campaigns yet"
              description="Launch your first campaign and your AI sales team will start finding prospects automatically."
              action={<Button size="sm" onClick={() => navigate('/app/campaigns')}><Rocket className="h-3.5 w-3.5" />Launch Campaign</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {d.campaigns.slice(0, 6).map((camp) => (
              <CampaignCard key={camp.id} name={camp.name} status={camp.status} metrics={d.campaignMetrics[camp.id]} onClick={() => navigate('/app/campaigns')} />
            ))}
          </div>
        )}
      </section>

      {/* ─── Tasks ─── */}
      {tasks.length > 0 && (
        <section>
          <SectionHeader title="Tasks Requiring Attention" icon={Hand} badge={tasks.length} />
          <div className="space-y-3">
            {tasks.slice(0, 5).map((task, i) => (
              <TaskRow key={i} {...task} />
            ))}
          </div>
        </section>
      )}

      {/* ─── Upcoming Meetings ─── */}
      <section>
        <SectionHeader title="Upcoming Meetings" icon={Calendar} action={() => navigate('/app/meetings')} />
        {d.upcoming.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No meetings yet"
              description="Your AI sales team will book meetings automatically once your campaign starts."
              action={<Button size="sm" onClick={() => navigate('/app/campaigns')}><Rocket className="h-3.5 w-3.5" />Launch Campaign</Button>}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-gold-500/8">
              {d.upcoming.map((mtg) => (
                <div key={mtg.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gold-500/4 transition-colors cursor-pointer table-row-luxury" onClick={() => navigate('/app/meetings')}>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success-500/10 text-success-500 shrink-0 border border-success-500/20">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-100 truncate">{mtg.title}</p>
                    <p className="text-xs text-ink-400 mt-0.5">
                      {new Date(mtg.scheduled_at).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </div>
                  <Badge tone="brand" className="hidden sm:inline-flex">{mtg.duration_minutes}m</Badge>
                  <Button size="sm" variant="secondary" className="hidden sm:flex">
                    <Video className="h-3.5 w-3.5" /> Join
                  </Button>
                  <ChevronRight className="h-4 w-4 text-ink-500 sm:hidden" />
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* ─── Recent Activity ─── */}
      <section>
        <SectionHeader title="Recent Activity" icon={Activity} />
        <Card className="overflow-hidden">
          <BusinessActivityList workspaceId={workspace.id} />
        </Card>
      </section>

      {/* ─── Revenue Insights ─── */}
      <section>
        <SectionHeader title="Revenue Insights" icon={BarChart3} action={() => navigate('/app/analytics')} />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <InsightCard icon={Award} label="Best Performing Campaign" value={d.campaigns[0]?.name ?? '—'} sub={d.campaigns.length > 0 ? `${d.replyRate}% reply rate` : 'Launch a campaign to see insights'} />
          <InsightCard icon={Clock3} label="Best Time to Send" value="Not enough data" sub="Calculated after confirmed outreach events" />
          <InsightCard icon={TrendingUp} label="Conversion Trend" value={d.receivedCount > 0 ? 'Improving' : '—'} sub={d.receivedCount > 0 ? `${d.receivedCount} replies this period` : 'No data yet'} />
        </div>
      </section>
    </div>
  );
}

function BusinessActivityList({ workspaceId }: { workspaceId: string }) {
  const { data: activity } = useQuery({
    queryKey: ['business-activity', workspaceId],
    queryFn: async () => {
      const { data } = await supabase
        .from('agent_executions')
        .select('id, status, created_at, workflow_id, agent_registry!inner(agent_name)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(8);
      return data ?? [];
    },
  });

  if (!activity || activity.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="h-5 w-5" />}
        title="No activity yet"
        description="Your AI sales team will start finding prospects and sending outreach as soon as you launch a campaign."
      />
    );
  }

  const friendlyMap: Record<string, { text: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
    prospect_discovery: { text: 'Found new prospects matching your profile', icon: Users, tone: 'bg-wine-800/40 text-gold-300' },
    outreach_send: { text: 'Sent personalized outreach to prospects', icon: Send, tone: 'bg-gold-500/10 text-gold-400' },
    linkedin_connect: { text: 'Sent LinkedIn connection requests', icon: Linkedin, tone: 'bg-wine-800/40 text-gold-300' },
    linkedin_message: { text: 'Sent LinkedIn messages', icon: MessageSquare, tone: 'bg-gold-500/10 text-gold-400' },
    email_send: { text: 'Sent email outreach', icon: Mail, tone: 'bg-wine-800/40 text-gold-300' },
    meeting_book: { text: 'Booked a meeting with a prospect', icon: Calendar, tone: 'bg-success-500/10 text-success-500' },
    proposal_generate: { text: 'Generated a proposal', icon: FileText, tone: 'bg-warning-500/10 text-warning-500' },
    reply_handle: { text: 'Received and handled a reply', icon: MessageSquare, tone: 'bg-success-500/10 text-success-500' },
    follow_up: { text: 'Sent a follow-up message', icon: RefreshCw, tone: 'bg-wine-800/40 text-gold-300' },
  };

  return (
    <div className="divide-y divide-gold-500/8">
      {activity.map((act) => {
        const friendly = friendlyMap[act.workflow_id] ?? friendlyMap[act.agent_registry?.agent_name ?? ''] ?? null;
        const Icon = friendly?.icon ?? Activity;
        const text = friendly?.text ?? 'Activity recorded';
        const tone = friendly?.tone ?? 'bg-maroon-800/40 text-ink-400';

        return (
          <div key={act.id} className="flex items-center gap-4 px-6 py-4 hover:bg-gold-500/4 transition-colors table-row-luxury">
            <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl shrink-0 border border-gold-500/10', tone)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-ink-200 truncate">{text}</p>
              <p className="text-xs text-ink-500 mt-0.5">{timeAgo(act.created_at)}</p>
            </div>
            {act.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-success-500 shrink-0" />}
          </div>
        );
      })}
    </div>
  );
}

// ─── Helper Components ───

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

function DateRangeSelector({ range, onChange }: { range: DateRange; onChange: (r: DateRange) => void }) {
  const options: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'all', label: 'All Time' },
  ];
  return (
    <div className="flex items-center rounded-xl border border-gold-500/12 p-0.5 backdrop-blur-md"
      style={{ background: 'rgba(59, 7, 18, 0.4)' }}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-300',
            range === opt.value ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20' : 'text-ink-400 hover:text-ink-200 border border-transparent'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionHeader({ title, icon: Icon, action, badge }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: () => void;
  badge?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4.5 w-4.5 text-gold-400" />
        <h2 className="text-base font-semibold text-ink-50 tracking-tight">{title}</h2>
        {badge !== undefined && badge > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500/15 text-error-500 text-xs font-bold px-1.5 border border-error-500/20">
            {badge}
          </span>
        )}
      </div>
      {action && (
        <Button size="sm" variant="ghost" onClick={action} className="text-ink-400 hover:text-gold-400">
          View All <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon, tone, sub }: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: 'brand' | 'success' | 'warning' | 'gold';
  sub?: string;
}) {
  const tones: Record<string, string> = {
    brand: 'bg-wine-800/40 text-gold-300 border-gold-500/20',
    success: 'bg-success-500/10 text-success-500 border-success-500/20',
    warning: 'bg-warning-500/10 text-warning-500 border-warning-500/20',
    gold: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
  };
  return (
    <div className="kpi-card p-5 hover-lift cursor-default">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-3xl font-bold text-ink-50 tracking-tight tabular-nums">{value}</p>
          <p className="text-sm text-ink-400 mt-1 font-medium">{label}</p>
        </div>
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {sub && <p className="text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

function CampaignCard({ name, status, metrics, onClick }: {
  name: string;
  status: string;
  metrics?: CampaignMetricSet;
  onClick: () => void;
}) {
  return (
    <Card className="p-5 hover-lift cursor-pointer" onClick={onClick}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-xl border',
            status === 'running' ? 'bg-success-500/10 text-success-500 border-success-500/20' :
            status === 'draft' ? 'bg-maroon-800/40 text-ink-500 border-gold-500/10' : 'bg-warning-500/10 text-warning-500 border-warning-500/20'
          )}>
            <Rocket className="h-4 w-4" />
          </div>
          <p className="text-sm font-medium text-ink-100 truncate">{name}</p>
        </div>
        <Badge tone={status === 'running' ? 'success' : status === 'draft' ? 'neutral' : 'warning'} dot>
          {CAMPAIGN_STATUS_LABELS[status] ?? status}
        </Badge>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-4">
        {([['Replies', metrics?.replies], ['Meetings', metrics?.meetingsBooked], ['Accepted', metrics?.connectionsAccepted]] as const).map(([label, value]) => (
          <div key={label} className="rounded-lg bg-maroon-900/50 px-2.5 py-2 border border-gold-500/8">
            <p className="text-xs text-ink-500">{label}</p>
            <p className="text-sm font-semibold text-ink-300 mt-0.5">{value === undefined ? 'Not available' : value}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function TaskRow({ icon: Icon, title, desc, tone, action, onClick }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
  tone: 'warning' | 'error' | 'brand';
  action: string;
  onClick: () => void;
}) {
  const toneClasses = {
    warning: { bg: 'bg-warning-500/10 text-warning-500 border-warning-500/20', border: 'border-warning-500/20' },
    error: { bg: 'bg-error-500/10 text-error-500 border-error-500/20', border: 'border-error-500/20' },
    brand: { bg: 'bg-wine-800/40 text-gold-300 border-gold-500/20', border: 'border-gold-500/20' },
  };
  const t = toneClasses[tone];
  return (
    <div className={cn('flex items-center gap-4 rounded-2xl border p-4 hover-lift cursor-pointer transition-all duration-300', t.border)}
      style={{ background: 'linear-gradient(145deg, rgba(77, 16, 32, 0.6), rgba(59, 7, 18, 0.5))' }}
      onClick={onClick}
    >
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl shrink-0 border', t.bg)}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-ink-100">{title}</p>
        <p className="text-xs text-ink-400 mt-0.5">{desc}</p>
      </div>
      <Button size="sm" variant="secondary" className="shrink-0">{action}</Button>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, sub }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-5 hover-lift">
      <div className="flex items-center gap-2.5 mb-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20">
          <Icon className="h-4 w-4" />
        </div>
        <p className="text-sm text-ink-400 font-medium">{label}</p>
      </div>
      <p className="text-lg font-semibold text-ink-50 tracking-tight">{value}</p>
      <p className="text-xs text-ink-500 mt-1">{sub}</p>
    </Card>
  );
}
