import { useState, useMemo } from 'react';
import {
  Sparkles,
  RefreshCw,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  Target,
  TrendingUp,
  Zap,
  MessageSquare,
  Award,
  MousePointerClick,
  FileText,
  AlertTriangle,
  FolderOpen,
  ClipboardList,
  Lightbulb,
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
import { ExecutiveSummaryCard } from '@/components/personalization/ExecutiveSummaryCard';
import { PainPointCard } from '@/components/personalization/PainPointCard';
import { CommunicationProfileCard } from '@/components/personalization/CommunicationProfileCard';
import { ValuePropositionCard } from '@/components/personalization/ValuePropositionCard';
import { OpeningHookCard } from '@/components/personalization/OpeningHookCard';
import { CTARecommendationCard } from '@/components/personalization/CTARecommendationCard';
import { AssetRecommendationCard } from '@/components/personalization/AssetRecommendationCard';
import { BlueprintCard } from '@/components/personalization/BlueprintCard';
import { TimelineCard } from '@/components/personalization/TimelineCard';

import {
  usePersonalization,
  useGeneratePersonalization,
  useRefreshPersonalization,
  useDeletePersonalization,
  useExportPersonalization,
  MOCK_PROSPECTS,
  MOCK_AI_RECOMMENDATIONS,
  PERSONALIZATION_STAGES,
} from '@/hooks/usePersonalization';
import { personalizationService } from '@/services/personalization';
import { cn } from '@/lib/utils';
import type { ExportFormat, PersonalizationAIRecommendations } from '@/types/personalization';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'executive_summary', label: 'Executive Summary', icon: FileText },
  { id: 'pain_points', label: 'Pain Point Analysis', icon: AlertTriangle },
  { id: 'communication', label: 'Communication Profile', icon: MessageSquare },
  { id: 'value_proposition', label: 'Value Proposition', icon: Award },
  { id: 'opening_hooks', label: 'Opening Hooks', icon: Zap },
  { id: 'recommended_assets', label: 'Recommended Assets', icon: FolderOpen },
  { id: 'cta_strategy', label: 'CTA Strategy', icon: MousePointerClick },
  { id: 'raw', label: 'Raw JSON', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function PersonalizationPage() {
  const { data: profile, isLoading } = usePersonalization();
  const startMutation = useGeneratePersonalization();
  const refreshMutation = useRefreshPersonalization();
  const deleteMutation = useDeletePersonalization();
  const exportMutation = useExportPersonalization();

  const [tab, setTab] = useState<TabId>('executive_summary');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedProspectIndex, setSelectedProspectIndex] = useState(0);

  const isProcessing = profile?.status === 'processing' || profile?.status === 'queued';
  const isMutating = startMutation.isPending || refreshMutation.isPending;

  // Derived stats
  const stats = useMemo(() => {
    const all = MOCK_PROSPECTS;
    const completed = all.filter((p) => p.profile.status === 'completed').length;
    const avgScore = Math.round(all.reduce((s, p) => s + p.profile.personalization_score, 0) / all.length);
    const highConfidence = all.filter((p) => p.profile.personalization_score >= 80).length;
    const messagingReady = all.filter((p) => p.ai_recommendations.outreach_readiness === 'ready' || p.ai_recommendations.outreach_readiness === 'highly_ready').length;
    const vpMatch = Math.round((all.filter((p) => p.profile.personalization_score >= 75).length / all.length) * 100);
    const painAccuracy = Math.round(all.reduce((s, p) => s + p.pain_points.reduce((ps, pp) => ps + pp.confidence, 0) / p.pain_points.length, 0) / all.length);
    const ctaConfidence = Math.round(all.reduce((s, p) => s + p.cta_recommendations.length, 0) / all.length) * 10;
    const overallReadiness = Math.round((messagingReady / all.length) * 100);
    return { completed, avgScore, highConfidence, messagingReady, vpMatch, painAccuracy, ctaConfidence: Math.min(ctaConfidence, 100), overallReadiness };
  }, []);

  // ============================================================
  // Handlers
  // ============================================================

  const handleStart = () => {
    setStartModalOpen(false);
    startMutation.mutate({ prospectIndex: selectedProspectIndex });
  };

  const handleRefresh = () => {
    if (profile) refreshMutation.mutate(profile.id);
  };

  const handleExport = (format: ExportFormat) => {
    if (profile) exportMutation.mutate({ profile, format });
  };

  const handleDelete = () => {
    if (profile) {
      deleteMutation.mutate(profile.id);
      setDeleteModalOpen(false);
    }
  };

  // ============================================================
  // Render
  // ============================================================

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Personalization Agent" description="Generate personalized outreach intelligence for every prospect." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!profile) {
    return (
      <div>
        <PageHeader title="Personalization Agent" description="Generate personalized outreach intelligence for every prospect." />
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="No Personalization Generated"
          description="Generate personalized outreach blueprints for your highest-priority prospects. The Personalization Agent analyzes every available signal to create pain point analysis, communication profiles, value propositions, opening hooks, recommended assets, and CTA strategies — all ready for the Outreach Strategy Agent."
          action={
            <Button onClick={() => setStartModalOpen(true)}>
              <Play className="h-4 w-4" />
              Generate Personalization
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
  if (profile.status === 'failed') {
    return (
      <div>
        <PageHeader title="Personalization Agent" description="Generate personalized outreach intelligence for every prospect." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Blueprint Failed"
          description={profile.error_message ?? 'The personalization blueprint could not be generated. Please try again.'}
          action={
            <div className="flex gap-2">
              <Button onClick={() => setStartModalOpen(true)}>
                <Play className="h-4 w-4" />
                New Blueprint
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
  const timelineEvents = personalizationService.getTimelineEvents(profile);
  const mockProspect = MOCK_PROSPECTS[selectedProspectIndex] ?? MOCK_PROSPECTS[0];
  const aiRecs: PersonalizationAIRecommendations = MOCK_AI_RECOMMENDATIONS;

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Personalization Agent"
        description="Generate personalized outreach intelligence for every prospect."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Analysis
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export Blueprint
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
            <Button size="sm" onClick={() => setStartModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              Generate Personalization
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="Personalizations">
          <span className="text-sm text-ink-500 font-semibold">{stats.completed}</span>
        </KpiCard>
        <KpiCard icon={Sparkles} label="Avg Score">
          <span className={cn('text-sm font-semibold', stats.avgScore >= 80 ? 'text-success-400' : stats.avgScore >= 60 ? 'text-warning-500' : 'text-ink-500')}>{stats.avgScore}</span>
        </KpiCard>
        <KpiCard icon={ShieldCheck} label="High Confidence">
          <span className="text-sm text-success-400 font-semibold">{stats.highConfidence}</span>
        </KpiCard>
        <KpiCard icon={MessageSquare} label="Messaging Ready">
          <span className="text-sm text-brand-400 font-semibold">{stats.messagingReady}</span>
        </KpiCard>
        <KpiCard icon={Award} label="VP Match">
          <span className={cn('text-sm font-semibold', stats.vpMatch >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.vpMatch}%</span>
        </KpiCard>
        <KpiCard icon={AlertTriangle} label="Pain Accuracy">
          <span className={cn('text-sm font-semibold', stats.painAccuracy >= 80 ? 'text-success-400' : 'text-warning-500')}>{stats.painAccuracy}%</span>
        </KpiCard>
        <KpiCard icon={MousePointerClick} label="CTA Confidence">
          <span className={cn('text-sm font-semibold', stats.ctaConfidence >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.ctaConfidence}%</span>
        </KpiCard>
        <KpiCard icon={Activity} label="Overall Readiness">
          <span className={cn('text-sm font-semibold', stats.overallReadiness >= 70 ? 'text-success-400' : 'text-warning-500')}>{stats.overallReadiness}%</span>
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
              <p className="text-xs text-ink-500 mt-0.5">Loaded from Buying Intent Agent</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow icon={User} label="Decision Maker" value={mockProspect.prospect_name} />
                <InfoRow icon={Briefcase} label="Job Title" value={mockProspect.prospect_title} />
                <InfoRow icon={Building2} label="Company" value={mockProspect.company_name} />
                <InfoRow icon={Target} label="Industry" value={mockProspect.company_industry} />
                <InfoRow icon={TrendingUp} label="Intent Score" value={`${mockProspect.intent_score}/100`} />
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Priority</dt>
                  <dd>
                    <Badge tone={mockProspect.priority === 'critical' ? 'error' : mockProspect.priority === 'high' ? 'warning' : 'neutral'} dot>
                      {mockProspect.priority}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Personalization Dashboard */}
        <div className="lg:col-span-6">
          <BlueprintCard
            personalization_score={profile.personalization_score}
            communication_style={profile.communication_style}
            tone={profile.tone}
            value_proposition={profile.value_proposition}
            cta_strategy={profile.cta_strategy}
          />
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
          {tab === 'executive_summary' && <ExecutiveSummaryTab recommendations={aiRecs} />}
          {tab === 'pain_points' && <PainPointCard painPoints={profile.pain_points} />}
          {tab === 'communication' && <CommunicationProfileCard profile={mockProspect.communication_profile} />}
          {tab === 'value_proposition' && <ValuePropositionCard valueProposition={mockProspect.value_proposition} />}
          {tab === 'opening_hooks' && <OpeningHookCard hooks={profile.opening_hooks} />}
          {tab === 'recommended_assets' && <AssetRecommendationCard assets={profile.recommended_assets} />}
          {tab === 'cta_strategy' && <CTARecommendationCard recommendations={profile.cta_recommendations} />}
          {tab === 'raw' && <RawTab data={profile} />}
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
  const currentStage = personalizationService.getCurrentStage();
  const stageIndex = PERSONALIZATION_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Personalization Agent" description="Generate personalized outreach intelligence for every prospect." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Sparkles className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Generating Personalization</h2>
        <p className="text-sm text-ink-500 mb-8">The Personalization Agent is analyzing signals, generating pain points, and building your outreach blueprint. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {PERSONALIZATION_STAGES.map((stage, i) => (
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

function ExecutiveSummaryTab({ recommendations }: { recommendations: PersonalizationAIRecommendations }) {
  return (
    <div className="space-y-4">
      <ExecutiveSummaryCard recommendations={recommendations} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-brand-400" />
              <CardTitle>Prospect Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.prospect_summary}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-400" />
              <CardTitle>Company Summary</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.company_summary}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success-400" />
            <CardTitle>Business Opportunity</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.business_opportunity}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-400" />
            <CardTitle>Key Insights</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {recommendations.key_insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2">
                <ArrowRight className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <span className="text-sm text-ink-500">{insight}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand-400" />
              <CardTitle>Messaging Angle</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_messaging_angle}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-brand-400" />
              <CardTitle>Conversation Context</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500 leading-relaxed">{recommendations.conversation_context}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-success-400" />
            <CardTitle>Outreach Readiness</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <Badge tone={recommendations.outreach_readiness === 'highly_ready' ? 'success' : recommendations.outreach_readiness === 'ready' ? 'brand' : 'warning'} dot>
            {recommendations.outreach_readiness.replace('_', ' ')}
          </Badge>
        </CardContent>
      </Card>
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
      title="Generate Personalization"
      description="The Personalization Agent will analyze signals, identify pain points, generate communication profiles, create opening hooks, and build a complete outreach blueprint for the selected prospect."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={onStart} loading={loading}>
            <Play className="h-4 w-4" />
            Generate Blueprint
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="text-xs font-medium text-ink-500 block mb-2">Select a prospect to personalize:</span>
          <div className="max-h-48 overflow-y-auto scrollbar-thin space-y-1">
            {MOCK_PROSPECTS.slice(0, 10).map((p, i) => (
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
                  {p.prospect_name} — {p.prospect_title}
                </span>
                <Badge tone={p.priority === 'critical' ? 'error' : p.priority === 'high' ? 'warning' : 'neutral'}>
                  {p.profile.personalization_score}
                </Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The agent will perform the following steps:</p>
          <ul className="space-y-1.5">
            {PERSONALIZATION_STAGES.map((stage) => (
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
      title="Delete Blueprint"
      description="This will permanently delete the personalization blueprint and all associated pain points, hooks, assets, and CTA recommendations. This action cannot be undone."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={onDelete} loading={loading}>Delete Blueprint</Button>
        </>
      }
    >
      <p className="text-xs text-ink-500">Are you sure you want to delete this blueprint?</p>
    </Modal>
  );
}
