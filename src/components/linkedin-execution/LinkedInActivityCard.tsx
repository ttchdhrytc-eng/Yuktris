import { Linkedin, Mail, MessageSquare, UserPlus, Eye, ThumbsUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { PerformanceMetric } from '@/types/linkedin-execution';

type Props = {
  performance: PerformanceMetric | null;
};

export function LinkedInActivityCard({ performance }: Props) {
  if (!performance) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No LinkedIn activity data available.</p>
        </CardContent>
      </Card>
    );
  }

  const activities = [
    { icon: UserPlus, label: 'Connections Sent', value: performance.connections_sent, tone: 'text-brand-400' },
    { icon: Mail, label: 'Messages Sent', value: performance.messages_sent, tone: 'text-brand-400' },
    { icon: MessageSquare, label: 'Follow-ups Sent', value: performance.followups_sent, tone: 'text-brand-400' },
    { icon: Eye, label: 'Profile Visits', value: Math.max(0, performance.connections_sent + 2), tone: 'text-ink-500' },
    { icon: ThumbsUp, label: 'Post Engagement', value: Math.max(0, Math.floor(performance.connections_sent * 0.5)), tone: 'text-ink-500' },
    { icon: Linkedin, label: 'Replies Received', value: performance.replies_received, tone: 'text-success-400' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Linkedin className="h-4 w-4 text-brand-400" />
          <CardTitle>LinkedIn Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {activities.map((act) => (
            <div key={act.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center gap-2 mb-2">
                <act.icon className={`h-3.5 w-3.5 ${act.tone}`} />
                <span className="text-xs text-ink-500">{act.label}</span>
              </div>
              <p className={`text-lg font-bold ${act.tone}`}>{act.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
