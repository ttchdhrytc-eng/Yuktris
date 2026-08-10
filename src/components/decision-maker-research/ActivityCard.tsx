import { Activity, TrendingUp, Hash, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { LinkedInActivity } from '@/types/decision-maker-research';

type Props = {
  activity: LinkedInActivity | null;
};

export function ActivityCard({ activity }: Props) {
  if (!activity) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No LinkedIn activity data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-brand-400" />
          <CardTitle>Professional Activity</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <MetricBar icon={Hash} label="Post Frequency" value={activity.post_frequency ?? '—'} numeric={false} />
            <MetricBar icon={TrendingUp} label="Engagement Score" value={String(activity.engagement_score)} numeric />
            <MetricBar icon={TrendingUp} label="Thought Leadership" value={String(activity.thought_leadership_score)} numeric />
          </div>

          {activity.primary_topics.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Hash className="h-3.5 w-3.5 text-ink-500" />
                <span className="text-xs font-medium text-ink-500">Primary Topics</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {activity.primary_topics.map((topic, i) => (
                  <Badge key={i} tone="brand">{topic}</Badge>
                ))}
              </div>
            </div>
          )}

          {activity.last_active && (
            <div className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-ink-500" />
              <span className="text-xs text-ink-500">Last active: <span className="text-ink-500">{activity.last_active}</span></span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBar({ icon: Icon, label, value, numeric }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; numeric: boolean }) {
  if (!numeric) {
    return (
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <Icon className="h-3.5 w-3.5 text-ink-500" />
          <span className="text-xs text-ink-500">{label}</span>
        </div>
        <p className="text-sm text-ink-500">{value}</p>
      </div>
    );
  }
  const numVal = parseInt(value, 10);
  const tone = numVal >= 85 ? 'bg-success-500' : numVal >= 70 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-ink-500" />
          <span className="text-xs text-ink-500">{label}</span>
        </div>
        <span className="text-xs font-semibold text-ink-500">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${numVal}%` }} />
      </div>
    </div>
  );
}
