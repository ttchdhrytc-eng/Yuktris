import {
  MessageSquare, Brain, Target, Zap, AlertTriangle, TrendingUp,
  CheckCircle2, XCircle, Clock, Shield, Sparkles, Send, Reply,
  Activity, Users, Building2, Gauge, Star, ArrowRight, Lightbulb,
  ThumbsUp, ThumbsDown, Calendar, FileText, Calculator, Headphones,
  Coffee, UserCog, Mail,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type {
  ConversationWithIntelligence, ConversationIntelligenceDashboard,
  ConversationEvent, PrimaryIntent, BuyingStage, RecommendedAction,
  MeetingReadiness, RiskLevel, ConversationLabelType,
} from '@/types/conversation-intelligence';

// ============================================================
// AI Badge
// ============================================================
export function CIAIBadge({ confidence }: { confidence?: number }) {
  return (
    <Badge tone="brand" className="gap-1">
      <Sparkles className="h-3 w-3" />
      AI{confidence ? ` · ${Math.round(confidence * 100)}%` : ''}
    </Badge>
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
      {label && <span className="text-xs text-ink-500 w-24 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-8 text-right">{Math.round(score)}</span>
    </div>
  );
}

// ============================================================
// Intent Badge
// ============================================================
const INTENT_CONFIG: Record<string, { label: string; tone: 'success' | 'warning' | 'error' | 'brand' | 'neutral' }> = {
  positive_interest: { label: 'Positive Interest', tone: 'success' },
  negative_interest: { label: 'Negative Interest', tone: 'error' },
  question: { label: 'Question', tone: 'brand' },
  objection: { label: 'Objection', tone: 'warning' },
  pricing_request: { label: 'Pricing Request', tone: 'success' },
  demo_request: { label: 'Demo Request', tone: 'success' },
  meeting_request: { label: 'Meeting Request', tone: 'success' },
  referral: { label: 'Referral', tone: 'brand' },
  need_more_info: { label: 'Need More Info', tone: 'brand' },
  competitor_mention: { label: 'Competitor Mention', tone: 'warning' },
  budget_concern: { label: 'Budget Concern', tone: 'warning' },
  authority_concern: { label: 'Authority Concern', tone: 'warning' },
  timing_concern: { label: 'Timing Concern', tone: 'warning' },
  security_concern: { label: 'Security Concern', tone: 'warning' },
  compliance_concern: { label: 'Compliance Concern', tone: 'warning' },
  no_interest: { label: 'No Interest', tone: 'neutral' },
  not_decision_maker: { label: 'Not Decision Maker', tone: 'neutral' },
  follow_up_later: { label: 'Follow Up Later', tone: 'neutral' },
  spam: { label: 'Spam', tone: 'neutral' },
  unknown: { label: 'Unknown', tone: 'neutral' },
};

export function IntentBadge({ intent }: { intent: PrimaryIntent }) {
  const config = INTENT_CONFIG[intent] ?? { label: intent, tone: 'neutral' as const };
  return <Badge tone={config.tone} dot>{config.label}</Badge>;
}

// ============================================================
// Buying Stage Badge
// ============================================================
const STAGE_CONFIG: Record<string, { label: string; tone: 'neutral' | 'brand' | 'warning' | 'success' | 'error' }> = {
  cold: { label: 'Cold', tone: 'neutral' },
  aware: { label: 'Aware', tone: 'brand' },
  interested: { label: 'Interested', tone: 'brand' },
  evaluating: { label: 'Evaluating', tone: 'warning' },
  decision: { label: 'Decision', tone: 'warning' },
  negotiation: { label: 'Negotiation', tone: 'warning' },
  meeting_scheduled: { label: 'Meeting Scheduled', tone: 'success' },
  proposal_sent: { label: 'Proposal Sent', tone: 'success' },
  closed_won: { label: 'Closed Won', tone: 'success' },
  closed_lost: { label: 'Closed Lost', tone: 'error' },
};

export function BuyingStageBadge({ stage }: { stage: BuyingStage }) {
  const config = STAGE_CONFIG[stage] ?? { label: stage, tone: 'neutral' as const };
  return <Badge tone={config.tone} dot>{config.label}</Badge>;
}

// ============================================================
// Meeting Readiness Badge
// ============================================================
const READINESS_CONFIG: Record<string, { label: string; tone: 'neutral' | 'brand' | 'warning' | 'success' }> = {
  not_ready: { label: 'Not Ready', tone: 'neutral' },
  warming_up: { label: 'Warming Up', tone: 'brand' },
  almost_ready: { label: 'Almost Ready', tone: 'warning' },
  ready: { label: 'Ready', tone: 'success' },
  handed_off: { label: 'Handed Off', tone: 'success' },
};

export function MeetingReadinessBadge({ readiness }: { readiness: MeetingReadiness }) {
  const config = READINESS_CONFIG[readiness] ?? { label: readiness, tone: 'neutral' as const };
  return <Badge tone={config.tone} dot>{config.label}</Badge>;
}

// ============================================================
// Recommended Action Badge
// ============================================================
const ACTION_CONFIG: Record<string, { label: string; icon: typeof Reply; tone: 'success' | 'warning' | 'error' | 'brand' | 'neutral' }> = {
  reply_now: { label: 'Reply Now', icon: Reply, tone: 'brand' },
  wait: { label: 'Wait', icon: Clock, tone: 'neutral' },
  book_meeting: { label: 'Book Meeting', icon: Calendar, tone: 'success' },
  send_proposal: { label: 'Send Proposal', icon: FileText, tone: 'brand' },
  send_case_study: { label: 'Send Case Study', icon: FileText, tone: 'brand' },
  send_roi_calculator: { label: 'Send ROI Calculator', icon: Calculator, tone: 'brand' },
  escalate_to_sales: { label: 'Escalate to Sales', icon: UserCog, tone: 'warning' },
  escalate_to_founder: { label: 'Escalate to Founder', icon: UserCog, tone: 'warning' },
  escalate_to_support: { label: 'Escalate to Support', icon: Headphones, tone: 'warning' },
  disqualify: { label: 'Disqualify', icon: XCircle, tone: 'neutral' },
  nurture: { label: 'Nurture', icon: Coffee, tone: 'neutral' },
  no_action: { label: 'No Action', icon: Clock, tone: 'neutral' },
};

export function RecommendedActionBadge({ action }: { action: RecommendedAction }) {
  const config = ACTION_CONFIG[action] ?? { label: action, icon: Clock, tone: 'neutral' as const };
  const Icon = config.icon;
  return <Badge tone={config.tone} className="gap-1"><Icon className="h-3 w-3" />{config.label}</Badge>;
}

// ============================================================
// Risk Badge
// ============================================================
const RISK_CONFIG: Record<string, { tone: 'success' | 'warning' | 'error' | 'neutral' }> = {
  low: { tone: 'success' },
  medium: { tone: 'warning' },
  high: { tone: 'error' },
  critical: { tone: 'error' },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_CONFIG[level] ?? { tone: 'neutral' as const };
  return <Badge tone={config.tone} dot>Risk: {level}</Badge>;
}

// ============================================================
// Label Badge
// ============================================================
const LABEL_CONFIG: Record<string, { tone: 'success' | 'warning' | 'error' | 'brand' | 'neutral' }> = {
  hot_lead: { tone: 'success' },
  warm_lead: { tone: 'brand' },
  cold_lead: { tone: 'neutral' },
  objection: { tone: 'warning' },
  meeting_ready: { tone: 'success' },
  pricing_discussion: { tone: 'brand' },
  competitor_mentioned: { tone: 'warning' },
  decision_maker: { tone: 'success' },
  champion: { tone: 'success' },
  detractor: { tone: 'error' },
  escalated: { tone: 'error' },
  nurture: { tone: 'neutral' },
  disqualified: { tone: 'neutral' },
  high_priority: { tone: 'error' },
  urgent_reply_needed: { tone: 'error' },
  human_escalation: { tone: 'error' },
};

export function LabelBadge({ label }: { label: ConversationLabelType }) {
  const config = LABEL_CONFIG[label] ?? { tone: 'neutral' as const };
  return <Badge tone={config.tone}>{label.replace(/_/g, ' ')}</Badge>;
}

// ============================================================
// Dashboard Section
// ============================================================
export function CIDashboardSection({ dashboard, onAnalyze, isAnalyzing }: {
  dashboard: ConversationIntelligenceDashboard;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><MessageSquare className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Conversations</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalConversations}</p>
          <p className="text-xs text-ink-500">{dashboard.activeConversations} active</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-success-400" /><span className="text-xs text-ink-500">High Intent</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.highIntentLeads}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Calendar className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Meeting Ready</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.meetingReadyCount}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Gauge className="h-4 w-4 text-warning-500" /><span className="text-xs text-ink-500">Avg Score</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.avgScore}</p>
          <p className="text-xs text-ink-500">{dashboard.urgentReplies} urgent</p>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Brain className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-medium text-ink-500">Conversation Intelligence Engine</p>
            <p className="text-xs text-ink-500">{dashboard.objectionCount} objections detected · {dashboard.urgentReplies} urgent replies needed</p>
          </div>
        </div>
        <button onClick={onAnalyze} disabled={isAnalyzing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
          <Zap className="h-4 w-4" />
          {isAnalyzing ? 'Analyzing...' : 'Analyze Conversations'}
        </button>
      </div>

      {dashboard.topConversations.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Star className="h-4 w-4 text-warning-500" /><span className="text-sm font-medium text-ink-500">Top Priority Conversations</span></div>
          <div className="space-y-2">
            {dashboard.topConversations.slice(0, 5).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Building2 className="h-4 w-4 text-brand-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-ink-500">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
                    <p className="text-xs text-ink-500">{c.prospect_title ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {c.intents[0] && <IntentBadge intent={c.intents[0].primary_intent} />}
                  <BuyingStageBadge stage={c.buying_stage} />
                  {c.score && <span className="text-sm font-bold text-ink-500">{c.score.overall_score}</span>}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {dashboard.recentEvents.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Activity className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Recent Events</span></div>
          <div className="space-y-1">
            {dashboard.recentEvents.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <div className={cn('h-1.5 w-1.5 rounded-full', e.event_type === 'message_received' ? 'bg-success-500' : 'bg-gradient-to-r from-gold-400 to-gold-300')} />
                <span className="text-ink-500 capitalize">{e.event_type.replace(/_/g, ' ')}</span>
                <span className="text-ink-500">{timeAgo(e.created_at)}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ============================================================
// Conversation Card (full intelligence)
// ============================================================
export function ConversationCard({ conversation }: { conversation: ConversationWithIntelligence }) {
  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Users className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-semibold text-ink-500">{conversation.prospect_name ?? conversation.company_name ?? 'Unknown'}</p>
            <p className="text-xs text-ink-500">{conversation.prospect_title ?? '—'} · {conversation.company_name ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {conversation.score && <span className="text-lg font-bold text-ink-500">{conversation.score.overall_score}</span>}
          <CIAIBadge confidence={conversation.overall_confidence} />
        </div>
      </div>

      {/* Labels */}
      {conversation.labels.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {conversation.labels.map((l) => <LabelBadge key={l.id} label={l.label} />)}
        </div>
      )}

      {/* Intent + Stage + Readiness + Risk */}
      <div className="flex flex-wrap items-center gap-2">
        {conversation.intents[0] && <IntentBadge intent={conversation.intents[0].primary_intent} />}
        <BuyingStageBadge stage={conversation.buying_stage} />
        <MeetingReadinessBadge readiness={conversation.meeting_readiness_level} />
        <RiskBadge level={conversation.risk_level} />
        {conversation.intents[0] && (
          <Badge tone="neutral" className="gap-1">
            <Zap className="h-3 w-3" />
            {conversation.intents[0].urgency} urgency
          </Badge>
        )}
      </div>

      {/* Intent Reasoning */}
      {conversation.intents[0]?.reasoning && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
          <div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm text-ink-500">{conversation.intents[0].reasoning}</p></div>
        </div>
      )}

      {/* Scores */}
      {conversation.score && (
        <div className="space-y-1.5">
          <ScoreBar score={conversation.score.intent_score} label="Intent" />
          <ScoreBar score={conversation.score.sentiment_score} label="Sentiment" />
          <ScoreBar score={conversation.score.engagement_score} label="Engagement" />
          <ScoreBar score={conversation.score.buying_stage_score} label="Buy Stage" />
          <ScoreBar score={conversation.score.meeting_readiness_score} label="Meeting" />
        </div>
      )}

      {/* Recommendation */}
      {conversation.recommendations[0] && (
        <div className="p-3 rounded-lg bg-success-500/5 border border-success-500/10">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2"><Target className="h-4 w-4 text-success-400" /><span className="text-xs text-ink-500">Recommended Action</span></div>
            <RecommendedActionBadge action={conversation.recommendations[0].recommended_action} />
          </div>
          <p className="text-sm text-ink-500">{conversation.recommendations[0].action_reason}</p>
          {conversation.recommendations[0].reasoning && <p className="text-xs text-ink-500 mt-1">{conversation.recommendations[0].reasoning}</p>}
        </div>
      )}

      {/* Suggested Replies */}
      {conversation.replies.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Reply className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500">Suggested Replies</span></div>
          <div className="space-y-1.5">
            {conversation.replies.slice(0, 3).map((r) => (
              <div key={r.id} className="p-2.5 rounded-lg bg-card-900/50 border border-gold-500/8">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-ink-500 capitalize">{r.reply_type.replace(/_/g, ' ')}</span>
                  <Badge tone="neutral">{Math.round(r.confidence * 100)}%</Badge>
                </div>
                <p className="text-sm text-ink-500">{r.reply_text}</p>
                {r.cta && <p className="text-xs text-brand-400 mt-1">CTA: {r.cta}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Summary */}
      {conversation.summary && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
          <div className="flex items-center gap-2 mb-1"><Sparkles className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500">AI Summary</span></div>
          <p className="text-sm text-ink-500">{conversation.summary.summary}</p>
          {conversation.summary.next_action && <p className="text-xs text-ink-500 mt-1">Next: {conversation.summary.next_action}</p>}
          {conversation.summary.executive_summary && <p className="text-xs text-ink-500 mt-2 pt-2 border-t border-gold-500/8">{conversation.summary.executive_summary}</p>}
        </div>
      )}

      {/* Messages Timeline */}
      {conversation.messages.length > 0 && (
        <div className="pt-2 border-t border-gold-500/8">
          <span className="text-xs text-ink-500 block mb-2">Conversation Timeline</span>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {conversation.messages.slice(-10).map((m) => (
              <div key={m.id} className={cn('flex items-start gap-2 text-xs', m.sender === 'prospect' ? '' : 'flex-row-reverse')}>
                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0 mt-1', m.sender === 'prospect' ? 'bg-success-500' : 'bg-gradient-to-r from-gold-400 to-gold-300')} />
                <div className="flex-1 min-w-0">
                  <span className="text-ink-500 capitalize">{m.sender}</span>
                  <p className="text-ink-500 truncate">{m.content}</p>
                  <span className="text-ink-500">{timeAgo(m.timestamp ?? m.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Live Conversations Section
// ============================================================
export function LiveConversationsSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  if (conversations.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No conversations yet. Run analysis to ingest LinkedIn history.</div>;
  return <div className="space-y-3">{conversations.map((c) => <ConversationCard key={c.id} conversation={c} />)}</div>;
}

// ============================================================
// AI Analysis Section
// ============================================================
export function AIAnalysisSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withAnalysis = conversations.filter((c) => c.intents.length > 0 || c.score);
  if (withAnalysis.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No AI analysis yet.</div>;
  return <div className="space-y-3">{withAnalysis.map((c) => <ConversationCard key={c.id} conversation={c} />)}</div>;
}

// ============================================================
// Intent Detection Section
// ============================================================
export function IntentSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withIntents = conversations.filter((c) => c.intents.length > 0);
  if (withIntents.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No intent detection yet.</div>;
  return (
    <div className="space-y-3">
      {withIntents.map((c) => (
        <Card key={c.id} className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-500">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
            {c.intents[0] && <IntentBadge intent={c.intents[0].primary_intent} />}
          </div>
          {c.intents[0]?.conversation_goal && <p className="text-sm text-ink-500">Goal: {c.intents[0].conversation_goal}</p>}
          {c.intents[0]?.reasoning && <p className="text-xs text-ink-500">{c.intents[0].reasoning}</p>}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-ink-500">Buy likelihood: <span className="text-ink-500">{Math.round((c.intents[0]?.likelihood_to_buy ?? 0) * 100)}%</span></span>
            <span className="text-ink-500">Meeting likelihood: <span className="text-ink-500">{Math.round((c.intents[0]?.meeting_likelihood ?? 0) * 100)}%</span></span>
            <span className="text-ink-500">Urgency: <span className="text-ink-500 capitalize">{c.intents[0]?.urgency}</span></span>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Buying Stage Section
// ============================================================
export function BuyingStageSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withStages = conversations.filter((c) => c.buyingStages.length > 0);
  if (withStages.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No buying stage data yet.</div>;
  return (
    <div className="space-y-3">
      {withStages.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-ink-500">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
            <BuyingStageBadge stage={c.buying_stage} />
          </div>
          {c.buyingStages[0]?.stage_reason && <p className="text-sm text-ink-500 mb-2">{c.buyingStages[0].stage_reason}</p>}
          {c.buyingStages[0]?.previous_stage && (
            <div className="flex items-center gap-2 text-xs text-ink-500">
              <span className="capitalize">{c.buyingStages[0].previous_stage.replace(/_/g, ' ')}</span>
              <ArrowRight className="h-3 w-3" />
              <span className="capitalize font-medium text-ink-500">{c.buying_stage.replace(/_/g, ' ')}</span>
              <span>· v{c.buyingStages[0].version}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Objections Section
// ============================================================
export function ObjectionsSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withObjections = conversations.filter((c) => c.objections.length > 0);
  if (withObjections.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No objections detected yet.</div>;
  return (
    <div className="space-y-3">
      {withObjections.map((c) => (
        <Card key={c.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-2">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
          <div className="space-y-2">
            {c.objections.map((o) => (
              <div key={o.id} className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-warning-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-ink-500 capitalize">{o.objection_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-ink-500">Severity: {o.severity}</p>
                  {o.recommended_response && <p className="text-xs text-ink-500 mt-1">Response: {o.recommended_response}</p>}
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
// Suggested Replies Section
// ============================================================
export function SuggestedRepliesSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withReplies = conversations.filter((c) => c.replies.length > 0);
  if (withReplies.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No suggested replies yet.</div>;
  return (
    <div className="space-y-3">
      {withReplies.map((c) => (
        <Card key={c.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-2">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
          <div className="space-y-2">
            {c.replies.map((r) => (
              <div key={r.id} className="p-3 rounded-lg bg-card-900/50 border border-gold-500/8">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-ink-500 capitalize">{r.reply_type.replace(/_/g, ' ')}</span>
                  <div className="flex items-center gap-2">
                    <Badge tone="neutral">{Math.round(r.confidence * 100)}%</Badge>
                    <Badge tone={r.status === 'pending' ? 'neutral' : r.status === 'approved' ? 'success' : 'error'}>{r.status}</Badge>
                  </div>
                </div>
                <p className="text-sm text-ink-500">{r.reply_text}</p>
                {r.cta && <p className="text-xs text-brand-400 mt-1">CTA: {r.cta}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Recommendations Section
// ============================================================
export function RecommendationsSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withRecs = conversations.filter((c) => c.recommendations.length > 0);
  if (withRecs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No recommendations yet.</div>;
  return (
    <div className="space-y-3">
      {withRecs.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-ink-500">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
            {c.recommendations[0] && <RecommendedActionBadge action={c.recommendations[0].recommended_action} />}
          </div>
          {c.recommendations.map((r) => (
            <div key={r.id} className="space-y-1">
              <p className="text-sm text-ink-500">{r.action_reason}</p>
              {r.reasoning && <p className="text-xs text-ink-500">{r.reasoning}</p>}
              <div className="flex items-center gap-2">
                <Badge tone="neutral">Priority: {r.action_priority}</Badge>
                <Badge tone="neutral">Confidence: {Math.round(r.confidence * 100)}%</Badge>
              </div>
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Timeline Section
// ============================================================
export function TimelineSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  if (conversations.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No conversations yet.</div>;
  return (
    <div className="space-y-3">
      {conversations.map((c) => (
        <Card key={c.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {c.messages.map((m) => (
              <div key={m.id} className={cn('flex items-start gap-2 text-xs', m.sender === 'prospect' ? '' : 'flex-row-reverse')}>
                <div className={cn('h-1.5 w-1.5 rounded-full shrink-0 mt-1', m.sender === 'prospect' ? 'bg-success-500' : m.sender === 'ai' ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-gray-500')} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-ink-500 capitalize">{m.sender}</span>
                    <span className="text-ink-500">{timeAgo(m.timestamp ?? m.created_at)}</span>
                  </div>
                  <p className="text-ink-500">{m.content}</p>
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
// Summary Section
// ============================================================
export function SummarySection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withSummary = conversations.filter((c) => c.summary);
  if (withSummary.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No summaries yet.</div>;
  return (
    <div className="space-y-3">
      {withSummary.map((c) => (
        <Card key={c.id} className="p-4 space-y-2">
          <p className="text-sm font-semibold text-ink-500">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
          {c.summary?.summary && <p className="text-sm text-ink-500">{c.summary.summary}</p>}
          {c.summary?.executive_summary && <p className="text-xs text-ink-500 pt-2 border-t border-gold-500/8">{c.summary.executive_summary}</p>}
          {c.summary?.next_action && <div className="flex items-center gap-2 pt-1"><ArrowRight className="h-3.5 w-3.5 text-brand-400" /><p className="text-sm text-ink-500">{c.summary.next_action}</p></div>}
          {c.summary?.recommended_followup && <p className="text-xs text-ink-500">Follow-up: {c.summary.recommended_followup}</p>}
          {c.summary?.escalation_suggestion && <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-warning-500" /><p className="text-xs text-warning-500">{c.summary.escalation_suggestion}</p></div>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Score Section
// ============================================================
export function ScoreSection({ conversations }: { conversations: ConversationWithIntelligence[] }) {
  const withScores = conversations.filter((c) => c.score);
  if (withScores.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No scores yet.</div>;
  return (
    <div className="space-y-3">
      {withScores.map((c) => (
        <Card key={c.id} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-ink-500">{c.prospect_name ?? c.company_name ?? 'Unknown'}</p>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-ink-500">{c.score!.overall_score}</span>
              <CIAIBadge confidence={c.score!.confidence} />
            </div>
          </div>
          <div className="space-y-1.5">
            <ScoreBar score={c.score!.intent_score} label="Intent" />
            <ScoreBar score={c.score!.sentiment_score} label="Sentiment" />
            <ScoreBar score={c.score!.engagement_score} label="Engagement" />
            <ScoreBar score={c.score!.buying_stage_score} label="Buy Stage" />
            <ScoreBar score={c.score!.meeting_readiness_score} label="Meeting" />
            <ScoreBar score={c.score!.risk_score} label="Risk" />
          </div>
          {c.score!.score_explanation && Object.keys(c.score!.score_explanation).length > 0 && (
            <div className="mt-3 pt-3 border-t border-gold-500/8 space-y-1">
              {Object.entries(c.score!.score_explanation).map(([key, val]) => (
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
// Empty State
// ============================================================
export function ConversationIntelligenceEmpty({ onAnalyze, isAnalyzing }: { onAnalyze: () => void; isAnalyzing: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Brain className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Conversation Intelligence Engine</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI analyzes every conversation to detect intent, sentiment, buying stage, objections, and generates suggested replies and next actions — all without sending messages.</p>
      </div>
      <button onClick={onAnalyze} disabled={isAnalyzing} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />
        {isAnalyzing ? 'Analyzing...' : 'Analyze Conversations'}
      </button>
    </div>
  );
}
