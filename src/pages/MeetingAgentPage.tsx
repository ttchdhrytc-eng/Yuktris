import { useState, useMemo } from 'react';
import {
  Calendar,
  Sparkles,
  RefreshCw,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  User,
  Briefcase,
  Building2,
  Target,
  Activity,
  DollarSign,
  TrendingUp,
  Clock,
  CalendarCheck,
  Users,
  BarChart3,
  Lightbulb,
  FileJson,
  ArrowRight,
  Video,
  Database,
  Award,
  FileText,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { MeetingDashboard } from '@/components/meeting-agent/MeetingDashboard';
import { CalendarCard } from '@/components/meeting-agent/CalendarCard';
import { MeetingBriefCard } from '@/components/meeting-agent/MeetingBriefCard';
import { SalesBriefCard } from '@/components/meeting-agent/SalesBriefCard';
import { CRMCard } from '@/components/meeting-agent/CRMCard';
import { ReminderCard } from '@/components/meeting-agent/ReminderCard';
import { MeetingOutcomeCard } from '@/components/meeting-agent/MeetingOutcomeCard';
import { RecommendationCard } from '@/components/meeting-agent/RecommendationCard';
import { TimelineCard } from '@/components/meeting-agent/TimelineCard';

import {
  useMeetings,
  useScheduleMeeting,
  useGenerateMeetingBrief,
  useRescheduleMeeting,
  useCancelMeeting,
  useExportMeeting,
  useDeleteMeeting,
  useMeetingAIRecommendations,
  MOCK_MEETINGS,
  MOCK_MEETING_RECOMMENDATIONS,
  MEETING_STAGES,
} from '@/hooks/useMeetingAgent';
import { meetingAgentService } from '@/services/meeting-agent';
import { cn } from '@/lib/utils';
import type { ExportFormat, MeetingAIRecommendations } from '@/types/meeting-agent';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'overview', label: 'Meeting Overview', icon: Calendar },
  { id: 'calendar', label: 'Calendar', icon: CalendarCheck },
  { id: 'brief', label: 'Meeting Brief', icon: FileText },
  { id: 'preparation', label: 'Sales Preparation', icon: Briefcase },
  { id: 'crm', label: 'CRM Synchronization', icon: Database },
  { id: 'outcome', label: 'Meeting Outcome', icon: Award },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw JSON', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function MeetingAgentPage() {
  const navigate = useNavigate();
  const { data: meeting, isLoading } = useMeetings();
  const scheduleMutation = useScheduleMeeting();
  const briefMutation = useGenerateMeetingBrief();
  const rescheduleMutation = useRescheduleMeeting();
  const cancelMutation = useCancelMeeting();
  const exportMutation = useExportMeeting();
  const deleteMutation = useDeleteMeeting();

  const [tab, setTab] = useState<TabId>('overview');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);

  const isMutating = scheduleMutation.isPending || briefMutation.isPending || rescheduleMutation.isPending || cancelMutation.isPending;

  const { data: aiRecs } = useMeetingAIRecommendations(selectedProspectIndex);

  // Derived stats
  const stats = useMemo(() => {
    const all = MOCK_MEETINGS;
    const scheduled = all.filter((m) => m.meeting.status === 'scheduled').length;
    const completed = all.filter((m) => m.meeting.status === 'completed').length;
    const upcoming = all.filter((m) => m.meeting.status === 'scheduled' || m.meeting.status === 'scheduling').length;
    const meetingReady = all.filter((m) => m.meeting.meeting_readiness_score >= 70).length;
    const bookingRate = Math.round((completed / all.length) * 100);
    const attendanceRate = Math.round((all.filter((m) => m.outcome?.attendance_status === 'attended').length / all.filter((m) => m.outcome).length) * 100);
    const pipeline = all.reduce((s, m) => s + m.meeting.revenue_potential, 0);
    const revenueOpp = all.filter((m) => m.outcome?.outcome === 'closed_won').reduce((s, m) => s + m.meeting.revenue_potential, 0);
    return { scheduled, completed, upcoming, meetingReady, bookingRate, attendanceRate, pipeline, revenueOpp };
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleSchedule = () => {
    setScheduleModalOpen(false);
    scheduleMutation.mutate({ prospectIndex: selectedProspectIndex });
  };

  const handleGenerateBrief = () => {
    briefMutation.mutate({ prospectIndex: selectedProspectIndex });
  };

  const handleReschedule = () => {
    if (meeting) rescheduleMutation.mutate({ meetingId: meeting.meeting.id, slotId: 'slot-1' });
  };

  const handleCancel = () => {
    if (meeting) {
      cancelMutation.mutate(meeting.meeting.id);
      setCancelModalOpen(false);
    }
  };

  const handleExport = (format: ExportFormat) => {
    if (meeting) exportMutation.mutate({ meeting, format });
  };

  const handleDelete = () => {
    if (meeting) {
      deleteMutation.mutate(meeting.meeting.id);
      setDeleteModalOpen(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Meeting Agent" description="Coordinate meetings, prepare your sales team, and manage post-meeting workflows." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!meeting) {
    return (
      <div>
        <PageHeader title="Meeting Agent" description="Coordinate meetings, prepare your sales team, and manage post-meeting workflows." />
        <EmptyState
          icon={<Calendar className="h-6 w-6" />}
          title="No Meeting Ready Prospects"
          description="Conversation AI will automatically send qualified prospects here when they are ready for scheduling. The Meeting Agent handles meeting preparation, calendar coordination, CRM synchronization, reminders, and post-meeting workflows."
          action={
            <div className="flex gap-2">
              <Button onClick={() => navigate('/app/agents/conversation-ai')}>
                <ArrowRight className="h-4 w-4" />
                View Conversations
              </Button>
              <Button variant="outline" onClick={() => setScheduleModalOpen(true)}>
                <Play className="h-4 w-4" />
                Schedule Meeting
              </Button>
            </div>
          }
        />
        <ScheduleModal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} onSchedule={handleSchedule} loading={scheduleMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      </div>
    );
  }

  // Processing state
  if (isMutating && scheduleMutation.isPending) {
    return <ProcessingView />;
  }

  // Error state
  if (meeting.meeting.status === 'failed') {
    return (
      <div>
        <PageHeader title="Meeting Agent" description="Coordinate meetings, prepare your sales team, and manage post-meeting workflows." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Meeting Generation Failed"
          description={meeting.meeting.error_message ?? 'The meeting could not be scheduled. This may be due to a calendar conflict, CRM sync failure, or missing prospect data. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setScheduleModalOpen(true)}>
                <Play className="h-4 w-4" />
                New Meeting
              </Button>
              <Button variant="outline" onClick={handleReschedule} loading={rescheduleMutation.isPending}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <ScheduleModal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} onSchedule={handleSchedule} loading={scheduleMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      </div>
    );
  }

  // Full dashboard
  const timelineEvents = meetingAgentService.getTimelineEvents(meeting);
  const mockMeeting = MOCK_MEETINGS[selectedProspectIndex] ?? MOCK_MEETINGS[0];
  const recs: MeetingAIRecommendations = aiRecs ?? MOCK_MEETING_RECOMMENDATIONS;
  const priority = meetingAgentService.getPriority(meeting);

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Meeting Agent"
        description="Coordinate meetings, prepare your sales team, and manage post-meeting workflows."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleReschedule} loading={rescheduleMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Reschedule
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCancelModalOpen(true)} loading={cancelMutation.isPending}>
              <AlertCircle className="h-3.5 w-3.5" />
              Cancel Meeting
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateBrief} loading={briefMutation.isPending}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Brief
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" onClick={() => setScheduleModalOpen(true)}>
              <Calendar className="h-3.5 w-3.5" />
              Schedule Meeting
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={Calendar} label="Scheduled"><span className="text-sm text-brand-400 font-semibold">{stats.scheduled}</span></KpiCard>
        <KpiCard icon={CheckCircle2} label="Completed"><span className="text-sm text-success-400 font-semibold">{stats.completed}</span></KpiCard>
        <KpiCard icon={Clock} label="Upcoming"><span className="text-sm text-brand-400 font-semibold">{stats.upcoming}</span></KpiCard>
        <KpiCard icon={Users} label="Meeting Ready"><span className="text-sm text-success-400 font-semibold">{stats.meetingReady}</span></KpiCard>
        <KpiCard icon={BarChart3} label="Booking Rate"><span className={cn('text-sm font-semibold', stats.bookingRate >= 50 ? 'text-success-400' : 'text-warning-500')}>{stats.bookingRate}%</span></KpiCard>
        <KpiCard icon={Activity} label="Attendance"><span className={cn('text-sm font-semibold', stats.attendanceRate >= 80 ? 'text-success-400' : 'text-warning-500')}>{stats.attendanceRate}%</span></KpiCard>
        <KpiCard icon={DollarSign} label="Pipeline"><span className="text-sm text-brand-400 font-semibold">${(stats.pipeline / 1000).toFixed(0)}K</span></KpiCard>
        <KpiCard icon={TrendingUp} label="Revenue Opp"><span className="text-sm text-success-400 font-semibold">${(stats.revenueOpp / 1000).toFixed(0)}K</span></KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Selected Prospect */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-brand-400" />
                <CardTitle>Selected Prospect</CardTitle>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">From Conversation AI</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow icon={User} label="Prospect" value={mockMeeting.meeting.prospect_name} />
                <InfoRow icon={Building2} label="Company" value={mockMeeting.meeting.company_name} />
                <InfoRow icon={Briefcase} label="Decision Maker" value={mockMeeting.meeting.prospect_title} />
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-500 mb-0.5">
                    <Activity className="h-3 w-3" />
                    Conversation Status
                  </dt>
                  <dd className="ml-4">
                    <Badge tone="success" dot>Handed Off</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-500 mb-0.5">
                    <CheckCircle2 className="h-3 w-3" />
                    Meeting Readiness
                  </dt>
                  <dd className="ml-4">
                    <Badge tone={mockMeeting.meeting.meeting_readiness_score >= 80 ? 'success' : mockMeeting.meeting.meeting_readiness_score >= 60 ? 'brand' : 'warning'} dot>
                      {mockMeeting.meeting.meeting_readiness_score >= 80 ? 'Ready' : mockMeeting.meeting.meeting_readiness_score >= 60 ? 'Almost Ready' : 'Warming Up'}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-500 mb-0.5">
                    <Target className="h-3 w-3" />
                    Priority
                  </dt>
                  <dd className="ml-4">
                    <Badge tone={priority === 'critical' ? 'error' : priority === 'high' ? 'warning' : priority === 'medium' ? 'brand' : 'neutral'} dot>
                      {priority}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Meeting Dashboard */}
        <div className="lg:col-span-6">
          <MeetingDashboard meeting={meeting} />
        </div>

        {/* Right panel — Timeline */}
        <div className="lg:col-span-3">
          <TimelineCard events={timelineEvents} />
        </div>
      </div>

      {/* Bottom tabs */}
      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 transition-colors',
                  tab === t.id ? 'border-brand-500 text-ink-500 font-medium' : 'border-transparent text-ink-500 hover:text-ink-500',
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <CardContent className="min-h-[300px]">
          {tab === 'overview' && <OverviewTab meeting={meeting} />}
          {tab === 'calendar' && <CalendarCard calendar={meeting.calendar} />}
          {tab === 'brief' && <MeetingBriefCard brief={meeting.brief} />}
          {tab === 'preparation' && <SalesBriefCard preparation={meeting.preparation} />}
          {tab === 'crm' && <CRMCard crmUpdate={meeting.crm_update} />}
          {tab === 'outcome' && <MeetingOutcomeCard outcome={meeting.outcome} />}
          {tab === 'recommendations' && <RecommendationCard recommendations={recs} />}
          {tab === 'raw' && <RawTab data={meeting} />}
        </CardContent>
      </Card>

      {/* Modals */}
      <ScheduleModal open={scheduleModalOpen} onClose={() => setScheduleModalOpen(false)} onSchedule={handleSchedule} loading={scheduleMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      <CancelModal open={cancelModalOpen} onClose={() => setCancelModalOpen(false)} onCancel={handleCancel} loading={cancelMutation.isPending} />
      <DeleteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onDelete={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView() {
  const currentStage = meetingAgentService.getCurrentStage();
  const stageIndex = MEETING_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Meeting Agent" description="Coordinate meetings, prepare your sales team, and manage post-meeting workflows." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Calendar className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Scheduling Meeting</h2>
        <p className="text-sm text-ink-500 mb-8 max-w-md text-center">Meeting Agent is loading the prospect, checking calendar availability, generating the meeting brief, preparing the sales team, syncing CRM, scheduling the meeting, sending reminders, and saving all records.</p>
        <div className="w-full max-w-md space-y-2">
          {MEETING_STAGES.map((stage, i) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0 transition-colors',
                i < stageIndex && 'border-success-500 bg-success-500/10 text-success-400',
                i === stageIndex && 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400',
                i > stageIndex && 'border-gold-500/12 bg-card-900 text-ink-500',
              )}>
                {i < stageIndex ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === stageIndex ? <Spinner className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}
              </div>
              <div className="flex-1">
                <p className={cn('text-sm', i <= stageIndex ? 'text-ink-500' : 'text-ink-500')}>{stage.label}</p>
                <p className="text-xs text-ink-500">{stage.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Overview Tab
// ============================================================

function OverviewTab({ meeting }: { meeting: import('@/types/meeting-agent').FullMeeting }) {
  const m = meeting.meeting;
  const items = [
    { icon: Video, label: 'Meeting Type', value: m.meeting_type.replace(/_/g, ' ') },
    { icon: Target, label: 'Meeting Goal', value: m.meeting_type === 'discovery' ? 'Understand prospect pain points and qualify opportunity' : m.meeting_type === 'demo' ? 'Showcase platform capabilities tailored to prospect needs' : m.meeting_type === 'technical' ? 'Deep dive into integration architecture and technical requirements' : m.meeting_type === 'proposal' ? 'Present customized proposal and pricing' : m.meeting_type === 'closing' ? 'Finalize contract terms and close the deal' : 'Follow up on previous discussion and maintain relationship' },
    { icon: Clock, label: 'Duration', value: `${m.meeting_duration} minutes` },
    { icon: Video, label: 'Platform', value: m.meeting_platform.replace(/_/g, ' ') },
    { icon: Clock, label: 'Timezone', value: m.timezone },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-brand-400" />
            <CardTitle>Meeting Overview</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className="flex items-center gap-1.5 mb-1 text-ink-500">
                  <item.icon className="h-3 w-3" />
                  <span className="text-xs">{item.label}</span>
                </div>
                <p className="text-sm text-ink-500 capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <ReminderCard meetingTime={m.meeting_time} meetingLink={m.meeting_link} />
    </div>
  );
}

// ============================================================
// Raw Tab
// ============================================================

function RawTab({ data }: { data: unknown }) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-maroon-950 p-4 max-h-[500px] overflow-auto scrollbar-thin">
      <pre className="text-xs text-ink-500 font-mono whitespace-pre-wrap">{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

function KpiCard({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-2 text-ink-500">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium uppercase tracking-wide">{label}</span>
      </div>
      {children}
    </Card>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-ink-500 mb-0.5">
        <Icon className="h-3 w-3" />
        {label}
      </dt>
      <dd className="text-sm text-ink-500 ml-4">{value}</dd>
    </div>
  );
}

function ScheduleModal({ open, onClose, onSchedule, loading, selectedIndex, onSelectIndex }: {
  open: boolean;
  onClose: () => void;
  onSchedule: () => void;
  loading: boolean;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Schedule Meeting"
      description="Meeting Agent will load a meeting-ready prospect, check calendar availability, generate the meeting brief, prepare the sales team, sync CRM, schedule the meeting, send reminders, and save all records."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSchedule} loading={loading}>
            <Calendar className="h-4 w-4" />
            Schedule Meeting
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-ink-500 block mb-2">Select a meeting-ready prospect:</span>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {MOCK_MEETINGS.slice(0, 10).map((m, i) => (
              <button
                key={i}
                onClick={() => onSelectIndex(i)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                  selectedIndex === i ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/30' : 'bg-card-900 border border-gold-500/12 hover:bg-card-800',
                )}
              >
                <User className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                <span className={cn('text-xs flex-1', selectedIndex === i ? 'text-brand-400 font-medium' : 'text-ink-500')}>
                  {m.meeting.prospect_name} — {m.meeting.prospect_title} at {m.meeting.company_name}
                </span>
                <Badge tone={m.meeting.meeting_readiness_score >= 80 ? 'success' : 'warning'}>
                  {m.meeting.meeting_readiness_score}/100
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The Meeting Agent will perform the following steps:</p>
          <ul className="space-y-1.5">
            {MEETING_STAGES.map((stage) => (
              <li key={stage.stage} className="flex items-start gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-ink-500 font-medium">{stage.label}</p>
                  <p className="text-xs text-ink-500">{stage.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}

function CancelModal({ open, onClose, onCancel, loading }: { open: boolean; onClose: () => void; onCancel: () => void; loading: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Cancel Meeting"
      description="This will cancel the scheduled meeting, notify all participants, and update the CRM status. The meeting record will be preserved for reference."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Go Back</Button>
          <Button variant="danger" onClick={onCancel} loading={loading}>Cancel Meeting</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to cancel this meeting? All participants will be notified via email and Slack.</p>
    </Modal>
  );
}

function DeleteModal({ open, onClose, onDelete, loading }: { open: boolean; onClose: () => void; onDelete: () => void; loading: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Meeting"
      description="This will permanently delete the meeting and all associated briefs, preparation materials, CRM updates, and outcomes. This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Meeting</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this meeting?</p>
    </Modal>
  );
}
