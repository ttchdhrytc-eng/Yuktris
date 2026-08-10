import {
  FileText, Sparkles, Zap, TrendingUp, Gauge, Star, Send,
  CheckCircle2, XCircle, AlertTriangle, Clock, Brain, Target,
  Package, DollarSign, Calendar, Users, Shield, Award,
  ArrowRight, Lightbulb, BarChart3, Bell, FileCheck, Swords,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type {
  ProposalIntelligenceDashboard, ProposalWithIntelligence,
  ProposalRequest,
} from '@/types/proposal-intelligence';

// ============================================================
// AI Badge
// ============================================================
export function PIAIBadge({ confidence }: { confidence?: number }) {
  return <Badge tone="brand" className="gap-1"><Sparkles className="h-3 w-3" />AI{confidence ? ` · ${Math.round(confidence * 100)}%` : ''}</Badge>;
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
// Status Badge
// ============================================================
const STATUS_TONE: Record<string, 'neutral' | 'brand' | 'warning' | 'success' | 'error'> = {
  draft: 'neutral', generating: 'brand', review: 'warning', approved: 'success',
  sent: 'brand', viewed: 'brand', negotiating: 'warning', accepted: 'success',
  rejected: 'error', expired: 'neutral', withdrawn: 'neutral', revised: 'brand',
};

export function ProposalStatusBadge({ status }: { status: string }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>{status.replace(/_/g, ' ')}</Badge>;
}

// ============================================================
// Dashboard Section
// ============================================================
export function PIDashboardSection({ dashboard, onDetect, isDetecting }: {
  dashboard: ProposalIntelligenceDashboard;
  onDetect: () => void;
  isDetecting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><FileText className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Total Proposals</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalProposals}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-warning-500" /><span className="text-xs text-ink-500">Awaiting Approval</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.awaitingApproval}</p>
          <p className="text-xs text-ink-500">{dashboard.sent} sent · {dashboard.viewed} viewed</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Gauge className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Avg Win Prob</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.avgWinProbability}%</p>
          <p className="text-xs text-ink-500">{dashboard.negotiating} negotiating</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-success-400" /><span className="text-xs text-ink-500">Forecast Rev</span></div>
          <p className="text-2xl font-bold text-ink-500">${dashboard.forecastRevenue.toLocaleString()}</p>
          <p className="text-xs text-ink-500">{dashboard.accepted} accepted · {dashboard.rejected} rejected</p>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Brain className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-medium text-ink-500">Proposal Intelligence Engine</p>
            <p className="text-xs text-ink-500">{dashboard.pendingRequests.length} pending requests · {dashboard.awaitingApproval} awaiting approval</p>
          </div>
        </div>
        <button onClick={onDetect} disabled={isDetecting} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
          <Zap className="h-4 w-4" />
          {isDetecting ? 'Detecting...' : 'Detect Readiness'}
        </button>
      </div>

      {dashboard.topProposals.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Star className="h-4 w-4 text-warning-500" /><span className="text-sm font-medium text-ink-500">Top Proposals by Score</span></div>
          <div className="space-y-2">
            {dashboard.topProposals.slice(0, 5).map((p) => (
              <div key={p.project.id} className="flex items-center justify-between rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><FileText className="h-4 w-4 text-brand-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-ink-500">{p.project.project_name}</p>
                    <p className="text-xs text-ink-500">{p.project.status}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ProposalStatusBadge status={p.project.status} />
                  {p.score && <span className="text-sm font-bold text-ink-500">{p.score.overall_score}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Proposal Card (full intelligence)
// ============================================================
export function ProposalCard({ proposal, onSend, onRecordOutcome }: {
  proposal: ProposalWithIntelligence;
  onSend?: (projectId: string) => void;
  onRecordOutcome?: (projectId: string) => void;
}) {
  const p = proposal;
  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><FileText className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-semibold text-ink-500">{p.project.project_name}</p>
            <p className="text-xs text-ink-500">Priority: {p.project.priority} · {timeAgo(p.project.updated_at)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {p.score && <span className="text-lg font-bold text-ink-500">{p.score.overall_score}</span>}
          <PIAIBadge confidence={p.score?.confidence} />
        </div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2">
        <ProposalStatusBadge status={p.project.status} />
        {p.packages.length > 0 && <Badge tone="brand"><Package className="h-3 w-3 mr-1" />{p.packages.length} packages</Badge>}
        {p.roi && <Badge tone="success"><TrendingUp className="h-3 w-3 mr-1" />ROI: {p.roi.roi_3_year ?? 0}x</Badge>}
        {p.negotiation && <Badge tone="warning"><Swords className="h-3 w-3 mr-1" />Negotiation prep</Badge>}
      </div>

      {/* Executive Summary */}
      {p.latestVersion?.executive_summary && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
          <div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm text-ink-500">{p.latestVersion.executive_summary}</p></div>
        </div>
      )}

      {/* AI Reasoning */}
      {p.reasoning.length > 0 && (
        <div className="space-y-1">
          {p.reasoning.slice(0, 4).map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-xs">
              <Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-ink-500 capitalize">{r.reasoning_type}: </span>
                <span className="text-ink-500">{r.reasoning_text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scores */}
      {p.score && (
        <div className="space-y-1.5">
          <ScoreBar score={p.score.win_probability} label="Win Prob" />
          <ScoreBar score={p.score.pricing_strength} label="Pricing" />
          <ScoreBar score={p.score.competitive_position} label="Competitive" />
          <ScoreBar score={p.score.roi_quality} label="ROI Quality" />
          <ScoreBar score={p.score.proposal_quality} label="Proposal Qlty" />
          <ScoreBar score={p.score.relationship_strength} label="Relationship" />
        </div>
      )}

      {/* Packages */}
      {p.packages.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Package className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500">Packages</span></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {p.packages.map((pkg) => (
              <div key={pkg.id} className={cn('p-2.5 rounded-lg border', pkg.is_recommended ? 'bg-gradient-to-r from-gold-400 to-gold-300/5 border-brand-500/20' : 'bg-card-900/50 border-gold-500/8')}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-ink-500">{pkg.package_name}</span>
                  {pkg.is_recommended && <Badge tone="brand">Recommended</Badge>}
                </div>
                <p className="text-sm font-bold text-ink-500">${pkg.price?.toLocaleString() ?? '—'}</p>
                <p className="text-xs text-ink-500 capitalize">{pkg.package_tier} · {pkg.timeline_weeks}w</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ROI */}
      {p.roi && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><span className="text-ink-500">Investment:</span> <span className="text-ink-500 font-medium">${p.roi.investment_amount?.toLocaleString()}</span></div>
          <div><span className="text-ink-500">Annual Savings:</span> <span className="text-ink-500 font-medium">${p.roi.annual_savings?.toLocaleString()}</span></div>
          <div><span className="text-ink-500">Payback:</span> <span className="text-ink-500 font-medium">{p.roi.payback_period_months}mo</span></div>
          <div><span className="text-ink-500">3yr ROI:</span> <span className="text-success-400 font-medium">{p.roi.roi_3_year}x</span></div>
        </div>
      )}

      {/* Approvals */}
      {p.approvals.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><FileCheck className="h-3.5 w-3.5 text-warning-500" /><span className="text-xs text-ink-500">Approvals</span></div>
          <div className="space-y-1">
            {p.approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {a.approval_status === 'approved' ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : a.approval_status === 'rejected' ? <XCircle className="h-3.5 w-3.5 text-error-400" /> : <Clock className="h-3.5 w-3.5 text-warning-500" />}
                  <span className="text-ink-500">{a.approver_name} ({a.approval_type})</span>
                </div>
                <Badge tone={a.approval_status === 'approved' ? 'success' : a.approval_status === 'rejected' ? 'error' : 'warning'}>{a.approval_status}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gold-500/8">
        {onSend && (p.project.status === 'review' || p.project.status === 'approved') && (
          <button onClick={() => onSend(p.project.id)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><Send className="h-3.5 w-3.5" />Send Proposal</button>
        )}
        {onRecordOutcome && (p.project.status === 'sent' || p.project.status === 'negotiating') && (
          <button onClick={() => onRecordOutcome(p.project.id)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><FileCheck className="h-3.5 w-3.5" />Record Outcome</button>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Pipeline Section
// ============================================================
export function PipelineSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  if (proposals.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No proposals yet.</div>;
  return <div className="space-y-3">{proposals.map((p) => <ProposalCard key={p.project.id} proposal={p} />)}</div>;
}

// ============================================================
// Pending Requests Section
// ============================================================
export function PendingRequestsSection({ requests, onGenerate }: {
  requests: ProposalRequest[];
  onGenerate: (requestId: string) => void;
}) {
  const pending = requests.filter((r) => r.status === 'pending');
  if (pending.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No pending proposal requests.</div>;
  return (
    <div className="space-y-3">
      {pending.map((r) => (
        <Card key={r.id} className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10"><Clock className="h-5 w-5 text-warning-500" /></div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{r.prospect_name ?? 'Unknown'}</p>
                <p className="text-xs text-ink-500">{r.company_name ?? '—'}</p>
              </div>
            </div>
            <Badge tone="warning">{r.urgency}</Badge>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge tone="neutral" className="capitalize">{r.trigger_reason.replace(/_/g, ' ')}</Badge>
            {r.estimated_deal_value && <Badge tone="success">${r.estimated_deal_value.toLocaleString()}</Badge>}
            <Badge tone="neutral">{Math.round(r.confidence_score * 100)}% confidence</Badge>
          </div>
          {r.reasoning && <p className="text-xs text-ink-500 mt-2">{r.reasoning}</p>}
          <button onClick={() => onGenerate(r.id)} className="mt-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15">
            <Sparkles className="h-3.5 w-3.5" />Generate Proposal
          </button>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Packages Section
// ============================================================
export function PackagesSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withPackages = proposals.filter((p) => p.packages.length > 0);
  if (withPackages.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No packages generated yet.</div>;
  return (
    <div className="space-y-3">
      {withPackages.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{p.project.project_name}</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {p.packages.map((pkg) => (
              <div key={pkg.id} className={cn('p-3 rounded-lg border', pkg.is_recommended ? 'bg-gradient-to-r from-gold-400 to-gold-300/5 border-brand-500/20' : 'bg-card-900/50 border-gold-500/8')}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-ink-500">{pkg.package_name}</span>
                  {pkg.is_recommended && <Badge tone="brand">Recommended</Badge>}
                </div>
                <p className="text-lg font-bold text-ink-500">${pkg.price?.toLocaleString() ?? '—'}</p>
                <p className="text-xs text-ink-500 capitalize mb-2">{pkg.package_tier} · {pkg.timeline_weeks} weeks</p>
                {Array.isArray(pkg.features) && (pkg.features as string[]).length > 0 && (
                  <div className="space-y-0.5">
                    {(pkg.features as string[]).slice(0, 4).map((f, i) => (
                      <div key={i} className="flex items-start gap-1.5 text-xs"><CheckCircle2 className="h-3 w-3 text-success-400 shrink-0 mt-0.5" /><span className="text-ink-500">{f}</span></div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Pricing Section
// ============================================================
export function PricingSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withPaymentPlans = proposals.filter((p) => p.paymentPlans.length > 0);
  if (withPaymentPlans.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No pricing data yet.</div>;
  return (
    <div className="space-y-3">
      {withPaymentPlans.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{p.project.project_name}</p>
          <div className="space-y-2">
            {p.paymentPlans.map((plan) => (
              <div key={plan.id} className={cn('p-3 rounded-lg border', plan.is_recommended ? 'bg-success-500/5 border-success-500/20' : 'bg-card-900/50 border-gold-500/8')}>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-ink-500">{plan.plan_name}</span>
                    {plan.is_recommended && <Badge tone="success" className="ml-2">Recommended</Badge>}
                  </div>
                  <span className="text-sm font-bold text-ink-500">${plan.total_amount?.toLocaleString() ?? '—'}</span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-ink-500">
                  <span className="capitalize">{plan.plan_type}</span>
                  {plan.installment_count && <span>{plan.installment_count} installments</span>}
                  {plan.installment_amount && <span>${plan.installment_amount.toLocaleString()}/installment</span>}
                  {plan.discount_percentage && <span className="text-success-400">{plan.discount_percentage}% discount</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// ROI Section
// ============================================================
export function ROISection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withROI = proposals.filter((p) => p.roi);
  if (withROI.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No ROI data yet.</div>;
  return (
    <div className="space-y-3">
      {withROI.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{p.project.project_name}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg bg-card-900/50"><p className="text-xs text-ink-500">Investment</p><p className="text-lg font-bold text-ink-500">${p.roi!.investment_amount.toLocaleString()}</p></div>
            <div className="p-3 rounded-lg bg-card-900/50"><p className="text-xs text-ink-500">Annual Savings</p><p className="text-lg font-bold text-ink-500">${p.roi!.annual_savings?.toLocaleString() ?? '—'}</p></div>
            <div className="p-3 rounded-lg bg-card-900/50"><p className="text-xs text-ink-500">Payback</p><p className="text-lg font-bold text-ink-500">{p.roi!.payback_period_months}mo</p></div>
            <div className="p-3 rounded-lg bg-success-500/5"><p className="text-xs text-ink-500">5yr ROI</p><p className="text-lg font-bold text-success-400">{p.roi!.roi_5_year}x</p></div>
          </div>
          {p.roi!.business_impact && <p className="text-xs text-ink-500 mt-2">{p.roi!.business_impact}</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Business Case Section
// ============================================================
export function BusinessCaseSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withBC = proposals.filter((p) => p.businessCase);
  if (withBC.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No business cases yet.</div>;
  return (
    <div className="space-y-3">
      {withBC.map((p) => (
        <Card key={p.project.id} className="p-4 space-y-2">
          <p className="text-sm font-semibold text-ink-500">{p.project.project_name}</p>
          {p.businessCase!.executive_summary && <p className="text-sm text-ink-500">{p.businessCase!.executive_summary}</p>}
          <div className="space-y-1 text-xs">
            <div><span className="text-ink-500">Problem:</span> <span className="text-ink-500">{p.businessCase!.problem_statement}</span></div>
            {p.businessCase!.financial_impact && <div><span className="text-ink-500">Financial Impact:</span> <span className="text-ink-500">{p.businessCase!.financial_impact}</span></div>}
            {p.businessCase!.expected_return && <div><span className="text-ink-500">Expected Return:</span> <span className="text-ink-500">{p.businessCase!.expected_return}</span></div>}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Implementation Section
// ============================================================
export function ImplementationSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withTimeline = proposals.filter((p) => p.timeline.length > 0);
  if (withTimeline.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No implementation plans yet.</div>;
  return (
    <div className="space-y-3">
      {withTimeline.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{p.project.project_name}</p>
          <div className="space-y-2">
            {p.timeline.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-card-900/50">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Calendar className="h-4 w-4 text-brand-400" /></div>
                <div className="flex-1">
                  <p className="text-sm text-ink-500">{t.phase_name}</p>
                  <p className="text-xs text-ink-500">Weeks {t.start_week}–{t.end_week}</p>
                </div>
                {Array.isArray(t.milestones) && t.milestones.length > 0 && <Badge tone="neutral">{t.milestones.length} milestones</Badge>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Negotiation Section
// ============================================================
export function NegotiationSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withNeg = proposals.filter((p) => p.negotiation);
  if (withNeg.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No negotiation guidance yet.</div>;
  return (
    <div className="space-y-3">
      {withNeg.map((p) => (
        <Card key={p.project.id} className="p-4 space-y-3">
          <p className="text-sm font-semibold text-ink-500">{p.project.project_name}</p>
          {p.negotiation!.negotiation_guidance && (
            <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
              <div className="flex items-start gap-2"><Brain className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm text-ink-500">{p.negotiation!.negotiation_guidance}</p></div>
            </div>
          )}
          {Array.isArray(p.negotiation!.predicted_objections) && (p.negotiation!.predicted_objections as Array<Record<string, unknown>>).length > 0 && (
            <div>
              <span className="text-xs text-ink-500">Predicted Objections</span>
              <div className="space-y-1 mt-1">
                {(p.negotiation!.predicted_objections as Array<Record<string, unknown>>).map((o, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs"><AlertTriangle className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" /><span className="text-ink-500">{o.objection as string ?? o.toString()}</span></div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(p.negotiation!.concessions) && (p.negotiation!.concessions as Array<Record<string, unknown>>).length > 0 && (
            <div>
              <span className="text-xs text-ink-500">Concessions</span>
              <div className="space-y-1 mt-1">
                {(p.negotiation!.concessions as Array<Record<string, unknown>>).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs"><CheckCircle2 className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" /><span className="text-ink-500">{c.concession as string ?? c.toString()}</span></div>
                ))}
              </div>
            </div>
          )}
          {Array.isArray(p.negotiation!.red_lines) && (p.negotiation!.red_lines as Array<Record<string, unknown>>).length > 0 && (
            <div>
              <span className="text-xs text-ink-500">Red Lines</span>
              <div className="space-y-1 mt-1">
                {(p.negotiation!.red_lines as Array<Record<string, unknown>>).map((r, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs"><XCircle className="h-3.5 w-3.5 text-error-400 shrink-0 mt-0.5" /><span className="text-ink-500">{r.red_line as string ?? r.toString()}</span></div>
                ))}
              </div>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Approvals Section
// ============================================================
export function ApprovalsSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withApprovals = proposals.filter((p) => p.approvals.length > 0);
  if (withApprovals.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No approvals needed yet.</div>;
  return (
    <div className="space-y-3">
      {withApprovals.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{p.project.project_name}</p>
          <div className="space-y-2">
            {p.approvals.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2.5 rounded-lg bg-card-900/50">
                <div className="flex items-center gap-2">
                  {a.approval_status === 'approved' ? <CheckCircle2 className="h-4 w-4 text-success-400" /> : a.approval_status === 'rejected' ? <XCircle className="h-4 w-4 text-error-400" /> : <Clock className="h-4 w-4 text-warning-500" />}
                  <div>
                    <p className="text-sm text-ink-500">{a.approver_name}</p>
                    <p className="text-xs text-ink-500 capitalize">{a.approval_type} approval{a.approver_role ? ` · ${a.approver_role}` : ''}</p>
                  </div>
                </div>
                <Badge tone={a.approval_status === 'approved' ? 'success' : a.approval_status === 'rejected' ? 'error' : 'warning'}>{a.approval_status}</Badge>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Versions Section
// ============================================================
export function VersionsSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  if (proposals.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No proposals yet.</div>;
  return (
    <div className="space-y-3">
      {proposals.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-2">{p.project.project_name}</p>
          <div className="flex items-center gap-2">
            <Badge tone="brand">v{p.latestVersion?.version_number ?? 1}</Badge>
            <Badge tone="neutral">{p.latestVersion?.is_latest ? 'Latest' : 'Draft'}</Badge>
            <span className="text-xs text-ink-500">{p.latestVersion ? timeAgo(p.latestVersion.created_at) : ''}</span>
          </div>
          {p.statusHistory.length > 0 && (
            <div className="mt-3 space-y-1">
              <span className="text-xs text-ink-500">Status History</span>
              {p.statusHistory.slice(0, 5).map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-xs">
                  <ProposalStatusBadge status={s.status} />
                  <span className="text-ink-500">{s.changed_by} · {timeAgo(s.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Delivery Analytics Section
// ============================================================
export function DeliverySection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withDelivery = proposals.filter((p) => p.deliveries.length > 0);
  if (withDelivery.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No delivery data yet.</div>;
  return (
    <div className="space-y-3">
      {withDelivery.map((p) => (
        <Card key={p.project.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{p.project.project_name}</p>
          <div className="space-y-2">
            {p.deliveries.map((d) => (
              <div key={d.id} className="p-3 rounded-lg bg-card-900/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-brand-400" />
                    <span className="text-sm text-ink-500">{d.recipient_name ?? d.recipient_email ?? 'Unknown'}</span>
                  </div>
                  <Badge tone={d.is_accepted ? 'success' : d.view_count > 0 ? 'brand' : 'neutral'}>{d.is_accepted ? 'Accepted' : d.view_count > 0 ? 'Viewed' : 'Sent'}</Badge>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div><span className="text-ink-500">Views:</span> <span className="text-ink-500">{d.view_count}</span></div>
                  <div><span className="text-ink-500">Time:</span> <span className="text-ink-500">{d.time_spent_seconds}s</span></div>
                  <div><span className="text-ink-500">Downloads:</span> <span className="text-ink-500">{d.download_count}</span></div>
                </div>
                {d.sent_at && <p className="text-xs text-ink-500 mt-1">Sent: {timeAgo(d.sent_at)}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Proposal Score Section
// ============================================================
export function ProposalScoreSection({ proposals }: { proposals: ProposalWithIntelligence[] }) {
  const withScore = proposals.filter((p) => p.score);
  if (withScore.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No scores yet.</div>;
  return (
    <div className="space-y-3">
      {withScore.map((p) => (
        <Card key={p.project.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-ink-500">{p.project.project_name}</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-ink-500">{p.score!.overall_score}</span>
              <PIAIBadge confidence={p.score!.confidence} />
            </div>
          </div>
          <div className="space-y-1.5">
            <ScoreBar score={p.score!.win_probability} label="Win Probability" />
            <ScoreBar score={p.score!.pricing_strength} label="Pricing Strength" />
            <ScoreBar score={p.score!.competitive_position} label="Competitive Pos" />
            <ScoreBar score={p.score!.roi_quality} label="ROI Quality" />
            <ScoreBar score={p.score!.proposal_quality} label="Proposal Quality" />
            <ScoreBar score={p.score!.relationship_strength} label="Relationship" />
            <ScoreBar score={p.score!.decision_confidence} label="Decision Conf" />
          </div>
          {p.score!.score_explanation && Object.keys(p.score!.score_explanation).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gold-500/8 space-y-1">
              {Object.entries(p.score!.score_explanation).map(([key, val]) => (
                <p key={key} className="text-xs text-ink-500"><span className="text-ink-500 capitalize">{key}:</span> {val}</p>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Notifications Section
// ============================================================
export function PNotificationsSection({ notifications }: { notifications: ProposalIntelligenceDashboard['notifications'] }) {
  if (notifications.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No notifications.</div>;
  const sevTone = { info: 'neutral', warning: 'warning', error: 'error', success: 'success' } as const;
  return (
    <div className="space-y-2">
      {notifications.map((n) => (
        <Card key={n.id} className={cn('p-3', !n.is_read && 'border-brand-500/20')}>
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2"><Bell className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{n.notification_title}</p><p className="text-xs text-ink-500">{n.notification_message}</p></div></div>
            <Badge tone={sevTone[n.severity] ?? 'neutral'}>{n.severity}</Badge>
          </div>
          <p className="text-xs text-ink-500 mt-1">{timeAgo(n.created_at)}</p>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function ProposalIntelligenceEmpty({ onDetect, isDetecting }: { onDetect: () => void; isDetecting: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><FileText className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Proposal Intelligence Engine</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI automatically detects proposal readiness from meeting outcomes, generates complete proposals with pricing, ROI, packages, negotiation guidance, and tracks delivery — all without manual creation.</p>
      </div>
      <button onClick={onDetect} disabled={isDetecting} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />
        {isDetecting ? 'Detecting...' : 'Detect Proposal Readiness'}
      </button>
    </div>
  );
}
