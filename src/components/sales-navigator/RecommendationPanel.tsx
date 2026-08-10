import { Lightbulb, Plus, GitBranch, Briefcase, Tag, TrendingUp, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { SNRecommendations } from '@/types/sales-navigator';

type Props = {
  recommendations: SNRecommendations;
};

export function RecommendationPanel({ recommendations }: Props) {
  return (
    <div className="space-y-4">
      {/* Suggested Improvements */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-brand-400" />
            <CardTitle>Suggested Improvements</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.suggested_improvements.map((item, i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <Lightbulb className="h-3.5 w-3.5 text-brand-400 shrink-0 mt-0.5" />
                <p className="text-xs text-ink-500 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Additional Filters */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-success-400" />
            <CardTitle>Additional Filters</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.additional_filters.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <Plus className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" />
                <p className="text-xs text-ink-500 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Alternative Searches */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-warning-500" />
            <CardTitle>Alternative Search Strategies</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {recommendations.alternative_searches.map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <GitBranch className="h-3.5 w-3.5 text-warning-500 shrink-0 mt-0.5" />
                <p className="text-xs text-ink-500 leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommended Titles */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Job Titles</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {recommendations.recommended_titles.map((title, i) => (
              <Badge key={i} tone="brand">{title}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recommended Keywords */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-brand-400" />
            <CardTitle>Recommended Keywords</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {recommendations.recommended_keywords.map((kw, i) => (
              <Badge key={i} tone="neutral">{kw}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Expected Performance */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-success-400" />
            <CardTitle>Expected Performance</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3">
            <ArrowRight className="h-3.5 w-3.5 text-success-400 shrink-0 mt-0.5" />
            <p className="text-xs text-ink-500 leading-relaxed">{recommendations.expected_performance}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
