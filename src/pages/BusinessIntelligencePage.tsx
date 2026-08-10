import { useState } from 'react';
import {
  Brain,
  Globe,
  RefreshCw,
  Download,
  Search,
  Building2,
  Tag,
  Target,
  CheckCircle2,
  AlertCircle,
  Clock,
  Layers,
  FileCode,
  Sparkles,
  TrendingUp,
  Package,
  Handshake,
  DollarSign,
  Users,
  Goal,
  Repeat,
  Shield,
  ChevronRight,
  Pencil,
  Check,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input, Label, Textarea } from '@/components/ui/Field';
import { Modal } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { AnalysisStatusCard } from '@/components/business-intelligence/AnalysisStatusCard';
import { BusinessModelCard } from '@/components/business-intelligence/BusinessModelCard';
import { WebsitePagesTable } from '@/components/business-intelligence/WebsitePagesTable';
import { ExecutiveSummaryCard } from '@/components/business-intelligence/ExecutiveSummaryCard';
import { InsightCard } from '@/components/business-intelligence/InsightCard';
import { TimelineCard } from '@/components/business-intelligence/TimelineCard';
import { ConfidenceScore } from '@/components/business-intelligence/ConfidenceScore';

import { ProgressCard } from '@/components/business-intelligence/ProgressCard';
import { useBusinessAnalysis, useCreateAnalysis, useRefreshAnalysis, useUpdateAnalysis } from '@/hooks/useBusinessAnalysis';
import { useRevenueDNA, useGenerateRevenueDNA } from '@/hooks/useRevenueDNA';
import {
  RevenueDNAOverview, BuyerPersonasSection, CompetitorIntelligenceSection,
  ValuePropositionsSection, TrustSignalsSection, BuyingCommitteeSection,
  KnowledgeGraphSection, RevenueDNAEmpty,
} from '@/components/revenue-dna';
import { biService, ANALYSIS_STAGES } from '@/services/business-intelligence';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { cn, timeAgo } from '@/lib/utils';
import type { FullAnalysis } from '@/types/business-intelligence';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'structure', label: 'Website Structure', icon: Layers },
  { id: 'content', label: 'Extracted Content', icon: FileCode },
  { id: 'summary', label: 'AI Summary', icon: Sparkles },
  { id: 'insights', label: 'Business Insights', icon: TrendingUp },
  { id: 'raw', label: 'Raw Data', icon: FileCode },
  { id: 'dna', label: 'Revenue DNA', icon: Brain },
  { id: 'personas', label: 'Buyer Personas', icon: Users },
  { id: 'competitors', label: 'Competitor Intel', icon: Shield },
  { id: 'value_props', label: 'Value Props', icon: Sparkles },
  { id: 'trust', label: 'Trust & Signals', icon: CheckCircle2 },
  { id: 'committee', label: 'Buying Committee', icon: Handshake },
  { id: 'graph', label: 'Knowledge Graph', icon: Globe },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function BusinessIntelligencePage() {
  const { data: analysis, isLoading } = useBusinessAnalysis();
  const createMutation = useCreateAnalysis();
  const refreshMutation = useRefreshAnalysis();
  const updateMutation = useUpdateAnalysis();

  const [tab, setTab] = useState<TabId>('structure');
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const { workspace } = useWorkspace();
  const { data: revenueDNA } = useRevenueDNA();
  const generateDNAMutation = useGenerateRevenueDNA();
  const [companyForm, setCompanyForm] = useState({
    company_name: '', website: '', industry: '', country: '', language: '', timezone: '', description: '',
  });

  const isProcessing = analysis?.analysis_status === 'processing' || analysis?.analysis_status === 'queued';
  const isMutating = createMutation.isPending || refreshMutation.isPending;

  // ============================================================
  // Handlers
  // ============================================================

  const handleAnalyze = () => {
    if (!websiteUrl.trim()) return;
    let url = websiteUrl.trim();
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = `https://${url}`;
    }
    setAnalyzeModalOpen(false);
    setWebsiteUrl('');
    createMutation.mutate(url);
  };

  const handleRefresh = () => {
    if (analysis) refreshMutation.mutate(analysis.id);
  };

  const handleExport = () => {
    if (!analysis) return;
    const exportData = {
      analysis: {
        website: analysis.website,
        company_name: analysis.company_name,
        industry: analysis.industry,
        description: analysis.description,
        business_model: analysis.business_model,
        products: analysis.products,
        services: analysis.services,
        pricing_model: analysis.pricing_model,
        target_audience: analysis.target_audience,
        usp: analysis.usp,
        customer_problems: analysis.customer_problems,
        business_goals: analysis.business_goals,
        revenue_model: analysis.revenue_model,
        competitive_position: analysis.competitive_position,
        confidence_score: analysis.confidence_score,
      },
      pages: analysis.pages.map((p) => ({ url: p.url, title: p.page_title, type: p.page_type, summary: p.summary })),
      insights: analysis.insights,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bi-analysis-${analysis.company_name ?? 'export'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEditCompany = () => {
    if (!analysis) return;
    setCompanyForm({
      company_name: analysis.company_name ?? '',
      website: analysis.website,
      industry: analysis.industry ?? '',
      country: analysis.country ?? '',
      language: analysis.language ?? '',
      timezone: analysis.timezone ?? '',
      description: analysis.description ?? '',
    });
    setEditCompanyOpen(true);
  };

  const handleSaveCompany = () => {
    if (!analysis) return;
    updateMutation.mutate({ id: analysis.id, updates: companyForm });
    setEditCompanyOpen(false);
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader
          title="Business Intelligence Agent"
          description="Understand your business before generating your revenue strategy."
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
          title="Business Intelligence Agent"
          description="Understand your business before generating your revenue strategy."
        />
        <EmptyState
          icon={<Brain className="h-6 w-6" />}
          title="No Business Analysis Yet"
          description="Enter your website URL to start analyzing your business. The Business Intelligence Agent will crawl your site, extract key information, and generate a comprehensive business understanding."
          action={
            <Button onClick={() => setAnalyzeModalOpen(true)}>
              <Search className="h-4 w-4" />
              Analyze Website
            </Button>
          }
        />
        <AnalyzeModal
          open={analyzeModalOpen}
          onClose={() => setAnalyzeModalOpen(false)}
          url={websiteUrl}
          setUrl={setWebsiteUrl}
          onAnalyze={handleAnalyze}
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
  if (analysis.analysis_status === 'failed') {
    return (
      <div>
        <PageHeader
          title="Business Intelligence Agent"
          description="Understand your business before generating your revenue strategy."
        />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Analysis Failed"
          description={analysis.error_message ?? 'The website could not be analyzed. This may be due to an unreachable URL, timeout, or invalid URL format.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setAnalyzeModalOpen(true)}>
                <Search className="h-4 w-4" />
                Try Different URL
              </Button>
              <Button variant="outline" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
                Retry
              </Button>
            </div>
          }
        />
        <AnalyzeModal
          open={analyzeModalOpen}
          onClose={() => setAnalyzeModalOpen(false)}
          url={websiteUrl}
          setUrl={setWebsiteUrl}
          onAnalyze={handleAnalyze}
          loading={createMutation.isPending}
        />
      </div>
    );
  }

  // Completed state — full dashboard
  const timelineEvents = biService.getTimelineEvents(analysis);

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Business Intelligence Agent"
        description="Understand your business before generating your revenue strategy."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Analysis
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" />
              Export Report
            </Button>
            <Button size="sm" onClick={() => setAnalyzeModalOpen(true)}>
              <Search className="h-3.5 w-3.5" />
              Analyze Website
            </Button>
          </div>
        }
      />

      {/* Overview cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <OverviewCard icon={CheckCircle2} label="Analysis Status">
          <AnalysisStatusCard status={analysis.analysis_status} />
        </OverviewCard>
        <OverviewCard icon={Globe} label="Website">
          <a href={analysis.website} target="_blank" rel="noopener noreferrer" className="text-sm text-brand-400 hover:text-brand-300 truncate block max-w-[140px]">
            {analysis.website.replace(/^https?:\/\//, '')}
          </a>
        </OverviewCard>
        <OverviewCard icon={Clock} label="Last Scan">
          <span className="text-sm text-ink-500">{timeAgo(analysis.updated_at)}</span>
        </OverviewCard>
        <OverviewCard icon={Target} label="Confidence Score">
          <div className="flex items-center gap-2">
            <span className={cn(
              'text-sm font-semibold',
              analysis.confidence_score >= 80 ? 'text-success-400' : analysis.confidence_score >= 50 ? 'text-warning-500' : 'text-error-400'
            )}>
              {analysis.confidence_score}%
            </span>
          </div>
        </OverviewCard>
        <OverviewCard icon={Tag} label="Business Category">
          <span className="text-xs text-ink-500 truncate block max-w-[140px]">{analysis.business_category ?? '—'}</span>
        </OverviewCard>
        <OverviewCard icon={Users} label="Primary ICP">
          <span className="text-xs text-ink-500 truncate block max-w-[140px]">{analysis.primary_icp ?? '—'}</span>
        </OverviewCard>
      </div>

      {/* Overall completion */}
      <div className="mb-6">
        <ProgressCard percentage={analysis.completion_percentage} label="Overall Completion" />
      </div>

      {/* Three-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 mb-6">
        {/* Left panel — Company Information */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Company Information</CardTitle>
              <button onClick={handleEditCompany} className="text-ink-500 hover:text-ink-500 transition-colors">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow label="Website URL" value={analysis.website} />
                <InfoRow label="Company Name" value={analysis.company_name} />
                <InfoRow label="Industry" value={analysis.industry} />
                <InfoRow label="Country" value={analysis.country} />
                <InfoRow label="Language" value={analysis.language} />
                <InfoRow label="Timezone" value={analysis.timezone} />
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Company Description</dt>
                  <dd className="text-xs text-ink-500 leading-relaxed">{analysis.description ?? '—'}</dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Business Understanding */}
        <div className="lg:col-span-6">
          <Card>
            <CardHeader>
              <CardTitle>Business Understanding</CardTitle>
              <p className="text-xs text-ink-500 mt-0.5">AI-extracted business intelligence from website analysis</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <BusinessModelCard title="Business Model" summary={analysis.business_model ?? '—'} confidence={93} icon={Repeat} onEdit={(v) => updateMutation.mutate({ id: analysis.id, updates: { business_model: v } })} />
                <BusinessModelCard title="Unique Value Proposition" summary={analysis.usp ?? '—'} confidence={89} icon={Sparkles} onEdit={(v) => updateMutation.mutate({ id: analysis.id, updates: { usp: v } })} />
                <BusinessModelCard title="Target Audience" summary={analysis.target_audience ?? '—'} confidence={91} icon={Users} onEdit={(v) => updateMutation.mutate({ id: analysis.id, updates: { target_audience: v } })} />
                <BusinessModelCard title="Pricing Model" summary={analysis.pricing_model ?? '—'} confidence={85} icon={DollarSign} onEdit={(v) => updateMutation.mutate({ id: analysis.id, updates: { pricing_model: v } })} />
                <BusinessModelCard title="Revenue Model" summary={analysis.revenue_model ?? '—'} confidence={87} icon={TrendingUp} onEdit={(v) => updateMutation.mutate({ id: analysis.id, updates: { revenue_model: v } })} />
                <BusinessModelCard title="Competitive Position" summary={analysis.competitive_position ?? '—'} confidence={82} icon={Shield} onEdit={(v) => updateMutation.mutate({ id: analysis.id, updates: { competitive_position: v } })} />
              </div>

              {/* Lists */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <ListCard title="Products" icon={Package} items={analysis.products} />
                <ListCard title="Services" icon={Handshake} items={analysis.services} />
                <ListCard title="Customer Problems" icon={AlertCircle} items={analysis.customer_problems} />
                <ListCard title="Business Goals" icon={Goal} items={analysis.business_goals} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right panel — Timeline + Confidence */}
        <div className="lg:col-span-3 space-y-4">
          <TimelineCard events={timelineEvents} />
          <Card>
            <CardContent className="flex flex-col items-center py-6">
              <ConfidenceScore score={analysis.confidence_score} size="lg" />
              <p className="text-xs text-ink-500 mt-3 text-center">Based on content extraction and AI analysis</p>
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
          {tab === 'structure' && <StructureTab analysis={analysis} />}
          {tab === 'content' && <ContentTab analysis={analysis} />}
          {tab === 'summary' && <SummaryTab analysis={analysis} />}
          {tab === 'insights' && <InsightsTab analysis={analysis} />}
          {tab === 'raw' && <RawTab analysis={analysis} />}
          {tab === 'dna' && (revenueDNA ? <RevenueDNAOverview dna={revenueDNA} /> : <RevenueDNAEmpty onGenerate={() => generateDNAMutation.mutate()} isGenerating={generateDNAMutation.isPending} />)}
          {tab === 'personas' && (revenueDNA ? <BuyerPersonasSection personas={revenueDNA.personas} /> : <RevenueDNAEmpty onGenerate={() => generateDNAMutation.mutate()} isGenerating={generateDNAMutation.isPending} />)}
          {tab === 'competitors' && (revenueDNA ? <CompetitorIntelligenceSection competitors={revenueDNA.competitors} /> : <RevenueDNAEmpty onGenerate={() => generateDNAMutation.mutate()} isGenerating={generateDNAMutation.isPending} />)}
          {tab === 'value_props' && (revenueDNA ? <ValuePropositionsSection valueProps={revenueDNA.valuePropositions} /> : <RevenueDNAEmpty onGenerate={() => generateDNAMutation.mutate()} isGenerating={generateDNAMutation.isPending} />)}
          {tab === 'trust' && (revenueDNA ? <TrustSignalsSection profile={revenueDNA.profile} /> : <RevenueDNAEmpty onGenerate={() => generateDNAMutation.mutate()} isGenerating={generateDNAMutation.isPending} />)}
          {tab === 'committee' && (revenueDNA ? <BuyingCommitteeSection profile={revenueDNA.profile} /> : <RevenueDNAEmpty onGenerate={() => generateDNAMutation.mutate()} isGenerating={generateDNAMutation.isPending} />)}
          {tab === 'graph' && workspace && <KnowledgeGraphSection workspaceId={workspace.id} />
        </CardContent>
      </Card>

      {/* Modals */}
      <AnalyzeModal
        open={analyzeModalOpen}
        onClose={() => setAnalyzeModalOpen(false)}
        url={websiteUrl}
        setUrl={setWebsiteUrl}
        onAnalyze={handleAnalyze}
        loading={createMutation.isPending}
      />
      <EditCompanyModal
        open={editCompanyOpen}
        onClose={() => setEditCompanyOpen(false)}
        form={companyForm}
        setForm={setCompanyForm}
        onSave={handleSaveCompany}
        loading={updateMutation.isPending}
      />
    </div>
  );
}

// ============================================================
// Processing View
// ============================================================

function ProcessingView({ analysis }: { analysis: FullAnalysis }) {
  const currentStage = biService.getCurrentStage(analysis.completion_percentage);
  const stageIndex = ANALYSIS_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader
        title="Business Intelligence Agent"
        description="Understand your business before generating your revenue strategy."
      />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Brain className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Analyzing {analysis.website}</h2>
        <p className="text-sm text-ink-500 mb-8">The Business Intelligence Agent is processing your website. This typically takes 30–60 seconds.</p>

        {/* Progress bar */}
        <div className="w-full max-w-md mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-ink-500">Progress</span>
            <span className="text-sm font-semibold text-ink-500">{analysis.completion_percentage}%</span>
          </div>
          <div className="h-2 rounded-full bg-card-900 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-500" style={{ width: `${analysis.completion_percentage}%` }} />
          </div>
        </div>

        {/* Stages */}
        <div className="w-full max-w-md space-y-2">
          {ANALYSIS_STAGES.map((stage, i) => (
            <div key={stage.stage} className="flex items-center gap-3">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border-2 shrink-0 transition-colors',
                i < stageIndex && 'border-success-500 bg-success-500/10 text-success-400',
                i === stageIndex && 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400',
                i > stageIndex && 'border-gold-500/12 bg-card-900 text-ink-500'
              )}>
                {i < stageIndex ? <Check className="h-3.5 w-3.5" /> : i === stageIndex ? <Spinner className="h-3.5 w-3.5" /> : <span className="text-xs">{i + 1}</span>}
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

function StructureTab({ analysis }: { analysis: FullAnalysis }) {
  const pageTypes: { type: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { type: 'homepage', label: 'Homepage', icon: Building2 },
    { type: 'services', label: 'Services', icon: Handshake },
    { type: 'pricing', label: 'Pricing', icon: DollarSign },
    { type: 'blog', label: 'Blogs', icon: FileCode },
    { type: 'resources', label: 'Resources', icon: Layers },
    { type: 'contact', label: 'Contact', icon: Globe },
    { type: 'faq', label: 'FAQs', icon: AlertCircle },
    { type: 'testimonials', label: 'Testimonials', icon: Users },
    { type: 'case_studies', label: 'Case Studies', icon: TrendingUp },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
        {pageTypes.map(({ type, label, icon: Icon }) => {
          const found = analysis.pages.find((p) => p.page_type === type);
          return (
            <div key={type} className={cn(
              'rounded-lg border p-3 transition-colors',
              found ? 'border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5' : 'border-gold-500/12 bg-card-900 opacity-50'
            )}>
              <Icon className={cn('h-4 w-4 mb-2', found ? 'text-brand-400' : 'text-ink-500')} />
              <p className="text-xs font-medium text-ink-500">{label}</p>
              <p className="text-[10px] text-ink-500 mt-0.5">{found ? 'Found' : 'Not found'}</p>
            </div>
          );
        })}
      </div>
      <WebsitePagesTable pages={analysis.pages} />
    </div>
  );
}

function ContentTab({ analysis }: { analysis: FullAnalysis }) {
  const [selectedPage, setSelectedPage] = useState<string | null>(analysis.pages[0]?.id ?? null);
  const page = analysis.pages.find((p) => p.id === selectedPage);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-1">
        {analysis.pages.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelectedPage(p.id)}
            className={cn(
              'w-full text-left rounded-lg px-3 py-2 text-xs transition-colors',
              selectedPage === p.id ? 'bg-card-900 text-ink-500' : 'text-ink-500 hover:bg-card-800'
            )}
          >
            <div className="flex items-center gap-2">
              <FileCode className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{p.page_title ?? 'Untitled'}</span>
            </div>
            <span className="text-[10px] text-ink-500 block mt-0.5 truncate">{p.url}</span>
          </button>
        ))}
      </div>
      <div className="lg:col-span-2">
        {page ? (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Badge tone="brand">{page.page_type.replace('_', ' ')}</Badge>
              <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-400 hover:text-brand-300 truncate">
                {page.url}
              </a>
            </div>
            {page.summary && (
              <div className="mb-4 rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <p className="text-xs text-ink-500 mb-1">Summary</p>
                <p className="text-sm text-ink-500">{page.summary}</p>
              </div>
            )}
            <div className="rounded-lg border border-gold-500/12 bg-maroon-950 p-4 max-h-[400px] overflow-y-auto scrollbar-thin">
              <p className="text-xs text-ink-500 whitespace-pre-wrap leading-relaxed">{page.content ?? 'No content extracted'}</p>
            </div>
          </div>
        ) : (
          <p className="text-xs text-ink-500 text-center py-8">Select a page to view its content.</p>
        )}
      </div>
    </div>
  );
}

function SummaryTab({ analysis }: { analysis: FullAnalysis }) {
  if (!analysis.insights?.executive_summary) {
    return <p className="text-xs text-ink-500 text-center py-8">No executive summary available.</p>;
  }
  return (
    <div className="max-w-3xl">
      <ExecutiveSummaryCard summary={analysis.insights.executive_summary} />
    </div>
  );
}

function InsightsTab({ analysis }: { analysis: FullAnalysis }) {
  if (!analysis.insights) {
    return <p className="text-xs text-ink-500 text-center py-8">No insights available.</p>;
  }
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <InsightCard type="strengths" items={analysis.insights.strengths} />
      <InsightCard type="weaknesses" items={analysis.insights.weaknesses} />
      <InsightCard type="opportunities" items={analysis.insights.opportunities} />
      <InsightCard type="risks" items={analysis.insights.risks} />
    </div>
  );
}

function RawTab({ analysis }: { analysis: FullAnalysis }) {
  const rawData = {
    analysis: {
      id: analysis.id,
      website: analysis.website,
      company_name: analysis.company_name,
      industry: analysis.industry,
      confidence_score: analysis.confidence_score,
      completion_percentage: analysis.completion_percentage,
      analysis_status: analysis.analysis_status,
      created_at: analysis.created_at,
      updated_at: analysis.updated_at,
    },
    business_data: {
      business_model: analysis.business_model,
      products: analysis.products,
      services: analysis.services,
      pricing_model: analysis.pricing_model,
      target_audience: analysis.target_audience,
      usp: analysis.usp,
      customer_problems: analysis.customer_problems,
      business_goals: analysis.business_goals,
      revenue_model: analysis.revenue_model,
      competitive_position: analysis.competitive_position,
    },
    pages: analysis.pages.map((p) => ({
      url: p.url,
      page_title: p.page_title,
      page_type: p.page_type,
      summary: p.summary,
      metadata: p.metadata,
    })),
    insights: analysis.insights ? {
      strengths: analysis.insights.strengths,
      weaknesses: analysis.insights.weaknesses,
      opportunities: analysis.insights.opportunities,
      risks: analysis.insights.risks,
      raw_json: analysis.insights.raw_json,
    } : null,
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

function OverviewCard({ icon: Icon, label, children }: {
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

function ListCard({ title, icon: Icon, items }: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: string[];
}) {
  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4 text-ink-500" />
        <h4 className="text-sm font-semibold text-ink-500">{title}</h4>
        <span className="text-xs text-ink-500 ml-auto">{items.length}</span>
      </div>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <ChevronRight className="h-3 w-3 text-ink-500 shrink-0 mt-0.5" />
            <span className="text-xs text-ink-500 leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyzeModal({ open, onClose, url, setUrl, onAnalyze, loading }: {
  open: boolean;
  onClose: () => void;
  url: string;
  setUrl: (v: string) => void;
  onAnalyze: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Analyze Website"
      description="Enter the website URL you want to analyze. The Business Intelligence Agent will crawl the site and generate a complete business understanding."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onAnalyze} loading={loading} disabled={!url.trim()}>
            <Search className="h-4 w-4" />
            Start Analysis
          </Button>
        </>
      }
    >
      <div>
        <Label>Website URL</Label>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          autoFocus
          onKeyDown={(e) => e.key === 'Enter' && url.trim() && onAnalyze()}
        />
        <p className="text-xs text-ink-500 mt-2">
          The agent will crawl up to 10 pages and analyze the content using AI.
        </p>
      </div>
    </Modal>
  );
}

function EditCompanyModal({ open, onClose, form, setForm, onSave, loading }: {
  open: boolean;
  onClose: () => void;
  form: { company_name: string; website: string; industry: string; country: string; language: string; timezone: string; description: string };
  setForm: (v: typeof form) => void;
  onSave: () => void;
  loading: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit Company Information"
      description="Update the company details extracted from the website."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} loading={loading}>
            <Check className="h-4 w-4" />
            Save Changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Company Name</Label>
            <Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Industry</Label>
            <Input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
          </div>
          <div>
            <Label>Country</Label>
            <Input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Language</Label>
            <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
          </div>
          <div>
            <Label>Timezone</Label>
            <Input value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}
