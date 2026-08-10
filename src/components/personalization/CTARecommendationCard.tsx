import { MousePointerClick } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { CTARecommendation, CTAType, CTAPriority } from '@/types/personalization';

type Props = {
  recommendations: CTARecommendation[];
};

const ctaTypeLabels: Record<CTAType, string> = {
  primary: 'Primary CTA',
  secondary: 'Secondary CTA',
  soft: 'Soft CTA',
  hard: 'Hard CTA',
};

const priorityTones: Record<CTAPriority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

export function CTARecommendationCard({ recommendations }: Props) {
  if (!recommendations || recommendations.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No CTA recommendations available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MousePointerClick className="h-4 w-4 text-brand-400" />
          <CardTitle>CTA Strategy</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recommendations.map((r, i) => (
            <div key={r.id ?? i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-medium text-brand-400">{ctaTypeLabels[r.cta_type] ?? r.cta_type}</span>
                <Badge tone={priorityTones[r.priority]} dot>{r.priority}</Badge>
              </div>
              <p className="text-sm text-ink-500 leading-relaxed">{r.cta_text ?? 'N/A'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
