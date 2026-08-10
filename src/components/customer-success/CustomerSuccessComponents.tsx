import {
  Heart, ShieldAlert, TrendingUp, TrendingDown, Users, Rocket,
  Award, Bell, FileText, Sparkles, Brain, Zap, Target,
  CheckCircle2, Clock, AlertTriangle, Lightbulb,
  ArrowRight, Star, Gift, BookOpen, UserCheck, DollarSign,
  Activity, Gauge, PieChart, Mail, Calendar,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { CustomerSuccessCommandCenter } from '@/types/customer-success';

// ============================================================
// KPI Card
// ============================================================
export function KPICard({ icon: Icon, label, value, trend, confidence, explanation }: {
  icon: typeof Heart;
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
      {label && <span className="text-xs text-ink-500 w-32 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ============================================================
// Customer Account Card
// ============================================================
export function AccountCard({ account, onHealth, onChurn, onExpansion }: {
  account: CustomerSuccessCommandCenter['accounts'][number];
  onHealth?: () => void;
  onChurn?: () => void;
  onExpansion?: () => void;
}) {
  const a = account as Record<string, unknown>;
  const healthScore = a.health_score as number;
  const churnRisk = a.churn_risk_score as number;
  const healthColor = healthScore >= 70 ? 'success' : healthScore >= 40 ? 'warning' : 'error';
  const statusColors: Record<string, string> = { active: 'success', onboarding: 'brand', at_risk: 'error', churned: 'neutral', paused: 'neutral', trial: 'brand' };
  return (
    <Card className="p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Users className="h-4 w-4 text-brand-400" /></div>
          <div>
            <p className="text-sm font-medium text-ink-500">{a.account_name as string}</p>
            <p className="text-xs text-ink-500">{a.industry as string | null ?? '—'} · {a.account_tier as string}</p>
          </div>
        </div>
        <Badge tone={(statusColors[a.account_status as string] ?? 'neutral') as 'success' | 'brand' | 'error' | 'neutral'} dot>{a.account_status as string}</Badge>
      </div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-ink-500">ARR: <span className="text-ink-500 font-medium">${(a.arr as number).toLocaleString()}</span></span>
        <span className="text-ink-500">MRR: <span className="text-ink-500 font-medium">${(a.mrr as number).toLocaleString()}</span></span>
      </div>
      <div className="space-y-1">
        <ScoreBar score={healthScore} label="Health" />
        <ScoreBar score={churnRisk} label="Churn Risk" />
        <ScoreBar score={a.expansion_score as number} label="Expansion" />
      </div>
      {a.ai_reasoning && (
        <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(a.ai_reasoning as string).slice(0, 120)}</span></div>
      )}
      <div className="flex items-center gap-1.5 pt-1 border-t border-gold-500/8">
        {onHealth && <button onClick={onHealth} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"><Heart className="h-3 w-3" />Health</button>}
        {onChurn && <button onClick={onChurn} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"><ShieldAlert className="h-3 w-3" />Churn</button>}
        {onExpansion && <button onClick={onExpansion} className="flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300"><Rocket className="h-3 w-3" />Expand</button>}
      </div>
    </Card>
  );
}

// ============================================================
// Executive Overview Section
// ============================================================
export function ExecutiveOverviewSection({ cc, onSync, isSyncing, onInsights }: {
  cc: CustomerSuccessCommandCenter;
  onSync: () => void;
  isSyncing: boolean;
  onInsights: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Users} label="Total Customers" value={`${cc.totalAccounts}`} explanation={`${cc.healthyAccounts} healthy`} />
        <KPICard icon={Heart} label="Avg Health" value={`${Math.round(cc.avgHealthScore)}/100`} trend={cc.avgHealthScore >= 70 ? 'up' : 'down'} />
        <KPICard icon={DollarSign} label="Total ARR" value={`$${cc.totalARR.toLocaleString()}`} trend="up" />
        <KPICard icon={ShieldAlert} label="At Risk" value={`${cc.atRiskAccounts}`} trend={cc.atRiskAccounts > 0 ? 'down' : 'neutral'} explanation={`${cc.churnedAccounts} churned`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Activity} label="Total MRR" value={`$${cc.totalMRR.toLocaleString()}`} />
        <KPICard icon={Rocket} label="Expansion Value" value={`$${cc.totalExpansionValue.toLocaleString()}`} trend="up" />
        <KPICard icon={Calendar} label="Upcoming Renewals" value={`${cc.upcomingRenewals}`} explanation={`$${cc.atRiskRenewalValue.toLocaleString()} at risk`} />
        <KPICard icon={Gift} label="Referral Value" value={`$${cc.totalReferralValue.toLocaleString()}`} trend="up" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
          <Zap className="h-3.5 w-3.5" />{isSyncing ? 'Syncing...' : 'Sync Customers'}
        </button>
        <button onClick={onInsights} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20">
          <Sparkles className="h-3.5 w-3.5" />Generate Insights
        </button>
      </div>

      {cc.accounts.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Heart className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Customers Needing Attention</span></div>
          <div className="space-y-2">
            {cc.accounts.filter((a) => (a as Record<string, unknown>).health_score as number < 60).slice(0, 5).map((a) => <AccountCard key={(a as Record<string, string>).id} account={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Customer Health Section
// ============================================================
export function CustomerHealthSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.healthRecords.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No health records. Run health calculation.</div>;
  return (
    <div className="space-y-2">
      {cc.healthRecords.map((h) => {
        const hr = h as Record<string, unknown>;
        return (
          <Card key={hr.id as string} className="p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-ink-500">{hr.health_date as string}</span>
              <Badge tone={(hr.overall_health_score as number) >= 70 ? 'success' : (hr.overall_health_score as number) >= 40 ? 'warning' : 'error'}>{hr.overall_health_score as number}/100</Badge>
            </div>
            <div className="space-y-1">
              <ScoreBar score={hr.relationship_score as number} label="Relationship" />
              <ScoreBar score={hr.engagement_score as number} label="Engagement" />
              <ScoreBar score={hr.product_adoption_score as number} label="Adoption" />
              <ScoreBar score={hr.communication_score as number} label="Communication" />
              <ScoreBar score={hr.customer_satisfaction_score as number} label="Satisfaction" />
              <ScoreBar score={hr.churn_probability as number} label="Churn Prob" />
            </div>
            {hr.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(hr.ai_reasoning as string).slice(0, 150)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Customer Journey Section
// ============================================================
export function CustomerJourneySection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.journey.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No journey data.</div>;
  return (
    <div className="space-y-2">
      {cc.journey.map((j) => {
        const jr = j as Record<string, unknown>;
        return (
          <Card key={jr.id as string} className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><PieChart className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500 capitalize">{(jr.journey_stage as string).replace(/_/g, ' ')}</span></div>
              {jr.milestone_achieved && <Badge tone="success"><CheckCircle2 className="h-3 w-3 mr-1" />Milestone</Badge>}
            </div>
            <p className="text-xs text-ink-500 mt-1">Entered: {timeAgo(jr.stage_entered_at as string)}{jr.duration_days ? ` · ${jr.duration_days} days` : ''}</p>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Onboarding Section
// ============================================================
export function OnboardingSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.onboardingProjects.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No onboarding projects.</div>;
  return (
    <div className="space-y-3">
      {cc.onboardingProjects.map((p) => {
        const proj = p as Record<string, unknown>;
        const statusTone = { planned: 'neutral', in_progress: 'brand', completed: 'success', delayed: 'warning', at_risk: 'error', cancelled: 'neutral' } as const;
        return (
          <Card key={proj.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500">{proj.project_name as string}</p><p className="text-xs text-ink-500">Owner: {proj.onboarding_owner as string | null ?? 'Unassigned'}</p></div>
              <Badge tone={statusTone[proj.project_status as string] ?? 'neutral'} dot>{(proj.project_status as string).replace(/_/g, ' ')}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 rounded-full bg-card-900 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300" style={{ width: `${proj.progress_percentage as number}%` }} /></div>
              <span className="text-xs text-ink-500">{proj.progress_percentage as number}%</span>
            </div>
            {proj.target_completion_date && <p className="text-xs text-ink-500">Target: {proj.target_completion_date as string}</p>}
            {proj.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(proj.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Renewals Section
// ============================================================
export function RenewalsSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.renewals.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No renewals in pipeline.</div>;
  const healthTone = { healthy: 'success', watch: 'brand', at_risk: 'warning', critical: 'error' } as const;
  return (
    <div className="space-y-2">
      {cc.renewals.map((r) => {
        const rn = r as Record<string, unknown>;
        return (
          <Card key={rn.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500">Renewal: {rn.renewal_date as string}</p><p className="text-xs text-ink-500">Value: ${(rn.renewal_value as number).toLocaleString()} · Prob: {rn.renewal_probability as number}%</p></div>
              <Badge tone={healthTone[rn.renewal_health as string] ?? 'neutral'} dot>{rn.renewal_health as string}</Badge>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-ink-500">Days to renewal: <span className="text-ink-500 font-medium">{rn.days_to_renewal as number | null ?? '—'}</span></span>
              <span className="text-ink-500">Status: <span className="text-ink-500 capitalize">{(rn.renewal_status as string).replace(/_/g, ' ')}</span></span>
            </div>
            {rn.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(rn.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Expansion Section
// ============================================================
export function ExpansionSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.expansionOpportunities.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No expansion opportunities detected.</div>;
  return (
    <div className="space-y-2">
      {cc.expansionOpportunities.map((e) => {
        const ex = e as Record<string, unknown>;
        return (
          <Card key={ex.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500">{ex.opportunity_name as string}</p><p className="text-xs text-ink-500 capitalize">{(ex.expansion_type as string).replace(/_/g, ' ')} · ${(ex.estimated_value as number).toLocaleString()}</p></div>
              <Badge tone="brand">{ex.probability as number}%</Badge>
            </div>
            {ex.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(ex.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Upsell Section
// ============================================================
export function UpsellSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.upsellOpportunities.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No upsell opportunities.</div>;
  return (
    <div className="space-y-2">
      {cc.upsellOpportunities.map((u) => {
        const up = u as Record<string, unknown>;
        return (
          <Card key={up.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500">{up.opportunity_name as string}</p><p className="text-xs text-ink-500">{up.current_product as string | null ?? '—'} → {up.upsell_product as string | null ?? '—'} · ${(up.estimated_value as number).toLocaleString()}</p></div>
              <Badge tone="brand">{up.probability as number}%</Badge>
            </div>
            {up.ai_reasoning && <p className="text-xs text-ink-500 mt-1">{(up.ai_reasoning as string).slice(0, 120)}</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Cross Sell Section
// ============================================================
export function CrossSellSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.crossSellOpportunities.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No cross-sell opportunities.</div>;
  return (
    <div className="space-y-2">
      {cc.crossSellOpportunities.map((c) => {
        const cs = c as Record<string, unknown>;
        return (
          <Card key={cs.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500">{cs.opportunity_name as string}</p><p className="text-xs text-ink-500">{cs.original_product as string | null ?? '—'} + {cs.cross_sell_product as string | null ?? '—'} · ${(cs.estimated_value as number).toLocaleString()}</p></div>
              <Badge tone="brand">{cs.probability as number}%</Badge>
            </div>
            {cs.ai_reasoning && <p className="text-xs text-ink-500 mt-1">{(cs.ai_reasoning as string).slice(0, 120)}</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Churn Prediction Section
// ============================================================
export function ChurnPredictionSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.churnPredictions.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No churn predictions. Run churn analysis.</div>;
  const riskTone = { low: 'success', medium: 'brand', high: 'warning', critical: 'error' } as const;
  return (
    <div className="space-y-2">
      {cc.churnPredictions.map((p) => {
        const pr = p as Record<string, unknown>;
        return (
          <Card key={pr.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-ink-500">{pr.prediction_date as string}</span>
              <Badge tone={riskTone[pr.churn_risk_level as string] ?? 'neutral'} dot>{pr.churn_risk_level as string}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
              <div><span className="text-ink-500">30d:</span> <span className="text-ink-500 font-medium">{Math.round((pr.churn_probability_30d as number) * 100)}%</span></div>
              <div><span className="text-ink-500">60d:</span> <span className="text-ink-500 font-medium">{Math.round((pr.churn_probability_60d as number) * 100)}%</span></div>
              <div><span className="text-ink-500">90d:</span> <span className="text-ink-500 font-medium">{Math.round((pr.churn_probability_90d as number) * 100)}%</span></div>
              <div><span className="text-ink-500">Annual:</span> <span className="text-ink-500 font-medium">{Math.round((pr.churn_probability_annual as number) * 100)}%</span></div>
            </div>
            {pr.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(pr.ai_reasoning as string).slice(0, 150)}</span></div>}
            {pr.mitigation_plan && <div className="flex items-start gap-1.5 text-xs pt-1 border-t border-gold-500/8"><ShieldAlert className="h-3.5 w-3.5 text-warning-400 shrink-0 mt-0.5" /><span className="text-ink-500">{pr.mitigation_plan as string}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Executive Reviews Section
// ============================================================
export function ExecutiveReviewsSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.executiveReviews.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No executive reviews generated.</div>;
  return (
    <div className="space-y-2">
      {cc.executiveReviews.map((r) => {
        const rv = r as Record<string, unknown>;
        return (
          <Card key={rv.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><FileText className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{rv.review_type as string} — {rv.review_date as string}</p></div></div>
              <Badge tone={rv.ai_generated ? 'brand' : 'neutral'}>{rv.ai_generated ? 'AI' : 'Manual'}</Badge>
            </div>
            {rv.executive_summary && <p className="text-sm text-ink-500">{(rv.executive_summary as string).slice(0, 200)}</p>}
            {rv.value_delivered && <div className="flex items-start gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" /><span className="text-ink-500">{rv.value_delivered as string}</span></div>}
            <div className="flex items-center gap-2"><Badge tone="brand"><Sparkles className="h-3 w-3 mr-1" />{Math.round((rv.ai_confidence as number) * 100)}%</Badge><span className="text-xs text-ink-500">{timeAgo(rv.created_at as string)}</span></div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Success Plans Section
// ============================================================
export function SuccessPlansSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.successPlans.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No success plans generated.</div>;
  return (
    <div className="space-y-2">
      {cc.successPlans.map((p) => {
        const pl = p as Record<string, unknown>;
        return (
          <Card key={pl.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <span className="text-sm font-medium text-ink-500 capitalize">{pl.plan_type as string} Plan</span>
              <Badge tone={pl.ai_generated ? 'brand' : 'neutral'}>{pl.ai_generated ? 'AI' : 'Manual'}</Badge>
            </div>
            {pl.plan_summary && <p className="text-sm text-ink-500">{(pl.plan_summary as string).slice(0, 200)}</p>}
            {pl.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(pl.ai_reasoning as string).slice(0, 150)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Case Studies Section
// ============================================================
export function CaseStudiesSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.caseStudies.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No case studies generated.</div>;
  return (
    <div className="space-y-2">
      {cc.caseStudies.map((c) => {
        const cs = c as Record<string, unknown>;
        return (
          <Card key={cs.id as string} className="p-3 space-y-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><BookOpen className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">{cs.case_study_title as string}</p></div>
              <Badge tone={cs.ai_generated ? 'brand' : 'neutral'}>{cs.ai_generated ? 'AI' : 'Manual'}</Badge>
            </div>
            {cs.case_study_summary && <p className="text-sm text-ink-500">{(cs.case_study_summary as string).slice(0, 200)}</p>}
            {cs.ai_reasoning && <div className="flex items-start gap-1.5 text-xs"><Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><span className="text-ink-500">{(cs.ai_reasoning as string).slice(0, 120)}</span></div>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Referrals Section
// ============================================================
export function ReferralsSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.referrals.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No referral opportunities.</div>;
  return (
    <div className="space-y-2">
      {cc.referrals.map((r) => {
        const rf = r as Record<string, unknown>;
        return (
          <Card key={rf.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{rf.referral_target_company as string | null ?? 'Referral Opportunity'}</p><p className="text-xs text-ink-500">{rf.referral_target_contact as string | null ?? '—'} · ${(rf.referral_value as number).toLocaleString()}</p></div></div>
              <Badge tone="brand">{rf.referral_probability as number}%</Badge>
            </div>
            {rf.ai_reasoning && <p className="text-xs text-ink-500 mt-1">{(rf.ai_reasoning as string).slice(0, 120)}</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Champions Section
// ============================================================
export function ChampionsSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.champions.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No champions identified.</div>;
  return (
    <div className="space-y-2">
      {cc.champions.map((c) => {
        const ch = c as Record<string, unknown>;
        return (
          <Card key={ch.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Star className="h-4 w-4 text-warning-400" /><div><p className="text-sm font-medium text-ink-500">{ch.champion_name as string}</p><p className="text-xs text-ink-500">{ch.champion_title as string | null ?? '—'} · {ch.advocacy_type as string}</p></div></div>
              <Badge tone={ch.champion_score as number >= 75 ? 'success' : 'brand'}>Score: {ch.champion_score as number}</Badge>
            </div>
            {ch.ai_reasoning && <p className="text-xs text-ink-500 mt-1">{(ch.ai_reasoning as string).slice(0, 120)}</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Customer Feedback Section
// ============================================================
export function FeedbackSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.feedback.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No customer feedback.</div>;
  const sentimentTone = { positive: 'success', neutral: 'neutral', negative: 'error' } as const;
  return (
    <div className="space-y-2">
      {cc.feedback.map((f) => {
        const fb = f as Record<string, unknown>;
        return (
          <Card key={fb.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div><p className="text-sm font-medium text-ink-500 capitalize">{fb.feedback_type as string}</p>{fb.feedback_text && <p className="text-xs text-ink-500 mt-1">{(fb.feedback_text as string).slice(0, 150)}</p>}</div>
              <Badge tone={sentimentTone[fb.sentiment as string] ?? 'neutral'}>{fb.sentiment as string}</Badge>
            </div>
            {fb.feedback_score !== null && <p className="text-xs text-ink-500 mt-1">Score: {fb.feedback_score as number}/10</p>}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Customer Timeline Section
// ============================================================
export function TimelineSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  if (cc.engagement.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No engagement activity.</div>;
  return (
    <div className="space-y-2">
      {cc.engagement.map((e) => {
        const en = e as Record<string, unknown>;
        return (
          <Card key={en.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500 capitalize">{(en.engagement_type as string).replace(/_/g, ' ')}</p>{en.engagement_summary && <p className="text-xs text-ink-500 mt-1">{en.engagement_summary as string}</p>}</div></div>
              <div className="flex items-center gap-2"><Badge tone={en.sentiment === 'positive' ? 'success' : en.sentiment === 'negative' ? 'error' : 'neutral'}>{en.sentiment as string}</Badge><span className="text-xs text-ink-500">{timeAgo(en.engagement_date as string)}</span></div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Revenue Expansion Section
// ============================================================
export function RevenueExpansionSection({ cc }: { cc: CustomerSuccessCommandCenter }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard icon={Rocket} label="Expansion Value" value={`$${cc.totalExpansionValue.toLocaleString()}`} trend="up" />
        <KPICard icon={TrendingUp} label="Upsell Opps" value={`${cc.upsellOpportunities.length}`} />
        <KPICard icon={ArrowRight} label="Cross-Sell Opps" value={`${cc.crossSellOpportunities.length}`} />
        <KPICard icon={Gift} label="Referral Value" value={`$${cc.totalReferralValue.toLocaleString()}`} trend="up" />
      </div>
      <Card className="p-4">
        <p className="text-sm font-medium text-ink-500 mb-2">Expansion Score Distribution</p>
        <div className="space-y-1">
          {cc.expansionScores.slice(0, 10).map((s) => {
            const sc = s as Record<string, unknown>;
            return <ScoreBar key={sc.id as string} score={sc.overall_expansion_score as number} label={sc.score_date as string} />;
          })}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function CommandCenterEmpty({ onSync, isSyncing }: { onSync: () => void; isSyncing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Heart className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Customer Success Command Center</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI Customer Success Brain manages the complete customer lifecycle — health, churn prediction, renewals, expansion, and advocacy. Sync from closed-won deals to begin.</p>
      </div>
      <button onClick={onSync} disabled={isSyncing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />{isSyncing ? 'Syncing...' : 'Sync Customers'}
      </button>
    </div>
  );
}
