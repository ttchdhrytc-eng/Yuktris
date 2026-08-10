import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

type Props = {
  buying_window: string | null;
  urgency_score: number;
};

export function BuyingWindowCard({ buying_window, urgency_score }: Props) {
  const urgencyTone = urgency_score >= 80 ? 'error' : urgency_score >= 60 ? 'warning' : 'neutral';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-brand-400" />
          <CardTitle>Buying Window</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-ink-500 mb-1">Estimated Window</p>
            <p className="text-lg font-semibold text-ink-500">{buying_window ?? 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-500 mb-1">Urgency Score</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-card-900 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-warning-500 to-error-500 transition-all duration-700"
                  style={{ width: `${urgency_score}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-ink-500">{urgency_score}</span>
            </div>
            <div className="mt-1.5">
              <Badge tone={urgencyTone as 'success' | 'warning' | 'error' | 'neutral'} dot>
                {urgency_score >= 80 ? 'Act Now' : urgency_score >= 60 ? 'Soon' : 'Monitor'}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
