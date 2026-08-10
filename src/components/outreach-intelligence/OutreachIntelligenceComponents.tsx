import {
  Sparkles, Brain, Zap, Clock, Radio, MessageSquare, Target, Shield,
  TrendingUp, Users, Building2, Lightbulb, ArrowRight, Activity,
  CheckCircle2, AlertTriangle, Coffee, Send, Mail, Linkedin,
  Video, Mic, Calendar, Gauge, Award, Star,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type {
  OutreachDashboard, ProspectOutreachIntelligence,
  OutreachDecision as OutreachDecisionType, OutreachScore,
  TimingRecommendation, ChannelStrategy, MessageStrategy,
  PersonalizationProfile, OutreachReasoning,
  CTALibraryEntry, IcebreakerLibraryEntry, TrustSignalLibraryEntry,
} from '@/types/outreach-intelligence';

// ============================================================
// AI Badge
// ============================================================
export function OutreachAIBadge({ confidence }: { confidence?: number }) {
  return (
    <Badge tone="brand" className="gap-1">
      <Sparkles className="h-3 w-3" />
      AI{confidence ? ` · ${Math.round(confidence)}%` : ''}
    </Badge>
  );
}

// ============================================================
// Score Bar
// ============================================================
function ScoreBar({ score, label, max = 100 }: { score: number; label?: string; max?: number }) {
  const pct = Math.min((score / max) * 100, 100);
  const color = pct >= 70 ? 'bg-success-500' : pct >= 40 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-xs text-ink-500 w-20 shrink-0">{label}</span>}
      <div className="h-1.5 flex-1 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-ink-500 w-10 text-right">
        {max === 1 ? `${Math.round(score * 100)}%` : Math.round(score)}
      </span>
    </div>
  );
}

// ============================================================
// Decision Badge
// ============================================================
const DECISION_LABELS: Record<string, { label: string; tone: 'success' | 'warning' | 'brand' | 'neutral' | 'error' }> = {
  contact_immediately: { label: 'Contact Now', tone: 'success' },
  wait_3_days: { label: 'Wait 3 Days', tone: 'warning' },
  wait_7_days: { label: 'Wait 7 Days', tone: 'warning' },
  engage_content_first: { label: 'Engage First', tone: 'brand' },
  connect_first: { label: 'Connect First', tone: 'brand' },
  email_first: { label: 'Email First', tone: 'brand' },
  linkedin_first: { label: 'LinkedIn First', tone: 'brand' },
  multi_channel: { label: 'Multi-Channel', tone: 'brand' },
  skip_prospect: { label: 'Skip', tone: 'neutral' },
  revisit_later: { label: 'Revisit Later', tone: 'neutral' },
};

export function DecisionBadge({ decision }: { decision: string }) {
  const config = DECISION_LABELS[decision] ?? { label: decision, tone: 'neutral' as const };
  return <Badge tone={config.tone} dot>{config.label}</Badge>;
}

// ============================================================
// Dashboard Section
// ============================================================
export function OutreachDashboardSection({ dashboard, onGenerate, isGenerating }: {
  dashboard: OutreachDashboard;
  onGenerate: () => void;
  isGenerating: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Total Prospects</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalProspects}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Zap className="h-4 w-4 text-success-400" /><span className="text-xs text-ink-500">Contact Now</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.contactImmediately}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Gauge className="h-4 w-4 text-warning-500" /><span className="text-xs text-ink-500">Avg Score</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.avgOutreachScore}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Avg Reply %</span></div>
          <p className="text-2xl font-bold text-ink-500">{Math.round(dashboard.avgReplyProbability * 100)}%</p>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Brain className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-medium text-ink-500">Outreach Intelligence Engine</p>
            <p className="text-xs text-ink-500">{dashboard.totalDecided} prospects analyzed · {dashboard.waitOrNurture} waiting · {dashboard.skipOrRevisit} skipped</p>
          </div>
        </div>
        <button onClick={onGenerate} disabled={isGenerating} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
          <Zap className="h-4 w-4" />
          {isGenerating ? 'Generating...' : 'Generate Intelligence'}
        </button>
      </div>

      {dashboard.topProspects.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Star className="h-4 w-4 text-warning-500" /><span className="text-sm font-medium text-ink-500">Top Priority Prospects</span></div>
          <div className="space-y-2">
            {dashboard.topProspects.slice(0, 5).map((p) => (
              <div key={`${p.company.id}-${p.contact?.id ?? ''}`} className="flex items-center justify-between rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Building2 className="h-4 w-4 text-brand-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-ink-500">{p.company.name}</p>
                    <p className="text-xs text-ink-500">{p.contact?.full_name ?? 'Company-level'} · {p.contact?.job_title ?? p.company.industry ?? '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.decision && <DecisionBadge decision={p.decision.decision} />}
                  {p.score && <span className="text-sm font-bold text-ink-500">{p.score.overall_outreach_score}</span>}
                  {p.channel && <ChannelIcon channel={p.channel.recommended_channel} />}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {dashboard.recentReasoning.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Brain className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Recent AI Reasoning</span></div>
          <div className="space-y-2">
            {dashboard.recentReasoning.slice(0, 5).map((r) => (
              <div key={r.id} className="flex items-start gap-2 p-2 rounded-lg bg-card-900/30">
                <Lightbulb className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-ink-500">{r.reasoning_text}</p>
                  <p className="text-xs text-ink-500 mt-0.5 capitalize">{r.reasoning_type} · {timeAgo(r.created_at)}</p>
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
// Channel Icon
// ============================================================
function ChannelIcon({ channel }: { channel: string }) {
  const icons: Record<string, typeof Linkedin> = { linkedin: Linkedin, email: Mail, linkedin_email: MessageSquare, voice_note: Mic, video: Video, multi_channel: Radio };
  const Icon = icons[channel] ?? Radio;
  return <Icon className="h-4 w-4 text-ink-500" />;
}

// ============================================================
// Prospect Intelligence Card
// ============================================================
export function ProspectIntelligenceCard({ prospect }: { prospect: ProspectOutreachIntelligence }) {
  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Building2 className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-semibold text-ink-500">{prospect.company.name}</p>
            <p className="text-xs text-ink-500">{prospect.contact?.full_name ?? '—'} · {prospect.contact?.job_title ?? prospect.company.industry ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {prospect.decision && <DecisionBadge decision={prospect.decision.decision} />}
          {prospect.score && <span className="text-lg font-bold text-ink-500">{prospect.score.overall_outreach_score}</span>}
          {prospect.decision && <OutreachAIBadge confidence={prospect.decision.confidence_score * 100} />}
        </div>
      </div>

      {/* Decision Reason */}
      {prospect.decision && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
          <div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm text-ink-500">{prospect.decision.decision_reason}</p></div>
        </div>
      )}

      {/* Scores */}
      {prospect.score && (
        <div className="space-y-1.5">
          <ScoreBar score={prospect.score.connection_probability} label="Connect %" max={1} />
          <ScoreBar score={prospect.score.reply_probability} label="Reply %" max={1} />
          <ScoreBar score={prospect.score.meeting_probability} label="Meeting %" max={1} />
          <ScoreBar score={prospect.score.personalization_score} label="Personal." />
          <ScoreBar score={prospect.score.timing_score} label="Timing" />
        </div>
      )}

      {/* Channel + Timing */}
      <div className="grid grid-cols-2 gap-3">
        {prospect.channel && (
          <div className="p-3 rounded-lg bg-card-900/50 border border-gold-500/8">
            <div className="flex items-center gap-1.5 mb-1"><ChannelIcon channel={prospect.channel.recommended_channel} /><span className="text-xs text-ink-500">Best Channel</span></div>
            <p className="text-sm text-ink-500 capitalize">{prospect.channel.recommended_channel.replace(/_/g, ' ')}</p>
            <p className="text-xs text-ink-500 mt-1">{prospect.channel.channel_reason}</p>
          </div>
        )}
        {prospect.timing && (
          <div className="p-3 rounded-lg bg-card-900/50 border border-gold-500/8">
            <div className="flex items-center gap-1.5 mb-1"><Clock className="h-3.5 w-3.5 text-ink-500" /><span className="text-xs text-ink-500">Best Time</span></div>
            <p className="text-sm text-ink-500 capitalize">{prospect.timing.best_day ?? '—'} {prospect.timing.best_hour ? `${prospect.timing.best_hour}:00` : ''}</p>
            <p className="text-xs text-ink-500 mt-1">{prospect.timing.timing_reason ?? '—'}</p>
          </div>
        )}
      </div>

      {/* CTA + Icebreaker */}
      {prospect.message && (
        <div className="space-y-2">
          {prospect.message.cta_strategy && (
            <div className="flex items-start gap-2"><Target className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" /><div><span className="text-xs text-ink-500">CTA Strategy</span><p className="text-sm text-ink-500">{prospect.message.cta_strategy}</p></div></div>
          )}
          {prospect.message.connection_request_strategy && (
            <div className="flex items-start gap-2"><Linkedin className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><div><span className="text-xs text-ink-500">Connection Request</span><p className="text-sm text-ink-500">{prospect.message.connection_request_strategy}</p></div></div>
          )}
          {prospect.message.first_message_strategy && (
            <div className="flex items-start gap-2"><Send className="h-3.5 w-3.5 text-ink-500 shrink-0 mt-0.5" /><div><span className="text-xs text-ink-500">First Message</span><p className="text-sm text-ink-500">{prospect.message.first_message_strategy}</p></div></div>
          )}
        </div>
      )}

      {/* Personalization Summary */}
      {prospect.personalization && prospect.personalization.personalization_summary && (
        <div className="p-3 rounded-lg bg-success-500/5 border border-success-500/10">
          <div className="flex items-start gap-2"><Sparkles className="h-4 w-4 text-success-400 shrink-0 mt-0.5" /><div><span className="text-xs text-ink-500">Personalization Summary</span><p className="text-sm text-ink-500">{prospect.personalization.personalization_summary}</p></div></div>
        </div>
      )}

      {/* Reasoning */}
      {prospect.reasoning.length > 0 && (
        <div className="pt-2 border-t border-gold-500/8">
          <span className="text-xs text-ink-500 mb-1 block">AI Reasoning</span>
          <div className="space-y-1">
            {prospect.reasoning.slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-start gap-2">
                <Brain className="h-3 w-3 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-xs text-ink-500">{r.reasoning_text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// Decisions Section
// ============================================================
export function DecisionsSection({ prospects }: { prospects: ProspectOutreachIntelligence[] }) {
  if (prospects.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No outreach decisions yet. Generate intelligence to analyze prospects.</div>;
  return <div className="space-y-3">{prospects.map((p) => <ProspectIntelligenceCard key={`${p.company.id}-${p.contact?.id ?? ''}`} prospect={p} />)}</div>;
}

// ============================================================
// Personalization Section
// ============================================================
export function PersonalizationSection({ prospects }: { prospects: ProspectOutreachIntelligence[] }) {
  const withProfiles = prospects.filter((p) => p.personalization);
  if (withProfiles.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No personalization profiles yet.</div>;
  return (
    <div className="space-y-3">
      {withProfiles.map((p) => (
        <Card key={`${p.company.id}-${p.contact?.id ?? ''}`} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-500">{p.company.name} · {p.contact?.full_name ?? '—'}</p>
            <OutreachAIBadge confidence={(p.personalization?.confidence_score ?? 0.5) * 100} />
          </div>
          {p.personalization?.personalization_summary && <p className="text-sm text-ink-500">{p.personalization.personalization_summary}</p>}
          <div className="grid grid-cols-2 gap-3 text-xs">
            {p.personalization?.communication_style && <div><span className="text-ink-500">Style:</span> <span className="text-ink-500">{p.personalization.communication_style}</span></div>}
            {p.personalization?.tone && <div><span className="text-ink-500">Tone:</span> <span className="text-ink-500">{p.personalization.tone}</span></div>}
            {p.personalization?.value_proposition && <div><span className="text-ink-500">Value Prop:</span> <span className="text-ink-500">{p.personalization.value_proposition}</span></div>}
            {p.personalization?.conversation_angle && <div><span className="text-ink-500">Angle:</span> <span className="text-ink-500">{p.personalization.conversation_angle}</span></div>}
          </div>
          {p.personalization?.icebreakers && Array.isArray(p.personalization.icebreakers) && (p.personalization.icebreakers as unknown[]).length > 0 && (
            <div>
              <span className="text-xs text-ink-500 block mb-1">Icebreakers</span>
              <div className="space-y-1">
                {(p.personalization.icebreakers as Array<{ type?: string; text?: string }>).slice(0, 3).map((ib, i) => (
                  <div key={i} className="flex items-start gap-2"><Coffee className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm text-ink-500">{ib.text ?? JSON.stringify(ib)}</p></div>
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
// Timing Section
// ============================================================
export function TimingSection({ prospects }: { prospects: ProspectOutreachIntelligence[] }) {
  const withTiming = prospects.filter((p) => p.timing);
  if (withTiming.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No timing recommendations yet.</div>;
  return (
    <div className="space-y-3">
      {withTiming.map((p) => (
        <Card key={`${p.company.id}-${p.contact?.id ?? ''}`} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-ink-500">{p.company.name}</p>
            <OutreachAIBadge confidence={(p.timing?.confidence_score ?? 0.5) * 100} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div><span className="text-xs text-ink-500">Best Day</span><p className="text-sm text-ink-500 capitalize">{p.timing!.best_day ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">Best Hour</span><p className="text-sm text-ink-500">{p.timing!.best_hour ? `${p.timing!.best_hour}:00` : '—'}</p></div>
            <div><span className="text-xs text-ink-500">Follow-up</span><p className="text-sm text-ink-500">{p.timing!.follow_up_delay_days} days</p></div>
            <div><span className="text-xs text-ink-500">Max Attempts</span><p className="text-sm text-ink-500">{p.timing!.maximum_attempts}</p></div>
            <div><span className="text-xs text-ink-500">Cooling</span><p className="text-sm text-ink-500">{p.timing!.cooling_period_days} days</p></div>
            <div><span className="text-xs text-ink-500">Retry Window</span><p className="text-sm text-ink-500">{p.timing!.retry_window_days} days</p></div>
            <div><span className="text-xs text-ink-500">Timezone</span><p className="text-sm text-ink-500">{p.timing!.timezone ?? '—'}</p></div>
            <div><span className="text-xs text-ink-500">TZ Aware</span><p className="text-sm text-ink-500">{p.timing!.timezone_aware ? 'Yes' : 'No'}</p></div>
          </div>
          {p.timing!.timing_reason && <p className="text-xs text-ink-500 mt-3 pt-3 border-t border-gold-500/8">{p.timing!.timing_reason}</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Channel Section
// ============================================================
export function ChannelSection({ prospects }: { prospects: ProspectOutreachIntelligence[] }) {
  const withChannel = prospects.filter((p) => p.channel);
  if (withChannel.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No channel strategies yet.</div>;
  return (
    <div className="space-y-3">
      {withChannel.map((p) => (
        <Card key={`${p.company.id}-${p.contact?.id ?? ''}`} className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2"><ChannelIcon channel={p.channel!.recommended_channel} /><p className="text-sm font-semibold text-ink-500 capitalize">{p.channel!.recommended_channel.replace(/_/g, ' ')}</p></div>
            <OutreachAIBadge confidence={(p.channel!.confidence_score ?? 0.5) * 100} />
          </div>
          <p className="text-sm text-ink-500 mb-3">{p.channel!.channel_reason}</p>
          {p.channel!.linkedin_feasibility && <div className="flex items-start gap-2 mb-1"><Linkedin className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" /><p className="text-xs text-ink-500">LinkedIn: {p.channel!.linkedin_feasibility}</p></div>}
          {p.channel!.email_feasibility && <div className="flex items-start gap-2 mb-1"><Mail className="h-3.5 w-3.5 text-ink-500 shrink-0 mt-0.5" /><p className="text-xs text-ink-500">Email: {p.channel!.email_feasibility}</p></div>}
          {p.channel!.channel_priority && Array.isArray(p.channel!.channel_priority) && (p.channel!.channel_priority as Array<{ channel: string; priority: number }>).length > 0 && (
            <div className="flex gap-2 mt-2">{(p.channel!.channel_priority as Array<{ channel: string; priority: number }>).map((c, i) => <Badge key={i} tone="neutral">#{c.priority} {c.channel}</Badge>)}</div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Message Strategy Section
// ============================================================
export function MessageStrategySection({ prospects }: { prospects: ProspectOutreachIntelligence[] }) {
  const withMessages = prospects.filter((p) => p.message);
  if (withMessages.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No message strategies yet.</div>;
  const strategies: Array<{ label: string; icon: typeof Send; field: keyof MessageStrategy }> = [
    { label: 'Connection Request', icon: Linkedin, field: 'connection_request_strategy' },
    { label: 'First Message', icon: Send, field: 'first_message_strategy' },
    { label: 'Second Message', icon: MessageSquare, field: 'second_message_strategy' },
    { label: 'Follow-up', icon: ArrowRight, field: 'follow_up_strategy' },
    { label: 'Re-engagement', icon: Activity, field: 're_engagement_strategy' },
    { label: 'Email', icon: Mail, field: 'email_strategy' },
    { label: 'Voice Note', icon: Mic, field: 'voice_note_strategy' },
    { label: 'Video', icon: Video, field: 'video_strategy' },
    { label: 'CTA', icon: Target, field: 'cta_strategy' },
    { label: 'Objection Prevention', icon: Shield, field: 'objection_prevention_strategy' },
  ];
  return (
    <div className="space-y-3">
      {withMessages.map((p) => (
        <Card key={`${p.company.id}-${p.contact?.id ?? ''}`} className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-500">{p.company.name} · {p.contact?.full_name ?? '—'}</p>
            <OutreachAIBadge confidence={(p.message?.confidence_score ?? 0.5) * 100} />
          </div>
          {strategies.map((s) => {
            const value = p.message![s.field] as string | null;
            if (!value) return null;
            return (
              <div key={s.field} className="flex items-start gap-2">
                <s.icon className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <div><span className="text-xs text-ink-500">{s.label}</span><p className="text-sm text-ink-500">{value}</p></div>
              </div>
            );
          })}
          {p.message!.strategy_reasoning && <p className="text-xs text-ink-500 pt-2 border-t border-gold-500/8">{p.message!.strategy_reasoning}</p>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Library Sections
// ============================================================
export function CTALibrarySection({ entries }: { entries: CTALibraryEntry[] }) {
  if (entries.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No CTAs in library yet.</div>;
  return (
    <div className="space-y-2">
      {entries.map((cta) => (
        <Card key={cta.id} className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2"><Target className="h-4 w-4 text-success-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{cta.cta_text}</p><p className="text-xs text-ink-500 capitalize mt-0.5">{cta.cta_type} · {cta.cta_angle ?? '—'}</p></div></div>
            <div className="flex items-center gap-2"><Badge tone="neutral">{Math.round(cta.effectiveness_score * 100)}% eff</Badge><OutreachAIBadge confidence={cta.confidence_score * 100} /></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function IcebreakerLibrarySection({ entries }: { entries: IcebreakerLibraryEntry[] }) {
  if (entries.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No icebreakers in library yet.</div>;
  return (
    <div className="space-y-2">
      {entries.map((ib) => (
        <Card key={ib.id} className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2"><Coffee className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{ib.icebreaker_text}</p><p className="text-xs text-ink-500 capitalize mt-0.5">{ib.icebreaker_type.replace(/_/g, ' ')}</p></div></div>
            <div className="flex items-center gap-2"><Badge tone="neutral">{Math.round(ib.effectiveness_score * 100)}% eff</Badge><OutreachAIBadge confidence={ib.confidence_score * 100} /></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TrustSignalLibrarySection({ entries }: { entries: TrustSignalLibraryEntry[] }) {
  if (entries.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No trust signals in library yet.</div>;
  return (
    <div className="space-y-2">
      {entries.map((ts) => (
        <Card key={ts.id} className="p-3">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-2"><Shield className="h-4 w-4 text-success-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{ts.signal_text}</p><p className="text-xs text-ink-500 capitalize mt-0.5">{ts.signal_type.replace(/_/g, ' ')}</p></div></div>
            <div className="flex items-center gap-2"><Badge tone="neutral">{Math.round(ts.effectiveness_score * 100)}% eff</Badge><OutreachAIBadge confidence={ts.confidence_score * 100} /></div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Reasoning Section
// ============================================================
export function ReasoningSection({ reasoning }: { reasoning: OutreachReasoning[] }) {
  if (reasoning.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No AI reasoning yet.</div>;
  const typeIcon: Record<string, typeof Brain> = { decision: Zap, personalization: Sparkles, timing: Clock, channel: Radio, message: MessageSquare, scoring: Gauge };
  return (
    <div className="space-y-2">
      {reasoning.map((r) => {
        const Icon = typeIcon[r.reasoning_type] ?? Brain;
        return (
          <Card key={r.id} className="p-3">
            <div className="flex items-start gap-2">
              <Icon className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-ink-500 capitalize">{r.reasoning_type}</span>
                  <OutreachAIBadge confidence={r.confidence_score * 100} />
                </div>
                <p className="text-sm text-ink-500 mt-1">{r.reasoning_text}</p>
                <p className="text-xs text-ink-500 mt-1">{timeAgo(r.created_at)}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Empty State
// ============================================================
export function OutreachIntelligenceEmpty({ onGenerate, isGenerating }: { onGenerate: () => void; isGenerating: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Brain className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Generate Outreach Intelligence</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The Outreach Intelligence Engine analyzes your discovered prospects and determines the optimal approach — decision, channel, timing, personalization, message strategy, and scoring — all powered by AI.</p>
      </div>
      <button onClick={onGenerate} disabled={isGenerating} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />
        {isGenerating ? 'Generating...' : 'Generate Outreach Intelligence'}
      </button>
    </div>
  );
}
