// ============================================================
// Revenue Intelligence Dashboard — Main Page
// ============================================================

import { useState } from 'react';
import {
  TrendingUp,
  Target,
  Activity,
  Zap,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  RefreshCw,
  Brain,
  ArrowRight,
  Sparkles,
  Trophy,
  Flame,
  Eye,
  X,
  ChevronRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import {
  useRevenueSummary,
  useRevenueHealth,
  useOpportunityScores,
  useRevenueProfile,
  useBuyingSignals,
  useRecommendations,
  useRecalculateRevenue,
  useUpdateRecommendationStatus,
} from '@/hooks/useRevenueIntelligence';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type {
  RevenueProfileRecord,
  RevenueRecommendationRecord,
  IntelligenceSignal,
  Priority,
} from '@/types/revenue-intelligence';

// ============================================================
// Main Page
// ============================================================

export function RevenueIntelligencePage() {
  const { data: summary, isLoading: summaryLoading } = useRevenueSummary();
  const { data: health } = useRevenueHealth();
  const { data: profiles } = useOpportunityScores(20);
  const recalcMutation = useRecalculateRevenue();

  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Revenue Intelligence"
        description="Actionable revenue insights from research and relationship data."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => recalcMutation.mutate({ all: true })}
            loading={recalcMutation.isPending}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Recalculate All
          </Button>
        }
      />

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Brain} label="Total Profiles" value={summary ? formatNumber(summary.total_profiles) : '—'} loading={summaryLoading} />
        <MetricCard icon={TrendingUp} label="Avg Revenue Score" value={summary ? `${Math.round(summary.average_overall_score * 100)}%` : '—'} loading={summaryLoading} tone="brand" />
        <MetricCard icon={Target} label="Avg ICP Score" value={summary ? `${Math.round(summary.average_icp_score * 100)}%` : '—'} loading={summaryLoading} tone="success" />
        <MetricCard icon={Zap} label="Avg Buying Intent" value={summary ? `${Math.round(summary.average_buying_intent_score * 100)}%` : '—'} loading={summaryLoading} tone="warning" />
        <MetricCard icon={Activity} label="Total Signals" value={summary ? formatNumber(summary.total_signals) : '—'} loading={summaryLoading} />
        <MetricCard icon={ShieldCheck} label="Health" value={health?.healthy ? 'Healthy' : 'Issues'} loading={!health} tone={health?.healthy ? 'success' : 'warning'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Opportunity Ranking */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-brand-400" />
                Opportunity Ranking
              </CardTitle>
              <Badge tone="neutral">{profiles?.length ?? 0} accounts</Badge>
            </CardHeader>
            <CardContent className="p-0">
              {!profiles || profiles.length === 0 ? (
                <EmptyState
                  icon={<Trophy className="h-6 w-6" />}
                  title="No Revenue Profiles Yet"
                  description="Analyze companies from the Research Intelligence page to generate revenue profiles."
                />
              ) : (
                <div className="divide-y divide-border-subtle">
                  {profiles.map((profile, index) => (
                    <ProfileRow
                      key={profile.id}
                      profile={profile}
                      rank={index + 1}
                      onSelect={() => setSelectedCompanyId(profile.company_id)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Priority Distribution */}
          {summary && Object.keys(summary.priority_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-4 w-4 text-ink-500" />
                  Priority Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(['critical', 'high', 'medium', 'low', 'none'] as Priority[]).map((priority) => {
                  const count = summary.priority_distribution[priority] ?? 0;
                  const total = summary.total_profiles;
                  const percentage = total > 0 ? (count / total) * 100 : 0;
                  return (
                    <div key={priority} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <PriorityBadge priority={priority} />
                        <span className="text-xs text-ink-500">{count} accounts</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 rounded-full bg-card-900 overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', priorityColor(priority))}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-ink-500">{Math.round(percentage)}%</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right: Health & Signal Trends */}
        <div className="space-y-6">
          {/* Health */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-brand-400" />
                Engine Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!health ? (
                <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Status</span>
                    <Badge tone={health.healthy ? 'success' : 'warning'} dot>
                      {health.healthy ? 'Healthy' : 'Issues Detected'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Stale Profiles</span>
                    <span className="text-xs text-ink-500">{health.stale_profiles}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Low Confidence</span>
                    <span className="text-xs text-ink-500">{health.low_confidence_profiles}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-ink-500">Recommendations</span>
                    <span className="text-xs text-ink-500">{health.total_recommendations}</span>
                  </div>
                  {health.errors.length > 0 && (
                    <div className="pt-2 border-t border-gold-500/8 space-y-1">
                      {health.errors.map((err, i) => (
                        <div key={i} className="flex items-start gap-1.5 text-xs text-error-400">
                          <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* ICP Distribution */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-ink-500" />
                  ICP Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">High Match (70%+)</span>
                  <Badge tone="success">{summary.icp_distribution.high}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Medium (40-70%)</span>
                  <Badge tone="warning">{summary.icp_distribution.medium}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Low (&lt;40%)</span>
                  <Badge tone="neutral">{summary.icp_distribution.low}</Badge>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Signal Trends */}
          {summary && Object.keys(summary.buying_signal_trends).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-ink-500" />
                  Signal Trends
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(summary.buying_signal_trends)
                  .sort((a, b) => b[1] - a[1])
                  .map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="text-xs text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
                      <Badge tone="neutral">{count}</Badge>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {/* Recommendations Summary */}
          {summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-ink-500" />
                  Recommendations
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Pending</span>
                  <Badge tone="warning">{summary.pending_recommendations}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Accepted</span>
                  <Badge tone="success">{summary.accepted_recommendations}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500">Total</span>
                  <Badge tone="neutral">{summary.total_recommendations}</Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Company Detail Modal */}
      <CompanyDetailModal
        companyId={selectedCompanyId}
        onClose={() => setSelectedCompanyId(null)}
      />
    </div>
  );
}

// ============================================================
// Metric Card
// ============================================================

function MetricCard({
  icon: Icon,
  label,
  value,
  loading,
  tone = 'default',
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'brand';
}) {
  const toneClasses = {
    default: 'text-ink-500',
    success: 'text-success-400',
    warning: 'text-warning-500',
    error: 'text-error-400',
    brand: 'text-brand-400',
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? (
        <Spinner className="h-4 w-4" />
      ) : (
        <span className={cn('text-lg font-semibold', toneClasses[tone])}>{value}</span>
      )}
    </Card>
  );
}

// ============================================================
// Profile Row
// ============================================================

function ProfileRow({
  profile,
  rank,
  onSelect,
}: {
  profile: RevenueProfileRecord & { company_name: string };
  rank: number;
  onSelect: () => void;
}) {
  const score = Math.round(profile.overall_score * 100);

  return (
    <div
      className="flex items-center gap-4 px-5 py-3 hover:bg-card-800 transition-colors cursor-pointer"
      onClick={onSelect}
    >
      <span className={cn(
        'text-sm font-bold w-6 text-center',
        rank === 1 ? 'text-brand-400' : rank <= 3 ? 'text-ink-500' : 'text-ink-500'
      )}>
        {rank}
      </span>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink-500 truncate">{profile.company_name}</span>
          <PriorityBadge priority={profile.priority} />
        </div>
        {profile.recommended_action && (
          <div className="flex items-center gap-1 mt-1">
            <ArrowRight className="h-3 w-3 text-ink-500" />
            <span className="text-xs text-ink-500 truncate">{profile.recommended_action}</span>
          </div>
        )}
      </div>

      {/* Score bars */}
      <div className="hidden md:flex items-center gap-3">
        <ScoreBar label="ICP" value={profile.icp_score} />
        <ScoreBar label="Intent" value={profile.buying_intent_score} />
        <ScoreBar label="Growth" value={profile.growth_score} />
      </div>

      {/* Overall score */}
      <div className="flex items-center gap-2">
        <div className="w-16 h-1.5 rounded-full bg-card-900 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full',
              score >= 70 ? 'bg-success-500' : score >= 40 ? 'bg-warning-500' : 'bg-error-500'
            )}
            style={{ width: `${score}%` }}
          />
        </div>
        <span className={cn(
          'text-xs font-medium',
          score >= 70 ? 'text-success-400' : score >= 40 ? 'text-warning-500' : 'text-error-400'
        )}>
          {score}%
        </span>
      </div>

      <ChevronRight className="h-4 w-4 text-ink-500" />
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-ink-500 w-12">{label}</span>
      <div className="w-12 h-1 rounded-full bg-card-900 overflow-hidden">
        <div
          className={cn('h-full rounded-full', pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ============================================================
// Priority Badge
// ============================================================

function PriorityBadge({ priority }: { priority: Priority }) {
  const tone: Record<Priority, 'error' | 'warning' | 'brand' | 'success' | 'neutral'> = {
    critical: 'error',
    high: 'warning',
    medium: 'brand',
    low: 'success',
    none: 'neutral',
  };
  return (
    <Badge tone={tone[priority]} dot>
      {priority}
    </Badge>
  );
}

function priorityColor(priority: Priority): string {
  switch (priority) {
    case 'critical': return 'bg-error-500';
    case 'high': return 'bg-warning-500';
    case 'medium': return 'bg-gradient-to-r from-gold-400 to-gold-300';
    case 'low': return 'bg-success-500';
    default: return 'bg-gray-600';
  }
}

// ============================================================
// Company Detail Modal
// ============================================================

function CompanyDetailModal({ companyId, onClose }: { companyId: string | null; onClose: () => void }) {
  const { data: profile } = useRevenueProfile(companyId);
  const { data: signals } = useBuyingSignals(companyId);
  const { data: recommendations } = useRecommendations(companyId);
  const updateRecMutation = useUpdateRecommendationStatus();
  const recalcMutation = useRecalculateRevenue();

  if (!companyId) return null;

  return (
    <Modal open={!!companyId} onClose={onClose} size="xl">
      {!profile ? (
        <div className="flex justify-center py-12"><Spinner className="h-6 w-6" /></div>
      ) : (
        <div className="space-y-5 max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-ink-500">Revenue Profile</h2>
              <div className="flex items-center gap-2 mt-1">
                <PriorityBadge priority={profile.priority} />
                <span className="text-xs text-ink-500">Updated {timeAgo(profile.updated_at)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => recalcMutation.mutate({ companyId })}
                loading={recalcMutation.isPending}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Recalculate
              </Button>
            </div>
          </div>

          {/* Recommended Action */}
          {profile.recommended_action && (
            <div className="rounded-lg border border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 p-4">
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-4 w-4 text-brand-400" />
                <span className="text-xs font-semibold text-brand-400 uppercase tracking-wide">Recommended Action</span>
              </div>
              <p className="text-sm text-ink-500">{profile.recommended_action}</p>
            </div>
          )}

          {/* Score Breakdown */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-3">Score Breakdown</h3>
            <div className="grid grid-cols-2 gap-3">
              <ScoreCard label="Overall Score" value={profile.overall_score} icon={TrendingUp} />
              <ScoreCard label="Opportunity" value={profile.opportunity_score} icon={Target} />
              <ScoreCard label="ICP Match" value={profile.icp_score} icon={Target} />
              <ScoreCard label="Buying Intent" value={profile.buying_intent_score} icon={Zap} />
              <ScoreCard label="Growth" value={profile.growth_score} icon={TrendingUp} />
              <ScoreCard label="Technology Fit" value={profile.technology_fit_score} icon={Activity} />
              <ScoreCard label="Service Fit" value={profile.service_fit_score} icon={CheckCircle2} />
              <ScoreCard label="Risk" value={profile.risk_score} icon={AlertTriangle} inverted />
              <ScoreCard label="Urgency" value={profile.urgency_score} icon={Clock} />
              <ScoreCard label="Relationship" value={profile.relationship_score} icon={Eye} />
            </div>
          </div>

          {/* Confidence */}
          <div className="flex items-center justify-between rounded-lg border border-gold-500/12 bg-card-900 p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-brand-400" />
              <span className="text-xs text-ink-500">Confidence Score</span>
            </div>
            <span className="text-sm font-semibold text-brand-400">{Math.round(profile.confidence_score * 100)}%</span>
          </div>

          {/* Signals */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
              Intelligence Signals ({signals?.length ?? 0})
            </h3>
            {!signals || signals.length === 0 ? (
              <p className="text-xs text-ink-500 py-3 text-center">No signals detected.</p>
            ) : (
              <div className="space-y-2">
                {signals.map((signal) => (
                  <SignalCard key={signal.id} signal={signal} />
                ))}
              </div>
            )}
          </div>

          {/* Recommendations */}
          <div>
            <h3 className="text-xs font-semibold text-ink-500 uppercase tracking-wide mb-2">
              Recommendations ({recommendations?.length ?? 0})
            </h3>
            {!recommendations || recommendations.length === 0 ? (
              <p className="text-xs text-ink-500 py-3 text-center">No recommendations generated.</p>
            ) : (
              <div className="space-y-2">
                {recommendations.map((rec) => (
                  <RecommendationCard
                    key={rec.id}
                    recommendation={rec}
                    onAccept={() => updateRecMutation.mutate({ recommendationId: rec.id, status: 'accepted' })}
                    onReject={() => updateRecMutation.mutate({ recommendationId: rec.id, status: 'rejected' })}
                    onComplete={() => updateRecMutation.mutate({ recommendationId: rec.id, status: 'completed' })}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Metadata */}
          <div className="text-xs text-ink-500 pt-2 border-t border-gold-500/8 flex items-center justify-between">
            <span>Created {timeAgo(profile.created_at)}</span>
            <span>v{profile.version}</span>
            {profile.analysis_duration_ms !== null && (
              <span>Analysis: {profile.analysis_duration_ms}ms</span>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ============================================================
// Score Card
// ============================================================

function ScoreCard({
  label,
  value,
  icon: Icon,
  inverted = false,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  inverted?: boolean;
}) {
  const pct = Math.round(value * 100);
  const displayPct = inverted ? 100 - pct : pct;
  const tone = displayPct >= 70 ? 'text-success-400' : displayPct >= 40 ? 'text-warning-500' : 'text-error-400';
  const barColor = displayPct >= 70 ? 'bg-success-500' : displayPct >= 40 ? 'bg-warning-500' : 'bg-error-500';

  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-ink-500" />
          <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
        </div>
        <span className={cn('text-sm font-semibold', tone)}>{pct}%</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-maroon-950 overflow-hidden">
        <div className={cn('h-full rounded-full', barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ============================================================
// Signal Card
// ============================================================

function SignalCard({ signal }: { signal: IntelligenceSignal }) {
  const tone: Record<string, 'success' | 'warning' | 'error' | 'brand' | 'neutral'> = {
    buying_intent: 'warning',
    growth: 'success',
    technology_fit: 'brand',
    service_fit: 'brand',
    risk: 'error',
    urgency: 'warning',
    relationship: 'neutral',
    competitive: 'error',
    icp_match: 'success',
    market_fit: 'brand',
    industry_fit: 'neutral',
    decision_maker_confidence: 'neutral',
  };

  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <div className="flex items-center justify-between mb-1">
        <Badge tone={tone[signal.signal_type] ?? 'neutral'} dot>
          {signal.signal_type.replace(/_/g, ' ')}
        </Badge>
        <span className="text-xs text-ink-500">{Math.round(signal.signal_strength * 100)}% strength</span>
      </div>
      {signal.description && <p className="text-xs text-ink-500 mt-1">{signal.description}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="text-[10px] text-ink-500">Source: {signal.source}</span>
        <span className="text-[10px] text-ink-500">{timeAgo(signal.detected_at)}</span>
      </div>
    </div>
  );
}

// ============================================================
// Recommendation Card
// ============================================================

function RecommendationCard({
  recommendation,
  onAccept,
  onReject,
  onComplete,
}: {
  recommendation: RevenueRecommendationRecord;
  onAccept: () => void;
  onReject: () => void;
  onComplete: () => void;
}) {
  const statusTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    pending: 'warning',
    accepted: 'success',
    rejected: 'error',
    completed: 'success',
    archived: 'neutral',
  };

  return (
    <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
      <div className="flex items-center justify-between mb-1">
        <Badge tone="brand">{recommendation.recommendation_type.replace(/_/g, ' ')}</Badge>
        <Badge tone={statusTone[recommendation.status] ?? 'neutral'} dot>
          {recommendation.status}
        </Badge>
      </div>
      <p className="text-sm text-ink-500 font-medium">{recommendation.title}</p>
      {recommendation.description && <p className="text-xs text-ink-500 mt-1">{recommendation.description}</p>}
      {recommendation.status === 'pending' && (
        <div className="flex items-center gap-2 mt-3">
          <Button size="sm" variant="outline" onClick={onAccept}>
            <CheckCircle2 className="h-3 w-3" />
            Accept
          </Button>
          <Button size="sm" variant="ghost" onClick={onReject}>
            <X className="h-3 w-3" />
            Reject
          </Button>
          <Button size="sm" variant="ghost" onClick={onComplete}>
            <CheckCircle2 className="h-3 w-3" />
            Complete
          </Button>
        </div>
      )}
    </div>
  );
}
