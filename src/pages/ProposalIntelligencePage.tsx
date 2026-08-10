import { useState } from 'react';
import {
  FileText, Sparkles, Zap, Package, DollarSign, TrendingUp,
  Calendar, Swords, FileCheck, Clock, Brain, Gauge, Bell,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useProposalIntelligenceDashboard, useDetectProposalReadiness,
  useGenerateProposal, useSendProposal, useRecordProposalOutcome,
} from '@/hooks/useProposalIntelligence';
import {
  PIDashboardSection, PipelineSection, PendingRequestsSection,
  PackagesSection, PricingSection, ROISection, BusinessCaseSection,
  ImplementationSection, NegotiationSection, ApprovalsSection,
  VersionsSection, DeliverySection, ProposalScoreSection,
  PNotificationsSection, ProposalIntelligenceEmpty,
} from '@/components/proposal-intelligence';

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Brain },
  { id: 'pipeline', label: 'Pipeline', icon: FileText },
  { id: 'pending', label: 'Pending Requests', icon: Clock },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'pricing', label: 'Pricing', icon: DollarSign },
  { id: 'roi', label: 'ROI', icon: TrendingUp },
  { id: 'business', label: 'Business Case', icon: FileText },
  { id: 'implementation', label: 'Implementation', icon: Calendar },
  { id: 'negotiation', label: 'Negotiation', icon: Swords },
  { id: 'approvals', label: 'Approvals', icon: FileCheck },
  { id: 'versions', label: 'Versions', icon: Clock },
  { id: 'delivery', label: 'Delivery Analytics', icon: Sparkles },
  { id: 'score', label: 'Proposal Score', icon: Gauge },
  { id: 'notifications', label: 'Notifications', icon: Bell },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function ProposalIntelligencePage() {
  const { data: dashboard, isLoading } = useProposalIntelligenceDashboard();
  const detectReadiness = useDetectProposalReadiness();
  const generateProposal = useGenerateProposal();
  const sendProposal = useSendProposal();
  const recordOutcome = useRecordProposalOutcome();
  const [tab, setTab] = useState<TabId>('dashboard');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Proposal Intelligence" description="AI-powered proposal generation and management." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!dashboard || dashboard.totalProposals === 0) {
    return (
      <div>
        <PageHeader title="Proposal Intelligence" description="AI-powered proposal generation and management." />
        <Card className="p-6">
          <ProposalIntelligenceEmpty onDetect={() => detectReadiness.mutate()} isDetecting={detectReadiness.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Proposal Intelligence"
        description="AI-powered proposal generation and management."
        actions={
          <button onClick={() => detectReadiness.mutate()} disabled={detectReadiness.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />
            {detectReadiness.isPending ? 'Detecting...' : 'Detect Readiness'}
          </button>
        }
      />

      {/* AI Copilot banner */}
      <div className="flex items-center gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <Brain className="h-5 w-5 text-brand-400 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-ink-500">
            <span className="font-semibold text-ink-500">{dashboard.totalProposals}</span> proposals
            {' · '}<span className="font-semibold text-ink-500">{dashboard.awaitingApproval}</span> awaiting approval
            {' · '}<span className="font-semibold text-ink-500">{dashboard.sent}</span> sent
            {' · '}<span className="font-semibold text-ink-500">{dashboard.accepted}</span> accepted
            {' · '}Avg win prob: <span className="font-semibold text-ink-500">{dashboard.avgWinProbability}%</span>
            {' · '}Forecast: <span className="font-semibold text-ink-500">${dashboard.forecastRevenue.toLocaleString()}</span>
          </p>
        </div>
      </div>

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn('flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap', tab === t.id ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'dashboard' && <PIDashboardSection dashboard={dashboard} onDetect={() => detectReadiness.mutate()} isDetecting={detectReadiness.isPending} />}
          {tab === 'pipeline' && <PipelineSection proposals={dashboard.proposals} />}
          {tab === 'pending' && <PendingRequestsSection requests={dashboard.pendingRequests} onGenerate={(id) => generateProposal.mutate(id)} />}
          {tab === 'packages' && <PackagesSection proposals={dashboard.proposals} />}
          {tab === 'pricing' && <PricingSection proposals={dashboard.proposals} />}
          {tab === 'roi' && <ROISection proposals={dashboard.proposals} />}
          {tab === 'business' && <BusinessCaseSection proposals={dashboard.proposals} />}
          {tab === 'implementation' && <ImplementationSection proposals={dashboard.proposals} />}
          {tab === 'negotiation' && <NegotiationSection proposals={dashboard.proposals} />}
          {tab === 'approvals' && <ApprovalsSection proposals={dashboard.proposals} />}
          {tab === 'versions' && <VersionsSection proposals={dashboard.proposals} />}
          {tab === 'delivery' && <DeliverySection proposals={dashboard.proposals} />}
          {tab === 'score' && <ProposalScoreSection proposals={dashboard.proposals} />}
          {tab === 'notifications' && <PNotificationsSection notifications={dashboard.notifications} />}
        </div>
      </Card>
    </div>
  );
}
