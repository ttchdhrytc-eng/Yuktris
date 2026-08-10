import {
  Sparkles, Target, Rocket, Mail, Linkedin, Zap, Lightbulb, Award,
  TrendingUp, Clock, CheckCircle2, AlertTriangle, Copy, Save, FileCheck,
  ArrowRight, MessageSquare, BarChart3, Brain, Layers, Radio,
} from 'lucide-react';
import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { cn, timeAgo } from '@/lib/utils';
import type {
  FullRevenueStrategy, CampaignStrategy, CampaignSequence,
  ChannelRecommendation, CampaignGoal, MessageLibraryAsset,
  StrategyApproval,
} from '@/types/revenue-strategy';

// ============================================================
// StrategyAIBadge
// ============================================================
export function StrategyAIBadge({ confidence }: { confidence?: number }) {
  return (
    <Badge tone="brand" className="gap-1">
      <Sparkles className="h-3 w-3" />
      AI{confidence ? ` · ${Math.round(confidence)}%` : ''}
    </Badge>
  );
}

// ============================================================
// StrategyOverview
// ============================================================
export function StrategyOverview({ strategy }: { strategy: FullRevenueStrategy }) {
  const s = strategy.strategy;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Target className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-medium text-ink-500">Best Target</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">ICP</span><p className="text-sm text-ink-500">{s.best_market ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Industry</span><p className="text-sm text-ink-500">{s.best_industry ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Company Size</span><p className="text-sm text-ink-500">{s.best_company_size ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Geography</span><p className="text-sm text-ink-500">{s.best_geography ?? '—'}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-success-400" />
            <span className="text-sm font-medium text-ink-500">Messaging</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Angle</span><p className="text-sm text-ink-500">{s.best_messaging_angle ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Channel</span><p className="text-sm text-ink-500 capitalize">{s.best_outreach_channel?.replace(/_/g, ' ') ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Sequence</span><p className="text-sm text-ink-500 capitalize">{s.best_campaign_sequence?.replace(/_/g, ' ') ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Follow-up</span><p className="text-sm text-ink-500">{s.best_follow_up_timing ?? '—'}</p></div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-warning-500" />
            <span className="text-sm font-medium text-ink-500">Expected KPIs</span>
          </div>
          <div className="space-y-2">
            <div><span className="text-xs text-ink-500">Reply Rate</span><p className="text-sm text-ink-500">{s.expected_reply_rate}%</p></div>
            <div><span className="text-xs text-ink-500">Meeting Rate</span><p className="text-sm text-ink-500">{s.expected_meeting_rate}%</p></div>
            <div><span className="text-xs text-ink-500">Expected Revenue</span><p className="text-sm text-ink-500">{s.expected_revenue ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Duration</span><p className="text-sm text-ink-500">{s.estimated_campaign_duration ?? '—'}</p></div>
          </div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-brand-400" />
            <span className="text-sm font-medium text-ink-500">AI Reasoning</span>
          </div>
          <StrategyAIBadge confidence={s.confidence_score} />
        </div>
        <p className="text-sm text-ink-500 leading-relaxed">{s.ai_reasoning ?? 'No AI reasoning provided.'}</p>
      </Card>

      <Card className="p-4">
        <span className="text-sm font-medium text-ink-500 mb-3 block">Best Decision Makers</span>
        <div className="flex flex-wrap gap-2">
          {s.best_decision_makers?.map((dm, i) => <Badge key={i} tone="brand">{dm}</Badge>)}
        </div>
      </Card>
    </div>
  );
}

// ============================================================
// CampaignStrategiesSection
// ============================================================
export function CampaignStrategiesSection({
  campaigns, sequences, onApprove, onDuplicate, onSaveTemplate,
}: {
  campaigns: CampaignStrategy[];
  sequences: Record<string, CampaignSequence[]>;
  onApprove: (id: string) => void;
  onDuplicate: (id: string) => void;
  onSaveTemplate: (id: string) => void;
}) {
  if (campaigns.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No campaign strategies generated yet.</div>;
  }
  return (
    <div className="space-y-4">
      {campaigns.map((campaign) => {
        const campSeqs = sequences[campaign.id] ?? [];
        return (
          <Card key={campaign.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                  <Rocket className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{campaign.strategy_name}</p>
                  <p className="text-xs text-ink-500">{campaign.objective ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={campaign.status === 'approved' ? 'success' : 'neutral'} dot>{campaign.status}</Badge>
                <StrategyAIBadge confidence={campaign.confidence_score * 100} />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div><span className="text-xs text-ink-500">Industry</span><p className="text-sm text-ink-500">{campaign.target_industry ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Company Size</span><p className="text-sm text-ink-500">{campaign.target_company_size ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Risk</span><p className="text-sm text-ink-500 capitalize">{campaign.risk_level ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Expected ROI</span><p className="text-sm text-ink-500">{campaign.expected_roi ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Expected Meetings</span><p className="text-sm text-ink-500">{campaign.expected_meetings}</p></div>
              <div><span className="text-xs text-ink-500">Est. Pipeline</span><p className="text-sm text-ink-500">{campaign.estimated_pipeline ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Primary CTA</span><p className="text-sm text-ink-500">{campaign.primary_cta ?? '—'}</p></div>
              <div><span className="text-xs text-ink-500">Secondary CTA</span><p className="text-sm text-ink-500">{campaign.secondary_cta ?? '—'}</p></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div>
                <span className="text-xs text-ink-500">Pain Points</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {campaign.pain_points?.map((p, i) => <Badge key={i} tone="error">{p}</Badge>)}
                </div>
              </div>
              <div>
                <span className="text-xs text-ink-500">Buying Triggers</span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {campaign.buying_triggers?.map((t, i) => <Badge key={i} tone="warning">{t}</Badge>)}
                </div>
              </div>
            </div>

            {campaign.unique_messaging_angle && (
              <div className="mb-3">
                <span className="text-xs text-ink-500">Unique Messaging Angle</span>
                <p className="text-sm text-ink-500 mt-0.5">{campaign.unique_messaging_angle}</p>
              </div>
            )}
            {campaign.ai_recommendation && (
              <div className="mb-3 p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
                <div className="flex items-start gap-2">
                  <Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-ink-500">{campaign.ai_recommendation}</p>
                </div>
              </div>
            )}

            {campSeqs.length > 0 && (
              <div className="mb-4">
                <span className="text-xs text-ink-500 mb-2 block">Sequence ({campSeqs.length} touches)</span>
                <div className="space-y-2">
                  {campSeqs.map((seq) => (
                    <div key={seq.id} className="flex items-center gap-3 rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 shrink-0 text-xs font-bold text-brand-400">
                        {seq.touch_order}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink-500">{seq.sequence_name}</p>
                        <p className="text-xs text-ink-500">{seq.purpose ?? '—'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone="neutral" className="capitalize">{seq.sequence_type.replace(/_/g, ' ')}</Badge>
                        {seq.delay_between_touches && <span className="text-xs text-ink-500">{seq.delay_between_touches}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 pt-3 border-t border-gold-500/8">
              <Button size="sm" variant="glow" onClick={() => onApprove(campaign.id)} disabled={campaign.status === 'approved'}>
                <FileCheck className="h-3.5 w-3.5" />
                {campaign.status === 'approved' ? 'Approved' : 'Approve'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => onDuplicate(campaign.id)}>
                <Copy className="h-3.5 w-3.5" />
                Duplicate
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSaveTemplate(campaign.id)}>
                <Save className="h-3.5 w-3.5" />
                Save as Template
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// MessagingLibrarySection
// ============================================================
export function MessagingLibrarySection({ assets }: { assets: MessageLibraryAsset[] }) {
  if (assets.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No messaging assets generated yet.</div>;
  }
  const typeIcon: Record<string, typeof Mail> = {
    linkedin_connection_hook: Linkedin,
    linkedin_opening_message: Linkedin,
    follow_up_theme: Clock,
    email_subject_line: Mail,
    email_opener: Mail,
    value_hook: Zap,
    trust_builder: CheckCircle2,
    social_proof: Award,
    industry_angle: Target,
    persona_angle: Target,
    objection_response: AlertTriangle,
    cta_library: ArrowRight,
  };
  const grouped = assets.reduce((acc, a) => {
    (acc[a.asset_type] ??= []).push(a);
    return acc;
  }, {} as Record<string, MessageLibraryAsset[]>);

  return (
    <div className="space-y-4">
      {Object.entries(grouped).map(([type, items]) => {
        const Icon = typeIcon[type] ?? MessageSquare;
        return (
          <Card key={type} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-brand-400" />
                <span className="text-sm font-medium text-ink-500 capitalize">{type.replace(/_/g, ' ')}</span>
              </div>
              <Badge tone="neutral">{items.length}</Badge>
            </div>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                  <p className="text-sm text-ink-500 leading-relaxed">{item.content}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {item.target_persona && <Badge tone="brand">{item.target_persona}</Badge>}
                    {item.target_industry && <Badge tone="success">{item.target_industry}</Badge>}
                    <StrategyAIBadge confidence={item.confidence_score * 100} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// ChannelRecommendationsSection
// ============================================================
export function ChannelRecommendationsSection({ channels }: { channels: ChannelRecommendation[] }) {
  if (channels.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No channel recommendations generated yet.</div>;
  }
  return (
    <div className="space-y-3">
      {channels.map((ch) => (
        <Card key={ch.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                <Radio className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-ink-500 capitalize">{ch.channel.replace(/_/g, ' ')}</p>
                {ch.is_primary && <Badge tone="success" dot>Primary</Badge>}
              </div>
            </div>
            <StrategyAIBadge confidence={ch.confidence_score * 100} />
          </div>
          <p className="text-sm text-ink-500 mb-2">{ch.recommendation}</p>
          {ch.reasoning && (
            <div className="flex items-start gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <p className="text-sm text-ink-500">{ch.reasoning}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div><span className="text-xs text-ink-500">Est. Reply Rate</span><p className="text-sm text-ink-500">{ch.estimated_reply_rate ? `${ch.estimated_reply_rate}%` : '—'}</p></div>
            <div><span className="text-xs text-ink-500">Est. Meeting Rate</span><p className="text-sm text-ink-500">{ch.estimated_meeting_rate ? `${ch.estimated_meeting_rate}%` : '—'}</p></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// CampaignGoalsSection
// ============================================================
export function CampaignGoalsSection({ goals }: { goals: CampaignGoal[] }) {
  if (goals.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No campaign goals generated yet.</div>;
  }
  const goalIcon: Record<string, typeof Target> = {
    book_meetings: Target,
    generate_demos: Rocket,
    generate_qualified_opportunities: Award,
    enterprise_expansion: TrendingUp,
    partnership_outreach: Handshake,
    affiliate_recruitment: Users,
    account_expansion: Layers,
    product_launch: Zap,
    hiring_outreach: Mail,
  };
  return (
    <div className="space-y-3">
      {goals.map((goal) => {
        const Icon = goalIcon[goal.goal_type] ?? Target;
        return (
          <Card key={goal.id} className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10">
                  <Icon className="h-4 w-4 text-brand-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-500 capitalize">{goal.goal_type.replace(/_/g, ' ')}</p>
                  {goal.target_value && <p className="text-xs text-ink-500">Target: {goal.target_value}</p>}
                </div>
              </div>
              <StrategyAIBadge confidence={goal.confidence_score * 100} />
            </div>
            {goal.goal_description && <p className="text-sm text-ink-500 mb-2">{goal.goal_description}</p>}
            {goal.messaging_adaptation && (
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-sm text-ink-500">{goal.messaging_adaptation}</p>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// ApprovalCenterSection
// ============================================================
export function ApprovalCenterSection({ approvals }: { approvals: StrategyApproval[] }) {
  if (approvals.length === 0) {
    return <div className="text-center py-8 text-sm text-ink-500">No approval activity yet. Approve campaigns from the Campaign Strategies tab.</div>;
  }
  return (
    <div className="space-y-2">
      {approvals.map((approval) => (
        <Card key={approval.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {approval.action === 'approve' && <FileCheck className="h-4 w-4 text-success-400" />}
              {approval.action === 'duplicate' && <Copy className="h-4 w-4 text-brand-400" />}
              {approval.action === 'save_template' && <Save className="h-4 w-4 text-warning-500" />}
              <span className="text-sm text-ink-500 capitalize">{approval.action.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone={approval.status === 'approved' || approval.status === 'completed' ? 'success' : 'neutral'} dot>
                {approval.status}
              </Badge>
              <span className="text-xs text-ink-500">{timeAgo(approval.created_at)}</span>
            </div>
          </div>
          {approval.feedback && <p className="text-xs text-ink-500 mt-1">{approval.feedback}</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// StrategyEmpty
// ============================================================
export function StrategyEmpty({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20">
        <Brain className="h-8 w-8 text-brand-400" />
      </div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Generate Your Revenue Strategy</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">
          The Revenue Strategy Engine analyzes your Revenue DNA, market intelligence, and opportunities to design complete campaign strategies with messaging, sequences, channels, and goals — before any outreach begins.
        </p>
      </div>
      <Button variant="glow" size="lg" onClick={onGenerate} loading={isGenerating}>
        <Sparkles className="h-4 w-4" />
        Generate Revenue Strategy
      </Button>
    </div>
  );
}

// Need additional icon imports
import { Handshake, Users } from 'lucide-react';
