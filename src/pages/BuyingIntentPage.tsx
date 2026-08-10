import { useState, useMemo } from 'react';
import {
  Target,
  RefreshCw,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Clock,
  Flame,
  Signal as SignalIcon,
  Users,
  BarChart3,
  ListOrdered,
  Lightbulb,
  FileJson,
  ArrowRight,
  MessageSquare,
  Building2,
  ShieldCheck,
  Activity,
  Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { IntentScoreCard } from '@/components/buying-intent/IntentScoreCard';
import { BuyingWindowCard } from '@/components/buying-intent/BuyingWindowCard';
import { OpportunityCard } from '@/components/buying-intent/OpportunityCard';
import { UrgencyCard } from '@/components/buying-intent/UrgencyCard';
import { SignalTable } from '@/components/buying-intent/SignalTable';
import { StakeholderSignalCard } from '@/components/buying-intent/StakeholderSignalCard';
import { PredictionCard } from '@/components/buying-intent/PredictionCard';
import { PriorityQueue } from '@/components/buying-intent/PriorityQueue';
import { ExecutiveSummaryCard } from '@/components/buying-intent/ExecutiveSummaryCard';
import { TimelineCard } from '@/components/buying-intent/TimelineCard';

import {
  useBuyingIntent,
  useAnalyzeIntent,
  useRefreshIntent,
  useDeleteIntent,
  useExportIntent,
  usePriorityQueue,
  MOCK_INTENT_COMPANIES,
  MOCK_PRIORITY_QUEUE,
  MOCK_AI_RECOMMENDATIONS,
  INTENT_STAGES,
} from '@/hooks/useBuyingIntent';
import { buyingIntentService } from '@/services/buying-intent';
import { cn } from '@/lib/utils';
import type { ExportFormat, IntentAIRecommendations, SignalType } from '@/types/buying-intent';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'intent_signals', label: 'Intent Signals', icon: SignalIcon },
  { id: 'stakeholder_signals', label: 'Stakeholder Signals', icon: Users },
  { id: 'business_signals', label: 'Business Signals', icon: Building2 },
  { id: 'technology_signals', label: 'Technology Signals', icon: Activity },
  { id: 'intent_prediction', label: 'Intent Prediction', icon: BarChart3 },
  { id: 'priority_queue', label: 'Priority Queue', icon: ListOrdered },
  { id: 'ai_recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw JSON', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

const businessTypes: SignalType[] = ['funding', 'hiring', 'expansion', 'revenue', 'employee_growth', 'leadership', 'acquisition', 'market'];
const technologyTypes: SignalType[] = ['technology', 'website', 'digital', 'security', 'infrastructure', 'product', 'partnership', 'competitive'];

// ============================================================
// Main Page
// ============================================================

export function BuyingIntentPage() {
  const { data: analysis, isLoading } = useBuyingIntent();
  const startMutation = useAnalyzeIntent();
  const refreshMutation = useRefreshIntent();
  const deleteMutation = useDeleteIntent();
  const exportMutation = useExportIntent();
  const { data: priorityQueue } = usePriorityQueue();

  const [tab, setTab] = useState<TabId>('intent_signals');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState(0);

  const isProcessing = analysis?.status === 'processing' || analysis?.status === 'queued';
  const isMutating = startMutation.isPending || refreshMutation.isPending;

  // Derived stats
  const stats = useMemo(() => {
    const all = MOCK_INTENT_COMPANIES;
    const completed = all.filter((c) => c.analysis.status === 'completed').length;
    const avgIntent = Math.round(all.reduce((s, c) => s + c.analysis.intent_score, 0) / all.length);
    const avgOpp = Math.round(all.reduce((s, c) => s + c.analysis.opportunity_score, 0) / all.length);
    const avgUrgency = Math.round(all.reduce((s, c) => s + c.analysis.urgency_score, 0) / all.length);
    const avgConfidence = Math.round(all.reduce((s, c) => s + c.analysis.confidence_score, 0) / all.length);
    const critical = all.filter((c) => c.analysis.recommended_priority === 'critical').length;
    const highPriority = all.filter((c) => c.analysis.recommended_priority === 'high' || c.analysis.recommended_priority === 'critical').length;
    const avgProb = Math.round(all.reduce((s, c) => s + c.prediction.purchase_probability, 0) / all.length);
    return { completed, avgIntent, avgOpp, avgUrgency, avgConfidence, critical, highPriority, avgProb };
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleStart = () => {
    setStartModalOpen(false);
    startMutation.mutate({ companyIndex: selectedCompanyIndex });
  };

  const handleRefresh = () => {
    if (analysis) refreshMutation.mutate(analysis.id);
  };

  const handleExport = (format: ExportFormat) => {
    if (analysis) exportMutation.mutate({ analysis, format });
  };

  const handleDelete = () => {
    if (analysis) {
      deleteMutation.mutate(analysis.id);
      setDeleteModalOpen(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Buying Intent Agent" description="Analyze signals to predict which prospects are most likely to purchase." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!analysis) {
    return (
      <div>
        <PageHeader title="Buying Intent Agent" description="Analyze signals to predict which prospects are most likely to purchase." />
        <EmptyState
          icon={<Target className="h-6 w-6" />}
          title="No Intent Analysis"
          description="The Buying Intent Agent analyzes every available signal from companies, stakeholders, industries, technologies, and market trends to determine which prospects are most likely to purchase. Start an analysis to generate intent scores, predictions, and AI-powered outreach recommendations."
          action={
            <Button onClick={() => setStartModalOpen(true)}>
              <Play className="h-4 w-4" />
              Analyze Buying Intent
            </Button>
          }
        />
        <StartModal open={startModalOpen} onClose={() => setStartModalOpen(false)} onStart={handleStart} loading={startMutation.isPending} selectedIndex={selectedCompanyIndex} onSelectIndex={setSelectedCompanyIndex} />
      </div>
    );
  }

  // Processing state
  if (isProcessing || isMutating) {
    return <ProcessingView />;
  }

  // Error state
  if (analysis.status === 'failed') {
    return (
      <div>
        <PageHeader title="Buying Intent Agent" description="Analyze signals to predict which prospects are most likely to purchase." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Analysis Failed"
          description={analysis.error_message ?? 'The buying intent analysis could not be completed. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setStartModalOpen(true)}>
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
        <StartModal open={startModalOpen} onClose={() => setStartModalOpen(false)} onStart={handleStart} loading={startMutation.isPending} selectedIndex={selectedCompanyIndex} onSelectIndex={setSelectedCompanyIndex} />
      </div>
    );
  }

  // Completed state — full dashboard
  const timelineEvents = buyingIntentService.getTimelineEvents(analysis);
  const aiRecs: IntentAIRecommendations = MOCK_AI_RECOMMENDATIONS;
  const businessSignals = analysis.signals.filter((s) => businessTypes.includes(s.signal_type));
  const techSignals = analysis.signals.filter((s) => technologyTypes.includes(s.signal_type));

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Buying Intent Agent"
        description="Analyze signals to predict which prospects are most likely to purchase."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
            <Button size="sm" onClick={() => setStartModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              New Analysis
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="Status">
          <Badge tone="success" dot>Completed</Badge>
        </KpiCard>
        <KpiCard icon={Target} label="Avg Intent">
          <span className={cn('text-sm font-semibold', stats.avgIntent >= 80 ? 'text-success-400' : stats.avgIntent >= 60 ? 'text-warning-500' : 'text-ink-500')}>{stats.avgIntent}</span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label="Avg Opportunity">
          <span className={cn('text-sm font-semibold', stats.avgOpp >= 80 ? 'text-success-400' : stats.avgOpp >= 60 ? 'text-warning-500' : 'text-ink-500')}>{stats.avgOpp}</span>
        </KpiCard>
        <KpiCard icon={Flame} label="Avg Urgency">
          <span className={cn('text-sm font-semibold', stats.avgUrgency >= 80 ? 'text-error-400' : stats.avgUrgency >= 60 ? 'text-warning-500' : 'text-ink-500')}>{stats.avgUrgency}</span>
        </KpiCard>
        <KpiCard icon={Zap} label="Critical Priority">
          <span className="text-sm text-error-400 font-semibold">{stats.critical}</span>
        </KpiCard>
        <KpiCard icon={Activity} label="High Priority">
          <span className="text-sm text-warning-500 font-semibold">{stats.highPriority}</span>
        </KpiCard>
        <KpiCard icon={BarChart3} label="Avg Purchase Prob.">
          <span className={cn('text-sm font-semibold', stats.avgProb >= 75 ? 'text-success-400' : stats.avgProb >= 50 ? 'text-warning-500' : 'text-ink-500')}>{stats.avgProb}%</span>
        </KpiCard>
        <KpiCard icon={ShieldCheck} label="Confidence">
          <span className={cn('text-sm font-semibold', stats.avgConfidence >= 85 ? 'text-success-400' : stats.avgConfidence >= 70 ? 'text-warning-500' : 'text-ink-500')}>{stats.avgConfidence}%</span>
        </KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Intent Score + Buying Window */}
        <div className="lg:col-span-3 space-y-4">
          <IntentScoreCard intent_score={analysis.intent_score} intent_level={analysis.intent_level} />
          <BuyingWindowCard buying_window={analysis.buying_window} urgency_score={analysis.urgency_score} />
        </div>

        {/* Center panel — Opportunity + Urgency + Prediction */}
        <div className="lg:col-span-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <OpportunityCard opportunity_score={analysis.opportunity_score} />
            <UrgencyCard urgency_score={analysis.urgency_score} />
          </div>
          <PredictionCard prediction={analysis.prediction} />
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
          {tab === 'intent_signals' && <SignalTable signals={analysis.signals} />}
          {tab === 'stakeholder_signals' && <StakeholderSignalCard signals={analysis.stakeholder_signals} />}
          {tab === 'business_signals' && <SignalTable signals={businessSignals} />}
          {tab === 'technology_signals' && <SignalTable signals={techSignals} />}
          {tab === 'intent_prediction' && <PredictionCard prediction={analysis.prediction} />}
          {tab === 'priority_queue' && <PriorityQueue entries={priorityQueue ?? MOCK_PRIORITY_QUEUE} />}
          {tab === 'ai_recommendations' && <AIRecommendationsTab recommendations={aiRecs} analysis={analysis} />}
          {tab === 'raw' && <RawTab data={analysis} />}
        </CardContent>
      </Card>

      {/* Modals */}
      <StartModal open={startModalOpen} onClose={() => setStartModalOpen(false)} onStart={handleStart} loading={startMutation.isPending} selectedIndex={selectedCompanyIndex} onSelectIndex={setSelectedCompanyIndex} />
      <DeleteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onDelete={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView() {
  const currentStage = buyingIntentService.getCurrentStage();
  const stageIndex = INTENT_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Buying Intent Agent" description="Analyze signals to predict which prospects are most likely to purchase." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Target className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Analyzing Buying Intent</h2>
        <p className="text-sm text-ink-500 mb-8">The Buying Intent Agent is collecting signals, calculating scores, and generating predictions. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {INTENT_STAGES.map((stage, i) => (
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
// Tab Views
// ============================================================

function AIRecommendationsTab({ recommendations, analysis }: { recommendations: IntentAIRecommendations; analysis: { recommendations: { id: string; recommendation: string; priority: string; reason: string | null }[] } }) {
  return (
    <div className="space-y-4">
      <ExecutiveSummaryCard recommendations={recommendations} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-success-400" />
              <CardTitle>Why This Prospect</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.why_this_prospect}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-400" />
              <CardTitle>Messaging Theme</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_messaging_theme}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Contact Order</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.recommended_contact_order.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 text-xs font-semibold shrink-0">{i + 1}</div>
                <span className="text-xs text-ink-500">{c}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Outreach Time</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_outreach_time}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-success-400" />
              <CardTitle>Expected Outcome</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.expected_outcome}</p>
          </CardContent>
        </Card>
      </div>

      {analysis.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-brand-400" />
              <CardTitle>Actionable Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.recommendations.map((rec) => (
                <div key={rec.id} className="flex items-start gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
                  <ArrowRight className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-ink-500">{rec.recommendation}</p>
                    {rec.reason && <p className="text-xs text-ink-500 mt-1">{rec.reason}</p>}
                  </div>
                  <Badge tone={rec.priority === 'critical' ? 'error' : rec.priority === 'high' ? 'warning' : 'neutral'} className="ml-auto shrink-0">{rec.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
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

function StartModal({ open, onClose, onStart, loading, selectedIndex, onSelectIndex }: {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  loading: boolean;
  selectedIndex: number;
  onSelectIndex: (i: number) => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Analyze Buying Intent"
      description="The Buying Intent Agent will collect signals, calculate intent scores, predict buying windows, and generate AI-powered outreach recommendations for the selected company."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onStart} loading={loading}>
            <Play className="h-4 w-4" />
            Start Analysis
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-ink-500 block mb-2">Select a company to analyze:</span>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {MOCK_INTENT_COMPANIES.slice(0, 10).map((c, i) => (
              <button
                key={i}
                onClick={() => onSelectIndex(i)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                  selectedIndex === i ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/30' : 'bg-card-900 border border-gold-500/12 hover:bg-card-800',
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                <span className={cn('text-xs flex-1', selectedIndex === i ? 'text-brand-400 font-medium' : 'text-ink-500')}>{c.company_name}</span>
                <Badge tone={c.analysis.recommended_priority === 'critical' ? 'error' : c.analysis.recommended_priority === 'high' ? 'warning' : 'neutral'}>
                  {c.analysis.intent_score}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The agent will perform the following steps:</p>
          <ul className="space-y-1.5">
            {INTENT_STAGES.map((stage) => (
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
      title="Delete Analysis"
      description="This will permanently delete the intent analysis and all associated signals, predictions, and recommendations. This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Analysis</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this analysis?</p>
    </Modal>
  );
}
