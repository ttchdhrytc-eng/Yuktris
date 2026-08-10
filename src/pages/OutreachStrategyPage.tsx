import { useState, useMemo } from 'react';
import {
  Rocket,
  RefreshCw,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  Target,
  TrendingUp,
  Mail,
  Zap,
  BarChart3,
  Lightbulb,
  Clock,
  Radio,
  MessageSquare,
  FileJson,
  ArrowRight,
  Building2,
  User,
  Briefcase,
  Activity,
  ShieldCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { CampaignOverviewCard } from '@/components/outreach-strategy/CampaignOverviewCard';
import { TouchpointTimeline } from '@/components/outreach-strategy/TouchpointTimeline';
import { ChannelStrategyCard } from '@/components/outreach-strategy/ChannelStrategyCard';
import { TimingStrategyCard } from '@/components/outreach-strategy/TimingStrategyCard';
import { MessagingFrameworkCard } from '@/components/outreach-strategy/MessagingFrameworkCard';
import { CampaignMetricsCard } from '@/components/outreach-strategy/CampaignMetricsCard';
import { RecommendationCard } from '@/components/outreach-strategy/RecommendationCard';
import { CampaignReadinessCard } from '@/components/outreach-strategy/CampaignReadinessCard';
import { TimelineCard } from '@/components/outreach-strategy/TimelineCard';

import {
  useOutreachStrategy,
  useGenerateStrategy,
  useRefreshStrategy,
  useDeleteStrategy,
  useExportStrategy,
  MOCK_CAMPAIGNS,
  MOCK_AI_RECOMMENDATIONS,
  OUTREACH_STAGES,
} from '@/hooks/useOutreachStrategy';
import { outreachStrategyService } from '@/services/outreach-strategy';
import { cn } from '@/lib/utils';
import type { ExportFormat, OutreachAIRecommendations } from '@/types/outreach-strategy';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'overview', label: 'Campaign Overview', icon: Target },
  { id: 'touchpoints', label: 'Touchpoint Sequence', icon: Mail },
  { id: 'channels', label: 'Channel Strategy', icon: Radio },
  { id: 'timing', label: 'Timing Strategy', icon: Clock },
  { id: 'messaging', label: 'Messaging Framework', icon: MessageSquare },
  { id: 'metrics', label: 'Success Metrics', icon: BarChart3 },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw JSON', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function OutreachStrategyPage() {
  const { data: campaign, isLoading } = useOutreachStrategy();
  const startMutation = useGenerateStrategy();
  const refreshMutation = useRefreshStrategy();
  const deleteMutation = useDeleteStrategy();
  const exportMutation = useExportStrategy();

  const [tab, setTab] = useState<TabId>('overview');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);

  const isProcessing = campaign?.campaign_status === 'processing' || campaign?.campaign_status === 'queued';
  const isMutating = startMutation.isPending || refreshMutation.isPending;

  // Derived stats
  const stats = useMemo(() => {
    const all = MOCK_CAMPAIGNS;
    const completed = all.filter((c) => c.campaign.campaign_status === 'completed').length;
    const ready = all.filter((c) => c.ai_recommendations.campaign_readiness === 'ready' || c.ai_recommendations.campaign_readiness === 'highly_ready').length;
    const avgScore = Math.round(all.reduce((s, c) => s + c.campaign.campaign_score, 0) / all.length);
    const highPriority = all.filter((c) => c.priority === 'critical' || c.priority === 'high').length;
    const avgTouchpoints = 6;
    const ctaConfidence = Math.round(all.reduce((s, c) => s + c.campaign_metrics.confidence, 0) / all.length);
    const followupReady = Math.round((ready / all.length) * 100);
    const strategyConfidence = avgScore;
    return { completed, ready, avgScore, highPriority, avgTouchpoints, ctaConfidence, followupReady, strategyConfidence };
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleStart = () => {
    setStartModalOpen(false);
    startMutation.mutate({ prospectIndex: selectedProspectIndex });
  };

  const handleRefresh = () => {
    if (campaign) refreshMutation.mutate(campaign.id);
  };

  const handleExport = (format: ExportFormat) => {
    if (campaign) exportMutation.mutate({ campaign, format });
  };

  const handleDelete = () => {
    if (campaign) {
      deleteMutation.mutate(campaign.id);
      setDeleteModalOpen(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Outreach Strategy Agent" description="Design intelligent multi-touch outreach campaigns before execution." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!campaign) {
    return (
      <div>
        <PageHeader title="Outreach Strategy Agent" description="Design intelligent multi-touch outreach campaigns before execution." />
        <EmptyState
          icon={<Rocket className="h-6 w-6" />}
          title="No Outreach Strategy Generated"
          description="Generate outreach campaigns for your personalized prospects. The Outreach Strategy Agent transforms personalization intelligence into complete multi-touch campaigns with channel strategy, timing optimization, messaging frameworks, and success metrics — all ready for the LinkedIn Execution Agent."
          action={
            <Button onClick={() => setStartModalOpen(true)}>
              <Play className="h-4 w-4" />
              Generate Campaign
            </Button>
          }
        />
        <StartModal open={startModalOpen} onClose={() => setStartModalOpen(false)} onStart={handleStart} loading={startMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      </div>
    );
  }

  // Processing state
  if (isProcessing || isMutating) {
    return <ProcessingView />;
  }

  // Error state
  if (campaign.campaign_status === 'failed') {
    return (
      <div>
        <PageHeader title="Outreach Strategy Agent" description="Design intelligent multi-touch outreach campaigns before execution." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Campaign Generation Failed"
          description={campaign.error_message ?? 'The outreach campaign could not be generated. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setStartModalOpen(true)}>
                <Play className="h-4 w-4" />
                New Campaign
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <StartModal open={startModalOpen} onClose={() => setStartModalOpen(false)} onStart={handleStart} loading={startMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      </div>
    );
  }

  // Completed state — full dashboard
  const timelineEvents = outreachStrategyService.getTimelineEvents(campaign);
  const mockCampaign = MOCK_CAMPAIGNS[selectedProspectIndex] ?? MOCK_CAMPAIGNS[0];
  const aiRecs: OutreachAIRecommendations = MOCK_AI_RECOMMENDATIONS;

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Outreach Strategy Agent"
        description="Design intelligent multi-touch outreach campaigns before execution."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Strategy
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export Campaign
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
            <Button size="sm" onClick={() => setStartModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              Generate Strategy
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="Strategies">
          <span className="text-sm text-ink-500 font-semibold">{stats.completed}</span>
        </KpiCard>
        <KpiCard icon={ShieldCheck} label="Readiness">
          <span className={cn('text-sm font-semibold', stats.followupReady >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.followupReady}%</span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label="Avg Success">
          <span className={cn('text-sm font-semibold', stats.avgScore >= 80 ? 'text-success-400' : 'text-warning-500')}>{stats.avgScore}</span>
        </KpiCard>
        <KpiCard icon={Target} label="High Priority">
          <span className="text-sm text-error-500 font-semibold">{stats.highPriority}</span>
        </KpiCard>
        <KpiCard icon={Mail} label="Avg Touches">
          <span className="text-sm text-brand-400 font-semibold">{stats.avgTouchpoints}</span>
        </KpiCard>
        <KpiCard icon={Zap} label="CTA Confidence">
          <span className={cn('text-sm font-semibold', stats.ctaConfidence >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.ctaConfidence}%</span>
        </KpiCard>
        <KpiCard icon={Activity} label="Follow-up Ready">
          <span className={cn('text-sm font-semibold', stats.followupReady >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.followupReady}%</span>
        </KpiCard>
        <KpiCard icon={ShieldCheck} label="Strategy Confidence">
          <span className={cn('text-sm font-semibold', stats.strategyConfidence >= 80 ? 'text-success-400' : 'text-warning-500')}>{stats.strategyConfidence}%</span>
        </KpiCard>
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
              <p className="text-xs text-ink-500 mt-0.5">Loaded from Personalization Agent</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow icon={User} label="Decision Maker" value={mockCampaign.prospect_name} />
                <InfoRow icon={Briefcase} label="Job Title" value={mockCampaign.prospect_title} />
                <InfoRow icon={Building2} label="Company" value={mockCampaign.company_name} />
                <InfoRow icon={TrendingUp} label="Buying Intent" value={`${mockCampaign.buying_intent}/100`} />
                <InfoRow icon={Target} label="Priority" value={mockCampaign.priority} />
                <InfoRow icon={Zap} label="Personalization" value={`${mockCampaign.personalization_score}/100`} />
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Campaign Dashboard */}
        <div className="lg:col-span-6">
          <CampaignReadinessCard campaign={campaign} />
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
          {tab === 'overview' && <CampaignOverviewCard campaign={campaign} />}
          {tab === 'touchpoints' && <TouchpointTimeline touchpoints={campaign.touchpoints} />}
          {tab === 'channels' && <ChannelStrategyCard channels={campaign.channel_strategy} />}
          {tab === 'timing' && <TimingStrategyCard timing={campaign.timing_strategy} />}
          {tab === 'messaging' && <MessagingFrameworkCard framework={mockCampaign.messaging_framework} />}
          {tab === 'metrics' && <CampaignMetricsCard metrics={campaign.campaign_metrics} />}
          {tab === 'recommendations' && <RecommendationsTab aiRecs={aiRecs} campaignRecs={campaign.recommendations} />}
          {tab === 'raw' && <RawTab data={campaign} />}
        </CardContent>
      </Card>

      {/* Modals */}
      <StartModal open={startModalOpen} onClose={() => setStartModalOpen(false)} onStart={handleStart} loading={startMutation.isPending} selectedIndex={selectedProspectIndex} onSelectIndex={setSelectedProspectIndex} />
      <DeleteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onDelete={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView() {
  const currentStage = outreachStrategyService.getCurrentStage();
  const stageIndex = OUTREACH_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Outreach Strategy Agent" description="Design intelligent multi-touch outreach campaigns before execution." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Rocket className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Generating Outreach Campaign</h2>
        <p className="text-sm text-ink-500 mb-8">The Outreach Strategy Agent is building your multi-touch campaign, optimizing channels and timing, and calculating success metrics. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {OUTREACH_STAGES.map((stage, i) => (
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

function RecommendationsTab({ aiRecs, campaignRecs }: { aiRecs: OutreachAIRecommendations; campaignRecs: import('@/types/outreach-strategy').OutreachRecommendation[] }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileJson className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{aiRecs.executive_summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-400" />
              <CardTitle>Recommended Campaign</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{aiRecs.recommended_campaign}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-success-400" />
              <CardTitle>Recommended Next Action</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{aiRecs.recommended_next_action}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-error-500" />
              <CardTitle>Risk Factors</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {aiRecs.risk_factors.map((risk, i) => (
                <li key={i} className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-error-500 shrink-0 mt-0.5" />
                  <span className="text-sm text-ink-500">{risk}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-brand-400" />
              <CardTitle>Optimization Suggestions</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {aiRecs.optimization_suggestions.map((sug, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                  <span className="text-sm text-ink-500">{sug}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-success-400" />
            <CardTitle>Campaign Readiness</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Badge tone={aiRecs.campaign_readiness === 'highly_ready' ? 'success' : aiRecs.campaign_readiness === 'ready' ? 'brand' : 'warning'} dot>
            {aiRecs.campaign_readiness.replace('_', ' ')}
          </Badge>
        </CardContent>
      </Card>

      <RecommendationCard recommendations={campaignRecs} />
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
      <dd className="text-sm text-ink-500 ml-4 capitalize">{value}</dd>
    </div>
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
      title="Generate Outreach Campaign"
      description="The Outreach Strategy Agent will transform personalization intelligence into a complete multi-touch campaign with channel strategy, timing optimization, messaging framework, and success metrics."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onStart} loading={loading}>
            <Play className="h-4 w-4" />
            Generate Campaign
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-ink-500 block mb-2">Select a prospect for campaign generation:</span>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {MOCK_CAMPAIGNS.slice(0, 10).map((c, i) => (
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
                  {c.prospect_name} — {c.prospect_title}
                </span>
                <Badge tone={c.priority === 'critical' ? 'error' : c.priority === 'high' ? 'warning' : 'neutral'}>
                  {c.campaign.campaign_score}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The agent will perform the following steps:</p>
          <ul className="space-y-1.5">
            {OUTREACH_STAGES.map((stage) => (
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
      title="Delete Campaign"
      description="This will permanently delete the outreach campaign and all associated touchpoints, channel strategies, timing strategies, metrics, and recommendations. This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Campaign</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this campaign?</p>
    </Modal>
  );
}
