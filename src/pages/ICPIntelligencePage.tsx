import { useState } from 'react';
import {
  Users,
  RefreshCw,
  Download,
  Play,
  Crown,
  Star,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Briefcase,
  Radar,
  Ban,
  Search,
  Lightbulb,
  Building2,
  Repeat,
  Goal,
  Code2 as CodeIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { ICPCard } from '@/components/icp-intelligence/ICPCard';
import { CompanyProfileCard } from '@/components/icp-intelligence/CompanyProfileCard';
import { DecisionMakerTable } from '@/components/icp-intelligence/DecisionMakerTable';
import { PainPointCard } from '@/components/icp-intelligence/PainPointCard';
import { BuyingTriggerCard } from '@/components/icp-intelligence/BuyingTriggerCard';
import { SalesNavigatorCard } from '@/components/icp-intelligence/SalesNavigatorCard';
import { NegativeICPCard } from '@/components/icp-intelligence/NegativeICPCard';
import { RecommendationCard } from '@/components/icp-intelligence/RecommendationCard';
import { ConfidenceBadge } from '@/components/icp-intelligence/ConfidenceBadge';
import { Timeline } from '@/components/icp-intelligence/Timeline';

import { useICP, useGenerateICP, useRefreshICP, useDeleteICP, usePrimaryICP } from '@/hooks/useICPIntelligence';
import { icpService, ICP_STAGES } from '@/services/icp-intelligence';
import { MOCK_BUSINESS_SUMMARY, MOCK_RECOMMENDATIONS } from '@/services/icp-intelligence/mockData';
import { cn, timeAgo } from '@/lib/utils';
import type { FullICP, ICPGoal, GoalCategory } from '@/types/icp-intelligence';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'company_profile', label: 'Company Profile', icon: Building2 },
  { id: 'decision_makers', label: 'Decision Makers', icon: Users },
  { id: 'pain_points', label: 'Pain Points', icon: AlertCircle },
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'buying_triggers', label: 'Buying Triggers', icon: Radar },
  { id: 'negative_icp', label: 'Negative ICP', icon: Ban },
  { id: 'sales_navigator', label: 'Sales Navigator Filters', icon: Search },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function ICPIntelligencePage() {
  const { data: icps, isLoading } = useICP();
  const generateMutation = useGenerateICP();
  const refreshMutation = useRefreshICP();
  const deleteMutation = useDeleteICP();
  const primaryMutation = usePrimaryICP();

  const [tab, setTab] = useState<TabId>('company_profile');
  const [selectedICPId, setSelectedICPId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FullICP | null>(null);

  const isProcessing = icps?.some((icp) => icp.status === 'processing' || icp.status === 'queued');
  const isMutating = generateMutation.isPending || refreshMutation.isPending;

  const selectedICP = icps?.find((icp) => icp.id === selectedICPId) ?? icps?.[0] ?? null;

  // ============================================================
  // Handlers
  // ============================================================

  const handleGenerate = () => {
    setGenerateModalOpen(false);
    generateMutation.mutate({ businessAnalysisId: null, marketAnalysisId: null });
  };

  const handleRefresh = () => {
    if (selectedICP) refreshMutation.mutate(selectedICP.id);
  };

  const handleExport = () => {
    if (!icps || icps.length === 0) return;
    const exportData = {
      icps: icps.map((icp) => ({
        name: icp.name,
        description: icp.description,
        priority: icp.priority,
        confidence: icp.confidence,
        opportunity_score: icp.opportunity_score,
        competition_score: icp.competition_score,
        revenue_score: icp.revenue_score,
        conversion_rate: icp.conversion_rate,
        estimated_deal_size: icp.estimated_deal_size,
        company_profile: icp.company_profile,
        decision_makers: icp.decision_makers,
        pain_points: icp.pain_points,
        goals: icp.goals,
        buying_triggers: icp.buying_triggers,
        negative_filters: icp.negative_filters,
        sales_navigator_filters: icp.sales_navigator_filters,
      })),
      recommendations: MOCK_RECOMMENDATIONS,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `icp-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = () => {
    if (deleteTarget) {
      deleteMutation.mutate(deleteTarget.id);
      setDeleteModalOpen(false);
      setDeleteTarget(null);
    }
  };

  const handleSetPrimary = (icp: FullICP) => {
    primaryMutation.mutate(icp.id);
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="ICP Intelligence Agent" description="Automatically identify your highest-converting customer profiles." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!icps || icps.length === 0) {
    return (
      <div>
        <PageHeader title="ICP Intelligence Agent" description="Automatically identify your highest-converting customer profiles." />
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No ICP Generated"
          description="Generate your first Ideal Customer Profile to identify your highest-converting prospects. The ICP Intelligence Agent combines data from the Business Intelligence and Market Intelligence agents."
          action={
            <Button onClick={() => setGenerateModalOpen(true)}>
              <Play className="h-4 w-4" />
              Generate ICP
            </Button>
          }
        />
        <GenerateModal
          open={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          onGenerate={handleGenerate}
          loading={generateMutation.isPending}
        />
      </div>
    );
  }

  // Processing state
  if (isProcessing || isMutating) {
    return <ProcessingView />;
  }

  // Error state
  const failedICP = icps.find((icp) => icp.status === 'failed');
  if (failedICP) {
    return (
      <div>
        <PageHeader title="ICP Intelligence Agent" description="Automatically identify your highest-converting customer profiles." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Generation Failed"
          description={failedICP.error_message ?? 'ICP generation could not be completed. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setGenerateModalOpen(true)}>
                <Play className="h-4 w-4" />
                Generate New
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <GenerateModal
          open={generateModalOpen}
          onClose={() => setGenerateModalOpen(false)}
          onGenerate={handleGenerate}
          loading={generateMutation.isPending}
        />
      </div>
    );
  }

  // Completed state — full dashboard
  const primaryICP = icps.find((icp) => icp.priority === 'primary');
  const secondaryICPs = icps.filter((icp) => icp.priority === 'secondary');
  const avgConfidence = Math.round(icps.reduce((sum, icp) => sum + icp.confidence, 0) / icps.length);
  const avgDealSize = icps.find((icp) => icp.priority === 'primary')?.estimated_deal_size ?? '—';
  const avgCloseRate = (icps.reduce((sum, icp) => sum + icp.conversion_rate, 0) / icps.length).toFixed(1);
  const timelineEvents = icpService.getTimelineEvents(icps);

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="ICP Intelligence Agent"
        description="Automatically identify your highest-converting customer profiles."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh ICP
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export ICP
            </Button>
            <Button size="sm" onClick={() => setGenerateModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              Generate ICP
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="ICP Status">
          <Badge tone="success" dot>Completed</Badge>
        </KpiCard>
        <KpiCard icon={Users} label="Total ICPs">
          <span className="text-sm text-ink-500 font-semibold">{icps.length}</span>
        </KpiCard>
        <KpiCard icon={Crown} label="Primary ICP">
          <span className="text-xs text-ink-500 truncate block max-w-[120px]">{primaryICP?.name ?? '—'}</span>
        </KpiCard>
        <KpiCard icon={Star} label="Secondary ICPs">
          <span className="text-sm text-ink-500 font-semibold">{secondaryICPs.length}</span>
        </KpiCard>
        <KpiCard icon={Target} label="Confidence Score">
          <span className={cn('text-sm font-semibold', avgConfidence >= 80 ? 'text-success-400' : avgConfidence >= 50 ? 'text-warning-500' : 'text-error-400')}>
            {avgConfidence}%
          </span>
        </KpiCard>
        <KpiCard icon={DollarSign} label="Avg Deal Size">
          <span className="text-xs text-ink-500 font-medium truncate block max-w-[120px]">{avgDealSize}</span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label="Est. Close Rate">
          <span className="text-sm text-ink-500 font-semibold">{avgCloseRate}%</span>
        </KpiCard>
        <KpiCard icon={Clock} label="Last Updated">
          <span className="text-xs text-ink-500">{timeAgo(icps[0]?.updated_at ?? '')}</span>
        </KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Business Summary */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Business Summary</CardTitle>
              <p className="text-xs text-ink-500 mt-0.5">From Business Intelligence Agent</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow label="Business Type" value={MOCK_BUSINESS_SUMMARY.business_type} />
                <InfoRow label="Industry" value={MOCK_BUSINESS_SUMMARY.industry} />
                <InfoRow label="Revenue Model" value={MOCK_BUSINESS_SUMMARY.revenue_model} />
                <InfoRow label="USP" value={MOCK_BUSINESS_SUMMARY.usp} />
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Products</dt>
                  <dd className="flex flex-wrap gap-1">
                    {MOCK_BUSINESS_SUMMARY.products.map((p, i) => (
                      <Badge key={i} tone="brand">{p}</Badge>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Services</dt>
                  <dd className="flex flex-wrap gap-1">
                    {MOCK_BUSINESS_SUMMARY.services.map((s, i) => (
                      <Badge key={i} tone="success">{s}</Badge>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Business Goals</dt>
                  <dd className="space-y-1">
                    {MOCK_BUSINESS_SUMMARY.business_goals.map((g, i) => (
                      <p key={i} className="text-xs text-ink-500 flex items-start gap-1">
                        <Goal className="h-3 w-3 text-ink-500 shrink-0 mt-0.5" />
                        {g}
                      </p>
                    ))}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Target Regions</dt>
                  <dd className="flex flex-wrap gap-1">
                    {MOCK_BUSINESS_SUMMARY.target_regions.map((r, i) => (
                      <Badge key={i} tone="neutral">{r}</Badge>
                    ))}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Generated ICPs */}
        <div className="lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink-500">Generated ICPs</h3>
            <span className="text-xs text-ink-500">{icps.length} profiles</span>
          </div>
          <div className="grid grid-cols-1 gap-3">
            {icps.map((icp) => (
              <ICPCard
                key={icp.id}
                icp={icp}
                onView={() => setSelectedICPId(icp.id)}
                onDuplicate={() => setSelectedICPId(icp.id)}
                onEdit={() => setSelectedICPId(icp.id)}
                onDelete={() => { setDeleteTarget(icp); setDeleteModalOpen(true); }}
                onSetPrimary={() => handleSetPrimary(icp)}
              />
            ))}
          </div>
        </div>

        {/* Right panel — Timeline */}
        <div className="lg:col-span-3 space-y-4">
          <Timeline events={timelineEvents} />
          <Card>
            <CardContent className="flex flex-col items-center py-6">
              <ConfidenceBadge score={avgConfidence} label="overall confidence" className="mb-3" />
              <p className="text-xs text-ink-500 text-center">Based on BI + MI data analysis</p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ICP selector + bottom tabs */}
      {selectedICP && (
        <Card>
          {/* ICP selector */}
          <div className="border-b border-gold-500/12 px-4 py-3 flex items-center gap-2 overflow-x-auto scrollbar-thin">
            <span className="text-xs text-ink-500 shrink-0">Viewing:</span>
            {icps.map((icp) => (
              <button
                key={icp.id}
                onClick={() => setSelectedICPId(icp.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs whitespace-nowrap transition-colors',
                  selectedICP.id === icp.id
                    ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 font-medium'
                    : 'text-ink-500 hover:bg-card-800'
                )}
              >
                {icp.priority === 'primary' && <Crown className="h-3 w-3" />}
                {icp.name}
              </button>
            ))}
          </div>

          {/* Tabs */}
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
            {tab === 'company_profile' && <CompanyProfileCard profile={selectedICP.company_profile} />}
            {tab === 'decision_makers' && <DecisionMakerTable decisionMakers={selectedICP.decision_makers} />}
            {tab === 'pain_points' && <PainPointsTab icp={selectedICP} />}
            {tab === 'goals' && <GoalsTab goals={selectedICP.goals} />}
            {tab === 'buying_triggers' && <BuyingTriggersTab icp={selectedICP} />}
            {tab === 'negative_icp' && <NegativeICPCard negativeFilters={selectedICP.negative_filters} />}
            {tab === 'sales_navigator' && <SalesNavigatorCard filters={selectedICP.sales_navigator_filters} />}
            {tab === 'recommendations' && <RecommendationCard recommendations={MOCK_RECOMMENDATIONS} />}
          </CardContent>
        </Card>
      )}

      {/* Modals */}
      <GenerateModal
        open={generateModalOpen}
        onClose={() => setGenerateModalOpen(false)}
        onGenerate={handleGenerate}
        loading={generateMutation.isPending}
      />
      <DeleteModal
        open={deleteModalOpen}
        onClose={() => { setDeleteModalOpen(false); setDeleteTarget(null); }}
        onDelete={handleDelete}
        loading={deleteMutation.isPending}
        icpName={deleteTarget?.name ?? ''}
      />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView() {
  const currentStage = icpService.getCurrentStage();
  const stageIndex = ICP_STAGES.findIndex((s) => s.stage === currentStage);
  const progress = Math.round(((stageIndex + 1) / ICP_STAGES.length) * 100);

  return (
    <div>
      <PageHeader title="ICP Intelligence Agent" description="Automatically identify your highest-converting customer profiles." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Users className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Generating ICPs</h2>
        <p className="text-sm text-ink-500 mb-8">The ICP Intelligence Agent is analyzing business and market data to generate Ideal Customer Profiles. This typically takes 30–60 seconds.</p>

        <div className="w-full max-w-md mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-500">Progress</span>
            <span className="text-sm font-semibold text-ink-500">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-card-900 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        <div className="w-full max-w-md space-y-2">
          {ICP_STAGES.map((stage, i) => (
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
      </div>
    </div>
  );
}

// ============================================================
// Tab Views
// ============================================================

function PainPointsTab({ icp }: { icp: FullICP }) {
  if (icp.pain_points.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No pain points identified for this ICP.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {icp.pain_points.map((pp) => (
        <PainPointCard key={pp.id} painPoint={pp} />
      ))}
    </div>
  );
}

function GoalsTab({ goals }: { goals: ICPGoal[] }) {
  if (goals.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No goals identified for this ICP.</p>;
  }

  const categoryConfig: Record<GoalCategory, { icon: React.ComponentType<{ className?: string }>; tone: 'brand' | 'success' | 'warning' | 'neutral' }> = {
    business: { icon: Briefcase, tone: 'brand' },
    revenue: { icon: DollarSign, tone: 'success' },
    marketing: { icon: TrendingUp, tone: 'warning' },
    operational: { icon: Repeat, tone: 'neutral' },
    technology: { icon: CodeIcon, tone: 'brand' },
  };

  const grouped = goals.reduce((acc, g) => {
    if (!acc[g.category]) acc[g.category] = [];
    acc[g.category].push(g);
    return acc;
  }, {} as Record<GoalCategory, ICPGoal[]>);

  return (
    <div className="space-y-4">
      {(Object.entries(grouped) as [GoalCategory, ICPGoal[]][]).map(([category, items]) => {
        const { icon: Icon, tone } = categoryConfig[category];
        return (
          <div key={category}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className="h-4 w-4 text-ink-500" />
              <h4 className="text-sm font-semibold text-ink-500 capitalize">{category} Goals</h4>
              <Badge tone={tone} className="ml-1">{items.length}</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {items.map((g) => (
                <div key={g.id} className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-ink-500 leading-relaxed">{g.goal}</p>
                    <Badge tone={g.priority === 'critical' ? 'error' : g.priority === 'high' ? 'warning' : g.priority === 'medium' ? 'success' : 'neutral'}>
                      {g.priority}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BuyingTriggersTab({ icp }: { icp: FullICP }) {
  if (icp.buying_triggers.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No buying triggers identified for this ICP.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {icp.buying_triggers.map((t) => (
        <BuyingTriggerCard key={t.id} trigger={t} />
      ))}
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

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-ink-500">{value ?? '—'}</dd>
    </div>
  );
}

function GenerateModal({ open, onClose, onGenerate, loading }: {
  open: boolean;
  onClose: () => void;
  onGenerate: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate ICP"
      description="The ICP Intelligence Agent will combine data from the Business Intelligence and Market Intelligence agents to generate multiple Ideal Customer Profiles."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onGenerate} loading={loading}>
            <Play className="h-4 w-4" />
            Generate
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-ink-500 leading-relaxed">
          The agent will perform the following steps:
        </p>
        <ul className="space-y-2">
          {ICP_STAGES.map((stage) => (
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

function DeleteModal({ open, onClose, onDelete, loading, icpName }: {
  open: boolean;
  onClose: () => void;
  onDelete: () => void;
  loading: boolean;
  icpName: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete ICP"
      description={`This will permanently delete the "${icpName}" ICP and all associated data (company profile, decision makers, pain points, goals, triggers, negative filters, and sales navigator filters). This action cannot be undone.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>
            Delete ICP
          </Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this ICP?</p>
    </Modal>
  );
}
