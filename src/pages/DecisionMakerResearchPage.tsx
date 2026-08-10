import { useState, useMemo } from 'react';
import {
  Users,
  RefreshCw,
  Play,
  Download,
  CheckCircle2,
  AlertCircle,
  Target,
  Building2,
  Star,
  Shield,
  Network,
  Briefcase,
  Activity,
  Lightbulb,
  FileJson,
  ArrowRight,
  UserCheck,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { DecisionMakerTable } from '@/components/decision-maker-research/DecisionMakerTable';
import { BuyingCommitteeCard } from '@/components/decision-maker-research/BuyingCommitteeCard';
import { ProfessionalProfileCard } from '@/components/decision-maker-research/ProfessionalProfileCard';
import { ActivityCard } from '@/components/decision-maker-research/ActivityCard';
import { RelationshipScoreCard } from '@/components/decision-maker-research/RelationshipScoreCard';
import { InfluenceCard } from '@/components/decision-maker-research/InfluenceCard';
import { RecommendationCard } from '@/components/decision-maker-research/RecommendationCard';
import { TimelineCard } from '@/components/decision-maker-research/TimelineCard';

import {
  useDecisionMakerResearch,
  useStartResearch,
  useRefreshResearch,
  useDeleteResearch,
  useExportResearch,
  MOCK_DM_COMPANIES,
  MOCK_DM_RECOMMENDATIONS,
  DM_STAGES,
} from '@/hooks/useDecisionMakerResearch';
import { dmResearchService } from '@/services/decision-maker-research';
import { cn } from '@/lib/utils';
import type { ExportFormat, FullContact, DMRecommendations } from '@/types/decision-maker-research';

// ============================================================
// Tab definitions
// ============================================================

const TABS = [
  { id: 'committee', label: 'Buying Committee', icon: Users },
  { id: 'professional', label: 'Professional Info', icon: Briefcase },
  { id: 'activity', label: 'Professional Activity', icon: Activity },
  { id: 'interests', label: 'Interests & Expertise', icon: Lightbulb },
  { id: 'relationship', label: 'Relationship Intelligence', icon: Network },
  { id: 'signals', label: 'Buying Signals', icon: Target },
  { id: 'recommendations', label: 'AI Recommendations', icon: Lightbulb },
  { id: 'raw', label: 'Raw JSON', icon: FileJson },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ============================================================
// Main Page
// ============================================================

export function DecisionMakerResearchPage() {
  const { data: research, isLoading } = useDecisionMakerResearch();
  const startMutation = useStartResearch();
  const refreshMutation = useRefreshResearch();
  const deleteMutation = useDeleteResearch();
  const exportMutation = useExportResearch();

  const [tab, setTab] = useState<TabId>('committee');
  const [startModalOpen, setStartModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedCompanyIndex, setSelectedCompanyIndex] = useState(0);
  const [selectedContact, setSelectedContact] = useState<FullContact | null>(null);

  const isProcessing = research?.status === 'processing' || research?.status === 'queued';
  const isMutating = startMutation.isPending || refreshMutation.isPending;

  // Derived stats
  const stats = useMemo(() => {
    const allCompanies = MOCK_DM_COMPANIES;
    const completed = allCompanies.filter((c) => c.research.status === 'completed').length;
    const totalContacts = allCompanies.reduce((s, c) => s + c.contacts.length, 0);
    const committees = allCompanies.filter((c) => c.buying_committee.economic_buyer).length;
    const avgContactScore = Math.round(allCompanies.reduce((s, c) => s + c.contacts.reduce((cs, cc) => cs + cc.contact.influence_score, 0) / c.contacts.length, 0) / allCompanies.length);
    const avgInfluence = Math.round(allCompanies.reduce((s, c) => s + c.contacts.reduce((cs, cc) => cs + cc.contact.influence_score, 0) / c.contacts.length, 0) / allCompanies.length);
    const avgReadiness = Math.round(allCompanies.reduce((s, c) => s + c.contacts.reduce((cs, cc) => cs + cc.contact.outreach_readiness, 0) / c.contacts.length, 0) / allCompanies.length);
    const avgConfidence = Math.round(allCompanies.reduce((s, c) => s + c.research.confidence_score, 0) / allCompanies.length);
    return { completed, totalContacts, committees, avgContactScore, avgInfluence, avgReadiness, avgConfidence };
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
        <PageHeader title="Decision Maker Research Agent" description="Research stakeholders and build complete buying committee intelligence." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  // Empty state
  if (!research) {
    return (
      <div>
        <PageHeader title="Decision Maker Research Agent" description="Research stakeholders and build complete buying committee intelligence." />
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title="No Decision Makers Researched"
          description="Research your companies to identify key stakeholders and buying committees. The Decision Maker Research Agent identifies decision makers, analyzes their professional background, maps the buying committee, and generates outreach recommendations."
          action={
            <Button onClick={() => setStartModalOpen(true)}>
              <Play className="h-4 w-4" />
              Research Decision Makers
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
  if (research.status === 'failed') {
    return (
      <div>
        <PageHeader title="Decision Maker Research Agent" description="Research stakeholders and build complete buying committee intelligence." />
        <EmptyState
          icon={<AlertCircle className="h-6 w-6" />}
          title="Research Failed"
          description={research.error_message ?? 'The decision maker research could not be completed. Please try again.'}
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
  const timelineEvents = dmResearchService.getTimelineEvents(research);
  const mockCompany = MOCK_DM_COMPANIES[0];
  const recommendations: DMRecommendations = MOCK_DM_RECOMMENDATIONS;
  const activeContact = selectedContact ?? research.contacts[0] ?? null;

  return (
    <div>
      {/* Header */}
      <PageHeader
        title="Decision Maker Research Agent"
        description="Research stakeholders and build complete buying committee intelligence."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} loading={refreshMutation.isPending}>
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh Research
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport('csv')} loading={exportMutation.isPending}>
              <Download className="h-3.5 w-3.5" />
              Export Contacts
            </Button>
            <Button variant="outline" size="sm" onClick={() => setDeleteModalOpen(true)}>
              Delete
            </Button>
            <Button size="sm" onClick={() => setStartModalOpen(true)}>
              <Play className="h-3.5 w-3.5" />
              Research Decision Makers
            </Button>
          </div>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3 mb-6">
        <KpiCard icon={CheckCircle2} label="Research Status">
          <Badge tone="success" dot>Completed</Badge>
        </KpiCard>
        <KpiCard icon={Building2} label="Companies Done">
          <span className="text-sm text-ink-500 font-semibold">{stats.completed}</span>
        </KpiCard>
        <KpiCard icon={Users} label="Decision Makers">
          <span className="text-sm text-ink-500 font-semibold">{stats.totalContacts}</span>
        </KpiCard>
        <KpiCard icon={Network} label="Committees Built">
          <span className="text-sm text-ink-500 font-semibold">{stats.committees}</span>
        </KpiCard>
        <KpiCard icon={Target} label="Avg Contact Score">
          <span className={cn('text-sm font-semibold', stats.avgContactScore >= 85 ? 'text-success-400' : stats.avgContactScore >= 70 ? 'text-warning-500' : 'text-error-400')}>{stats.avgContactScore}</span>
        </KpiCard>
        <KpiCard icon={Star} label="Avg Influence">
          <span className={cn('text-sm font-semibold', stats.avgInfluence >= 85 ? 'text-success-400' : stats.avgInfluence >= 70 ? 'text-warning-500' : 'text-error-400')}>{stats.avgInfluence}</span>
        </KpiCard>
        <KpiCard icon={UserCheck} label="Avg Readiness">
          <span className={cn('text-sm font-semibold', stats.avgReadiness >= 85 ? 'text-success-400' : stats.avgReadiness >= 70 ? 'text-warning-500' : 'text-error-400')}>{stats.avgReadiness}</span>
        </KpiCard>
        <KpiCard icon={Shield} label="Confidence">
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
              <p className="text-xs text-ink-500 mt-0.5">Loaded from Company Research Agent</p>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <InfoRow label="Company Name" value={mockCompany.company_name} />
                <InfoRow label="Industry" value={mockCompany.company_industry} />
                <InfoRow label="Website" value={mockCompany.company_website} />
                <InfoRow label="Employees" value={mockCompany.company_employees} />
                <InfoRow label="Revenue" value={mockCompany.company_revenue} />
                <InfoRow label="Growth Stage" value={mockCompany.company_growth_stage} />
                <div>
                  <dt className="text-xs text-ink-500 mb-1">Research Status</dt>
                  <dd><Badge tone="success" dot>Completed</Badge></dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Center panel — Decision Makers Table */}
        <div className="lg:col-span-6">
          <DecisionMakerTable contacts={research.contacts} onSelectContact={setSelectedContact} />
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
          {tab === 'committee' && <BuyingCommitteeCard committee={research.buying_committee} />}
          {tab === 'professional' && <ProfessionalProfileCard profile={activeContact?.profile ?? null} />}
          {tab === 'activity' && <ActivityCard activity={activeContact?.linkedin_activity ?? null} />}
          {tab === 'interests' && <InterestsTab contact={activeContact} />}
          {tab === 'relationship' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <RelationshipScoreCard contact={activeContact} />
              <InfluenceCard contact={activeContact} />
            </div>
          )}
          {tab === 'signals' && <BuyingSignalsTab contact={activeContact} />}
          {tab === 'recommendations' && <RecommendationsTab recommendations={recommendations} contact={activeContact} />}
          {tab === 'raw' && <RawTab data={research} />}
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
  const currentStage = dmResearchService.getCurrentStage();
  const stageIndex = DM_STAGES.findIndex((s) => s.stage === currentStage);

  return (
    <div>
      <PageHeader title="Decision Maker Research Agent" description="Research stakeholders and build complete buying committee intelligence." />
      <div className="flex flex-col items-center justify-center py-12">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 text-brand-400 mb-6">
          <Users className="h-8 w-8 animate-pulse" />
        </div>
        <h2 className="text-lg font-semibold text-ink-500 mb-1">Researching Decision Makers</h2>
        <p className="text-sm text-ink-500 mb-8">The Decision Maker Research Agent is identifying stakeholders and building buying committee intelligence. This typically takes 30–60 seconds.</p>
        <div className="w-full max-w-md space-y-2">
          {DM_STAGES.map((stage, i) => (
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

function InterestsTab({ contact }: { contact: FullContact | null }) {
  if (!contact?.linkedin_activity) {
    return <EmptyState icon={<Lightbulb className="h-6 w-6" />} title="No Interest Data" description="No interests and expertise data available for this contact." />;
  }

  const topics = contact.linkedin_activity.primary_topics;
  const allTopics = [
    { label: 'Primary Interests', items: topics },
    { label: 'Technologies', items: contact.profile?.skills ?? [] },
    { label: 'Business Topics', items: topics.filter((t) => t.toLowerCase().includes('saas') || t.toLowerCase().includes('business') || t.toLowerCase().includes('growth') || t.toLowerCase().includes('revenue')) },
    { label: 'Leadership Topics', items: topics.filter((t) => t.toLowerCase().includes('leadership') || t.toLowerCase().includes('management') || t.toLowerCase().includes('team')) },
    { label: 'Sales Topics', items: topics.filter((t) => t.toLowerCase().includes('sales') || t.toLowerCase().includes('revops') || t.toLowerCase().includes('sdr')) },
    { label: 'Marketing Topics', items: topics.filter((t) => t.toLowerCase().includes('marketing') || t.toLowerCase().includes('demand') || t.toLowerCase().includes('content')) },
    { label: 'AI Topics', items: topics.filter((t) => t.toLowerCase().includes('ai') || t.toLowerCase().includes('ml') || t.toLowerCase().includes('intelligence')) },
    { label: 'Cloud Topics', items: topics.filter((t) => t.toLowerCase().includes('cloud') || t.toLowerCase().includes('aws') || t.toLowerCase().includes('gcp') || t.toLowerCase().includes('azure')) },
  ];

  return (
    <div className="space-y-4">
      {allTopics.map((section) => (
        <Card key={section.label}>
          <CardHeader>
            <CardTitle>{section.label}</CardTitle>
          </CardHeader>
          <CardContent>
            {section.items.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {section.items.map((item, i) => (
                  <Badge key={i} tone="brand">{item}</Badge>
                ))}
              </div>
            ) : (
              <p className="text-xs text-ink-500">No data in this category.</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BuyingSignalsTab({ contact }: { contact: FullContact | null }) {
  if (!contact) {
    return <EmptyState icon={<Target className="h-6 w-6" />} title="No Contact Selected" description="Select a contact from the table to view their buying signals." />;
  }

  const signals = [
    { label: 'Hiring Activity', value: contact.activity_score > 70 ? 'Active hiring detected' : 'Low hiring activity', icon: Users, tone: contact.activity_score > 70 ? 'success' : 'neutral' },
    { label: 'Technology Changes', value: 'New technology adoption signals', icon: Activity, tone: 'brand' },
    { label: 'Expansion', value: contact.activity_score > 75 ? 'Expansion signals detected' : 'No expansion signals', icon: Building2, tone: contact.activity_score > 75 ? 'success' : 'neutral' },
    { label: 'Leadership Changes', value: 'Recent leadership changes noted', icon: UserCheck, tone: 'warning' },
    { label: 'Funding Discussions', value: 'Funding activity in the ecosystem', icon: Star, tone: 'brand' },
    { label: 'Digital Transformation', value: 'Digital transformation initiatives', icon: Activity, tone: 'success' },
    { label: 'Business Initiatives', value: 'New business initiatives detected', icon: Target, tone: 'brand' },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {signals.map((s) => (
        <div key={s.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
          <div className="flex items-center gap-2 mb-2">
            <s.icon className="h-4 w-4 text-brand-400" />
            <span className="text-xs font-medium text-ink-500">{s.label}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={s.tone as 'success' | 'warning' | 'error' | 'brand' | 'neutral'} dot>{s.value}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function RecommendationsTab({ recommendations, contact }: { recommendations: DMRecommendations; contact: FullContact | null }) {
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
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-success-400" />
              <CardTitle>Primary Contact</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-ink-500">{recommendations.primary_contact}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-400" />
              <CardTitle>Secondary Contacts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recommendations.secondary_contacts.map((c, i) => (
                <p key={i} className="text-xs text-ink-500">{c}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Outreach Order</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.recommended_outreach_order.map((c, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 text-xs font-semibold shrink-0">{i + 1}</div>
                <span className="text-xs text-ink-500">{c}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Communication Style</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_communication_style}</p>
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
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.recommended_next_action}</p>
        </CardContent>
      </Card>

      {contact?.recommendation && (
        <RecommendationCard recommendation={contact.recommendation} />
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-ink-500 mb-0.5">{label}</dt>
      <dd className="text-sm text-ink-500">{value}</dd>
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
      title="Research Decision Makers"
      description="The Decision Maker Research Agent will identify stakeholders, build the buying committee, and generate outreach recommendations for the selected company."
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
            {MOCK_DM_COMPANIES.slice(0, 10).map((c, i) => (
              <button
                key={i}
                onClick={() => onSelectIndex(i)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors',
                  selectedIndex === i ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/30' : 'bg-card-900 border border-gold-500/12 hover:bg-card-800'
                )}
              >
                <Building2 className="h-3.5 w-3.5 text-ink-500 shrink-0" />
                <span className={cn('text-xs', selectedIndex === i ? 'text-brand-400 font-medium' : 'text-ink-500')}>{c.company_name}</span>
                <Badge tone="neutral">{c.contacts.length} stakeholders</Badge>
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs text-ink-500 leading-relaxed mb-2">The agent will perform the following steps:</p>
          <ul className="space-y-1.5">
            {DM_STAGES.map((stage) => (
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
      description="This will permanently delete the research and all associated contacts, profiles, activity data, and recommendations. This action cannot be undone."
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
