import {
  Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, Target,
  Zap, ShieldAlert, Rocket, PieChart, DollarSign, Users, BarChart3,
  Activity, CheckCircle2, XCircle, Clock, Lightbulb, Award,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { CEOCommandCenter } from '@/types/ai-ceo';

// ============================================================
// Score Gauge
// ============================================================
export function ScoreGauge({ score, label, icon: Icon }: { score: number; label: string; icon: typeof Brain }) {
  const color = score >= 70 ? 'text-success-400' : score >= 50 ? 'text-warning-400' : 'text-error-400';
  const ringColor = score >= 70 ? 'stroke-success-500' : score >= 50 ? 'stroke-warning-500' : 'stroke-error-500';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;
  return (
    <Card className="p-4 flex flex-col items-center">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" className="stroke-bg-elevated" />
          <circle cx="50" cy="50" r="40" fill="none" strokeWidth="6" className={ringColor} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold', color)}>{score.toFixed(0)}</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-2"><Icon className={cn('h-3.5 w-3.5', color)} /><span className="text-xs text-ink-500">{label}</span></div>
    </Card>
  );
}

// ============================================================
// KPI Card
// ============================================================
export function CEOKPICard({ icon: Icon, label, value, trend }: { icon: typeof DollarSign; label: string; value: string; trend?: 'up' | 'down' | 'neutral' }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">{label}</span></div>
      <p className="text-xl font-bold text-ink-500">{value}</p>
      {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success-400 mt-1" />}
      {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-error-400 mt-1" />}
    </Card>
  );
}

// ============================================================
// Progress Bar
// ============================================================
function ProgressBar({ value, max = 100, label, format = 'number' }: { value: number; max?: number; label?: string; format?: 'number' | 'currency' | 'percent' }) {
  const pct = Math.min((value / max) * 100, 100);
  const color = pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500';
  const display = format === 'currency' ? `$${value.toLocaleString()}` : format === 'percent' ? `${value.toFixed(1)}%` : value.toLocaleString();
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-ink-500 w-32 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-20 text-right">{display}</span>
    </div>
  );
}

// ============================================================
// AI Copilot Banner
// ============================================================
export function CEOCopilotBanner({ cc }: { cc: CEOCommandCenter }) {
  const state = cc.state as Record<string, unknown> | null;
  const score = state?.overall_company_score as number ?? 0;
  return (
    <div className="flex items-start gap-3 mb-6 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
      <Brain className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
      <div className="flex-1">
        <p className="text-sm text-ink-500">
          I analyzed every department. The company scores {score.toFixed(0)}/100 overall.{' '}
          {cc.activeRisksCount > 0 ? `I found ${cc.activeRisksCount} major risks requiring attention. ` : ''}
          {cc.opportunities.length > 0 ? `I identified ${cc.opportunities.length} strategic opportunities. ` : ''}
          {cc.churnRiskCount > 0 ? `I detect ${cc.churnRiskCount} customers at high churn risk. ` : ''}
          {cc.recommendations.length > 0 ? `I have ${cc.recommendations.length} recommendations ready. ` : ''}
        </p>
        <p className="text-xs text-ink-500 mt-0.5">
          MRR: ${cc.totalMRR.toLocaleString()} · ARR: ${cc.totalARR.toLocaleString()} · Pipeline: ${cc.totalPipeline.toLocaleString()} · Customers: {cc.activeCustomers} · Margin: {cc.grossMargin.toFixed(1)}% · LTV: ${cc.avgLTV.toLocaleString()} · CAC: ${cc.avgCAC.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

// ============================================================
// CEO Dashboard Section
// ============================================================
export function CEODashboardSection({ cc }: { cc: CEOCommandCenter }) {
  const state = cc.state as Record<string, unknown> | null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreGauge score={state?.overall_company_score as number ?? 70} label="Overall" icon={Brain} />
        <ScoreGauge score={state?.health_score as number ?? 70} label="Health" icon={Activity} />
        <ScoreGauge score={state?.growth_score as number ?? 65} label="Growth" icon={TrendingUp} />
        <ScoreGauge score={state?.risk_score as number ?? 35} label="Risk" icon={ShieldAlert} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CEOKPICard icon={DollarSign} label="MRR" value={`$${cc.totalMRR.toLocaleString()}`} trend="up" />
        <CEOKPICard icon={TrendingUp} label="ARR" value={`$${cc.totalARR.toLocaleString()}`} trend="up" />
        <CEOKPICard icon={Users} label="Customers" value={`${cc.activeCustomers}`} />
        <CEOKPICard icon={BarChart3} label="Margin" value={`${cc.grossMargin.toFixed(1)}%`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <CEOKPICard icon={Target} label="Win Rate" value={`${cc.winRate.toFixed(0)}%`} />
        <CEOKPICard icon={AlertTriangle} label="Churn Risk" value={`${cc.churnRiskCount}`} trend={cc.churnRiskCount > 0 ? 'down' : 'neutral'} />
        <CEOKPICard icon={ShieldAlert} label="Risks" value={`${cc.risks.length}`} trend={cc.risks.length > 0 ? 'down' : 'neutral'} />
        <CEOKPICard icon={Rocket} label="Opportunities" value={`${cc.opportunities.length}`} trend="up" />
      </div>
    </div>
  );
}

// ============================================================
// Company Health Section
// ============================================================
export function CompanyHealthSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.companyHealth.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No health data. Run company analysis.</div>;
  const latest = cc.companyHealth[0] as Record<string, unknown>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreGauge score={latest.overall_score as number} label="Overall" icon={Brain} />
        <ScoreGauge score={latest.revenue_health as number} label="Revenue" icon={DollarSign} />
        <ScoreGauge score={latest.pipeline_health as number} label="Pipeline" icon={BarChart3} />
        <ScoreGauge score={latest.customer_health as number} label="Customer" icon={Users} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <ScoreGauge score={latest.team_health as number} label="Team" icon={Users} />
        <ScoreGauge score={latest.financial_health as number} label="Financial" icon={PieChart} />
        <ScoreGauge score={latest.market_health as number} label="Market" icon={Activity} />
        <ScoreGauge score={latest.growth_health as number} label="Growth" icon={TrendingUp} />
      </div>
      {latest.ai_reasoning && <Card className="p-3"><div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{latest.ai_reasoning as string}</span></div></Card>}
    </div>
  );
}

// ============================================================
// Executive Brief Section
// ============================================================
export function ExecutiveBriefSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.executiveBriefs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No executive briefs. Generate a brief.</div>;
  const brief = cc.executiveBriefs[0] as Record<string, unknown>;
  const sections = [
    { key: 'executive_summary', label: 'Executive Summary', icon: Brain },
    { key: 'wins', label: 'Wins', icon: CheckCircle2 },
    { key: 'losses', label: 'Losses', icon: XCircle },
    { key: 'risks', label: 'Risks', icon: AlertTriangle },
    { key: 'revenue_summary', label: 'Revenue', icon: DollarSign },
    { key: 'forecast_summary', label: 'Forecast', icon: TrendingUp },
    { key: 'customer_health_summary', label: 'Customer Health', icon: Users },
    { key: 'finance_summary', label: 'Finance', icon: PieChart },
    { key: 'cashflow_summary', label: 'Cash Flow', icon: Activity },
    { key: 'hiring_summary', label: 'Hiring', icon: Users },
    { key: 'growth_summary', label: 'Growth', icon: Rocket },
    { key: 'competition_summary', label: 'Competition', icon: ShieldAlert },
    { key: 'strategic_priorities', label: 'Strategic Priorities', icon: Target },
  ];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-2"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((brief.ai_confidence as number) * 100)}%</Badge><span className="text-xs text-ink-500">{brief.brief_date as string}</span></div>
      {sections.map((s) => {
        const content = brief[s.key] as string | null;
        if (!content) return null;
        return (
          <Card key={s.key} className="p-3">
            <div className="flex items-start gap-2">
              <s.icon className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <div><p className="text-xs font-medium text-ink-500 mb-1">{s.label}</p><p className="text-sm text-ink-500 leading-relaxed">{content}</p></div>
            </div>
          </Card>
        );
      })}
      {brief.ai_reasoning && <Card className="p-3 bg-gradient-to-r from-gold-400 to-gold-300/5 border-brand-500/10"><div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{brief.ai_reasoning as string}</span></div></Card>}
    </div>
  );
}

// ============================================================
// Strategic Priorities Section
// ============================================================
export function StrategicPrioritiesSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.priorities.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No priorities. Run prioritization.</div>;
  return (
    <div className="space-y-2">
      {cc.priorities.map((p) => {
        const pr = p as Record<string, unknown>;
        const levelTone = { 1: 'error', 2: 'warning', 3: 'brand', 4: 'brand', 5: 'neutral' } as const;
        return (
          <Card key={pr.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><Target className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{pr.priority_name as string}</p><p className="text-xs text-ink-500 mt-0.5">{pr.priority_description as string}</p></div></div>
              <Badge tone={levelTone[pr.priority_level as number] ?? 'neutral'}>P{pr.priority_level as number}</Badge>
            </div>
            {pr.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(pr.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Recommendations Section
// ============================================================
export function RecommendationsSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.recommendations.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No recommendations. Generate recommendations.</div>;
  const typeIcon = { immediate: Zap, short_term: Clock, long_term: TrendingUp, strategic: Target, investment: DollarSign, hiring: Users, market: Rocket, revenue: PieChart } as const;
  return (
    <div className="space-y-2">
      {cc.recommendations.map((r) => {
        const rec = r as Record<string, unknown>;
        const Icon = typeIcon[rec.recommendation_type as string] ?? Lightbulb;
        return (
          <Card key={rec.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><Icon className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{rec.recommendation_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{rec.recommendation_description as string}</p></div></div>
              <Badge tone={rec.priority as string === 'critical' ? 'error' : rec.priority as string === 'high' ? 'warning' : 'brand'}>{rec.priority as string}</Badge>
            </div>
            {(rec.estimated_value as number) > 0 && <p className="text-xs text-success-400 mt-1">Estimated value: ${(rec.estimated_value as number).toLocaleString()}</p>}
            {rec.expected_impact && <p className="text-xs text-ink-500 mt-0.5">{rec.expected_impact as string}</p>}
            {rec.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(rec.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Risks Section
// ============================================================
export function RisksSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.risks.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No risks detected. Run risk detection.</div>;
  const levelTone = { low: 'brand', medium: 'warning', high: 'warning', critical: 'error' } as const;
  return (
    <div className="space-y-2">
      {cc.risks.map((r) => {
        const risk = r as Record<string, unknown>;
        return (
          <Card key={risk.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-error-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{risk.risk_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{risk.risk_description as string}</p></div></div>
              <Badge tone={levelTone[risk.risk_level as string] ?? 'neutral'} dot>{risk.risk_level as string}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1">
              <span className="text-ink-500">Probability: <span className="text-ink-500">{risk.probability as number}%</span></span>
              <span className="text-ink-500">Impact: <span className="text-error-400">${(risk.impact as number).toLocaleString()}</span></span>
            </div>
            {risk.mitigation_strategy && <p className="text-xs text-brand-400 mt-1">Mitigation: {risk.mitigation_strategy as string}</p>}
            {risk.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(risk.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Opportunities Section
// ============================================================
export function OpportunitiesSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.opportunities.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No opportunities detected. Run growth detection.</div>;
  return (
    <div className="space-y-2">
      {cc.opportunities.map((o) => {
        const opp = o as Record<string, unknown>;
        return (
          <Card key={opp.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><Rocket className="h-4 w-4 text-success-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{opp.opportunity_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{opp.opportunity_description as string}</p></div></div>
              <Badge tone="success">{opp.opportunity_type as string}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1">
              <span className="text-ink-500">Value: <span className="text-success-400">${(opp.estimated_value as number).toLocaleString()}</span></span>
              <span className="text-ink-500">Probability: <span className="text-ink-500">{opp.probability as number}%</span></span>
              <span className="text-ink-500">Horizon: <span className="text-ink-500">{opp.time_horizon as string}</span></span>
            </div>
            {opp.ai_reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(opp.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Scenario Planning Section
// ============================================================
export function ScenarioPlanningSection({ cc, onSimulate, isSimulating }: { cc: CEOCommandCenter; onSimulate: (q: string) => void; isSimulating: boolean }) {
  const presets = [
    'What happens if we hire 5 SDRs?',
    'What if we increase pricing by 15%?',
    'What if churn increases 10%?',
    'What if close rate becomes 30%?',
    'What if CAC increases 20%?',
    'What if we expand to Europe?',
  ];
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <p className="text-sm font-medium text-ink-500 mb-2">Interactive Scenario Simulator</p>
        <p className="text-xs text-ink-500 mb-3">Ask me any what-if question and I'll estimate the business impact.</p>
        <div className="flex flex-wrap gap-2 mb-3">
          {presets.map((p) => (
            <button key={p} onClick={() => onSimulate(p)} disabled={isSimulating} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50">{p}</button>
          ))}
        </div>
      </Card>
      {cc.whatIfAnalyses.length > 0 && (
        <div className="space-y-2">
          {cc.whatIfAnalyses.slice(0, 5).map((w) => {
            const wa = w as Record<string, unknown>;
            return (
              <Card key={wa.id as string} className="p-3 space-y-2">
                <div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm font-medium text-ink-500">{wa.question as string}</p></div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">Baseline</span><p className="text-ink-500 font-medium">${(wa.baseline_metric as number).toLocaleString()}</p></div>
                  <div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">Projected</span><p className="text-success-400 font-medium">${(wa.projected_metric as number).toLocaleString()}</p></div>
                  <div className="rounded-lg bg-card-900 p-2"><span className="text-ink-500">Impact</span><p className={cn('font-medium', (wa.impact_delta as number) >= 0 ? 'text-success-400' : 'text-error-400')}>{(wa.impact_delta as number) >= 0 ? '+' : ''}${(wa.impact_delta as number).toLocaleString()}</p></div>
                </div>
                {wa.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(wa.ai_reasoning as string).slice(0, 200)}</span></div>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// OKRs Section
// ============================================================
export function OKRsSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.okrs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No OKRs defined.</div>;
  return (
    <div className="space-y-3">
      {cc.okrs.map((o) => {
        const okr = o as Record<string, unknown>;
        const krs = cc.keyResults.filter((kr) => (kr as Record<string, unknown>).okr_id === okr.id);
        return (
          <Card key={okr.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500">{okr.objective_text as string}</p><p className="text-xs text-ink-500">{okr.quarter as string} {okr.year as number}</p></div>
              <Badge tone={okr.status as string === 'active' ? 'brand' : okr.status as string === 'completed' ? 'success' : 'warning'}>{okr.status as string}</Badge>
            </div>
            <ProgressBar value={okr.progress_percent as number} label="Progress" format="percent" />
            {krs.length > 0 && (
              <div className="space-y-1 pt-1">
                {krs.map((kr) => {
                  const k = kr as Record<string, unknown>;
                  return <ProgressBar key={k.id as string} value={k.progress_percent as number} label={k.key_result_text as string} format="percent" />;
                })}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Board Reports Section
// ============================================================
export function BoardReportsSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.boardReports.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No board reports. Generate a report.</div>;
  const sections = ['revenue_summary', 'forecast_summary', 'pipeline_summary', 'profit_summary', 'customer_summary', 'risk_summary', 'opportunity_summary', 'strategic_summary'];
  return (
    <div className="space-y-3">
      {cc.boardReports.map((b) => {
        const br = b as Record<string, unknown>;
        return (
          <Card key={br.id as string} className="p-3 space-y-2">
            <div className="flex items-center justify-between"><p className="text-sm font-medium text-ink-500">{br.report_period as string}</p><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((br.ai_confidence as number) * 100)}%</Badge></div>
            {sections.map((s) => {
              const content = br[s] as string | null;
              if (!content) return null;
              return <div key={s}><p className="text-xs font-medium text-ink-500 capitalize">{s.replace(/_/g, ' ')}</p><p className="text-xs text-ink-500 mt-0.5">{content}</p></div>;
            })}
            {br.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(br.ai_reasoning as string).slice(0, 150)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// AI Decisions Section
// ============================================================
export function AIDecisionsSection({ cc }: { cc: CEOCommandCenter }) {
  if (cc.decisions.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No AI decisions yet.</div>;
  const statusTone = { recommended: 'brand', approved: 'success', rejected: 'error', executing: 'warning', completed: 'success', archived: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {cc.decisions.map((d) => {
        const dec = d as Record<string, unknown>;
        return (
          <Card key={dec.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><Award className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{dec.decision_title as string}</p><p className="text-xs text-ink-500 mt-0.5">{dec.decision_description as string}</p></div></div>
              <Badge tone={statusTone[dec.decision_status as string] ?? 'neutral'} dot>{dec.decision_status as string}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs mt-1">
              <span className="text-ink-500">Impact: <span className="text-ink-500">{dec.impact_level as string}</span></span>
              <span className="text-ink-500">Est: <span className="text-ink-500">${(dec.estimated_impact as number).toLocaleString()}</span></span>
              <Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((dec.confidence as number) * 100)}%</Badge>
            </div>
            {dec.reasoning && <div className="flex items-start gap-1.5 text-xs mt-1"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(dec.reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Executive Timeline Section
// ============================================================
export function ExecutiveTimelineSection({ cc }: { cc: CEOCommandCenter }) {
  const events: Array<{ time: string; title: string; type: string }> = [];
  cc.observations.slice(0, 5).forEach((o) => { const obs = o as Record<string, unknown>; events.push({ time: obs.detected_at as string, title: obs.observation_title as string, type: obs.observation_type as string }); });
  cc.predictions.slice(0, 5).forEach((p) => { const pred = p as Record<string, unknown>; events.push({ time: pred.created_at as string, title: pred.prediction_title as string, type: 'prediction' }); });
  cc.executiveBriefs.slice(0, 3).forEach((b) => { const br = b as Record<string, unknown>; events.push({ time: br.created_at as string, title: `Executive Brief — ${br.brief_date as string}`, type: 'brief' }); });
  events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
  if (events.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No timeline events yet.</div>;
  return (
    <div className="space-y-2">
      {events.slice(0, 15).map((e, i) => (
        <Card key={i} className="p-3 flex items-start gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-gold-400 to-gold-300/10 shrink-0"><Clock className="h-3.5 w-3.5 text-brand-400" /></div>
          <div className="flex-1"><p className="text-sm text-ink-500">{e.title}</p><p className="text-xs text-ink-500 mt-0.5">{timeAgo(e.time)} · {e.type}</p></div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Generic Intelligence Section
// ============================================================
export function IntelligenceSection({ title, items, icon: Icon }: { title: string; items: Array<Record<string, unknown>>; icon: typeof DollarSign }) {
  if (items.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No {title.toLowerCase()} data available.</div>;
  return (
    <div className="space-y-2">
      {items.slice(0, 15).map((item, i) => (
        <Card key={i} className="p-3 flex items-start gap-2">
          <Icon className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-ink-500">{(item.title ?? item.insight_title ?? item.metric_name ?? item.observation_title ?? 'Item') as string}</p>
            <p className="text-xs text-ink-500 mt-0.5">{((item.description ?? item.insight_text ?? item.observation_description ?? item.ai_reasoning ?? '') as string).slice(0, 120)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function CEOEmptyState({ onAnalyze, isAnalyzing }: { onAnalyze: () => void; isAnalyzing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Brain className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">AI CEO — Autonomous Company Operations</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">I am your AI CEO. I analyze every department — sales, marketing, pipeline, forecast, revenue, finance, customers, churn, meetings, proposals, growth, and competition — to generate strategic recommendations and autonomous decisions. Start by analyzing the company.</p>
      </div>
      <button onClick={onAnalyze} disabled={isAnalyzing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />{isAnalyzing ? 'Analyzing...' : 'Analyze Company'}
      </button>
    </div>
  );
}
