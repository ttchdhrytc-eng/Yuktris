import { CheckCircle2, XCircle, Calendar, Award, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { MeetingOutcomeRecord } from '@/types/meeting-agent';

type Props = { outcome: MeetingOutcomeRecord | null };

export function MeetingOutcomeCard({ outcome }: Props) {
  if (!outcome) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No meeting outcome recorded yet. The outcome will be tracked after the meeting is completed.</p>
        </CardContent>
      </Card>
    );
  }

  const attendanceTone = outcome.attendance_status === 'attended' ? 'success' : outcome.attendance_status === 'no_show' ? 'error' : outcome.attendance_status === 'rescheduled' ? 'warning' : outcome.attendance_status === 'cancelled' ? 'error' : 'neutral';

  const qualificationTone = outcome.qualification_result === 'qualified' ? 'success' : outcome.qualification_result === 'unqualified' ? 'error' : outcome.qualification_result === 'needs_followup' ? 'warning' : 'neutral';

  const outcomeTone = outcome.outcome === 'closed_won' ? 'success' : outcome.outcome === 'closed_lost' || outcome.outcome === 'disqualified' ? 'error' : outcome.outcome === 'moved_to_opportunity' ? 'brand' : outcome.outcome === 'followup_scheduled' ? 'warning' : 'neutral';

  const AttendanceIcon = outcome.attendance_status === 'attended' ? CheckCircle2 : outcome.attendance_status === 'no_show' ? XCircle : Clock;

  const OutcomeIcon = outcome.outcome === 'closed_won' ? Award : outcome.outcome === 'closed_lost' ? TrendingDown : outcome.outcome === 'moved_to_opportunity' ? TrendingUp : Clock;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-brand-400" />
          <CardTitle>Meeting Outcome</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <div className="flex items-center gap-1.5 mb-1 text-ink-500">
              <AttendanceIcon className="h-3 w-3" />
              <span className="text-xs">Attendance</span>
            </div>
            <Badge tone={attendanceTone as 'success' | 'error' | 'warning' | 'neutral'} dot>{outcome.attendance_status.replace(/_/g, ' ')}</Badge>
          </div>

          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <div className="flex items-center gap-1.5 mb-1 text-ink-500">
              <CheckCircle2 className="h-3 w-3" />
              <span className="text-xs">Qualification</span>
            </div>
            <Badge tone={qualificationTone as 'success' | 'error' | 'warning' | 'neutral'} dot>{outcome.qualification_result.replace(/_/g, ' ')}</Badge>
          </div>

          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <div className="flex items-center gap-1.5 mb-1 text-ink-500">
              <OutcomeIcon className="h-3 w-3" />
              <span className="text-xs">Outcome</span>
            </div>
            <Badge tone={outcomeTone as 'success' | 'error' | 'brand' | 'warning' | 'neutral'} dot>{outcome.outcome.replace(/_/g, ' ')}</Badge>
          </div>
        </div>

        {outcome.next_followup && (
          <div className={cn('rounded-lg border p-3 mb-3', outcome.outcome === 'closed_won' ? 'border-success-500/20 bg-success-500/5' : 'border-brand-500/30 bg-gradient-to-r from-gold-400 to-gold-300/5')}>
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="h-3.5 w-3.5 text-brand-400" />
              <span className="text-xs text-brand-400">Next Follow-up</span>
            </div>
            <p className="text-sm text-ink-500">{new Date(outcome.next_followup).toLocaleDateString('en-US', { dateStyle: 'full' })}</p>
          </div>
        )}

        {outcome.followup_notes && (
          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <span className="text-xs text-ink-500 block mb-1">Follow-up Notes</span>
            <p className="text-sm text-ink-500 leading-relaxed">{outcome.followup_notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
