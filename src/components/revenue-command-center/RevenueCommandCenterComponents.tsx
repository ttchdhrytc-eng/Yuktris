import {
  TrendingUp, TrendingDown, DollarSign, Gauge, AlertTriangle,
  Brain, Zap, Target, Award, BarChart3, Activity, Bell,
  CheckCircle2, XCircle, Clock, FileText, Sparkles,
  ArrowRight, Lightbulb, Rocket, ShieldAlert, PieChart,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { RevenueCommandCenter } from '@/types/revenue-forecast';

// ============================================================
// KPI Card
// ============================================================
export function KPICard({ icon: Icon, label, value, trend, confidence, explanation }: {
  icon: typeof TrendingUp;
  label: string;
  value: string;
  trend?: 'up' | 'down' | 'neutral';
  confidence?: number;
  explanation?: string;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2"><Icon className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">{label}</span></div>
        {confidence !== undefined && <Badge tone="brand">{Math.round(confidence * 100)}%</Badge>}
      </div>
      <p className="text-2xl font-bold text-ink-500">{value}</p>
      <div className="flex items-center gap-1 mt-1">
        {trend === 'up' && <TrendingUp className="h-3.5 w-3.5 text-success-400" />}
        {trend === 'down' && <TrendingDown className="h-3.5 w-3.5 text-error-400" />}
        {explanation && <p className="text-xs text-ink-500 truncate">{explanation}</p>}
      </div>
    </Card>
  );
}

// ============================================================
// Score Bar
// ============================================================
function ScoreBar({ score, label }: { score: number; label?: string }) {
  const pct = Math.min(score, 100);
  const color = pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-ink-500 w-28 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ============================================================
// Deal Card
// ============================================================
export function DealCard({ deal }: { deal: RevenueCommandCenter['deals'][number] }) {
  const d = deal as Record<string, unknown>;
  const stageColors: Record<string, string> = {
    qualification: 'neutral', discovery: 'neutral', proposal: 'brand',
    negotiation: 'warning', closed_won: 'success',
  };
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Target className="h-4 w-4 text-brand-400" /></div>
          <div>
            <p className="text-sm font-medium text-ink-500">{d.deal_name as string}</p>
            <p className="text-xs text-ink-500">{d.company_name as string | null ?? '—'}</p>
          </div>
        </div>
        <Badge tone={(stageColors[d.current_stage as string] ?? 'neutral') as 'neutral' | 'brand' | 'warning' | 'success'} dot>{(d.current_stage as string).replace(/_/g, ' ')}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-500">Value: <span className="text-ink-500 font-medium">${(d.deal_value as number)?.toLocaleString()}</span></span>
        <span className="text-ink-500">Prob: <span className="text-ink-500 font-medium">{d.probability_to_close as number}%</span></span>
        <span className="text-ink-500">Health: <span className={cn('font-medium', (d.health_score as number) >= 70 ? 'text-success-400' : (d.health_score as number) >= 40 ? 'text-warning-400' : 'text-error-400')}>{d.health_score as number}</span></span>
      </div>
      {d.ai_reasoning && (
        <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{d.ai_reasoning as string}</span></div>
      )}
      {d.next_recommended_action && (
        <div className="flex items-center gap-1.5 text-xs pt-1 border-t border-gold-500/8"><Zap className="h-3.5 w-3.5 text-brand-400" /><span className="text-ink-500">{d.next_recommended_action as string}</span></div>
      )}
    </Card>
  );
}

// ============================================================
// Executive Overview Section
// ============================================================
export function ExecutiveOverviewSection({ cc, onSync, isSyncing, onForecast, onSummary }: {
  cc: RevenueCommandCenter;
  onSync: () => void;
  isSyncing: boolean;
  onForecast: () => void;
  onSummary: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={DollarSign} label="Total Pipeline" value={`$${cc.totalPipelineValue.toLocaleString()}`} confidence={0.8} explanation={`${cc.dealCount} deals`} />
        <KPICard icon={TrendingUp} label="Weighted Pipeline" value={`$${cc.weightedPipelineValue.toLocaleString()}`} confidence={0.75} explanation={`${Math.round(cc.avgProbability)}% avg prob`} />
        <KPICard icon={Gauge} label="Pipeline Health" value={cc.pipelineHealth ? `${cc.pipelineHealth.overall_health_score}/100` : '—'} trend={cc.pipelineHealth && cc.pipelineHealth.overall_health_score >= 70 ? 'up' : 'down'} explanation={cc.pipelineHealth?.bottleneck_stage ? `Bottleneck: ${cc.pipelineHealth.bottleneck_stage}` : undefined} />
        <KPICard icon={BarChart3} label="Forecast (Quarter)" value={cc.currentQuarterForecast ? `$${cc.currentQuarterForecast.expected_revenue.toLocaleString()}` : '—'} confidence={cc.currentQuarterForecast?.forecast_confidence} explanation={cc.currentQuarterForecast?.ai_reasoning?.slice(0, 60)} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Activity} label="MRR" value={cc.latestMRR ? `$${cc.latestMRR.total_mrr.toLocaleString()}` : '—'} trend={cc.latestMRR && cc.latestMRR.net_new_mrr > 0 ? 'up' : 'neutral'} explanation={cc.latestMRR ? `Net new: $${cc.latestMRR.net_new_mrr.toLocaleString()}` : undefined} />
        <KPICard icon={Rocket} label="ARR" value={cc.latestARR ? `$${cc.latestARR.total_arr.toLocaleString()}` : '—'} trend={cc.latestARR && cc.latestARR.net_new_arr > 0 ? 'up' : 'neutral'} />
        <KPICard icon={Award} label="Win Rate" value={cc.pipelineHealth ? `${cc.pipelineHealth.win_rate.toFixed(1)}%` : '—'} />
        <KPICard icon={AlertTriangle} label="At Risk" value={cc.pipelineHealth ? `${cc.pipelineHealth.at_risk_count}` : '—'} trend={cc.pipelineHealth && cc.pipelineHealth.at_risk_count > 0 ? 'down' : 'neutral'} explanation={cc.pipelineHealth ? `${cc.pipelineHealth.stale_deal_count} stale` : undefined} />
      </div>

      {/* AI Copilot banner */}
      {cc.latestBrief && (
        <div className="flex items-start gap-3 rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
          <Brain className="h-5 w-5 text-brand-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink-500">{cc.latestBrief.headline}</p>
            {cc.latestBrief.summary && <p className="text-sm text-ink-500 mt-1">{cc.latestBrief.summary}</p>}
            <div className="flex items-center gap-2 mt-2">
              <Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />AI Brief</Badge>
              <span className="text-xs text-ink-500">{timeAgo(cc.latestBrief.created_at)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
          <Zap className="h-3.5 w-3.5" />{isSyncing ? 'Syncing...' : 'Sync Pipeline'}
        </button>
        <button onClick={onForecast} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20">
          <TrendingUp className="h-3.5 w-3.5" />Generate Forecast
        </button>
        <button onClick={onSummary} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20">
          <FileText className="h-3.5 w-3.5" />Generate Executive Summary
        </button>
      </div>

      {/* Top deals */}
      {cc.deals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Target className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Top Deals</span></div>
          <div className="space-y-2">
            {cc.deals.slice(0, 5).map((d) => <DealCard key={(d as Record<string, string>).id} deal={d} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Pipeline Section
// ============================================================
export function PipelineSection({ cc }: { cc: RevenueCommandCenter }) {
  if (cc.deals.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No deals in pipeline. Sync from previous phases.</div>;
  const stages = cc.stages.length > 0 ? cc.stages : [
    { stage_name: 'qualification', stage_order: 1 },
    { stage_name: 'discovery', stage_order: 2 },
    { stage_name: 'proposal', stage_order: 3 },
    { stage_name: 'negotiation', stage_order: 4 },
    { stage_name: 'closed_won', stage_order: 5 },
  ] as RevenueCommandCenter['stages'];
  return (
    <div className="space-y-3">
      {stages.map((stage) => {
        const s = stage as Record<string, unknown>;
        const stageDeals = cc.deals.filter((d) => (d as Record<string, unknown>).current_stage === s.stage_name && !(d as Record<string, unknown>).is_closed);
        if (stageDeals.length === 0) return null;
        const stageValue = stageDeals.reduce((sum, d) => sum + ((d as Record<string, unknown>).deal_value as number), 0);
        return (
          <div key={s.id as string ?? (s.stage_name as string)}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-ink-500 capitalize">{(s.stage_name as string).replace(/_/g, ' ')}</span>
              <span className="text-xs text-ink-500">{stageDeals.length} deals · ${stageValue.toLocaleString()}</span>
            </div>
            <div className="space-y-2">{stageDeals.map((d) => <DealCard key={(d as Record<string, string>).id} deal={d} />)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ============================================================
// Pipeline Health Section
// ============================================================
export function PipelineHealthSection({ cc }: { cc: RevenueCommandCenter }) {
  if (!cc.pipelineHealth) return <div className="text-center py-8 text-sm text-ink-500">No health data. Run health calculation.</div>;
  const h = cc.pipelineHealth;
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Overall Health Score</span>
          <span className={cn('text-2xl font-bold', h.overall_health_score >= 70 ? 'text-success-400' : h.overall_health_score >= 40 ? 'text-warning-400' : 'text-error-400')}>{h.overall_health_score}/100</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-ink-500">Win Rate:</span> <span className="text-ink-500 font-medium">{h.win_rate.toFixed(1)}%</span></div>
          <div><span className="text-ink-500">Loss Rate:</span> <span className="text-ink-500 font-medium">{h.loss_rate.toFixed(1)}%</span></div>
          <div><span className="text-ink-500">Stale Deals:</span> <span className="text-warning-400 font-medium">{h.stale_deal_count}</span></div>
          <div><span className="text-ink-500">At Risk:</span> <span className="text-error-400 font-medium">{h.at_risk_count}</span></div>
          <div><span className="text-ink-500">Avg Days:</span> <span className="text-ink-500 font-medium">{h.avg_days_in_pipeline.toFixed(0)}</span></div>
          <div><span className="text-ink-500">Bottleneck:</span> <span className="text-ink-500 font-medium capitalize">{h.bottleneck_stage ?? '—'}</span></div>
        </div>
      </Card>

      {cc.leakage.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><ShieldAlert className="h-4 w-4 text-error-400" /><span className="text-sm font-medium text-ink-500">Pipeline Leakage ({cc.leakage.length})</span></div>
          <div className="space-y-2">
            {cc.leakage.map((l) => {
              const lk = l as Record<string, unknown>;
              return (
                <Card key={lk.id as string} className="p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-ink-500 capitalize">{(lk.leakage_type as string).replace(/_/g, ' ')}</p>
                      <p className="text-xs text-ink-500">{lk.leakage_description as string}</p>
                    </div>
                    <Badge tone={lk.risk_score as number > 60 ? 'error' : 'warning'}>Risk: {lk.risk_score as number}</Badge>
                  </div>
                  {lk.recommended_action && <div className="flex items-center gap-1.5 text-xs mt-1"><Zap className="h-3.5 w-3.5 text-brand-400" /><span className="text-ink-500">{lk.recommended_action as string}</span></div>}
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {Array.isArray(h.recommendations) && h.recommendations.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Lightbulb className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">AI Recommendations</span></div>
          <div className="space-y-1">
            {(h.recommendations as Array<Record<string, unknown>>).map((r, i) => (
              <div key={i} className="flex items-start gap-2 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" /><span className="text-ink-500">{r.action as string ?? r.toString()}</span></div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Forecast Section
// ============================================================
export function ForecastSection({ cc }: { cc: RevenueCommandCenter }) {
  const f = cc.currentQuarterForecast;
  if (!f) return <div className="text-center py-8 text-sm text-ink-500">No forecast generated yet.</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={TrendingUp} label="Expected Revenue" value={`$${f.expected_revenue.toLocaleString()}`} confidence={f.forecast_confidence} />
        <KPICard icon={DollarSign} label="Weighted Revenue" value={`$${f.weighted_revenue.toLocaleString()}`} />
        <KPICard icon={Rocket} label="Best Case" value={`$${f.best_case_revenue.toLocaleString()}`} trend="up" />
        <KPICard icon={ShieldAlert} label="Worst Case" value={`$${f.worst_case_revenue.toLocaleString()}`} trend="down" />
      </div>
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2"><Brain className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">AI Reasoning</span></div>
        <p className="text-sm text-ink-500">{f.ai_reasoning}</p>
        {Array.isArray(f.supporting_signals) && f.supporting_signals.length > 0 && (
          <div className="space-y-1">
            <span className="text-xs text-ink-500">Supporting Signals</span>
            {(f.supporting_signals as Array<Record<string, unknown>>).map((s, i) => (
              <div key={i} className="flex items-start gap-2 text-xs"><Sparkles className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{s.signal as string ?? s.toString()}</span></div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ============================================================
// MRR / ARR Section
// ============================================================
export function MRRSection({ cc }: { cc: RevenueCommandCenter }) {
  if (!cc.latestMRR) return <div className="text-center py-8 text-sm text-ink-500">No MRR data.</div>;
  const m = cc.latestMRR;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Activity} label="Total MRR" value={`$${m.total_mrr.toLocaleString()}`} trend={m.net_new_mrr > 0 ? 'up' : 'down'} />
        <KPICard icon={TrendingUp} label="New MRR" value={`$${m.new_mrr.toLocaleString()}`} trend="up" />
        <KPICard icon={Rocket} label="Expansion MRR" value={`$${m.expansion_mrr.toLocaleString()}`} trend="up" />
        <KPICard icon={TrendingDown} label="Churn MRR" value={`$${m.churn_mrr.toLocaleString()}`} trend="down" />
      </div>
      <Card className="p-4">
        <p className="text-sm text-ink-500">Net New MRR: <span className={cn('font-bold', m.net_new_mrr > 0 ? 'text-success-400' : 'text-error-400')}>${m.net_new_mrr.toLocaleString()}</span></p>
        <p className="text-xs text-ink-500 mt-1">As of {m.mrr_date}</p>
      </Card>
    </div>
  );
}

export function ARRSection({ cc }: { cc: RevenueCommandCenter }) {
  if (!cc.latestARR) return <div className="text-center py-8 text-sm text-ink-500">No ARR data.</div>;
  const a = cc.latestARR;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Rocket} label="Total ARR" value={`$${a.total_arr.toLocaleString()}`} trend={a.net_new_arr > 0 ? 'up' : 'down'} />
        <KPICard icon={TrendingUp} label="New ARR" value={`$${a.new_arr.toLocaleString()}`} trend="up" />
        <KPICard icon={Activity} label="Expansion ARR" value={`$${a.expansion_arr.toLocaleString()}`} trend="up" />
        <KPICard icon={TrendingDown} label="Churn ARR" value={`$${a.churn_arr.toLocaleString()}`} trend="down" />
      </div>
    </div>
  );
}

// ============================================================
// Cash Flow Section
// ============================================================
export function CashFlowSection({ cc }: { cc: RevenueCommandCenter }) {
  if (cc.cashflowProjections.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No cashflow projections.</div>;
  return (
    <div className="space-y-2">
      {cc.cashflowProjections.map((c) => {
        const cf = c as Record<string, unknown>;
        return (
          <Card key={cf.id as string} className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-ink-500">{cf.projection_date as string}</span>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-success-400">In: ${(cf.expected_inflow as number).toLocaleString()}</span>
                <span className="text-error-400">Out: ${(cf.expected_outflow as number).toLocaleString()}</span>
                <span className={cn('font-medium', (cf.net_cashflow as number) >= 0 ? 'text-success-400' : 'text-error-400')}>Net: ${(cf.net_cashflow as number).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Performance Sections
// ============================================================
export function PerformanceTable({ data, title, columns }: {
  data: Array<Record<string, unknown>>;
  title: string;
  columns: Array<{ key: string; label: string; format?: (v: unknown) => string }>;
}) {
  if (data.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No {title.toLowerCase()} data.</div>;
  return (
    <Card className="p-4">
      <p className="text-sm font-medium text-ink-500 mb-3">{title}</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead><tr className="border-b border-gold-500/8">{columns.map((c) => <th key={c.key} className="text-left py-2 px-2 text-ink-500 font-medium">{c.label}</th>)}</tr></thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={i} className="border-b border-gold-500/8/50">
                {columns.map((c) => <td key={c.key} className="py-2 px-2 text-ink-500">{c.format ? c.format(row[c.key]) : String(row[c.key] ?? '—')}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// AI Insights Section
// ============================================================
export function InsightsSection({ cc }: { cc: RevenueCommandCenter }) {
  if (cc.insights.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No insights generated yet.</div>;
  const sevTone = { info: 'neutral', low: 'neutral', medium: 'warning', high: 'warning', critical: 'error' } as const;
  return (
    <div className="space-y-2">
      {cc.insights.map((ins) => {
        const i = ins as Record<string, unknown>;
        return (
          <Card key={i.id as string} className={cn('p-3', !i.is_read && 'border-brand-500/20')}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{i.insight_title as string}</p><p className="text-xs text-ink-500">{i.insight_text as string}</p></div></div>
              <Badge tone={sevTone[i.severity as string] ?? 'neutral'}>{i.severity as string}</Badge>
            </div>
            <div className="flex items-center gap-2 mt-1"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((i.confidence as number) * 100)}%</Badge><span className="text-xs text-ink-500 capitalize">{i.insight_type as string}</span></div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Revenue Alerts Section
// ============================================================
export function AlertsSection({ cc }: { cc: RevenueCommandCenter }) {
  if (cc.alerts.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No alerts.</div>;
  const sevTone = { low: 'neutral', medium: 'warning', high: 'warning', critical: 'error' } as const;
  return (
    <div className="space-y-2">
      {cc.alerts.map((a) => {
        const al = a as Record<string, unknown>;
        return (
          <Card key={al.id as string} className={cn('p-3', !al.is_read && 'border-brand-500/20')}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2"><Bell className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm font-medium text-ink-500">{al.alert_title as string}</p><p className="text-xs text-ink-500">{al.alert_message as string}</p></div></div>
              <Badge tone={sevTone[al.severity as string] ?? 'neutral'}>{al.severity as string}</Badge>
            </div>
            <p className="text-xs text-ink-500 mt-1">{timeAgo(al.created_at as string)}</p>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Executive Brief Section
// ============================================================
export function ExecutiveBriefSection({ cc }: { cc: RevenueCommandCenter }) {
  if (!cc.latestBrief) return <div className="text-center py-8 text-sm text-ink-500">No executive brief generated yet.</div>;
  const b = cc.latestBrief;
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2"><Brain className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">{b.headline}</span></div>
        {b.summary && <p className="text-sm text-ink-500">{b.summary}</p>}
        <div className="flex items-center gap-2 mt-2"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />AI Brief</Badge><span className="text-xs text-ink-500">{timeAgo(b.created_at)}</span></div>
      </Card>
      {Array.isArray(b.key_points) && b.key_points.length > 0 && (
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-2 block">Key Points</span>
          <div className="space-y-1">{(b.key_points as Array<Record<string, unknown>>).map((p, i) => <div key={i} className="flex items-start gap-2 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" /><span className="text-ink-500">{p.point as string ?? p.toString()}</span></div>)}</div>
        </Card>
      )}
      {Array.isArray(b.action_items) && b.action_items.length > 0 && (
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-2 block">Action Items</span>
          <div className="space-y-1">{(b.action_items as Array<Record<string, unknown>>).map((a, i) => <div key={i} className="flex items-start gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{a.action as string ?? a.toString()}</span></div>)}</div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Board Report Section
// ============================================================
export function BoardReportSection({ cc }: { cc: RevenueCommandCenter }) {
  if (!cc.latestSummary) return <div className="text-center py-8 text-sm text-ink-500">No board report generated yet.</div>;
  const s = cc.latestSummary;
  return (
    <div className="space-y-3">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">{s.summary_type} Executive Summary</span></div>
        <p className="text-sm text-ink-500">{s.summary_text}</p>
        <div className="flex items-center gap-2 mt-2"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />AI Generated</Badge><span className="text-xs text-ink-500">{Math.round(s.ai_confidence * 100)}% confidence</span></div>
      </Card>
      {Array.isArray(s.highlights) && s.highlights.length > 0 && (
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-2 block">Highlights</span>
          <div className="space-y-1">{(s.highlights as Array<Record<string, unknown>>).map((h, i) => <div key={i} className="flex items-start gap-2 text-xs"><TrendingUp className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" /><span className="text-ink-500">{h.point as string ?? h.toString()}</span></div>)}</div>
        </Card>
      )}
      {Array.isArray(s.risks) && s.risks.length > 0 && (
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-2 block">Risks</span>
          <div className="space-y-1">{(s.risks as Array<Record<string, unknown>>).map((r, i) => <div key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className="h-3.5 w-3.5 text-warning-400 shrink-0 mt-0.5" /><span className="text-ink-500">{r.risk as string ?? r.toString()}</span></div>)}</div>
        </Card>
      )}
      {Array.isArray(s.recommendations) && s.recommendations.length > 0 && (
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-2 block">Recommendations</span>
          <div className="space-y-1">{(s.recommendations as Array<Record<string, unknown>>).map((r, i) => <div key={i} className="flex items-start gap-2 text-xs"><Zap className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{r.action as string ?? r.toString()}</span></div>)}</div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Forecast History Section
// ============================================================
export function ForecastHistorySection({ cc }: { cc: RevenueCommandCenter }) {
  if (cc.forecastHistory.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No forecast history.</div>;
  return (
    <div className="space-y-2">
      {cc.forecastHistory.map((h) => {
        const fh = h as Record<string, unknown>;
        return (
          <Card key={fh.id as string} className="p-3">
            <div className="flex items-center justify-between">
              <div><span className="text-sm text-ink-500">{fh.snapshot_date as string}</span><span className="text-xs text-ink-500 ml-2 capitalize">{fh.forecast_type as string}</span></div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-ink-500">Expected: ${(fh.expected_revenue as number ?? 0).toLocaleString()}</span>
                <span className="text-ink-500">Weighted: ${(fh.weighted_revenue as number ?? 0).toLocaleString()}</span>
                {fh.actual_revenue !== null && <Badge tone={(fh.actual_revenue as number) >= (fh.expected_revenue as number) ? 'success' : 'error'}>Actual: ${(fh.actual_revenue as number).toLocaleString()}</Badge>}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Forecast Accuracy Section
// ============================================================
export function ForecastAccuracySection({ cc }: { cc: RevenueCommandCenter }) {
  if (cc.forecastAccuracy.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No accuracy data.</div>;
  return (
    <div className="space-y-2">
      {cc.forecastAccuracy.map((a) => {
        const fa = a as Record<string, unknown>;
        return (
          <Card key={fa.id as string} className="p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-ink-500">{fa.period_start as string} — {fa.period_end as string}</span>
              <Badge tone={fa.bias === 'accurate' ? 'success' : fa.bias === 'over_forecast' ? 'warning' : 'error'}>{fa.bias as string ?? '—'}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-ink-500">Forecast: ${(fa.forecasted_revenue as number ?? 0).toLocaleString()}</span>
              <span className="text-ink-500">Actual: ${(fa.actual_revenue as number ?? 0).toLocaleString()}</span>
              <span className="text-ink-500">Variance: {fa.variance_percentage as number ?? 0}%</span>
              <span className="text-ink-500">Accuracy: {fa.accuracy_score as number ?? 0}%</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Revenue Trends Section
// ============================================================
export function RevenueTrendsSection({ cc }: { cc: RevenueCommandCenter }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={TrendingUp} label="Pipeline Value" value={`$${cc.totalPipelineValue.toLocaleString()}`} />
        <KPICard icon={DollarSign} label="Avg Deal Size" value={`$${cc.avgDealSize.toLocaleString()}`} />
        <KPICard icon={Gauge} label="Avg Probability" value={`${Math.round(cc.avgProbability)}%`} />
        <KPICard icon={Activity} label="Deal Count" value={`${cc.dealCount}`} />
      </div>
      {cc.forecastHistory.length > 0 && (
        <Card className="p-4">
          <span className="text-sm font-medium text-ink-500 mb-3 block">Forecast Trend</span>
          <div className="space-y-1">
            {cc.forecastHistory.slice(0, 10).map((h) => {
              const fh = h as Record<string, unknown>;
              const pct = cc.totalPipelineValue > 0 ? Math.min(((fh.expected_revenue as number) / cc.totalPipelineValue) * 100, 100) : 0;
              return (
                <div key={fh.id as string} className="flex items-center gap-2">
                  <span className="text-xs text-ink-500 w-20">{fh.snapshot_date as string}</span>
                  <div className="h-2 flex-1 rounded-full bg-card-900 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-ink-500 w-20 text-right">${(fh.expected_revenue as number ?? 0).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function CommandCenterEmpty({ onSync, isSyncing }: { onSync: () => void; isSyncing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><PieChart className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Revenue Command Center</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI Revenue Brain predicts revenue, identifies risks, recommends actions, and continuously optimizes the sales pipeline. Sync from previous phases to begin.</p>
      </div>
      <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />{isSyncing ? 'Syncing...' : 'Sync Pipeline'}
      </button>
    </div>
  );
}
