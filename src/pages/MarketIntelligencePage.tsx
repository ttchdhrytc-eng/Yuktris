import { useState } from 'react';
import {
  Globe,
  RefreshCw,
  Download,
  Play,
  TrendingUp,
  Target,
  Swords,
  Sparkles,
  Factory,
  MapPin,
  DollarSign,
  Radar,
  Lightbulb,
  CheckCircle2,
  AlertCircle,
  Clock,
  Code2,
  Layers,
  Rocket,
  Award,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ConfidenceBadge } from '@/components/market-intelligence/ConfidenceBadge';
import { MarketOverviewCard } from '@/components/market-intelligence/MarketOverviewCard';
import { IndustryOpportunityTable } from '@/components/market-intelligence/IndustryOpportunityTable';
import { CountryOpportunityTable } from '@/components/market-intelligence/CountryOpportunityTable';
import { CompetitorCard } from '@/components/market-intelligence/CompetitorCard';
import { TrendCard } from '@/components/market-intelligence/TrendCard';
import { BuyingSignalCard } from '@/components/market-intelligence/BuyingSignalCard';
import { RecommendationCard } from '@/components/market-intelligence/RecommendationCard';
import { ExecutiveSummary } from '@/components/market-intelligence/ExecutiveSummary';
import { ProgressTimeline } from '@/components/market-intelligence/ProgressTimeline';

import { useMarketAnalysis, useCreateMarketAnalysis, useRefreshMarketAnalysis, useDeleteMarketAnalysis } from '@/hooks/useMarketAnalysis';
import { useMarketIntelligence, useGenerateMarketIntelligence } from '@/hooks/useMarketOpportunity';
import {
  MarketProfileOverview, MarketSegmentsSection, OpportunityFeedSection,
  MarketScoresSection, TargetAccountListsSection, MarketTrendsSection,
  MarketIntelligenceEmpty,
} from '@/components/market-opportunity';
import { miService, MARKET_STAGES } from '@/services/market-intelligence';
import { cn, timeAgo } from '@/lib/utils';
import type { FullMarketAnalysis, StrategyResult } from '@/types/market-intelligence';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'industries', label: 'Industry Opportunities', icon: Factory },
  { id: 'countries', label: 'Country Analysis', icon: MapPin },
  { id: 'competitors', label: 'Competitor Landscape', icon: Swords },
  { id: 'trends', label: 'Market Trends', icon: TrendingUp },
  { id: 'signals', label: 'Buying Signals', icon: Radar },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw Market Data', icon: Code2 },
  { id: 'market_profile', label: 'Market Profile', icon: Globe },
  { id: 'segments', label: 'Market Segments', icon: Layers },
  { id: 'opportunities', label: 'Opportunity Feed', icon: Rocket },
  { id: 'scores', label: 'Market Scores', icon: Target },
  { id: 'target_lists', label: 'Target Accounts', icon: Award },
  { id: 'market_trends', label: 'Emerging Trends', icon: Sparkles },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function MarketIntelligencePage() {
  const { data: analysis, isLoading } = useMarketAnalysis();
  const createMutation = useCreateMarketAnalysis();
  const refreshMutation = useRefreshMarketAnalysis();
  const deleteMutation = useDeleteMarketAnalysis();

  const [tab, setTab] = useState<TabId>('industries');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const { data: marketIntel } = useMarketIntelligence();
  const generateIntelMutation = useGenerateMarketIntelligence();

  const isProcessing = analysis?.market_status === 'processing' || analysis?.market_status === 'queued';
  const isMutating = createMutation.isPending || refreshMutation.isPending;

  // ============================================================
  // Handlers
  // ============================================================

  const handleStart = () => {
    setStartModalOpen(false);
    createMutation.mutate({ businessAnalysisId: null });
  };

  const handleRefresh = () => {
    if (analysis) refreshMutation.mutate(analysis.id);
  };

  const handleExport = () => {
    if (!analysis) return;
    const exportData = {
      analysis: {
        market_size: analysis.market_size,
        growth_score: analysis.growth_score,
        competition_score: analysis.competition_score,
        opportunity_score: analysis.opportunity_score,
        confidence_score: analysis.confidence_score,
        recommended_strategy: analysis.recommended_strategy,
        executive_summary: analysis.executive_summary,
        created_at: analysis.created_at,
        updated_at: analysis.updated_at,
      },
      industries: analysis.industries,
      countries: analysis.countries,
      competitors: analysis.competitors,
      trends: analysis.trends,
      signals: analysis.signals,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-analysis-${analysis.id.slice(0, 8)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
        <PageHeader
          title="Market Intelligence Agent"
          description="Analyze markets, identify demand, and discover opportunities."
        />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state — no analysis yet
  if (!analysis) {
    return (
      <div>
        <PageHeader
          title="Market Intelligence Agent"
          description="Analyze markets, identify demand, and discover opportunities."
        />
        <EmptyState
          icon={<Globe className="h-6 w-6" />}
          title="No Market Analysis Yet"
          description="Start a market analysis to identify industry opportunities, analyze competitors, discover market trends, and generate a GTM strategy. The Market Intelligence Agent runs after the Business Intelligence Agent completes."
          action={
            <Button onClick={() => setStartModalOpen(true)}>
              <Play className="h-4 w-4" />
              Start Market Analysis
            </Button>
          }
        />
        <StartModal
          open={startModalOpen}
          onClose={() => setStartModalOpen(false)}
          onStart={handleStart}
          loading={createMutation.isPending}
        />
      </div>
    );
  }

  // Processing state
  if (isProcessing || isMutating) {
    return <ProcessingView analysis={analysis} />;
  }

  // Error state
  if (analysis.market_status === 'failed') {
    return (
      <div>
        <PageHeader
          title="Market Intelligence Agent"
          description="Analyze markets, identify demand, and discover opportunities."
        />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Analysis Failed"
          description={analysis.error_message ?? 'The market analysis could not be completed. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setStartModalOpen(true)}>
                <Play className="h-4 w-4" />
                Start New
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <StartModal
          open={startModalOpen}
          onClose={() => setStartModalOpen(false)}
          onStart={handleStart}
          loading={createMutation.isPending}
        />
      </div>
    );
  }

  // Completed state — full dashboard
  const timelineEvents = miService.getTimelineEvents(analysis);
  const recommendedCount = analysis.industries.filter((i) => i.recommended).length;
  const recommendedCountries = analysis.countries.filter((c) => c.recommended).length;
  const avgConfidence = analysis.trends.length > 0
    ? Math.round(analysis.trends.reduce((sum, t) => sum + t.confidence, 0) / analysis.trends.length)
    : 0;
  const criticalSignals = analysis.signals.filter((s) => s.priority === 'critical').length;

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Market Intelligence Agent"
        description="Analyze markets, identify demand, and discover opportunities."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
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
        <KpiCard icon={DollarSign} label="Market Size">
          <span className="text-xs text-ink-500 font-medium truncate block max-w-[120px]">{analysis.market_size ?? '—'}</span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label="Growth Score">
          <span className={cn('text-sm font-semibold', analysis.growth_score >= 80 ? 'text-success-400' : analysis.growth_score >= 50 ? 'text-warning-500' : 'text-error-400')}>
            {analysis.growth_score}/100
          </span>
        </KpiCard>
        <KpiCard icon={Swords} label="Competition">
          <span className={cn('text-sm font-semibold', analysis.competition_score >= 80 ? 'text-error-400' : analysis.competition_score >= 50 ? 'text-warning-500' : 'text-success-400')}>
            {analysis.competition_score}/100
          </span>
        </KpiCard>
        <KpiCard icon={Target} label="Opportunity">
          <span className={cn('text-sm font-semibold', analysis.opportunity_score >= 80 ? 'text-success-400' : analysis.opportunity_score >= 50 ? 'text-warning-500' : 'text-error-400')}>
            {analysis.opportunity_score}/100
          </span>
        </KpiCard>
        <KpiCard icon={Factory} label="Top Industries">
          <span className="text-sm text-ink-500 font-medium">{recommendedCount} recommended</span>
        </KpiCard>
        <KpiCard icon={MapPin} label="Target Countries">
          <span className="text-sm text-ink-500 font-medium">{recommendedCountries} markets</span>
        </KpiCard>
        <KpiCard icon={Clock} label="Last Updated">
          <span className="text-xs text-ink-500">{timeAgo(analysis.updated_at)}</span>
        </KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Market Overview */}
        <div className="lg:col-span-4">
          <MarketOverviewCard analysis={analysis} />
        </div>

        {/* Center panel — Analysis cards */}
        <div className="lg:col-span-5 space-y-4">
          <ExecutiveSummary summary={analysis.executive_summary ?? 'No executive summary available.'} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AnalysisMiniCard icon={Factory} title="Industries Analyzed" value={analysis.industries.length} subtitle={`${recommendedCount} recommended`} />
            <AnalysisMiniCard icon={MapPin} title="Countries Analyzed" value={analysis.countries.length} subtitle={`${recommendedCountries} recommended`} />
            <AnalysisMiniCard icon={Swords} title="Competitors Found" value={analysis.competitors.length} subtitle="Direct competitors" />
            <AnalysisMiniCard icon={TrendingUp} title="Trends Detected" value={analysis.trends.length} subtitle={`${avgConfidence}% avg confidence`} />
            <AnalysisMiniCard icon={Radar} title="Buying Signals" value={analysis.signals.length} subtitle={`${criticalSignals} critical`} />
            <AnalysisMiniCard icon={Sparkles} label="Confidence" title="Analysis Confidence">
              <ConfidenceBadge score={analysis.confidence_score} />
            </AnalysisMiniCard>
          </div>
        </div>

        {/* Right panel — Timeline */}
        <div className="lg:col-span-3 space-y-4">
          <ProgressTimeline events={timelineEvents} />
          <Card>
            <CardContent className="flex flex-col items-center py-6">
              <div className="text-center mb-2">
                <p className="text-3xl font-bold text-ink-500">{analysis.opportunity_score}</p>
                <p className="text-xs text-ink-500 mt-1">Overall Opportunity Score</p>
              </div>
              <div className="h-2 w-full rounded-full bg-card-900 overflow-hidden mt-2">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', analysis.opportunity_score >= 80 ? 'bg-success-500' : analysis.opportunity_score >= 50 ? 'bg-warning-500' : 'bg-error-500')}
                  style={{ width: `${analysis.opportunity_score}%` }}
                />
              </div>
            </CardContent>
          </Card>
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
                  tab === t.id
                    ? 'border-brand-500 text-ink-500 font-medium'
                    : 'border-transparent text-ink-500 hover:text-ink-500'
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <CardContent className="min-h-[300px]">
          {tab === 'industries' && <IndustryOpportunityTable industries={analysis.industries} />}
          {tab === 'countries' && <CountryOpportunityTable countries={analysis.countries} />}
          {tab === 'competitors' && <CompetitorTab analysis={analysis} />}
          {tab === 'trends' && <TrendsTab analysis={analysis} />}
          {tab === 'signals' && <SignalsTab analysis={analysis} />}
          {tab === 'recommendations' && <RecommendationsTab analysis={analysis} />}
          {tab === 'raw' && <RawTab analysis={analysis} />}
          {tab === 'market_profile' && (marketIntel ? <MarketProfileOverview profile={marketIntel.profile} /> : <MarketIntelligenceEmpty onGenerate={() => generateIntelMutation.mutate()} isGenerating={generateIntelMutation.isPending} />)}
          {tab === 'segments' && (marketIntel ? <MarketSegmentsSection segments={marketIntel.segments} /> : <MarketIntelligenceEmpty onGenerate={() => generateIntelMutation.mutate()} isGenerating={generateIntelMutation.isPending} />)}
          {tab === 'opportunities' && (marketIntel ? <OpportunityFeedSection opportunities={marketIntel.opportunities} /> : <MarketIntelligenceEmpty onGenerate={() => generateIntelMutation.mutate()} isGenerating={generateIntelMutation.isPending} />)}
          {tab === 'scores' && (marketIntel ? <MarketScoresSection scores={marketIntel.scores} /> : <MarketIntelligenceEmpty onGenerate={() => generateIntelMutation.mutate()} isGenerating={generateIntelMutation.isPending} />)}
          {tab === 'target_lists' && (marketIntel ? <TargetAccountListsSection lists={marketIntel.targetLists} /> : <MarketIntelligenceEmpty onGenerate={() => generateIntelMutation.mutate()} isGenerating={generateIntelMutation.isPending} />)}
          {tab === 'market_trends' && (marketIntel ? <MarketTrendsSection trends={marketIntel.trends} /> : <MarketIntelligenceEmpty onGenerate={() => generateIntelMutation.mutate()} isGenerating={generateIntelMutation.isPending} />)}
        </CardContent>
      </Card>

      {/* Modals */}
      <StartModal
        open={startModalOpen}
        onClose={() => setStartModalOpen(false)}
        onStart={handleStart}
        loading={createMutation.isPending}
      />
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onDelete={handleDelete}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView({ analysis }: { analysis: FullMarketAnalysis }) {
  const currentStage = miService.getCurrentStage();
  const stageIndex = MARKET_STAGES.findIndex((s) => s.stage === currentStage);
  const progress = Math.round(((stageIndex + 1) / MARKET_STAGES.length) * 100);

  return (
    <div>
      <PageHeader
        title="Market Intelligence Agent"
        description="Analyze markets, identify demand, and discover opportunities."
      />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Globe className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Analyzing Market</h2>
        <p className="text-sm text-ink-500 mb-8">The Market Intelligence Agent is researching industries, competitors, and opportunities. This typically takes 30–60 seconds.</p>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-500">Progress</span>
            <span className="text-sm font-semibold text-ink-500">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-card-900 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Stages */}
        <div className="w-full max-w-md space-y-2">
          {MARKET_STAGES.map((stage, i) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0 transition-colors',
                i < stageIndex && 'border-success-500 bg-success-500/10 text-success-400',
                i === stageIndex && 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400',
                i > stageIndex && 'border-gold-500/12 bg-card-900 text-ink-500'
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

        {analysis.error_message && (
          <div className="mt-6 rounded-lg border border-error-500/20 bg-error-500/5 px-4 py-3 max-w-md">
            <p className="text-xs text-error-400">{analysis.error_message}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tab Views
// ============================================================

function CompetitorTab({ analysis }: { analysis: FullMarketAnalysis }) {
  if (analysis.competitors.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No competitor analysis available.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {analysis.competitors.map((c) => (
        <CompetitorCard key={c.id} competitor={c} />
      ))}
    </div>
  );
}

function TrendsTab({ analysis }: { analysis: FullMarketAnalysis }) {
  if (analysis.trends.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No trend analysis available.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {analysis.trends.map((t) => (
        <TrendCard key={t.id} trend={t} />
      ))}
    </div>
  );
}

function SignalsTab({ analysis }: { analysis: FullMarketAnalysis }) {
  if (analysis.signals.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No buying signals available.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {analysis.signals.map((s) => (
        <BuyingSignalCard key={s.id} signal={s} />
      ))}
    </div>
  );
}

function RecommendationsTab({ analysis }: { analysis: FullMarketAnalysis }) {
  const strategy: StrategyResult = {
    recommendedIndustries: analysis.industries.filter((i) => i.recommended).map((i) => i.industry_name),
    recommendedCountries: analysis.countries.filter((c) => c.recommended).map((c) => c.country),
    recommendedCompanySizes: ['50–200 employees', '200–500 employees', '500–1000 employees'],
    recommendedSalesStrategy: analysis.recommended_strategy ?? 'No sales strategy available.',
    recommendedPositioning: 'Position as the AI-native alternative to legacy sales engagement platforms.',
    recommendedMessaging: 'Lead with intent-driven outreach as the primary differentiator.',
    recommendedStrategy: analysis.recommended_strategy ?? '',
    executiveSummary: analysis.executive_summary ?? '',
  };
  return <RecommendationCard strategy={strategy} />;
}

function RawTab({ analysis }: { analysis: FullMarketAnalysis }) {
  const rawData = {
    analysis: {
      id: analysis.id,
      market_status: analysis.market_status,
      market_size: analysis.market_size,
      growth_score: analysis.growth_score,
      competition_score: analysis.competition_score,
      opportunity_score: analysis.opportunity_score,
      confidence_score: analysis.confidence_score,
      recommended_strategy: analysis.recommended_strategy,
      executive_summary: analysis.executive_summary,
      created_at: analysis.created_at,
      updated_at: analysis.updated_at,
    },
    industries: analysis.industries,
    countries: analysis.countries,
    competitors: analysis.competitors,
    trends: analysis.trends,
    signals: analysis.signals,
  };

  return (
    <div className="rounded-lg border border-gold-500/12 bg-maroon-950 p-4 max-h-[500px] overflow-auto scrollbar-thin">
      <pre className="text-xs text-ink-500 font-mono whitespace-pre-wrap">{JSON.stringify(rawData, null, 2)}</pre>
    </div>
  );
}

// ============================================================
// Helper Components
// ============================================================

function KpiCard({ icon: Icon, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
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

function AnalysisMiniCard({ icon: Icon, title, value, subtitle, label, children }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value?: number;
  subtitle?: string;
  label?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-maroon-900 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-ink-500" />
        <span className="text-xs font-medium text-ink-500">{title}</span>
      </div>
      {value !== undefined && (
        <p className="text-2xl font-bold text-ink-500">{value}</p>
      )}
      {children}
      {subtitle && <p className="text-xs text-ink-500 mt-1">{subtitle}</p>}
      {label && <p className="text-xs text-ink-500 mt-1">{label}</p>}
    </div>
  );
}

function StartModal({ open, onClose, onStart, loading }: {
  open: boolean;
  onClose: () => void;
  onStart: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Start Market Analysis"
      description="The Market Intelligence Agent will research industries, analyze competitors, detect market trends, identify buying signals, and generate a GTM strategy with recommendations."
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
      <div className="space-y-3">
        <p className="text-xs text-ink-500 leading-relaxed">
          This analysis runs after the Business Intelligence Agent has completed. It will:
        </p>
        <ul className="space-y-2">
          {MARKET_STAGES.map((stage) => (
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
    </Modal>
  );
}

function DeleteModal({ open, onClose, onDelete, loading }: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Market Analysis"
      description="This will permanently delete the market analysis and all associated data (industries, countries, competitors, trends, and buying signals). This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>
            Delete Analysis
          </Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this market analysis?</p>
    </Modal>
  );
}
