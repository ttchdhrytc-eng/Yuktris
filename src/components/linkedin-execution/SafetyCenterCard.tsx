import { ShieldCheck, AlertTriangle, Gauge, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { SafetyCenterData } from '@/types/linkedin-execution';

type Props = {
  data: SafetyCenterData | null;
};

export function SafetyCenterCard({ data }: Props) {
  if (!data) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No safety data available.</p>
        </CardContent>
      </Card>
    );
  }

  const dailyPct = Math.round((data.daily_used / data.daily_limit) * 100);
  const hourlyPct = Math.round((data.hourly_used / data.hourly_limit) * 100);
  const healthTone = data.account_health === 'excellent' ? 'text-success-400' : data.account_health === 'good' ? 'text-brand-400' : data.account_health === 'warning' ? 'text-warning-500' : 'text-error-500';
  const healthBadge = data.account_health === 'excellent' ? 'success' : data.account_health === 'good' ? 'brand' : data.account_health === 'warning' ? 'warning' : 'error';

  const items = [
    { icon: Gauge, label: 'Daily Limit', used: data.daily_used, limit: data.daily_limit, pct: dailyPct },
    { icon: Clock, label: 'Hourly Limit', used: data.hourly_used, limit: data.hourly_limit, pct: hourlyPct },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-brand-400" />
            <CardTitle>Safety Center</CardTitle>
          </div>
          <Badge tone={healthBadge as 'success' | 'brand' | 'warning' | 'error'} dot>
            {data.account_health}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.label}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <item.icon className="h-3.5 w-3.5 text-ink-500" />
                  <span className="text-xs text-ink-500">{item.label}</span>
                </div>
                <span className={cn('text-xs font-medium', item.pct >= 90 ? 'text-error-500' : item.pct >= 75 ? 'text-warning-500' : 'text-ink-500')}>
                  {item.used} / {item.limit}
                </span>
              </div>
              <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', item.pct >= 90 ? 'bg-error-500' : item.pct >= 75 ? 'bg-warning-500' : 'bg-success-500')}
                  style={{ width: `${item.pct}%` }}
                />
              </div>
            </div>
          ))}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <span className="text-xs text-ink-500 block">Rate Limit Remaining</span>
              <p className="text-sm font-semibold text-ink-500">{data.rate_limit_remaining} actions</p>
            </div>
            <div className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <span className="text-xs text-ink-500 block">Risk Score</span>
              <p className={cn('text-sm font-semibold', data.risk_score > 70 ? 'text-error-500' : data.risk_score > 40 ? 'text-warning-500' : 'text-success-400')}>
                {data.risk_score}/100
              </p>
            </div>
          </div>

          {data.cooldown_active && data.cooldown_until && (
            <div className="flex items-center gap-2 rounded-lg border border-warning-500/30 bg-warning-500/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-warning-500" />
              <span className="text-xs text-warning-500">Cooldown active until {new Date(data.cooldown_until).toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
            <span className="text-xs text-ink-500">Account Health</span>
            <span className={cn('text-sm font-semibold capitalize', healthTone)}>{data.account_health}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
