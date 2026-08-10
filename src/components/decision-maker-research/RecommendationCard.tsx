import { Lightbulb, ArrowRight, MessageSquare } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Recommendation, ContactPriority } from '@/types/decision-maker-research';

type Props = {
  recommendation: Recommendation | null;
};

const priorityTones: Record<ContactPriority, 'success' | 'warning' | 'error' | 'brand'> = {
  low: 'neutral',
  medium: 'brand',
  high: 'warning',
  critical: 'error',
} as Record<ContactPriority, 'success' | 'warning' | 'error' | 'brand'>;

export function RecommendationCard({ recommendation }: Props) {
  if (!recommendation) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No recommendation available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-brand-400" />
          <CardTitle>AI Recommendation</CardTitle>
          <Badge tone={priorityTones[recommendation.priority]}>{recommendation.priority}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <ArrowRight className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
            <p className="text-sm text-ink-500 leading-relaxed">{recommendation.recommendation}</p>
          </div>
          {recommendation.reason && (
            <div className="flex items-start gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <MessageSquare className="h-3.5 w-3.5 text-ink-500 shrink-0 mt-0.5" />
              <p className="text-xs text-ink-500 leading-relaxed">{recommendation.reason}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
