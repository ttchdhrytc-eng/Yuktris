import { Bell, Mail, MessageSquare, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Props = {
  meetingTime: string | null;
  meetingLink: string | null;
};

export function ReminderCard({ meetingTime, meetingLink }: Props) {
  const channels = [
    { icon: Mail, name: 'Email Reminder', description: 'Sent to all participants 24 hours before meeting', sent: true },
    { icon: MessageSquare, name: 'Slack Notification', description: 'Posted to the sales team channel 1 hour before', sent: true },
    { icon: Bell, name: 'Calendar Alert', description: '15-minute popup reminder before meeting start', sent: true },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-brand-400" />
          <CardTitle>Meeting Reminders</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {channels.map((ch, i) => (
            <div key={i} className="flex items-start gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20 shrink-0">
                <ch.icon className="h-3.5 w-3.5 text-brand-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-ink-500">{ch.name}</p>
                  {ch.sent ? <CheckCircle2 className="h-3.5 w-3.5 text-success-400" /> : <Bell className="h-3.5 w-3.5 text-ink-500" />}
                </div>
                <p className="text-xs text-ink-500 mt-0.5">{ch.description}</p>
              </div>
            </div>
          ))}

          {meetingTime && (
            <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <span className="text-xs text-ink-500 block mb-1">Meeting Time</span>
              <p className="text-sm text-ink-500">
                {new Date(meetingTime).toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' })}
              </p>
            </div>
          )}

          {meetingLink && (
            <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <span className="text-xs text-ink-500 block mb-1">Meeting Link</span>
              <p className="text-sm text-brand-400 truncate">{meetingLink}</p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-success-500/20 bg-success-500/5 p-3">
            <span className="text-xs text-ink-500">All Reminders</span>
            <Badge tone="success" dot>Delivered</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
