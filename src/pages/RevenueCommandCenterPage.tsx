import { useState } from 'react';
import {
  Brain, Zap, TrendingUp, Gauge, Activity, DollarSign,
  BarChart3, Bell, FileText, Target, Award, Rocket,
  PieChart, Lightbulb, ShieldAlert, Calendar,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useRevenueCommandCenter, useSyncPipeline, useGenerateForecast,
  useCalculatePipelineHealth, useCalculateMRR, useGenerateExecutiveSummary,
  useGenerateRevenueAlerts, useGenerateRevenueInsights,
} from '@/hooks/useRevenueForecast';
import {
  ExecutiveOverviewSection, PipelineSection, PipelineHealthSection,
  ForecastSection, MRRSection, ARRSection, CashFlowSection,
  PerformanceTable, InsightsSection, AlertsSection,
  ExecutiveBriefSection, BoardReportSection,
  ForecastHistorySection, ForecastAccuracySection,
  RevenueTrendsSection, CommandCenterEmpty,
} from '@/components/revenue-command-center';

const TABS = [
  { id: 'overview', label: 'Executive Overview', icon: Brain },
  { id: 'forecast', label: 'Revenue Forecast', icon: TrendingUp },
  { id: 'pipeline', label: 'Pipeline', icon: Target },
  { id: 'health', label: 'Pipeline Health', icon: Gauge },
  { id: 'accuracy', label: 'Forecast Accuracy', icon: BarChart3 },
  { id: 'trends', label: 'Revenue Trends', icon: Activity },
  { id: 'mrr', label: 'MRR', icon: DollarSign },
  { id: 'arr', label: 'ARR', icon: Rocket },
  { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
  { id: 'sales', label: 'Sales Performance', icon: Award },
  { id: 'campaigns', label: 'Campaign Performance', icon: BarChart3 },
  { id: 'industry', label: 'Industry Performance', icon: PieChart },
  { id: 'channel', label: 'Channel Performance', icon: Activity },
  { id: 'proposals', label: 'Proposal Performance', icon: FileText },
  { id: 'meetings', label: 'Meeting Performance', icon: Calendar },
  { id: 'insights', label: 'AI Insights', icon: Lightbulb },
  { id: 'alerts', label: 'Revenue Alerts', icon: Bell },
  { id: 'brief', label: 'Executive Brief', icon: FileText },
  { id: 'board', label: 'Board Report', icon: FileText },
  { id: 'history', label: 'Forecast History', icon: Calendar },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function RevenueCommandCenterPage() {
  const { data: cc, isLoading } = useRevenueCommandCenter();
  const syncPipeline = useSyncPipeline();
  const generateForecast = useGenerateForecast();
  const calculateHealth = useCalculatePipelineHealth();
  const calculateMRR = useCalculateMRR();
  const generateSummary = useGenerateExecutiveSummary();
  const generateAlerts = useGenerateRevenueAlerts();
  const generateInsights = useGenerateRevenueInsights();
  const [tab, setTab] = useState<TabId>('overview');

  const runAll = () => {
    syncPipeline.mutate();
    setTimeout(() => generateForecast.mutate('quarterly'), 500);
    setTimeout(() => calculateHealth.mutate(), 1000);
    setTimeout(() => calculateMRR.mutate(), 1500);
    setTimeout(() => generateSummary.mutate('weekly'), 2000);
    setTimeout(() => generateAlerts.mutate(), 2500);
    setTimeout(() => generateInsights.mutate(), 3000);
  };

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Revenue Command Center" description="AI Revenue Brain — predict, optimize, and command your pipeline." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!cc || cc.deals.length === 0) {
    return (
      <div>
        <PageHeader title="Revenue Command Center" description="AI Revenue Brain — predict, optimize, and command your pipeline." />
        <Card className="p-6">
          <CommandCenterEmpty onSync={() => syncPipeline.mutate()} isSyncing={syncPipeline.isPending} />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Revenue Command Center"
        description="AI Revenue Brain — predict, optimize, and command your pipeline."
        actions={
          <button onClick={runAll} disabled={syncPipeline.isPending} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
            <Zap className="h-3.5 w-3.5" />Run Full Analysis
          </button>
        }
      />

      {/* AI Copilot banner */}
      {cc.latestBrief && (
        <div className="flex items-start gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
          <Brain className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-ink-500">{cc.latestBrief.headline}</p>
            <p className="text-xs text-ink-500 mt-0.5">{cc.latestBrief.summary?.slice(0, 200)}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ink-500">Pipeline: ${cc.totalPipelineValue.toLocaleString()}</span>
            <span className="text-xs text-ink-500">Weighted: ${cc.weightedPipelineValue.toLocaleString()}</span>
            {cc.currentQuarterForecast && <span className="text-xs text-ink-500">Forecast: ${cc.currentQuarterForecast.expected_revenue.toLocaleString()}</span>}
          </div>
        </div>
      )}

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
          {tab === 'overview' && <ExecutiveOverviewSection cc={cc} onSync={() => syncPipeline.mutate()} isSyncing={syncPipeline.isPending} onForecast={() => generateForecast.mutate('quarterly')} onSummary={() => generateSummary.mutate('weekly')} />}
          {tab === 'forecast' && <ForecastSection cc={cc} />}
          {tab === 'pipeline' && <PipelineSection cc={cc} />}
          {tab === 'health' && <PipelineHealthSection cc={cc} />}
          {tab === 'accuracy' && <ForecastAccuracySection cc={cc} />}
          {tab === 'trends' && <RevenueTrendsSection cc={cc} />}
          {tab === 'mrr' && <MRRSection cc={cc} />}
          {tab === 'arr' && <ARRSection cc={cc} />}
          {tab === 'cashflow' && <CashFlowSection cc={cc} />}
          {tab === 'sales' && <PerformanceTable data={cc.salesPerformance as Array<Record<string, unknown>>} title="Sales Performance" columns={[{ key: 'rep_name', label: 'Rep' }, { key: 'deals_won', label: 'Won' }, { key: 'won_value', label: 'Won Value', format: (v) => `$${Number(v ?? 0).toLocaleString()}` }, { key: 'win_rate', label: 'Win Rate', format: (v) => `${Number(v ?? 0).toFixed(1)}%` }]} />}
          {tab === 'campaigns' && <PerformanceTable data={cc.campaignPerformance as Array<Record<string, unknown>>} title="Campaign Performance" columns={[{ key: 'campaign_name', label: 'Campaign' }, { key: 'deals_generated', label: 'Deals' }, { key: 'won_value', label: 'Won Value', format: (v) => `$${Number(v ?? 0).toLocaleString()}` }, { key: 'conversion_rate', label: 'Conv Rate', format: (v) => `${Number(v ?? 0).toFixed(1)}%` }, { key: 'roi', label: 'ROI', format: (v) => `${Number(v ?? 0).toFixed(1)}x` }]} />}
          {tab === 'industry' && <PerformanceTable data={cc.industryPerformance as Array<Record<string, unknown>>} title="Industry Performance" columns={[{ key: 'industry', label: 'Industry' }, { key: 'deals_count', label: 'Deals' }, { key: 'won_value', label: 'Won Value', format: (v) => `$${Number(v ?? 0).toLocaleString()}` }, { key: 'conversion_rate', label: 'Conv Rate', format: (v) => `${Number(v ?? 0).toFixed(1)}%` }]} />}
          {tab === 'channel' && <PerformanceTable data={cc.channelPerformance as Array<Record<string, unknown>>} title="Channel Performance" columns={[{ key: 'channel', label: 'Channel' }, { key: 'deals_count', label: 'Deals' }, { key: 'won_value', label: 'Won Value', format: (v) => `$${Number(v ?? 0).toLocaleString()}` }, { key: 'conversion_rate', label: 'Conv Rate', format: (v) => `${Number(v ?? 0).toFixed(1)}%` }]} />}
          {tab === 'proposals' && (cc.proposalPerformance ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Total Proposals</p><p className="text-xl font-bold text-ink-500">{cc.proposalPerformance.total_proposals}</p></div>
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Accepted</p><p className="text-xl font-bold text-success-400">{cc.proposalPerformance.accepted_proposals}</p></div>
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Acceptance Rate</p><p className="text-xl font-bold text-ink-500">{cc.proposalPerformance.acceptance_rate.toFixed(1)}%</p></div>
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Total Value</p><p className="text-xl font-bold text-ink-500">${cc.proposalPerformance.total_proposal_value.toLocaleString()}</p></div>
            </div>
          ) : <div className="text-center py-8 text-sm text-ink-500">No proposal performance data.</div>)}
          {tab === 'meetings' && (cc.meetingPerformance ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Total Meetings</p><p className="text-xl font-bold text-ink-500">{cc.meetingPerformance.total_meetings}</p></div>
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Completed</p><p className="text-xl font-bold text-ink-500">{cc.meetingPerformance.completed_meetings}</p></div>
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Moved to Opp</p><p className="text-xl font-bold text-success-400">{cc.meetingPerformance.moved_to_opportunity}</p></div>
              <div className="p-4 rounded-lg bg-card-900"><p className="text-xs text-ink-500">Conversion Rate</p><p className="text-xl font-bold text-ink-500">{cc.meetingPerformance.conversion_rate.toFixed(1)}%</p></div>
            </div>
          ) : <div className="text-center py-8 text-sm text-ink-500">No meeting performance data.</div>)}
          {tab === 'insights' && <InsightsSection cc={cc} />}
          {tab === 'alerts' && <AlertsSection cc={cc} />}
          {tab === 'brief' && <ExecutiveBriefSection cc={cc} />}
          {tab === 'board' && <BoardReportSection cc={cc} />}
          {tab === 'history' && <ForecastHistorySection cc={cc} />}
        </div>
      </Card>
    </div>
  );
}
