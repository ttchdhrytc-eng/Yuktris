import { Calendar, Clock, Video, MapPin, User, CheckCircle2, AlertCircle, XCircle, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { FullMeeting } from '@/types/meeting-agent';

type Props = { meeting: FullMeeting };

export function MeetingDashboard({ meeting }: Props) {
  const m = meeting.meeting;

  const statusTone = m.status === 'completed' ? 'success' : m.status === 'scheduled' ? 'brand' : m.status === 'cancelled' || m.status === 'failed' ? 'error' : m.status === 'rescheduled' || m.status === 'no_show' ? 'warning' : 'neutral';

  const calendarTone = m.calendar_status === 'synced' ? 'success' : m.calendar_status === 'conflict' ? 'warning' : m.calendar_status === 'failed' ? 'error' : 'neutral';
  const crmTone = m.crm_status === 'synced' ? 'success' : m.crm_status === 'failed' ? 'error' : 'neutral';

  const readinessTone = m.meeting_readiness_score >= 80 ? 'text-success-400' : m.meeting_readiness_score >= 60 ? 'text-brand-400' : 'text-warning-500';

  const items = [
    { label: 'Meeting Readiness', value: m.meeting_readiness_score, max: 100, tone: m.meeting_readiness_score >= 80 ? 'bg-success-500' : m.meeting_readiness_score >= 60 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-warning-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-brand-400" />
          <CardTitle>Meeting Dashboard</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <MiniStat icon={Calendar} label="Status">
            <Badge tone={statusTone as 'success' | 'brand' | 'error' | 'warning' | 'neutral'} dot>{m.status.replace(/_/g, ' ')}</Badge>
          </MiniStat>
          <MiniStat icon={Video} label="Type">
            <span className="text-sm text-ink-500 capitalize">{m.meeting_type.replace(/_/g, ' ')}</span>
          </MiniStat>
          <MiniStat icon={Clock} label="Duration">
            <span className="text-sm text-ink-500">{m.meeting_duration} min</span>
          </MiniStat>
          <MiniStat icon={MapPin} label="Platform">
            <span className="text-sm text-ink-500 capitalize">{m.meeting_platform.replace(/_/g, ' ')}</span>
          </MiniStat>
          <MiniStat icon={User} label="Assigned Rep">
            <span className="text-sm text-ink-500">{m.assigned_rep}</span>
          </MiniStat>
          <MiniStat icon={DollarSign} label="Revenue Potential">
            <span className="text-sm font-semibold text-success-400">${m.revenue_potential.toLocaleString()}</span>
          </MiniStat>
        </div>

        <div className="space-y-3 mb-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-ink-500">{item.label}</span>
                <span className={cn('text-sm font-semibold', readinessTone)}>{item.value}/{item.max}</span>
              </div>
              <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', item.tone)} style={{ width: `${item.value}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {m.calendar_status === 'synced' ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : m.calendar_status === 'conflict' ? <AlertCircle className="h-3.5 w-3.5 text-warning-500" /> : m.calendar_status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-error-500" /> : <Clock className="h-3.5 w-3.5 text-ink-500" />}
              <span className="text-xs text-ink-500">Calendar Status</span>
            </div>
            <Badge tone={calendarTone as 'success' | 'warning' | 'error' | 'neutral'} dot>{m.calendar_status}</Badge>
          </div>
          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              {m.crm_status === 'synced' ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : m.crm_status === 'failed' ? <XCircle className="h-3.5 w-3.5 text-error-500" /> : <Clock className="h-3.5 w-3.5 text-ink-500" />}
              <span className="text-xs text-ink-500">CRM Status</span>
            </div>
            <Badge tone={crmTone as 'success' | 'error' | 'neutral'} dot>{m.crm_status}</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
      <div className="flex items-center gap-1.5 mb-1 text-ink-500">
        <Icon className="h-3 w-3" />
        <span className="text-xs">{label}</span>
      </div>
      {children}
    </div>
  );
}
