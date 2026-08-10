import { Award } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ValueProposition } from '@/types/personalization';

type Props = {
  valueProposition: ValueProposition | null;
};

export function ValuePropositionCard({ valueProposition }: Props) {
  if (!valueProposition) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No value proposition available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-brand-400" />
          <CardTitle>Value Proposition</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <span className="text-xs text-ink-500 block mb-1">Primary Value Proposition</span>
            <p className="text-sm text-ink-500 leading-relaxed">{valueProposition.primary_value_proposition}</p>
          </div>
          <div>
            <span className="text-xs text-ink-500 block mb-1">Secondary Value Proposition</span>
            <p className="text-sm text-ink-500 leading-relaxed">{valueProposition.secondary_value_proposition}</p>
          </div>
          <div>
            <span className="text-xs text-ink-500 block mb-2">Unique Selling Points</span>
            <div className="flex flex-wrap gap-2">
              {valueProposition.unique_selling_points.map((usp, i) => (
                <Badge key={i} tone="brand">{usp}</Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-ink-500 block mb-2">Competitive Advantages</span>
            <div className="flex flex-wrap gap-2">
              {valueProposition.competitive_advantages.map((ca, i) => (
                <Badge key={i} tone="success">{ca}</Badge>
              ))}
            </div>
          </div>
          <div>
            <span className="text-xs text-ink-500 block mb-2">Recommended Services</span>
            <div className="flex flex-wrap gap-2">
              {valueProposition.recommended_services.map((s, i) => (
                <Badge key={i} tone="neutral">{s}</Badge>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
