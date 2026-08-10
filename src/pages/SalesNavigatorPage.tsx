import { useState, useMemo } from 'react';
import {
  Linkedin,
  RefreshCw,
  Play,
  CheckCircle2,
  AlertCircle,
  Building2,
  Users,
  Code2,
  Gauge,
  Copy,
  Lightbulb,
  Download,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { SearchBuilder } from '@/components/sales-navigator/SearchBuilder';
import { CompanyFilterCard } from '@/components/sales-navigator/CompanyFilterCard';
import { LeadFilterCard } from '@/components/sales-navigator/LeadFilterCard';
import { BooleanBuilder } from '@/components/sales-navigator/BooleanBuilder';
import { CoverageCard } from '@/components/sales-navigator/CoverageCard';
import { QualityScoreCard } from '@/components/sales-navigator/QualityScoreCard';
import { RecommendationPanel } from '@/components/sales-navigator/RecommendationPanel';
import { TemplateCard } from '@/components/sales-navigator/TemplateCard';
import { TimelineCard } from '@/components/sales-navigator/TimelineCard';
import { ExportPanel } from '@/components/sales-navigator/ExportPanel';

import {
  useSalesNavigator,
  useGenerateSearch,
  useRefreshSearch,
  useTemplates,
  useExportSearch,
  useDeleteSearch,
  MOCK_QUALITY,
  MOCK_RECOMMENDATIONS,
} from '@/hooks/useSalesNavigator';
import { snService, SN_STAGES } from '@/services/sales-navigator';
import { cn } from '@/lib/utils';
import type { ExportFormat, SearchTemplate } from '@/types/sales-navigator';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'company', label: 'Company Search Filters', icon: Building2 },
  { id: 'lead', label: 'Lead Search Filters', icon: Users },
  { id: 'boolean', label: 'Boolean Generator', icon: Code2 },
  { id: 'quality', label: 'Search Quality', icon: Gauge },
  { id: 'templates', label: 'Saved Templates', icon: Copy },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'export', label: 'Export', icon: Download },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function SalesNavigatorPage() {
  const { data: search, isLoading } = useSalesNavigator();
  const generateMutation = useGenerateSearch();
  const refreshMutation = useRefreshSearch();
  const deleteMutation = useDeleteSearch();
  const exportMutation = useExportSearch();
  const { data: templates = [] } = useTemplates();

  const [tab, setTab] = useState<TabId>('company');
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const isProcessing = search?.status === 'processing' || search?.status === 'queued';
  const isMutating = generateMutation.isPending || refreshMutation.isPending;

  const quality = useMemo(() => MOCK_QUALITY[0] ?? null, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleGenerate = () => {
    setGenerateModalOpen(false);
    generateMutation.mutate({ icpId: null, discoveryId: null });
  };

  const handleRefresh = () => {
    if (search) refreshMutation.mutate(search.id);
  };

  const handleExport = (format: ExportFormat) => {
    if (search) exportMutation.mutate({ search, format });
  };

  const handleDelete = () => {
    if (search) {
      deleteMutation.mutate(search.id);
      setDeleteModalOpen(false);
    }
  };

  const handleLoadTemplate = (_template: SearchTemplate) => {
    // Future: load template into builder
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Sales Navigator Intelligence Agent" description="Transform ICPs into optimized LinkedIn Sales Navigator search strategies." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!search) {
    return (
      <div>
        <PageHeader title="Sales Navigator Intelligence Agent" description="Transform ICPs into optimized LinkedIn Sales Navigator search strategies." />
        <EmptyState
          icon={<Linkedin className="h-6 w-6" />}
          title="No Search Strategy Generated"
          description="Generate your first Sales Navigator search strategy from your ICP and discovered companies. The agent creates optimized company filters, lead filters, and boolean queries — no LinkedIn login or scraping required."
          action={
            <Button onClick={() => setGenerateModalOpen(true)}>
              <Play className="h-4 w-4" />
              Generate Search Strategy
            </Button>
          }
        />
        <GenerateModal open={generateModalOpen} onClose={() => setGenerateModalOpen(false)} onGenerate={handleGenerate} loading={generateMutation.isPending} />
      </div>
    );
  }

  // Processing state
  if (isProcessing || isMutating) {
    return <ProcessingView />;
  }

  // Error state
  if (search.status === 'failed') {
    return (
      <div>
        <PageHeader title="Sales Navigator Intelligence Agent" description="Transform ICPs into optimized LinkedIn Sales Navigator search strategies." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Search Generation Failed"
          description={search.error_message ?? 'The search strategy could not be generated. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setGenerateModalOpen(true)}>
                <Play className="h-4 w-4" />
                New Search
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <GenerateModal open={generateModalOpen} onClose={() => setGenerateModalOpen(false)} onGenerate={handleGenerate} loading={generateMutation.isPending} />
      </div>
    );
  }

  // Completed state — full dashboard
  const timelineEvents = snService.getTimelineEvents(search);

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Sales Navigator Intelligence Agent"
        description="Transform ICPs into optimized LinkedIn Sales Navigator search strategies."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
            <Button size="sm" onClick={() => setGenerateModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              New Search
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="Status">
          <Badge tone="success" dot>Completed</Badge>
        </KpiCard>
        <KpiCard icon={Gauge} label="Quality Score">
          <span className={cn('text-sm font-semibold', search.quality_score >= 85 ? 'text-success-400' : search.quality_score >= 70 ? 'text-warning-500' : 'text-error-400')}>{search.quality_score}</span>
        </KpiCard>
        <KpiCard icon={Building2} label="Coverage Score">
          <span className={cn('text-sm font-semibold', search.coverage_score >= 85 ? 'text-success-400' : search.coverage_score >= 70 ? 'text-warning-500' : 'text-error-400')}>{search.coverage_score}</span>
        </KpiCard>
        <KpiCard icon={Building2} label="Search Type">
          <Badge tone="brand">{search.search_type === 'both' ? 'Company + Lead' : search.search_type}</Badge>
        </KpiCard>
        <KpiCard icon={Code2} label="Boolean Query">
          <Badge tone={search.company_filters?.boolean_query ? 'success' : 'neutral'} dot>{search.company_filters?.boolean_query ? 'Generated' : 'None'}</Badge>
        </KpiCard>
        <KpiCard icon={Copy} label="Templates">
          <span className="text-sm text-ink-500 font-semibold">{templates.length}</span>
        </KpiCard>
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Search overview */}
        <div className="lg:col-span-3 space-y-4">
          <QualityScoreCard score={search.quality_score} label="Quality Score" size="md" />
          <Card>
            <CardContent className="flex flex-col items-center py-4">
              <div className="text-center mb-2">
                <p className="text-3xl font-bold text-ink-500">{search.coverage_score}</p>
                <p className="text-xs text-ink-500 mt-1">Coverage Score</p>
              </div>
              <div className="h-2 w-full rounded-full bg-card-900 overflow-hidden mt-2">
                <div className={cn('h-full rounded-full', search.coverage_score >= 85 ? 'bg-success-500' : search.coverage_score >= 70 ? 'bg-warning-500' : 'bg-error-500')} style={{ width: `${search.coverage_score}%` }} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Search builder */}
        <div className="lg:col-span-6">
          <SearchBuilder search={search} />
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
          {tab === 'company' && <CompanyFilterCard filters={search.company_filters} />}
          {tab === 'lead' && <LeadFilterCard filters={search.lead_filters} />}
          {tab === 'boolean' && <BooleanBuilder booleanQuery={search.company_filters?.boolean_query ?? null} />}
          {tab === 'quality' && (
            <div className="space-y-4">
              <CoverageCard quality={quality} />
              {quality && (
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {quality.recommendations.map((rec, i) => (
                        <div key={i} className="flex items-start gap-3">
                          <CheckCircle2 className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                          <p className="text-xs text-ink-500 leading-relaxed">{rec}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
          {tab === 'templates' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.length === 0 ? (
                <p className="text-xs text-ink-500 text-center py-8 col-span-full">No saved templates yet.</p>
              ) : (
                templates.map((tmpl) => (
                  <TemplateCard key={tmpl.id} template={tmpl} onLoad={handleLoadTemplate} />
                ))
              )}
            </div>
          )}
          {tab === 'recommendations' && <RecommendationPanel recommendations={MOCK_RECOMMENDATIONS} />}
          {tab === 'export' && <ExportPanel onExport={handleExport} loading={exportMutation.isPending} />}
        </CardContent>
      </Card>

      {/* Modals */}
      <GenerateModal open={generateModalOpen} onClose={() => setGenerateModalOpen(false)} onGenerate={handleGenerate} loading={generateMutation.isPending} />
      <DeleteModal open={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} onDelete={handleDelete} loading={deleteMutation.isPending} />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView() {
  const currentStage = snService.getCurrentStage();
  const stageIndex = SN_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Sales Navigator Intelligence Agent" description="Transform ICPs into optimized LinkedIn Sales Navigator search strategies." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Linkedin className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Generating Search Strategy</h2>
        <p className="text-sm text-ink-500 mb-8">The Sales Navigator Intelligence Agent is creating optimized search filters from your ICP data. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {SN_STAGES.map((stage, i) => (
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

function GenerateModal({ open, onClose, onGenerate, loading }: { open: boolean; onClose: () => void; onGenerate: () => void; loading: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate Search Strategy"
      description="The Sales Navigator Intelligence Agent will create optimized search filters from your ICP and discovered companies."
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
        <p className="text-xs text-ink-500 leading-relaxed">The agent will perform the following steps:</p>
        <ul className="space-y-2">
          {SN_STAGES.map((stage) => (
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

function DeleteModal({ open, onClose, onDelete, loading }: { open: boolean; onClose: () => void; onDelete: () => void; loading: boolean }) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete Search Strategy"
      description="This will permanently delete the search strategy and all associated filters. This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Search</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this search strategy?</p>
    </Modal>
  );
}
