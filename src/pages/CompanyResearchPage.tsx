import { useState, useMemo } from 'react';
import {
  Building2,
  RefreshCw,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  Target,
  TrendingUp,
  Cpu,
  Star,
  Shield,
  FileText,
  Package,
  Globe,
  Lightbulb,
  FileJson,
  ArrowRight,
  Briefcase,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { CompanyOverviewCard } from '@/components/company-research/CompanyOverviewCard';
import { TechnologyStackCard } from '@/components/company-research/TechnologyStackCard';
import { ProductsTable } from '@/components/company-research/ProductsTable';
import { GrowthSignalCard } from '@/components/company-research/GrowthSignalCard';
import { DigitalPresenceCard } from '@/components/company-research/DigitalPresenceCard';
import { SWOTCard } from '@/components/company-research/SWOTCard';
import { ExecutiveSummaryCard } from '@/components/company-research/ExecutiveSummaryCard';
import { ResearchScoreCard } from '@/components/company-research/ResearchScoreCard';
import { ConfidenceBadge } from '@/components/company-research/ConfidenceBadge';
import { TimelineCard } from '@/components/company-research/TimelineCard';

import {
  useCompanyResearch,
  useStartResearch,
  useRefreshResearch,
  useDeleteResearch,
  useExportResearch,
  MOCK_COMPANIES,
  MOCK_RECOMMENDATIONS,
  RESEARCH_STAGES,
} from '@/hooks/useCompanyResearch';
import { companyResearchService } from '@/services/company-research';
import { cn } from '@/lib/utils';
import type { ExportFormat, ResearchRecommendations } from '@/types/company-research';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'overview', label: 'Business Overview', icon: Building2 },
  { id: 'products', label: 'Products & Services', icon: Package },
  { id: 'technology', label: 'Technology Stack', icon: Cpu },
  { id: 'growth', label: 'Growth Signals', icon: TrendingUp },
  { id: 'digital', label: 'Digital Presence', icon: Globe },
  { id: 'intelligence', label: 'Business Intelligence', icon: Shield },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw Data', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function CompanyResearchPage() {
  const { data: research, isLoading } = useCompanyResearch();
  const startMutation = useStartResearch();
  const refreshMutation = useRefreshResearch();
  const deleteMutation = useDeleteResearch();
  const exportMutation = useExportResearch();

  const [tab, setTab] = useState<TabId>('overview');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState(0);

  const isProcessing = research?.research_status === 'processing' || research?.research_status === 'queued';
  const isMutating = startMutation.isPending || refreshMutation.isPending;

  // Derived stats
  const stats = useMemo(() => {
    const allCompanies = MOCK_COMPANIES;
    const researched = allCompanies.filter((c) => c.research.research_status === 'completed').length;
    const pending = allCompanies.length - researched;
    const avgScore = Math.round(allCompanies.reduce((s, c) => s + c.research.research_score, 0) / allCompanies.length);
    const techProfiles = allCompanies.reduce((s, c) => s + c.technology_profiles.length, 0);
    const growthCompanies = allCompanies.filter((c) => c.growth_signals.length > 0).length;
    const qualified = allCompanies.filter((c) => c.recommendations.should_continue).length;
    const avgConfidence = Math.round(allCompanies.reduce((s, c) => s + c.research.confidence_score, 0) / allCompanies.length);
    return { researched, pending, avgScore, techProfiles, growthCompanies, qualified, avgConfidence };
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleStart = () => {
    setStartModalOpen(false);
    startMutation.mutate({ companyIndex: selectedCompanyIndex });
  };

  const handleRefresh = () => {
    if (research) refreshMutation.mutate(research.id);
  };

  const handleExport = (format: ExportFormat) => {
    if (research) exportMutation.mutate({ research, format });
  };

  const handleDelete = () => {
    if (research) {
      deleteMutation.mutate(research.id);
      setDeleteModalOpen(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Company Research Agent" description="Build comprehensive intelligence profiles for every target company." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!research) {
    return (
      <div>
        <PageHeader title="Company Research Agent" description="Build comprehensive intelligence profiles for every target company." />
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="No Company Research Available"
          description="Research your discovered companies to generate detailed business intelligence. The Company Research Agent crawls websites, detects technologies, analyzes business models, and generates SWOT analysis for every target company."
          action={
            <Button onClick={() => setStartModalOpen(true)}>
              <Play className="h-4 w-4" />
              Research Companies
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
  if (research.research_status === 'failed') {
    return (
      <div>
        <PageHeader title="Company Research Agent" description="Build comprehensive intelligence profiles for every target company." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Research Failed"
          description={research.error_message ?? 'The company research could not be completed. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setStartModalOpen(true)}>
                <Play className="h-4 w-4" />
                New Research
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
  const timelineEvents = companyResearchService.getTimelineEvents(research);
  const recommendations: ResearchRecommendations = MOCK_RECOMMENDATIONS;

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Company Research Agent"
        description="Build comprehensive intelligence profiles for every target company."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Research
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('json')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export Research
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
            <Button size="sm" onClick={() => setStartModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              Research Companies
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="Research Status">
          <Badge tone="success" dot>Completed</Badge>
        </KpiCard>
        <KpiCard icon={Building2} label="Companies Researched">
          <span className="text-sm text-ink-500 font-semibold">{stats.researched}</span>
        </KpiCard>
        <KpiCard icon={Clock} label="Companies Pending">
          <span className="text-sm text-ink-500 font-semibold">{stats.pending}</span>
        </KpiCard>
        <KpiCard icon={Target} label="Avg Research Score">
          <span className={cn('text-sm font-semibold', stats.avgScore >= 85 ? 'text-success-400' : stats.avgScore >= 70 ? 'text-warning-500' : 'text-error-400')}>{stats.avgScore}</span>
        </KpiCard>
        <KpiCard icon={Cpu} label="Technology Profiles">
          <span className="text-sm text-ink-500 font-semibold">{stats.techProfiles}</span>
        </KpiCard>
        <KpiCard icon={TrendingUp} label="Growth Companies">
          <span className="text-sm text-ink-500 font-semibold">{stats.growthCompanies}</span>
        </KpiCard>
        <KpiCard icon={Star} label="Qualified Companies">
          <span className="text-sm text-ink-500 font-semibold">{stats.qualified}</span>
        </KpiCard>
        <KpiCard icon={Shield} label="Research Confidence">
          <span className={cn('text-sm font-semibold', stats.avgConfidence >= 85 ? 'text-success-400' : stats.avgConfidence >= 70 ? 'text-warning-500' : 'text-error-400')}>{stats.avgConfidence}%</span>
        </KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Selected Company */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-brand-400" />
                <CardTitle>Selected Company</CardTitle>
              </div>
              <p className="text-xs text-ink-500 mt-0.5">Loaded from Prospect Discovery Agent</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow label="Company Name" value={research.profile?.company_name ?? null} />
                <InfoRow label="Website" value={research.profile?.website ?? null} />
                <InfoRow label="Industry" value={research.profile?.industry ?? null} />
                <InfoRow label="Country" value={research.profile?.headquarters ?? null} />
                <InfoRow label="Employee Count" value={research.profile?.employee_count ?? null} />
                <InfoRow label="Annual Revenue" value={research.profile?.annual_revenue ?? null} />
                <InfoRow label="Company Size" value={research.profile?.company_size ?? null} />
                <InfoRow label="Growth Stage" value={research.profile?.business_model ?? null} />
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Status</dt>
                  <dd><Badge tone="success" dot>Researched</Badge></dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Company Intelligence cards */}
        <div className="lg:col-span-6 space-y-4">
          <ExecutiveSummaryCard summary={research.executive_summary} />
          <div className="grid grid-cols-2 gap-4">
            <ResearchScoreCard score={research.research_score} label="Research Score" size="md" />
            <div className="flex flex-col items-center justify-center gap-3">
              <ConfidenceBadge score={research.confidence_score} label="Confidence Score" />
              <div className="text-center">
                <p className="text-2xl font-bold text-ink-500">{research.technology_profiles.length}</p>
                <p className="text-xs text-ink-500 mt-1">Technologies Detected</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-ink-500">{research.growth_signals.length}</p>
                <p className="text-xs text-ink-500 mt-1">Growth Signals</p>
              </div>
            </div>
          </div>
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
                  tab === t.id ? 'border-brand-500 text-ink-500 font-medium' : 'border-transparent text-ink-500 hover:text-ink-500'
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <CardContent className="min-h-[300px]">
          {tab === 'overview' && <CompanyOverviewCard profile={research.profile} />}
          {tab === 'products' && <ProductsTable products={research.products_services} />}
          {tab === 'technology' && <TechnologyStackCard technologies={research.technology_profiles} />}
          {tab === 'growth' && <GrowthSignalCard signals={research.growth_signals} />}
          {tab === 'digital' && <DigitalPresenceCard presence={research.digital_presence} />}
          {tab === 'intelligence' && <SWOTCard analysis={research.business_analysis} />}
          {tab === 'recommendations' && <RecommendationsTab recommendations={recommendations} />}
          {tab === 'raw' && <RawTab research={research} />}
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
  const currentStage = companyResearchService.getCurrentStage();
  const stageIndex = RESEARCH_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Company Research Agent" description="Build comprehensive intelligence profiles for every target company." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Building2 className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Researching Company</h2>
        <p className="text-sm text-ink-500 mb-8">The Company Research Agent is performing deep intelligence gathering. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {RESEARCH_STAGES.map((stage, i) => (
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

function RecommendationsTab({ recommendations }: { recommendations: ResearchRecommendations }) {
  const fitTone = recommendations.business_fit === 'strong' ? 'success' : recommendations.business_fit === 'moderate' ? 'warning' : 'error';
  const ratingTone = recommendations.opportunity_rating === 'high' ? 'success' : recommendations.opportunity_rating === 'medium' ? 'warning' : 'error';

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-500">Business Fit</span>
              <Badge tone={fitTone} dot>{recommendations.business_fit.charAt(0).toUpperCase() + recommendations.business_fit.slice(1)}</Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-ink-500">Opportunity Rating</span>
              <Badge tone={ratingTone} dot>{recommendations.opportunity_rating.charAt(0).toUpperCase() + recommendations.opportunity_rating.slice(1)}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Next Action</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_next_action}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-400" />
            <CardTitle>Should Continue to Decision Maker Research?</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3 mb-3">
            <Badge tone={recommendations.should_continue ? 'success' : 'error'} dot>
              {recommendations.should_continue ? 'Yes — Proceed' : 'No — Monitor'}
            </Badge>
          </div>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.reasoning}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function RawTab({ research }: { research: unknown }) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-maroon-950 p-4 max-h-[500px] overflow-auto scrollbar-thin">
      <pre className="text-xs text-ink-500 font-mono whitespace-pre-wrap">{JSON.stringify(research, null, 2)}</pre>
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

function InfoRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs text-ink-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-ink-500">{value ?? '—'}</dd>
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
      title="Research Companies"
      description="The Company Research Agent will perform deep intelligence gathering on the selected company from the Prospect Discovery Agent."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onStart} loading={loading}>
            <Play className="h-4 w-4" />
            Start Research
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-ink-500 block mb-2">Select a company to research:</span>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {MOCK_COMPANIES.slice(0, 10).map((c, i) => (
              <button
                key={i}
                onClick={() => onSelectIndex(i)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                  selectedIndex === i ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/30' : 'bg-card-900 border border-gold-500/12 hover:bg-card-800'
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                <span className={cn('text-xs', selectedIndex === i ? 'text-brand-400 font-medium' : 'text-ink-500')}>{c.profile.company_name}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The agent will perform the following steps:</p>
          <ul className="space-y-1.5">
            {RESEARCH_STAGES.map((stage) => (
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
      title="Delete Research"
      description="This will permanently delete the research and all associated data (profile, products, technologies, growth signals, digital presence, and analysis). This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Research</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this research?</p>
    </Modal>
  );
}
