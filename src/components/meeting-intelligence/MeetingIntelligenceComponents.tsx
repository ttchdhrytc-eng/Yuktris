import {
  Calendar, Clock, Users, Building2, Brain, Sparkles, Zap, Target,
  CheckCircle2, XCircle, AlertTriangle, TrendingUp, Gauge, Star,
  Send, FileText, ListChecks, Swords, HelpCircle, Bell, ArrowRight,
  Video, MapPin, Phone, RotateCcw, ClipboardList, Lightbulb,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type {
  MeetingIntelligenceDashboard, MeetingWithIntelligence,
  MeetingRequest, MeetingCandidate, MeetingSlot,
  MeetingNotification, MeetingTypeCode, MeetingStatus,
  MeetingUrgency, MeetingPriority,
} from '@/types/meeting-intelligence';

// ============================================================
// AI Badge
// ============================================================
export function MIAIBadge({ confidence }: { confidence?: number }) {
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
      {label && <span className="text-xs text-ink-500 w-24 shrink-0">{label}</span>}
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
const STATUS_TONE: Record<MeetingStatus, 'neutral' | 'brand' | 'warning' | 'success' | 'error'> = {
  pending_confirmation: 'warning', confirmed: 'success', rescheduled: 'brand',
  completed: 'neutral', cancelled: 'error', no_show: 'error', failed: 'error',
};

export function MeetingStatusBadge({ status }: { status: MeetingStatus }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'} dot>{status.replace(/_/g, ' ')}</Badge>;
}

// ============================================================
// Urgency Badge
// ============================================================
const URGENCY_TONE: Record<MeetingUrgency, 'neutral' | 'brand' | 'warning' | 'error'> = {
  low: 'neutral', medium: 'brand', high: 'warning', critical: 'error',
};

export function UrgencyBadge({ urgency }: { urgency: MeetingUrgency }) {
  return <Badge tone={URGENCY_TONE[urgency] ?? 'neutral'} dot>{urgency}</Badge>;
}

// ============================================================
// Priority Badge
// ============================================================
const PRIORITY_TONE: Record<MeetingPriority, 'neutral' | 'brand' | 'warning' | 'error'> = {
  low: 'neutral', medium: 'brand', high: 'warning', critical: 'error',
};

export function PriorityBadge({ priority }: { priority: MeetingPriority }) {
  return <Badge tone={PRIORITY_TONE[priority] ?? 'neutral'} dot>{priority}</Badge>;
}

// ============================================================
// Platform Icon
// ============================================================
const PLATFORM_ICON: Record<string, typeof Video> = {
  google_meet: Video, zoom: Video, microsoft_teams: Video, in_person: MapPin, phone: Phone,
};

export function PlatformBadge({ platform }: { platform: string }) {
  const Icon = PLATFORM_ICON[platform] ?? Video;
  return <Badge tone="neutral" className="gap-1"><Icon className="h-3 w-3" />{platform.replace(/_/g, ' ')}</Badge>;
}

// ============================================================
// Dashboard Section
// ============================================================
export function MIDashboardSection({ dashboard, onDetect, isDetecting }: {
  dashboard: MeetingIntelligenceDashboard;
  onDetect: () => void;
  isDetecting: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Calendar className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Total Meetings</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.totalMeetings}</p>
          <p className="text-xs text-ink-500">{dashboard.meetingsToday} today</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Clock className="h-4 w-4 text-warning-500" /><span className="text-xs text-ink-500">Pending</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.pendingScheduling}</p>
          <p className="text-xs text-ink-500">{dashboard.awaitingConfirmation} awaiting confirmation</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><Gauge className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">Avg Score</span></div>
          <p className="text-2xl font-bold text-ink-500">{dashboard.avgMeetingScore}</p>
          <p className="text-xs text-ink-500">{dashboard.preparationNeeded} need prep</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2"><TrendingUp className="h-4 w-4 text-success-400" /><span className="text-xs text-ink-500">Forecast Rev</span></div>
          <p className="text-2xl font-bold text-ink-500">${dashboard.forecastRevenue.toLocaleString()}</p>
        </Card>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Brain className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-medium text-ink-500">Meeting Intelligence Engine</p>
            <p className="text-xs text-ink-500">{dashboard.pendingScheduling} pending · {dashboard.candidates.length} candidates · {dashboard.notifications.filter(n => !n.is_read).length} unread notifications</p>
          </div>
        </div>
        <button onClick={onDetect} disabled={isDetecting} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
          <Zap className="h-4 w-4" />
          {isDetecting ? 'Detecting...' : 'Detect Meeting Intent'}
        </button>
      </div>

      {dashboard.topMeetings.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3"><Star className="h-4 w-4 text-warning-500" /><span className="text-sm font-medium text-ink-500">Top Priority Meetings</span></div>
          <div className="space-y-2">
            {dashboard.topMeetings.slice(0, 5).map((m) => (
              <div key={m.meeting.id} className="flex items-center justify-between rounded-lg bg-card-900/50 p-3 border border-gold-500/8">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Calendar className="h-4 w-4 text-brand-400" /></div>
                  <div>
                    <p className="text-sm font-medium text-ink-500">{m.meeting.meeting_title}</p>
                    <p className="text-xs text-ink-500">{m.meeting.prospect_name} · {m.meeting.company_name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <MeetingStatusBadge status={m.meeting.status} />
                  {m.score && <span className="text-sm font-bold text-ink-500">{m.score.overall_score}</span>}
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
// Meeting Card (full intelligence)
// ============================================================
export function MeetingCard({ meeting, onConfirm, onCancel, onGenerateBrief, onRecordOutcome }: {
  meeting: MeetingWithIntelligence;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onGenerateBrief?: (id: string) => void;
  onRecordOutcome?: (id: string) => void;
}) {
  const m = meeting.meeting;
  return (
    <Card className="p-4 space-y-3">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Calendar className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-semibold text-ink-500">{m.meeting_title}</p>
            <p className="text-xs text-ink-500">{m.prospect_name} · {m.prospect_title} · {m.company_name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {meeting.score && <span className="text-lg font-bold text-ink-500">{meeting.score.overall_score}</span>}
          <MIAIBadge confidence={meeting.score?.confidence} />
        </div>
      </div>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2">
        <MeetingStatusBadge status={m.status} />
        <Badge tone="neutral" className="gap-1"><Calendar className="h-3 w-3" />{new Date(m.scheduled_start).toLocaleString()}</Badge>
        <Badge tone="neutral">{m.duration_minutes}min</Badge>
        <PlatformBadge platform={m.platform} />
        <Badge tone="neutral" className="capitalize">{m.meeting_type.replace(/_/g, ' ')}</Badge>
      </div>

      {/* Brief */}
      {meeting.brief?.executive_summary && (
        <div className="p-3 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
          <div className="flex items-start gap-2"><Lightbulb className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><p className="text-sm text-ink-500">{meeting.brief.executive_summary}</p></div>
        </div>
      )}

      {/* AI Reasoning */}
      {meeting.reasoning.length > 0 && (
        <div className="space-y-1">
          {meeting.reasoning.slice(0, 3).map((r) => (
            <div key={r.id} className="flex items-start gap-2 text-xs">
              <Brain className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-ink-500 capitalize">{r.reasoning_type.replace(/_/g, ' ')}: </span>
                <span className="text-ink-500">{r.reasoning_text}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scores */}
      {meeting.score && (
        <div className="space-y-1.5">
          <ScoreBar score={meeting.score.preparation_score} label="Prep" />
          <ScoreBar score={meeting.score.qualification_score} label="Qual" />
          <ScoreBar score={meeting.score.revenue_score} label="Revenue" />
          <ScoreBar score={meeting.score.likelihood_to_close} label="Close %" />
          <ScoreBar score={meeting.score.risk_score} label="Risk" />
        </div>
      )}

      {/* Agenda */}
      {meeting.agenda?.agenda_items && Array.isArray(meeting.agenda.agenda_items) && meeting.agenda.agenda_items.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><ListChecks className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500">Agenda</span></div>
          <div className="space-y-1">
            {(meeting.agenda.agenda_items as Array<Record<string, unknown>>).slice(0, 5).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-ink-500">{item.item as string ?? `Item ${i + 1}`}</span>
                <span className="text-ink-500">{item.duration_minutes as number ?? 5}min</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Discovery Questions */}
      {meeting.questions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><HelpCircle className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500">Discovery Questions</span></div>
          <div className="space-y-1">
            {meeting.questions.slice(0, 5).map((q) => (
              <div key={q.id} className="flex items-start gap-2 text-xs">
                <span className="text-ink-500">·</span>
                <div>
                  <span className="text-ink-500">{q.question_text}</span>
                  <span className="text-ink-500 ml-1 capitalize">({q.question_category.replace(/_/g, ' ')})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Competitor Intel */}
      {meeting.competitorIntel.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Swords className="h-3.5 w-3.5 text-warning-500" /><span className="text-xs text-ink-500">Competitor Intel</span></div>
          <div className="space-y-2">
            {meeting.competitorIntel.map((c) => (
              <div key={c.id} className="p-2.5 rounded-lg bg-warning-500/5 border border-warning-500/10">
                <p className="text-sm font-medium text-ink-500">{c.competitor_name}</p>
                {Array.isArray(c.differentiators) && c.differentiators.length > 0 && (
                  <p className="text-xs text-ink-500 mt-1">Differentiators: {(c.differentiators as string[]).join(', ')}</p>
                )}
                {Array.isArray(c.battle_cards) && c.battle_cards.length > 0 && (
                  <p className="text-xs text-ink-500">Battle cards: {c.battle_cards.length} prepared</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Follow-ups */}
      {meeting.followups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><RotateCcw className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500">Follow-ups</span></div>
          <div className="space-y-1">
            {meeting.followups.slice(0, 5).map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  {f.is_completed ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : <Clock className="h-3.5 w-3.5 text-ink-500" />}
                  <span className="text-ink-500">{f.followup_content}</span>
                </div>
                <Badge tone="neutral" className="capitalize">{f.followup_type.replace(/_/g, ' ')}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-gold-500/8">
        {m.status === 'pending_confirmation' && onConfirm && (
          <button onClick={() => onConfirm(m.id)} className="flex items-center gap-1.5 rounded-lg bg-success-500/10 px-3 py-1.5 text-xs font-medium text-success-400 hover:bg-success-500/20"><CheckCircle2 className="h-3.5 w-3.5" />Confirm</button>
        )}
        {onGenerateBrief && (
          <button onClick={() => onGenerateBrief(m.id)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><Sparkles className="h-3.5 w-3.5" />Generate Brief</button>
        )}
        {onCancel && (
          <button onClick={() => onCancel(m.id)} className="flex items-center gap-1.5 rounded-lg bg-error-500/10 px-3 py-1.5 text-xs font-medium text-error-400 hover:bg-error-500/20"><XCircle className="h-3.5 w-3.5" />Cancel</button>
        )}
        {onRecordOutcome && m.status === 'confirmed' && (
          <button onClick={() => onRecordOutcome(m.id)} className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><ClipboardList className="h-3.5 w-3.5" />Record Outcome</button>
        )}
      </div>
    </Card>
  );
}

// ============================================================
// Pending Scheduling Section
// ============================================================
export function PendingSchedulingSection({ requests, candidates, onSchedule }: {
  requests: MeetingRequest[];
  candidates: MeetingCandidate[];
  onSchedule: (requestId: string) => void;
}) {
  if (requests.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No pending meeting requests.</div>;
  return (
    <div className="space-y-3">
      {requests.filter((r) => r.status === 'pending').map((r) => {
        const candidate = candidates.find((c) => c.meeting_request_id === r.id);
        return (
          <Card key={r.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-500/10"><Clock className="h-5 w-5 text-warning-500" /></div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{r.prospect_name ?? 'Unknown'}</p>
                  <p className="text-xs text-ink-500">{r.prospect_title ?? '—'} · {r.company_name ?? '—'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <UrgencyBadge urgency={r.meeting_urgency} />
                {candidate && <PriorityBadge priority={candidate.priority} />}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Badge tone="brand" className="capitalize">{(r.recommended_meeting_type ?? 'discovery').replace(/_/g, ' ')}</Badge>
              <Badge tone="neutral">{r.estimated_duration}min</Badge>
              {r.confidence_score > 0 && <Badge tone="neutral">{Math.round(r.confidence_score * 100)}% confidence</Badge>}
              {r.competitor_discussion_expected && <Badge tone="warning">Competitor discussion</Badge>}
              {r.decision_makers_attending && <Badge tone="success">Decision makers</Badge>}
            </div>
            {r.reasoning && <p className="text-xs text-ink-500 mt-2">{r.reasoning}</p>}
            {candidate && (
              <div className="grid grid-cols-3 gap-3 mt-3 text-xs">
                <div><span className="text-ink-500">Intent:</span> <span className="text-ink-500">{candidate.intent_score}</span></div>
                <div><span className="text-ink-500">Engagement:</span> <span className="text-ink-500">{candidate.engagement_score}</span></div>
                <div><span className="text-ink-500">Overall:</span> <span className="text-ink-500">{candidate.overall_score}</span></div>
              </div>
            )}
            <button onClick={() => onSchedule(r.id)} className="mt-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15">
              <Zap className="h-3.5 w-3.5" />Schedule Automatically
            </button>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Upcoming Meetings Section
// ============================================================
export function UpcomingMeetingsSection({ meetings, onConfirm, onCancel }: {
  meetings: MeetingWithIntelligence[];
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  const upcoming = meetings.filter((m) => ['pending_confirmation', 'confirmed', 'rescheduled'].includes(m.meeting.status));
  if (upcoming.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No upcoming meetings.</div>;
  return <div className="space-y-3">{upcoming.map((m) => <MeetingCard key={m.meeting.id} meeting={m} onConfirm={onConfirm} onCancel={onCancel} />)}</div>;
}

// ============================================================
// Availability Section
// ============================================================
export function AvailabilitySection({ slots }: { slots: MeetingSlot[] }) {
  if (slots.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No slots generated yet.</div>;
  return (
    <div className="space-y-2">
      {slots.slice(0, 20).map((s) => (
        <Card key={s.id} className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-brand-400" />
              <span className="text-sm text-ink-500">{new Date(s.start_time).toLocaleString()}</span>
              <span className="text-xs text-ink-500">— {new Date(s.end_time).toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="neutral">Rank {s.slot_rank}</Badge>
              <Badge tone={s.prospect_response === 'accepted' ? 'success' : s.prospect_response === 'rejected' ? 'error' : 'neutral'}>{s.prospect_response}</Badge>
              {s.is_selected && <Badge tone="brand">Selected</Badge>}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Briefs Section
// ============================================================
export function BriefsSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withBriefs = meetings.filter((m) => m.brief);
  if (withBriefs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No meeting briefs yet.</div>;
  return (
    <div className="space-y-3">
      {withBriefs.map((m) => (
        <Card key={m.meeting.id} className="p-4 space-y-2">
          <p className="text-sm font-semibold text-ink-500">{m.meeting.meeting_title}</p>
          {m.brief?.executive_summary && <p className="text-sm text-ink-500">{m.brief.executive_summary}</p>}
          {m.brief?.company_overview && <p className="text-xs text-ink-500">Company: {m.brief.company_overview}</p>}
          {m.brief?.conversation_summary && <p className="text-xs text-ink-500">Conversation: {m.brief.conversation_summary}</p>}
          {m.brief?.next_recommendation && <div className="flex items-center gap-2 pt-1"><ArrowRight className="h-3.5 w-3.5 text-brand-400" /><p className="text-sm text-ink-500">{m.brief.next_recommendation}</p></div>}
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Agendas Section
// ============================================================
export function AgendasSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withAgendas = meetings.filter((m) => m.agenda?.agenda_items && Array.isArray(m.agenda.agenda_items) && m.agenda.agenda_items.length > 0);
  if (withAgendas.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No agendas generated yet.</div>;
  return (
    <div className="space-y-3">
      {withAgendas.map((m) => (
        <Card key={m.meeting.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{m.meeting.meeting_title}</p>
          <div className="space-y-1.5">
            {(m.agenda!.agenda_items as Array<Record<string, unknown>>).map((item, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-card-900/50">
                <div className="flex items-center gap-2">
                  <span className="text-ink-500">{i + 1}.</span>
                  <span className="text-ink-500">{item.item as string}</span>
                </div>
                <span className="text-ink-500">{item.duration_minutes as number}min</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-ink-500 mt-2">Total: {m.agenda!.total_duration_minutes}min</p>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Discovery Questions Section
// ============================================================
export function QuestionsSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withQuestions = meetings.filter((m) => m.questions.length > 0);
  if (withQuestions.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No discovery questions yet.</div>;
  return (
    <div className="space-y-3">
      {withQuestions.map((m) => (
        <Card key={m.meeting.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{m.meeting.meeting_title}</p>
          <div className="space-y-1.5">
            {m.questions.map((q) => (
              <div key={q.id} className="flex items-start gap-2 text-xs p-2 rounded-lg bg-card-900/50">
                <HelpCircle className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-ink-500">{q.question_text}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge tone="neutral" className="capitalize">{q.question_category.replace(/_/g, ' ')}</Badge>
                    <Badge tone={q.priority === 'high' ? 'warning' : 'neutral'}>{q.priority}</Badge>
                  </div>
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
// Competitor Intel Section
// ============================================================
export function CompetitorIntelSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withIntel = meetings.filter((m) => m.competitorIntel.length > 0);
  if (withIntel.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No competitor intelligence yet.</div>;
  return (
    <div className="space-y-3">
      {withIntel.map((m) => (
        <Card key={m.meeting.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{m.meeting.meeting_title}</p>
          <div className="space-y-2">
            {m.competitorIntel.map((c) => (
              <div key={c.id} className="p-3 rounded-lg bg-warning-500/5 border border-warning-500/10">
                <p className="text-sm font-medium text-ink-500">{c.competitor_name}</p>
                {Array.isArray(c.weaknesses) && c.weaknesses.length > 0 && <p className="text-xs text-ink-500 mt-1">Weaknesses: {(c.weaknesses as string[]).join(', ')}</p>}
                {Array.isArray(c.differentiators) && c.differentiators.length > 0 && <p className="text-xs text-ink-500">Differentiators: {(c.differentiators as string[]).join(', ')}</p>}
                {Array.isArray(c.battle_cards) && c.battle_cards.length > 0 && <p className="text-xs text-ink-500">Battle cards: {c.battle_cards.length} prepared</p>}
                {c.migration_strategy && <p className="text-xs text-ink-500">Migration: {c.migration_strategy}</p>}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// Preparation Section
// ============================================================
export function PreparationSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withPrep = meetings.filter((m) => m.preparation || m.checklist);
  if (withPrep.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No preparation materials yet.</div>;
  return (
    <div className="space-y-3">
      {withPrep.map((m) => (
        <Card key={m.meeting.id} className="p-4 space-y-3">
          <p className="text-sm font-semibold text-ink-500">{m.meeting.meeting_title}</p>
          {m.preparation?.pricing_recommendation && (
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
              <p className="text-xs text-ink-500">Pricing Recommendation</p>
              <p className="text-sm text-ink-500">{m.preparation.pricing_recommendation}</p>
            </div>
          )}
          {m.preparation?.offer_recommendation && (
            <div className="p-2.5 rounded-lg bg-success-500/5 border border-success-500/10">
              <p className="text-xs text-ink-500">Offer Recommendation</p>
              <p className="text-sm text-ink-500">{m.preparation.offer_recommendation}</p>
            </div>
          )}
          {m.checklist && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-ink-500">Checklist</span>
                <Badge tone={m.checklist.completion_percentage === 100 ? 'success' : 'warning'}>{m.checklist.completion_percentage}% complete</Badge>
              </div>
              <div className="space-y-1">
                {(m.checklist.checklist_items as Array<Record<string, unknown>>).slice(0, 8).map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    {item.done ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : <Clock className="h-3.5 w-3.5 text-ink-500" />}
                    <span className={cn('text-ink-500', item.done && 'line-through text-ink-500')}>{item.item as string}</span>
                  </div>
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
// Follow-ups Section
// ============================================================
export function FollowupsSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withFollowups = meetings.filter((m) => m.followups.length > 0);
  if (withFollowups.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No follow-ups yet.</div>;
  return (
    <div className="space-y-3">
      {withFollowups.map((m) => (
        <Card key={m.meeting.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{m.meeting.meeting_title}</p>
          <div className="space-y-1.5">
            {m.followups.map((f) => (
              <div key={f.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-card-900/50">
                <div className="flex items-center gap-2">
                  {f.is_completed ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : <Clock className="h-3.5 w-3.5 text-ink-500" />}
                  <span className="text-ink-500">{f.followup_content}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="neutral" className="capitalize">{f.followup_type.replace(/_/g, ' ')}</Badge>
                  {f.due_date && <span className="text-ink-500">{timeAgo(f.due_date)}</span>}
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
// Meeting History Section
// ============================================================
export function HistorySection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const completed = meetings.filter((m) => ['completed', 'cancelled', 'no_show'].includes(m.meeting.status));
  if (completed.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No meeting history yet.</div>;
  return <div className="space-y-3">{completed.map((m) => <MeetingCard key={m.meeting.id} meeting={m} />)}</div>;
}

// ============================================================
// AI Recommendations Section
// ============================================================
export function AIRecommendationsSection({ meetings }: { meetings: MeetingWithIntelligence[] }) {
  const withReasoning = meetings.filter((m) => m.reasoning.length > 0);
  if (withReasoning.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No AI recommendations yet.</div>;
  return (
    <div className="space-y-3">
      {withReasoning.map((m) => (
        <Card key={m.meeting.id} className="p-4">
          <p className="text-sm font-semibold text-ink-500 mb-3">{m.meeting.meeting_title}</p>
          <div className="space-y-2">
            {m.reasoning.map((r) => (
              <div key={r.id} className="flex items-start gap-2 p-2.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/5 border border-brand-500/10">
                <Brain className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-ink-500 capitalize">{r.reasoning_type.replace(/_/g, ' ')}</p>
                  <p className="text-sm text-ink-500">{r.reasoning_text}</p>
                  <Badge tone="neutral" className="mt-1">{Math.round(r.confidence * 100)}% confidence</Badge>
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
// Notifications Section
// ============================================================
export function NotificationsSection({ notifications }: { notifications: MeetingNotification[] }) {
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
export function MeetingIntelligenceEmpty({ onDetect, isDetecting }: { onDetect: () => void; isDetecting: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Calendar className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Meeting Intelligence Engine</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">The AI automatically detects meeting intent from conversations, schedules meetings, generates briefs, agendas, discovery questions, and competitor battle cards — all without manual scheduling.</p>
      </div>
      <button onClick={onDetect} disabled={isDetecting} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />
        {isDetecting ? 'Detecting...' : 'Detect Meeting Intent'}
      </button>
    </div>
  );
}
