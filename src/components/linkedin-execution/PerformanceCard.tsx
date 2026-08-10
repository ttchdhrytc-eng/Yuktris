import { BarChart3, TrendingUp, TrendingDown, MessageSquareOff, Ban } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { PerformanceMetric } from '@/types/linkedin-execution';

type Props = {
  performance: PerformanceMetric | null;
};

export function PerformanceCard({ performance }: Props) {
  if (!performance) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No performance data available.</p>
        </CardContent>
      </Card>
    );
  }

  const bars = [
    { label: 'Acceptance Rate', value: performance.acceptance_rate, tone: 'bg-success-500' },
    { label: 'Reply Rate', value: performance.reply_rate, tone: 'bg-gradient-to-r from-gold-400 to-gold-300' },
  ];

  const stats = [
    { icon: TrendingUp, label: 'Positive Replies', value: performance.positive_replies, tone: 'text-success-400' },
    { icon: TrendingDown, label: 'Negative Replies', value: performance.negative_replies, tone: 'text-error-500' },
    { icon: MessageSquareOff, label: 'Ignored', value: performance.ignored_count, tone: 'text-ink-500' },
    { icon: Ban, label: 'Blocked', value: performance.blocked_count, tone: 'text-error-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          <CardTitle>Performance</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mb-4">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-ink-500">{bar.label}</span>
                <span className="text-sm font-semibold text-ink-500">{bar.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
                <div className={cn('h-full rounded-full transition-all duration-700', bar.tone)} style={{ width: `${bar.value}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className={cn('h-3 w-3', stat.tone)} />
                <span className="text-xs text-ink-500">{stat.label}</span>
              </div>
              <p className={cn('text-lg font-bold', stat.tone)}>{stat.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
