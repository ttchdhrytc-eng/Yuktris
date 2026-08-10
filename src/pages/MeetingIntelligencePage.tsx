import { useState } from 'react';
import {
  Calendar, Clock, Sparkles, Zap, Target, HelpCircle, Swords,
  ListChecks, RotateCcw, Bell, Brain, TrendingUp, Gauge,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useMeetingIntelligenceDashboard, useDetectMeetingIntent,
  useScheduleMeeting, useConfirmMeeting, useCancelMeeting,
  useGenerateBrief, useRecordOutcome,
} from '@/hooks/useMeetingIntelligence';
import {
  MIDashboardSection, UpcomingMeetingsSection, PendingSchedulingSection,
  AvailabilitySection, BriefsSection, AgendasSection,
  QuestionsSection, CompetitorIntelSection, PreparationSection,
  FollowupsSection, HistorySection, AIRecommendationsSection,
  NotificationsSection, MeetingIntelligenceEmpty,
} from '@/components/meeting-intelligence';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Brain },
  { id: 'upcoming', label: 'Upcoming Meetings', icon: Calendar },
  { id: 'pending', label: 'Pending Scheduling', icon: Clock },
  { id: 'availability', label: 'Availability', icon: Calendar },
  { id: 'briefs', label: 'Meeting Briefs', icon: Sparkles },
  { id: 'agendas', label: 'Agendas', icon: ListChecks },
  { id: 'questions', label: 'Discovery Questions', icon: HelpCircle },
  { id: 'competitor', label: 'Competitor Intel', icon: Swords },
  { id: 'preparation', label: 'Preparation', icon: Target },
  { id: 'followups', label: 'Follow-ups', icon: RotateCcw },
  { id: 'history', label: 'Meeting History', icon: Clock },
  { id: 'recommendations', label: 'AI Recommendations', icon: Brain },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function MeetingIntelligencePage() {
  const { data: dashboard, isLoading } = useMeetingIntelligenceDashboard();
  const detectIntent = useDetectMeetingIntent();
  const scheduleMeeting = useScheduleMeeting();
  const confirmMeeting = useConfirmMeeting();
  const cancelMeeting = useCancelMeeting();
  const generateBrief = useGenerateBrief();
  const recordOutcome = useRecordOutcome();

  const [tab, setTab] = useState<TabId>('dashboard');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Meeting Intelligence" description="AI-powered meeting scheduling and preparation." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dashboard || dashboard.totalMeetings === 0) {
    return (
      <div>
        <PageHeader title="Meeting Intelligence" description="AI-powered meeting scheduling and preparation." />
        <Card className="p-6">
          <MeetingIntelligenceEmpty onDetect={() => detectIntent.mutate()} isDetecting={detectIntent.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Meeting Intelligence"
        description="AI-powered meeting scheduling and preparation."
        actions={
          <button onClick={() => detectIntent.mutate()} disabled={detectIntent.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />
            {detectIntent.isPending ? 'Detecting...' : 'Detect Intent'}
          </button>
        }
      />

      {/* AI Copilot banner */}
      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Brain className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-500">{dashboard.totalMeetings}</span> meetings
            {' · '}<span className="font-semibold text-ink-500">{dashboard.meetingsToday}</span> today
            {' · '}<span className="font-semibold text-ink-500">{dashboard.pendingScheduling}</span> pending
            {' · '}<span className="font-semibold text-ink-500">{dashboard.awaitingConfirmation}</span> awaiting confirmation
            {' · '}Avg score: <span className="font-semibold text-ink-500">{dashboard.avgMeetingScore}</span>
            {' · '}Forecast: <span className="font-semibold text-ink-500">${dashboard.forecastRevenue.toLocaleString()}</span>
          </p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'dashboard' && <MIDashboardSection dashboard={dashboard} onDetect={() => detectIntent.mutate()} isDetecting={detectIntent.isPending} />}
          {tab === 'upcoming' && <UpcomingMeetingsSection meetings={dashboard.meetings} onConfirm={(id) => confirmMeeting.mutate({ meetingId: id })} onCancel={(id) => cancelMeeting.mutate({ meetingId: id })} />}
          {tab === 'pending' && <PendingSchedulingSection requests={dashboard.pendingRequests} candidates={dashboard.candidates} onSchedule={(id) => scheduleMeeting.mutate(id)} />}
          {tab === 'availability' && <AvailabilitySection slots={dashboard.slots} />}
          {tab === 'briefs' && <BriefsSection meetings={dashboard.meetings} />}
          {tab === 'agendas' && <AgendasSection meetings={dashboard.meetings} />}
          {tab === 'questions' && <QuestionsSection meetings={dashboard.meetings} />}
          {tab === 'competitor' && <CompetitorIntelSection meetings={dashboard.meetings} />}
          {tab === 'preparation' && <PreparationSection meetings={dashboard.meetings} />}
          {tab === 'followups' && <FollowupsSection meetings={dashboard.meetings} />}
          {tab === 'history' && <HistorySection meetings={dashboard.meetings} />}
          {tab === 'recommendations' && <AIRecommendationsSection meetings={dashboard.meetings} />}
          {tab === 'notifications' && <NotificationsSection notifications={dashboard.notifications} />}
        </div>
      </Card>
    </div>
  );
}
