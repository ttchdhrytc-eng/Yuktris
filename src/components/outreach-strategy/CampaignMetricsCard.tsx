import { BarChart3 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { CampaignMetrics } from '@/types/outreach-strategy';

type Props = {
  metrics: CampaignMetrics | null;
};

export function CampaignMetricsCard({ metrics }: Props) {
  if (!metrics) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No campaign metrics available.</p>
        </CardContent>
      </Card>
    );
  }

  const bars = [
    { label: 'Expected Acceptance Rate', value: metrics.expected_acceptance_rate, tone: 'bg-success-500' },
    { label: 'Expected Reply Rate', value: metrics.expected_reply_rate, tone: 'bg-gradient-to-r from-gold-400 to-gold-300' },
    { label: 'Expected Meeting Rate', value: metrics.expected_meeting_rate, tone: 'bg-warning-500' },
    { label: 'Confidence Score', value: metrics.confidence, tone: 'bg-success-500' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          <CardTitle>Success Metrics</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {bars.map((bar) => (
            <div key={bar.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-ink-500">{bar.label}</span>
                <span className="text-sm font-semibold text-ink-500">{bar.value}%</span>
              </div>
              <div className="h-2 rounded-full bg-maroon-950 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all duration-700', bar.tone)}
                  style={{ width: `${bar.value}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
