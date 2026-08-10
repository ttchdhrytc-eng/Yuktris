import { Lightbulb, ListOrdered, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { DiscoveryRecommendations } from '@/types/prospect-discovery';

type Props = {
  recommendations: DiscoveryRecommendations;
};

export function RecommendationCard({ recommendations }: Props) {
  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
        </CardContent>
      </Card>

      {/* Recommended Companies */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success-400" />
            <CardTitle>Recommended Companies</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {recommendations.recommended_companies.map((c, i) => (
              <Badge key={i} tone="success" dot>{c}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Priority Order */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-warning-500" />
            <CardTitle>Priority Order</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.priority_order.map((company, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card-900 text-xs font-semibold text-ink-500">
                  {i + 1}
                </div>
                <span className="text-sm text-ink-500">{company}</span>
                {i === 0 && <Badge tone="brand" dot>Focus First</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Best Opportunities */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand-400" />
            <CardTitle>Best Opportunities</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.best_opportunities.map((opp, i) => (
              <div key={i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <p className="text-xs text-ink-500 leading-relaxed">{opp}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Suggested Next Action */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ArrowRight className="h-4 w-4 text-brand-400" />
            <CardTitle>Suggested Next Action</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.suggested_next_action}</p>
        </CardContent>
      </Card>
    </div>
  );
}
