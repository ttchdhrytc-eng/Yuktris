import { FileText, Crown, Star, ListOrdered, Briefcase, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ICPRecommendations } from '@/types/icp-intelligence';

type Props = {
  recommendations: ICPRecommendations;
};

export function RecommendationCard({ recommendations }: Props) {
  return (
    <div className="space-y-4">
      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-brand-400" />
            <CardTitle>Executive Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ink-500 leading-relaxed">{recommendations.executive_summary}</p>
        </CardContent>
      </Card>

      {/* Primary & Secondary ICPs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-brand-400" />
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Primary ICP</span>
            </div>
            <p className="text-sm font-semibold text-ink-500">{recommendations.primary_icp}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-success-400" />
              <span className="text-xs font-medium uppercase tracking-wide text-ink-500">Secondary ICPs</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recommendations.secondary_icps.map((icp, i) => (
                <Badge key={i} tone="success">{icp}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

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
            {recommendations.priority_order.map((icp, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-card-900 text-xs font-semibold text-ink-500">
                  {i + 1}
                </div>
                <span className="text-sm text-ink-500">{icp}</span>
                {i === 0 && <Badge tone="brand" dot>Focus First</Badge>}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sales Strategy */}
      <StrategyBlock icon={Briefcase} title="Sales Strategy" content={recommendations.sales_strategy} />

      {/* Messaging */}
      <StrategyBlock icon={MessageSquare} title="Recommended Messaging" content={recommendations.recommended_messaging} />

      {/* Estimated Pipeline */}
      <StrategyBlock icon={TrendingUp} title="Estimated Pipeline" content={recommendations.estimated_pipeline} />
    </div>
  );
}

function StrategyBlock({ icon: Icon, title, content }: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  content: string;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-ink-500 leading-relaxed">{content}</p>
      </CardContent>
    </Card>
  );
}
