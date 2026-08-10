import {
  Sparkles, Globe, TrendingUp, TrendingDown, Target, Zap, Radar,
  Building2, Award, AlertTriangle, CheckCircle2, Clock, Rocket,
  Lightbulb, BarChart3, Layers, Shield,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, timeAgo } from '@/lib/utils';
import type {
  MarketProfile, MarketSegment, MarketOpportunity, MarketScore,
  TargetAccountList, MarketTrend,
} from '@/types/market-opportunity';

export function MarketAIBadge({ confidence }: { confidence?: number }) {
  return (
    <Badge tone="brand" className="gap-1">
      <Sparkles className="h-3 w-3" />
      AI{confidence ? ` · ${Math.round(confidence)}%` : ''}
    </Badge>
  );
}

export function MarketProfileOverview({ profile }: { profile: MarketProfile }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-medium text-ink-500">Market Size</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">TAM</span><p className="text-sm text-ink-500">{profile.total_addressable_market ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">SAM</span><p className="text-sm text-ink-500">{profile.serviceable_addressable_market ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Ideal Market</span><p className="text-sm text-ink-500">{profile.ideal_market ?? '—'}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-success-400" />
            <span className="text-sm font-medium text-ink-500">Market Dynamics</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Saturation</span><p className="text-sm text-ink-500 capitalize">{profile.market_saturation ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Competition</span><p className="text-sm text-ink-500 capitalize">{profile.competitive_density ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Growth Potential</span><p className="text-sm text-ink-500">{profile.growth_potential}/100</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-4 w-4 text-warning-500" />
            <span className="text-sm font-medium text-ink-500">Sales Metrics</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Avg Sales Cycle</span><p className="text-sm text-ink-500">{profile.average_sales_cycle ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Avg Deal Size</span><p className="text-sm text-ink-500">{profile.average_deal_size ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Committee Complexity</span><p className="text-sm text-ink-500 capitalize">{profile.buying_committee_complexity ?? '—'}</p></div>
          </div>
        </Card>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-ink-500">Growing Industries</span>
            <MarketAIBadge confidence={profile.confidence_score} />
          </div>
          <div className="space-y-2">
            {profile.growing_industries?.map((ind, i) => (
              <div key={i} className="flex items-start gap-2">
                <TrendingUp className="h-4 w-4 text-success-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{ind}</p>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium text-ink-500">Declining Industries</span>
            <MarketAIBadge confidence={profile.confidence_score} />
          </div>
          <div className="space-y-2">
            {profile.declining_industries?.map((ind, i) => (
              <div key={i} className="flex items-start gap-2">
                <TrendingDown className="h-4 w-4 text-error-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{ind}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-ink-500">Emerging Markets</span>
          <MarketAIBadge confidence={profile.confidence_score} />
        </div>
        <div className="flex flex-wrap gap-2">
          {profile.emerging_markets?.map((m, i) => <Badge key={i} tone="brand">{m}</Badge>)}
        </div>
      </Card>
    </div>
  );
}

export function MarketSegmentsSection({ segments }: { segments: MarketSegment[] }) {
  if (segments.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No market segments generated yet.</div>;
  return (
    <div className="space-y-3">
      {segments.map((seg) => (
        <Card key={seg.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                <Layers className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{seg.segment_name}</p>
                <p className="text-xs text-ink-500 capitalize">{seg.segment_type.replace(/_/g, ' ')}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {seg.recommended && <Badge tone="success" dot>Recommended</Badge>}
              <MarketAIBadge confidence={seg.confidence_score * 100} />
            </div>
          </div>
          {seg.description && <p className="text-sm text-ink-500 mb-3">{seg.description}</p>}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><span className="text-xs text-ink-500">Market Size</span><p className="text-sm text-ink-500">{seg.market_size ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Growth Rate</span><p className="text-sm text-ink-500">{seg.growth_rate ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Opportunity Score</span><p className="text-sm text-ink-500">{seg.opportunity_score}/100</p></div>
            <div><span className="text-xs text-ink-500">Competition</span><p className="text-sm text-ink-500 capitalize">{seg.competition_level ?? '—'}</p></div>
          </div>
          {seg.reason && (
            <div className="mt-3 pt-3 border-t border-gold-500/8">
              <span className="text-xs text-ink-500">Why selected</span>
              <p className="text-sm text-ink-500 mt-0.5">{seg.reason}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function OpportunityFeedSection({ opportunities }: { opportunities: MarketOpportunity[] }) {
  if (opportunities.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No opportunities discovered yet.</div>;
  const priorityTone = { critical: 'error', high: 'warning', medium: 'brand', low: 'neutral' } as const;
  const urgencyIcon = { immediate: Zap, high: Zap, medium: Clock, low: CheckCircle2 } as const;
  return (
    <div className="space-y-3">
      {opportunities.map((opp) => {
        const UrgencyIcon = urgencyIcon[opp.urgency ?? 'low'];
        return (
          <Card key={opp.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                  <Building2 className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{opp.company_name}</p>
                  <p className="text-xs text-ink-500">{opp.industry ?? '—'} · {opp.signal_type.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={priorityTone[opp.priority]} dot>{opp.priority}</Badge>
                <MarketAIBadge confidence={opp.confidence * 100} />
              </div>
            </div>
            <p className="text-sm text-ink-500 mb-3">{opp.reason}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><span className="text-xs text-ink-500 flex items-center gap-1"><UrgencyIcon className="h-3 w-3" /> Urgency</span><p className="text-sm text-ink-500 capitalize">{opp.urgency ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Opp Score</span><p className="text-sm text-ink-500">{opp.opportunity_score}/100</p></div>
              <div><span className="text-xs text-ink-500">Conv. Prob</span><p className="text-sm text-ink-500">{opp.expected_conversion_probability ? `${Math.round(opp.expected_conversion_probability * 100)}%` : '—'}</p></div>
              <div><span className="text-xs text-ink-500">Discovered</span><p className="text-sm text-ink-500">{timeAgo(opp.discovered_at)}</p></div>
            </div>
            {opp.recommended_action && (
              <div className="mt-3 pt-3 border-t border-gold-500/8 flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{opp.recommended_action}</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function MarketScoresSection({ scores }: { scores: MarketScore[] }) {
  if (scores.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No market scores generated yet.</div>;
  const factors: Array<{ key: keyof MarketScore; label: string }> = [
    { key: 'revenue_dna_fit', label: 'DNA Fit' }, { key: 'icp_fit', label: 'ICP Fit' },
    { key: 'buying_signals_score', label: 'Signals' }, { key: 'technology_fit', label: 'Tech Fit' },
    { key: 'industry_fit', label: 'Industry' }, { key: 'growth_stage_fit', label: 'Growth Stage' },
    { key: 'geography_fit', label: 'Geography' }, { key: 'market_momentum', label: 'Momentum' },
    { key: 'decision_maker_accessibility', label: 'DM Access' }, { key: 'expected_deal_quality', label: 'Deal Quality' },
  ];
  return (
    <div className="space-y-3">
      {scores.slice(0, 20).map((score) => (
        <Card key={score.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-brand-400" />
              <p className="text-sm font-semibold text-ink-500">{score.company_name}</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-lg font-bold text-ink-500">{score.overall_score}</p>
                <p className="text-[10px] text-ink-500">Overall Score</p>
              </div>
              <MarketAIBadge confidence={score.overall_confidence * 100} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {factors.map((f) => {
              const val = score[f.key] as number;
              return (
                <div key={f.key}>
                  <span className="text-xs text-ink-500">{f.label}</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
                      <div className={cn('h-full rounded-full', val >= 70 ? 'bg-success-500' : val >= 40 ? 'bg-warning-500' : 'bg-error-500')} style={{ width: `${val}%` }} />
                    </div>
                    <span className="text-xs text-ink-500">{val}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-gold-500/8 grid grid-cols-3 gap-3">
            <div><span className="text-xs text-ink-500">Reply Rate</span><p className="text-sm text-ink-500">{Math.round(score.expected_reply_rate * 100)}%</p></div>
            <div><span className="text-xs text-ink-500">Meeting Rate</span><p className="text-sm text-ink-500">{Math.round(score.expected_meeting_rate * 100)}%</p></div>
            <div><span className="text-xs text-ink-500">Sales Cycle</span><p className="text-sm text-ink-500">{score.expected_sales_cycle ?? '—'}</p></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TargetAccountListsSection({ lists }: { lists: TargetAccountList[] }) {
  if (lists.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No target account lists generated yet.</div>;
  return (
    <div className="space-y-3">
      {lists.map((list) => (
        <Card key={list.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success-500/10">
                <Rocket className="h-4 w-4 text-success-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500">{list.list_name}</p>
                {list.description && <p className="text-xs text-ink-500">{list.description}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {list.recommended && <Badge tone="success" dot>Recommended</Badge>}
              <MarketAIBadge confidence={list.confidence_score * 100} />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><span className="text-xs text-ink-500">Est. Opportunities</span><p className="text-sm text-ink-500">{list.estimated_opportunities}</p></div>
            <div><span className="text-xs text-ink-500">Avg Score</span><p className="text-sm text-ink-500">{list.average_score}/100</p></div>
            <div><span className="text-xs text-ink-500">Risk</span><p className="text-sm text-ink-500 capitalize">{list.risk_level ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Expected ROI</span><p className="text-sm text-ink-500">{list.expected_roi ?? '—'}</p></div>
          </div>
          {list.selection_reason && (
            <div className="mt-3 pt-3 border-t border-gold-500/8">
              <span className="text-xs text-ink-500">Why this list exists</span>
              <p className="text-sm text-ink-500 mt-0.5">{list.selection_reason}</p>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export function MarketTrendsSection({ trends }: { trends: MarketTrend[] }) {
  if (trends.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No market trends generated yet.</div>;
  const impactTone = { transformative: 'error', high: 'warning', medium: 'brand', low: 'neutral' } as const;
  const typeIcon = { growth: TrendingUp, decline: TrendingDown, emerging: Sparkles, disruption: Zap, regulatory: Shield, technology: Layers, consumer_behavior: Target, economic: BarChart3 } as const;
  return (
    <div className="space-y-3">
      {trends.map((trend) => {
        const TypeIcon = typeIcon[trend.trend_type] ?? TrendingUp;
        return (
          <Card key={trend.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                  <TypeIcon className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{trend.trend_name}</p>
                  <p className="text-xs text-ink-500 capitalize">{trend.trend_type.replace(/_/g, ' ')} · {trend.time_horizon?.replace(/_/g, ' ') ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={impactTone[trend.impact_level]} dot>{trend.impact_level}</Badge>
                <MarketAIBadge confidence={trend.confidence * 100} />
              </div>
            </div>
            {trend.description && <p className="text-sm text-ink-500 mb-3">{trend.description}</p>}
            <div className="flex flex-wrap gap-2 mb-3">
              {trend.affected_industries?.map((ind, i) => <Badge key={i} tone="neutral">{ind}</Badge>)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-xs text-ink-500">Momentum</span><p className="text-sm text-ink-500">{trend.momentum}/100</p></div>
              <div><span className="text-xs text-ink-500">Signal Count</span><p className="text-sm text-ink-500">{trend.signal_count}</p></div>
            </div>
            {trend.opportunity && (
              <div className="mt-3 pt-3 border-t border-gold-500/8 flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{trend.opportunity}</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function MarketIntelligenceEmpty({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20">
        <Radar className="h-8 w-8 text-brand-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Discover Market Opportunities</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
          The Market Intelligence Engine analyzes your market, discovers companies with buying signals, scores opportunities, and generates target account lists — all powered by AI.
        </p>
      </div>
      <Button variant="glow" size="lg" onClick={onGenerate} loading={isGenerating}>
        <Radar className="h-4 w-4" />
        Generate Market Intelligence
      </Button>
    </div>
  );
}
