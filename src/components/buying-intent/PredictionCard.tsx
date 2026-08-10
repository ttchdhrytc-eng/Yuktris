import { BarChart3, DollarSign, CalendarClock, Target, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { IntentPrediction } from '@/types/buying-intent';

type Props = {
  prediction: IntentPrediction | null;
};

export function PredictionCard({ prediction }: Props) {
  if (!prediction) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No prediction data available.</p>
        </CardContent>
      </Card>
    );
  }

  const probTone = prediction.purchase_probability >= 75 ? 'text-success-400' : prediction.purchase_probability >= 50 ? 'text-warning-500' : 'text-ink-500';
  const riskTone = prediction.risk_score >= 60 ? 'text-error-400' : prediction.risk_score >= 40 ? 'text-warning-500' : 'text-success-400';

  const metrics = [
    { icon: Target, label: 'Purchase Probability', value: `${prediction.purchase_probability}%`, tone: probTone, bar: prediction.purchase_probability },
    { icon: DollarSign, label: 'Estimated Deal Size', value: prediction.estimated_deal_size ?? 'N/A', tone: 'text-ink-500', bar: null },
    { icon: CalendarClock, label: 'Estimated Sales Cycle', value: prediction.estimated_sales_cycle ?? 'N/A', tone: 'text-ink-500', bar: null },
    { icon: BarChart3, label: 'Expected Close Rate', value: `${prediction.expected_close_rate}%`, tone: probTone, bar: prediction.expected_close_rate },
    { icon: ShieldAlert, label: 'Risk Score', value: `${prediction.risk_score}`, tone: riskTone, bar: prediction.risk_score },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-brand-400" />
          <CardTitle>Intent Prediction</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center gap-2 mb-2">
                <m.icon className="h-3.5 w-3.5 text-ink-500" />
                <span className="text-xs text-ink-500">{m.label}</span>
              </div>
              <p className={cn('text-lg font-semibold', m.tone)}>{m.value}</p>
              {m.bar !== null && (
                <div className="mt-2 h-1.5 rounded-full bg-maroon-950 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', m.bar >= 75 ? 'bg-success-500' : m.bar >= 50 ? 'bg-warning-500' : 'bg-gray-500')}
                    style={{ width: `${m.bar}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
