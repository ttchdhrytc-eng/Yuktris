import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import type { TimingStrategy } from '@/types/outreach-strategy';

type Props = {
  timing: TimingStrategy | null;
};

export function TimingStrategyCard({ timing }: Props) {
  if (!timing) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No timing strategy defined.</p>
        </CardContent>
      </Card>
    );
  }

  const items = [
    { label: 'Best Day', value: timing.best_day },
    { label: 'Best Time', value: timing.best_time },
    { label: 'Follow-up Interval', value: timing.follow_up_interval },
    { label: 'Cooling Period', value: timing.cooling_period },
    { label: 'Maximum Attempts', value: String(timing.maximum_attempts) },
    { label: 'Campaign Expiry', value: timing.campaign_expiry },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-400" />
          <CardTitle>Timing Strategy</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {items.map((item) => (
            <div key={item.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <span className="text-xs text-ink-500 block mb-1">{item.label}</span>
              <p className="text-sm text-ink-500">{item.value ?? 'N/A'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
