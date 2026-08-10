import { Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { OutreachRecommendation, Priority } from '@/types/outreach-strategy';

type Props = {
  recommendations: OutreachRecommendation[];
};

const priorityTones: Record<Priority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

export function RecommendationCard({ recommendations }: Props) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No recommendations available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-brand-400" />
          <CardTitle>Recommendations</CardTitle>
          <Badge tone="brand">{recommendations.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={rec.id ?? i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <Badge tone={priorityTones[rec.priority]} dot>{rec.priority}</Badge>
              </div>
              <p className="text-sm text-ink-500 mb-1">{rec.recommendation ?? 'N/A'}</p>
              {rec.reason && <p className="text-xs text-ink-500">{rec.reason}</p>}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
