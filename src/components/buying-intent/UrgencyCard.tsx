import { Flame } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';

type Props = {
  urgency_score: number;
};

export function UrgencyCard({ urgency_score }: Props) {
  const tone = urgency_score >= 80 ? 'error' : urgency_score >= 60 ? 'warning' : 'neutral';
  const label = urgency_score >= 80 ? 'Critical' : urgency_score >= 60 ? 'Elevated' : 'Normal';

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Flame className="h-4 w-4 text-brand-400" />
          <CardTitle>Urgency</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-ink-500">{urgency_score}</p>
            <p className="text-xs text-ink-500">urgency score</p>
          </div>
          <Badge tone={tone as 'success' | 'warning' | 'error' | 'neutral'} dot>{label}</Badge>
        </div>
        <div className="mt-3 h-1.5 rounded-full bg-card-900 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              urgency_score >= 80 ? 'bg-error-500' : urgency_score >= 60 ? 'bg-warning-500' : 'bg-gray-500',
            )}
            style={{ width: `${urgency_score}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
