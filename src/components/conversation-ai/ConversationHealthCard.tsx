import { Activity, TrendingUp, TrendingDown, Minus, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ConversationHealth } from '@/types/conversation-ai';

type Props = {
  health: ConversationHealth | null;
};

const trendConfig = {
  increasing: { icon: TrendingUp, tone: 'text-success-400', label: 'Increasing' },
  stable: { icon: Minus, tone: 'text-brand-400', label: 'Stable' },
  decreasing: { icon: TrendingDown, tone: 'text-error-500', label: 'Decreasing' },
  flat: { icon: Minus, tone: 'text-ink-500', label: 'Flat' },
} as const;

export function ConversationHealthCard({ health }: Props) {
  if (!health) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No conversation health data available.</p>
        </CardContent>
      </Card>
    );
  }

  const trend = trendConfig[health.engagement_trend];
  const TrendIcon = trend.icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-brand-400" />
            <CardTitle>Conversation Health</CardTitle>
          </div>
          <Badge tone={health.momentum_score >= 70 ? 'success' : health.momentum_score >= 40 ? 'brand' : 'warning'} dot>
            {trend.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Momentum Score */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <TrendIcon className={cn('h-3.5 w-3.5', trend.tone)} />
                <span className="text-xs text-ink-500">Momentum Score</span>
              </div>
              <span className={cn('text-sm font-semibold', health.momentum_score >= 70 ? 'text-success-400' : health.momentum_score >= 40 ? 'text-brand-400' : 'text-warning-500')}>
                {health.momentum_score}/100
              </span>
            </div>
            <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
              <div className={cn('h-full rounded-full transition-all duration-700', health.momentum_score >= 70 ? 'bg-success-500' : health.momentum_score >= 40 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-warning-500')} style={{ width: `${health.momentum_score}%` }} />
            </div>
          </div>

          {/* Response Time */}
          <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
            <span className="text-xs text-ink-500 block mb-0.5">Average Response Time</span>
            <p className="text-sm text-ink-500">
              {health.response_time_avg < 3600 ? `${Math.round(health.response_time_avg / 60)} min` : `${Math.round(health.response_time_avg / 3600)} hours`}
            </p>
          </div>

          {/* Positive Signals */}
          {health.positive_signals.length > 0 && (
            <div>
              <span className="text-xs text-success-400 block mb-1.5">Positive Signals</span>
              <ul className="space-y-1">
                {health.positive_signals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <TrendingUp className="h-3 w-3 text-success-400 shrink-0 mt-0.5" />
                    <span className="text-xs text-ink-500">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Negative Signals */}
          {health.negative_signals.length > 0 && (
            <div>
              <span className="text-xs text-error-500 block mb-1.5">Negative Signals</span>
              <ul className="space-y-1">
                {health.negative_signals.map((signal, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <TrendingDown className="h-3 w-3 text-error-500 shrink-0 mt-0.5" />
                    <span className="text-xs text-ink-500">{signal}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Alerts */}
          {health.risk_alerts.length > 0 && (
            <div className="space-y-1.5">
              {health.risk_alerts.map((alert, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-warning-500/30 bg-warning-500/5 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-warning-500">{alert}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
