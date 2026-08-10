import { useState, useMemo } from 'react';
import {
  MessageSquare,
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
  Zap,
  ShieldCheck,
  Smile,
  Frown,
  Mail,
  MessagesSquare,
  BarChart3,
  Lightbulb,
  FileJson,
  ArrowRight,
  Brain,
  Send,
  Clock,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ConversationTimeline } from '@/components/conversation-ai/ConversationTimeline';
import { ConversationSummaryCard } from '@/components/conversation-ai/ConversationSummaryCard';
import { QualificationCard } from '@/components/conversation-ai/QualificationCard';
import { ObjectionCard } from '@/components/conversation-ai/ObjectionCard';
import { AIResponseCard } from '@/components/conversation-ai/AIResponseCard';
import { ConversationHealthCard } from '@/components/conversation-ai/ConversationHealthCard';
import { NextActionCard } from '@/components/conversation-ai/NextActionCard';

import {
  useConversation,
  useAnalyzeConversation,
  useGenerateResponse,
  useRefreshConversation,
  useExportConversation,
  useDeleteConversation,
  useConversationAIRecommendations,
  useBANTQualification,
  useConversationHealth,
  MOCK_CONVERSATIONS,
  MOCK_AI_RECOMMENDATIONS,
  CONVERSATION_STAGES,
} from '@/hooks/useConversationAI';
import { conversationAIService } from '@/services/conversation-ai';
import { cn } from '@/lib/utils';
import type { ExportFormat, ConversationAIRecommendations, BANTQualification, ConversationHealth } from '@/types/conversation-ai';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'history', label: 'Conversation History', icon: MessagesSquare },
  { id: 'intelligence', label: 'Conversation Intelligence', icon: Brain },
  { id: 'qualification', label: 'Lead Qualification', icon: ShieldCheck },
  { id: 'objections', label: 'Objection Intelligence', icon: AlertCircle },
  { id: 'responses', label: 'AI Response Center', icon: Sparkles },
  { id: 'health', label: 'Conversation Health', icon: Activity },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw JSON', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function ConversationAIPage() {
  const navigate = useNavigate();
  const { data: conversation, isLoading } = useConversation();
  const analyzeMutation = useAnalyzeConversation();
  const generateResponseMutation = useGenerateResponse();
  const refreshMutation = useRefreshConversation();
  const exportMutation = useExportConversation();
  const deleteMutation = useDeleteConversation();

  const [tab, setTab] = useState<TabId>('history');
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);

  const isMutating = analyzeMutation.isPending || generateResponseMutation.isPending || refreshMutation.isPending;

  const { data: aiRecs } = useConversationAIRecommendations(selectedProspectIndex);
  const { data: bant } = useBANTQualification(selectedProspectIndex);
  const { data: health } = useConversationHealth(selectedProspectIndex);

  // Derived stats
  const stats = useMemo(() => {
    const all = MOCK_CONVERSATIONS;
    const active = all.filter((c) => c.status === 'active').length;
    const qualified = all.filter((c) => c.bant.qualification_score >= 70).length;
    const positive = all.filter((c) => c.analysis.sentiment === 'very_positive' || c.analysis.sentiment === 'positive').length;
    const negative = all.filter((c) => c.analysis.sentiment === 'very_negative' || c.analysis.sentiment === 'negative').length;
    const meetingReady = all.filter((c) => c.meeting_ready).length;
    const avgScore = Math.round(all.reduce((s, c) => s + c.analysis.conversation_score, 0) / all.length);
    const aiConfidence = Math.round(all.reduce((s, c) => s + (c.ai_responses[0]?.confidence ?? 0), 0) / all.length);
    const convHealth = Math.round(all.reduce((s, c) => s + c.health.momentum_score, 0) / all.length);
    return { active, qualified, positive, negative, meetingReady, avgScore, aiConfidence, convHealth };
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleAnalyze = () => {
    setAnalyzeModalOpen(false);
    analyzeMutation.mutate({ prospectIndex: selectedProspectIndex });
  };

  const handleGenerateResponse = () => {
    if (conversation) generateResponseMutation.mutate({ conversationId: conversation.id });
  };

  const handleRefresh = () => {
    if (conversation) refreshMutation.mutate(conversation.id);
  };

  const handleExport = (format: ExportFormat) => {
    if (conversation) exportMutation.mutate({ conversation, format });
  };

  const handleDelete = () => {
    if (conversation) {
      deleteMutation.mutate(conversation.id);
      setDeleteModalOpen(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Conversation AI" description="Understand, qualify, and manage prospect conversations with AI." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!conversation) {
    return (
      <div>
        <PageHeader title="Conversation AI" description="Understand, qualify, and manage prospect conversations with AI." />
        <EmptyState
          icon={<MessageSquare className="h-6 w-6" />}
          title="No Conversations Available"
          description="Start an outreach campaign to begin AI conversation management. Conversation AI analyzes replies from the LinkedIn Execution Agent, detects buyer intent and sentiment, qualifies leads, recommends responses, and determines when prospects are ready for the Meeting Agent."
          action={
            <div className="flex gap-2">
              <Button onClick={() => navigate('/app/campaigns')}>
                <ArrowRight className="h-4 w-4" />
                View Campaigns
              </Button>
              <Button variant="outline" onClick={() => setAnalyzeModalOpen(true)}>
                <Play className="h-4 w-4" />
                Analyze Conversation
              </Button>
            </div>
          }
        />
        <AnalyzeModal open={analyzeModalOpen} onClose={() => setAnalyzeModalOpen(false)} onAnalyze={handleAnalyze} loading={analyzeMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      </div>
    );
  }

  // Processing state
  if (isMutating && analyzeMutation.isPending) {
    return <ProcessingView />;
  }

  // Error state
  if (conversation.status === 'failed') {
    return (
      <div>
        <PageHeader title="Conversation AI" description="Understand, qualify, and manage prospect conversations with AI." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Conversation Analysis Failed"
          description={conversation.error_message ?? 'The conversation analysis could not be completed. This may be due to missing messages, AI timeout, or context loss. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setAnalyzeModalOpen(true)}>
                <Play className="h-4 w-4" />
                New Analysis
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <AnalyzeModal open={analyzeModalOpen} onClose={() => setAnalyzeModalOpen(false)} onAnalyze={handleAnalyze} loading={analyzeMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      </div>
    );
  }

  // Full dashboard
  const timelineEvents = conversationAIService.getTimelineEvents(conversation);
  const mockConv = MOCK_CONVERSATIONS[selectedProspectIndex] ?? MOCK_CONVERSATIONS[0];
  const recs: ConversationAIRecommendations = aiRecs ?? MOCK_AI_RECOMMENDATIONS;
  const bantData: BANTQualification | null = bant ?? null;
  const healthData: ConversationHealth | null = health ?? null;

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Conversation AI"
        description="Understand, qualify, and manage prospect conversations with AI."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Analysis
            </Button>
            <Button variant="outline" size="sm" onClick={handleGenerateResponse} loading={generateResponseMutation.isPending}>
              <Sparkles className="h-3.5 w-3.5" />
              Generate Response
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button size="sm" onClick={() => setAnalyzeModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              Analyze Conversation
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={MessageSquare} label="Active"><span className="text-sm text-brand-400 font-semibold">{stats.active}</span></KpiCard>
        <KpiCard icon={ShieldCheck} label="Qualified"><span className="text-sm text-success-400 font-semibold">{stats.qualified}</span></KpiCard>
        <KpiCard icon={Smile} label="Positive"><span className="text-sm text-success-400 font-semibold">{stats.positive}</span></KpiCard>
        <KpiCard icon={Frown} label="Negative"><span className="text-sm text-error-500 font-semibold">{stats.negative}</span></KpiCard>
        <KpiCard icon={CheckCircle2} label="Meeting Ready"><span className="text-sm text-success-400 font-semibold">{stats.meetingReady}</span></KpiCard>
        <KpiCard icon={BarChart3} label="Avg Score"><span className={cn('text-sm font-semibold', stats.avgScore >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.avgScore}</span></KpiCard>
        <KpiCard icon={Zap} label="AI Confidence"><span className={cn('text-sm font-semibold', stats.aiConfidence >= 80 ? 'text-success-400' : 'text-brand-400')}>{stats.aiConfidence}%</span></KpiCard>
        <KpiCard icon={Activity} label="Conv. Health"><span className={cn('text-sm font-semibold', stats.convHealth >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.convHealth}</span></KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Selected Conversation */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-brand-400" />
                <CardTitle>Selected Conversation</CardTitle>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">From LinkedIn Execution Agent</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow icon={User} label="Prospect" value={mockConv.prospect_name} />
                <InfoRow icon={Building2} label="Company" value={mockConv.company_name} />
                <InfoRow icon={Briefcase} label="Job Title" value={mockConv.prospect_title} />
                <InfoRow icon={Target} label="Campaign" value={mockConv.campaign_name} />
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-500 mb-0.5">
                    <Activity className="h-3 w-3" />
                    Conversation Status
                  </dt>
                  <dd className="ml-4">
                    <Badge
                      tone={conversation.status === 'handed_off' ? 'success' : conversation.status === 'active' ? 'brand' : conversation.status === 'escalated' ? 'warning' : conversation.status === 'failed' ? 'error' : 'neutral'}
                      dot
                    >
                      {conversation.status.replace(/_/g, ' ')}
                    </Badge>
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1.5 text-xs text-ink-500 mb-0.5">
                    <Clock className="h-3 w-3" />
                    Current Stage
                  </dt>
                  <dd className="ml-4 text-sm text-ink-500 capitalize">{conversation.conversation_stage.replace(/_/g, ' ')}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Conversation Dashboard */}
        <div className="lg:col-span-6">
          <ConversationDashboard conversation={conversation} analysis={conversation.analysis} recs={recs} />
        </div>

        {/* Right panel — Timeline */}
        <div className="lg:col-span-3">
          <ConversationTimeline events={timelineEvents} />
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
          {tab === 'history' && <ConversationHistoryTab messages={conversation.messages} />}
          {tab === 'intelligence' && <ConversationIntelligenceTab analysis={conversation.analysis} summary={conversation.summary} />}
          {tab === 'qualification' && <QualificationCard qualification={bantData} />}
          {tab === 'objections' && <ObjectionCard objections={conversation.objections} />}
          {tab === 'responses' && <AIResponseCard responses={conversation.ai_responses} />}
          {tab === 'health' && <ConversationHealthCard health={healthData} />}
          {tab === 'recommendations' && <RecommendationsTab recs={recs} />}
          {tab === 'raw' && <RawTab data={conversation} />}
        </CardContent>
      </Card>

      {/* Modals */}
      <AnalyzeModal open={analyzeModalOpen} onClose={() => setAnalyzeModalOpen(false)} onAnalyze={handleAnalyze} loading={analyzeMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      <DeleteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onDelete={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView() {
  const currentStage = conversationAIService.getCurrentStage();
  const stageIndex = CONVERSATION_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Conversation AI" description="Understand, qualify, and manage prospect conversations with AI." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Brain className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Analyzing Conversation</h2>
        <p className="text-sm text-ink-500 mb-8">Conversation AI is loading messages, analyzing sentiment, detecting buyer intent, qualifying the lead, detecting objections, and generating response recommendations. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {CONVERSATION_STAGES.map((stage, i) => (
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
// Conversation Dashboard (center panel)
// ============================================================

function ConversationDashboard({ conversation, analysis, recs }: {
  conversation: import('@/types/conversation-ai').Conversation;
  analysis: import('@/types/conversation-ai').ConversationAnalysis | null;
  recs: ConversationAIRecommendations;
}) {
  if (!analysis) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No analysis available.</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: 'Conversation Score', value: analysis.conversation_score, max: 100, tone: analysis.conversation_score >= 80 ? 'bg-success-500' : analysis.conversation_score >= 60 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-warning-500' },
    { label: 'Qualification Score', value: analysis.qualification_score, max: 100, tone: analysis.qualification_score >= 80 ? 'bg-success-500' : analysis.qualification_score >= 60 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-warning-500' },
    { label: 'Trust Score', value: analysis.trust_score, max: 100, tone: analysis.trust_score >= 80 ? 'bg-success-500' : analysis.trust_score >= 60 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-warning-500' },
    { label: 'Engagement Level', value: analysis.engagement_score, max: 100, tone: analysis.engagement_score >= 80 ? 'bg-success-500' : analysis.engagement_score >= 60 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-warning-500' },
  ];

  const meetingReady = conversation.meeting_ready;
  const readinessLabel = recs.meeting_readiness.replace(/_/g, ' ');
  const readinessTone = recs.meeting_readiness === 'handed_off' || recs.meeting_readiness === 'ready' ? 'text-success-400' : recs.meeting_readiness === 'almost_ready' ? 'text-brand-400' : recs.meeting_readiness === 'warming_up' ? 'text-warning-500' : 'text-ink-500';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-400" />
          <CardTitle>Conversation Dashboard</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 mb-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-500">{item.label}</span>
                <span className="text-sm font-semibold text-ink-500">{item.value}/{item.max}</span>
              </div>
              <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', item.tone)} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <MiniStat label="Sentiment" value={analysis.sentiment.replace(/_/g, ' ')} tone={analysis.sentiment === 'very_positive' || analysis.sentiment === 'positive' ? 'text-success-400' : analysis.sentiment === 'negative' || analysis.sentiment === 'very_negative' ? 'text-error-500' : 'text-ink-500'} />
          <MiniStat label="Buyer Intent" value={analysis.buyer_intent.replace(/_/g, ' ')} tone={analysis.buyer_intent === 'very_high' || analysis.buyer_intent === 'high' ? 'text-success-400' : analysis.buyer_intent === 'medium' ? 'text-brand-400' : 'text-warning-500'} />
          <MiniStat label="Urgency" value={analysis.urgency} tone={analysis.urgency === 'critical' || analysis.urgency === 'high' ? 'text-error-500' : analysis.urgency === 'medium' ? 'text-brand-400' : 'text-ink-500'} />
          <MiniStat label="Interest" value={analysis.interest_level.replace(/_/g, ' ')} tone={analysis.interest_level === 'very_high' || analysis.interest_level === 'high' ? 'text-success-400' : 'text-brand-400'} />
          <MiniStat label="Decision Stage" value={analysis.decision_stage} tone="text-ink-500" />
          <MiniStat label="Meeting Ready" value={meetingReady ? 'Yes' : 'No'} tone={meetingReady ? 'text-success-400' : 'text-ink-500'} />
        </div>

        <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-500">Meeting Readiness</span>
            <span className={cn('text-sm font-semibold capitalize', readinessTone)}>{readinessLabel}</span>
          </div>
        </div>

        <div className="mt-3 rounded-lg border border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/5 p-3">
          <span className="text-xs text-brand-400 block mb-1">Next Best Action</span>
          <p className="text-sm text-ink-500 leading-relaxed">{recs.recommended_next_action}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
      <span className="text-xs text-ink-500 block mb-0.5">{label}</span>
      <p className={cn('text-sm font-medium capitalize', tone)}>{value}</p>
    </div>
  );
}

// ============================================================
// Tab Views
// ============================================================

function ConversationHistoryTab({ messages }: { messages: import('@/types/conversation-ai').ConversationMessage[] }) {
  if (!messages || messages.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No messages in this conversation.</p>;
  }

  const channelIcons: Record<string, React.ComponentType<{ className?: string }>> = {
    linkedin: MessageSquare,
    email: Mail,
    whatsapp: MessageSquare,
    slack: MessageSquare,
    manual: MessageSquare,
  };

  return (
    <div className="space-y-3">
      {messages.map((msg, i) => {
        const isProspect = msg.sender === 'prospect';
        const Icon = channelIcons[msg.channel] ?? MessageSquare;
        return (
          <div key={msg.id ?? i} className={cn('flex gap-3', isProspect ? 'justify-start' : 'justify-end')}>
            {(isProspect || msg.sender === 'ai') && (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-card-900 border border-gold-500/12 shrink-0 mt-0.5">
                <Icon className={cn('h-3.5 w-3.5', isProspect ? 'text-ink-500' : 'text-brand-400')} />
              </div>
            )}
            <div className={cn('max-w-[70%] rounded-lg px-3 py-2', isProspect ? 'bg-card-900 border border-gold-500/8' : msg.sender === 'ai' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20' : 'bg-gradient-to-r from-gold-400 to-gold-300/15 border border-brand-500/30')}>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-xs font-medium', isProspect ? 'text-ink-500' : 'text-brand-400')}>
                  {msg.sender === 'prospect' ? 'Prospect' : msg.sender === 'ai' ? 'AI' : 'You'}
                </span>
                <span className="text-[10px] text-ink-500">
                  {new Date(msg.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                </span>
              </div>
              <p className="text-sm text-ink-500 leading-relaxed">{msg.content}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ConversationIntelligenceTab({ analysis, summary }: {
  analysis: import('@/types/conversation-ai').ConversationAnalysis | null;
  summary: import('@/types/conversation-ai').ConversationSummary | null;
}) {
  if (!analysis) {
    return <p className="text-xs text-ink-500 text-center py-8">No intelligence data available.</p>;
  }

  const items = [
    { label: 'Sentiment', value: analysis.sentiment.replace(/_/g, ' ') },
    { label: 'Buyer Intent', value: analysis.buyer_intent.replace(/_/g, ' ') },
    { label: 'Urgency', value: analysis.urgency },
    { label: 'Interest Level', value: analysis.interest_level.replace(/_/g, ' ') },
    { label: 'Decision Stage', value: analysis.decision_stage },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-brand-400" />
            <CardTitle>Conversation Intelligence</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {items.map((item) => (
              <div key={item.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <span className="text-xs text-ink-500 block mb-1">{item.label}</span>
                <p className="text-sm text-ink-500 capitalize">{item.value}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      <ConversationSummaryCard summary={summary} />
    </div>
  );
}

function RecommendationsTab({ recs }: { recs: ConversationAIRecommendations }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recs.executive_summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Next Action</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recs.recommended_next_action}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Follow-up</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recs.recommended_followup}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-warning-500" />
            <CardTitle>Escalation Suggestion</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recs.escalation_suggestion}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success-400" />
            <CardTitle>Meeting Readiness</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Badge
            tone={recs.meeting_readiness === 'handed_off' || recs.meeting_readiness === 'ready' ? 'success' : recs.meeting_readiness === 'almost_ready' ? 'brand' : recs.meeting_readiness === 'warming_up' ? 'warning' : 'neutral'}
            dot
          >
            {recs.meeting_readiness.replace(/_/g, ' ')}
          </Badge>
        </CardContent>
      </Card>

      <NextActionCard recommendations={recs} />
    </div>
  );
}

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

function AnalyzeModal({ open, onClose, onAnalyze, loading, selectedIndex, onSelectIndex }: {
  open: boolean;
  onClose: () => void;
  onAnalyze: () => void;
  loading: boolean;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Analyze Conversation"
      description="Conversation AI will load the conversation history, analyze sentiment and buyer intent, qualify the lead using BANT, detect objections, generate AI response recommendations, and determine meeting readiness."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onAnalyze} loading={loading}>
            <Play className="h-4 w-4" />
            Analyze Conversation
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-ink-500 block mb-2">Select a prospect conversation to analyze:</span>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {MOCK_CONVERSATIONS.slice(0, 10).map((c, i) => (
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
                  {c.prospect_name} — {c.prospect_title} at {c.company_name}
                </span>
                <Badge tone={c.status === 'handed_off' ? 'success' : c.status === 'active' ? 'brand' : c.status === 'completed' ? 'neutral' : 'warning'}>
                  {c.status.replace(/_/g, ' ')}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The AI will perform the following steps:</p>
          <ul className="space-y-1.5">
            {CONVERSATION_STAGES.map((stage) => (
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

function DeleteModal({ open, onClose, onDelete, loading }: { open: boolean; onClose: () => void; onDelete: () => void; loading: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Conversation"
      description="This will permanently delete the conversation and all associated messages, analysis, objections, AI responses, and summary. This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Conversation</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this conversation?</p>
    </Modal>
  );
}
