import { useState } from 'react';
import {
  MessageSquare, Brain, Target, AlertTriangle, Reply,
  Clock, Activity, Gauge, Sparkles, TrendingUp,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useConversationIntelligenceDashboard, useAnalyzeConversations,
} from '@/hooks/useConversationIntelligence';
import {
  CIDashboardSection, LiveConversationsSection, AIAnalysisSection,
  IntentSection, BuyingStageSection, ObjectionsSection,
  SuggestedRepliesSection, RecommendationsSection,
  TimelineSection, SummarySection, ScoreSection,
  ConversationIntelligenceEmpty,
} from '@/components/conversation-intelligence';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Brain },
  { id: 'live', label: 'Live Conversations', icon: MessageSquare },
  { id: 'analysis', label: 'AI Analysis', icon: Sparkles },
  { id: 'intent', label: 'Intent Detection', icon: Target },
  { id: 'stage', label: 'Buying Stage', icon: TrendingUp },
  { id: 'objections', label: 'Objections', icon: AlertTriangle },
  { id: 'replies', label: 'Suggested Replies', icon: Reply },
  { id: 'recs', label: 'Recommendations', icon: Activity },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'summary', label: 'Summary', icon: MessageSquare },
  { id: 'score', label: 'Conversation Score', icon: Gauge },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ConversationIntelligencePage() {
  const { data: dashboard, isLoading } = useConversationIntelligenceDashboard();
  const analyze = useAnalyzeConversations();
  const [tab, setTab] = useState<TabId>('dashboard');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Conversation Intelligence" description="AI-powered analysis of every prospect conversation." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dashboard || dashboard.totalConversations === 0) {
    return (
      <div>
        <PageHeader title="Conversation Intelligence" description="AI-powered analysis of every prospect conversation." />
        <Card className="p-6">
          <ConversationIntelligenceEmpty onAnalyze={() => analyze.mutate()} isAnalyzing={analyze.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Conversation Intelligence"
        description="AI-powered analysis of every prospect conversation."
        actions={
          <button onClick={() => analyze.mutate()} disabled={analyze.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" />
            {analyze.isPending ? 'Analyzing...' : 'Analyze'}
          </button>
        }
      />

      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Brain className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-500">{dashboard.totalConversations}</span> conversations
            {' · '}<span className="font-semibold text-ink-500">{dashboard.highIntentLeads}</span> high intent
            {' · '}<span className="font-semibold text-ink-500">{dashboard.meetingReadyCount}</span> meeting ready
            {' · '}<span className="font-semibold text-ink-500">{dashboard.objectionCount}</span> objections
            {' · '}Avg score: <span className="font-semibold text-ink-500">{dashboard.avgScore}</span>
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
          {tab === 'dashboard' && <CIDashboardSection dashboard={dashboard} onAnalyze={() => analyze.mutate()} isAnalyzing={analyze.isPending} />}
          {tab === 'live' && <LiveConversationsSection conversations={dashboard.conversations} />}
          {tab === 'analysis' && <AIAnalysisSection conversations={dashboard.conversations} />}
          {tab === 'intent' && <IntentSection conversations={dashboard.conversations} />}
          {tab === 'stage' && <BuyingStageSection conversations={dashboard.conversations} />}
          {tab === 'objections' && <ObjectionsSection conversations={dashboard.conversations} />}
          {tab === 'replies' && <SuggestedRepliesSection conversations={dashboard.conversations} />}
          {tab === 'recs' && <RecommendationsSection conversations={dashboard.conversations} />}
          {tab === 'timeline' && <TimelineSection conversations={dashboard.conversations} />}
          {tab === 'summary' && <SummarySection conversations={dashboard.conversations} />}
          {tab === 'score' && <ScoreSection conversations={dashboard.conversations} />}
        </div>
      </Card>
    </div>
  );
}
