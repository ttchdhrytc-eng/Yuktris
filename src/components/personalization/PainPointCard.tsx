import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { PainPoint, PainPointPriority } from '@/types/personalization';

type Props = {
  painPoints: PainPoint[];
};

const priorityTones: Record<PainPointPriority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

const categoryLabels: Record<string, string> = {
  current_challenges: 'Current Challenges',
  likely_frustrations: 'Likely Frustrations',
  business_goals: 'Business Goals',
  operational_issues: 'Operational Issues',
  growth_challenges: 'Growth Challenges',
  technology_challenges: 'Technology Challenges',
};

export function PainPointCard({ painPoints }: Props) {
  if (!painPoints || painPoints.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No pain points identified.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-brand-400" />
          <CardTitle>Pain Point Analysis</CardTitle>
          <Badge tone="brand">{painPoints.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {painPoints.map((pp) => (
            <div key={pp.id} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-ink-500">{categoryLabels[pp.category] ?? pp.category}</span>
                <div className="flex items-center gap-2">
                  <span className={cn('text-xs font-semibold', pp.confidence >= 85 ? 'text-success-400' : pp.confidence >= 70 ? 'text-warning-500' : 'text-ink-500')}>
                    {pp.confidence}% conf.
                  </span>
                  <Badge tone={priorityTones[pp.priority]} dot>{pp.priority}</Badge>
                </div>
              </div>
              <p className="text-sm text-ink-500">{pp.description ?? 'N/A'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
