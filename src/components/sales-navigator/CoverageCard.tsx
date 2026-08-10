import { Gauge, TrendingUp, BarChart3, Hash } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { SearchQuality } from '@/types/sales-navigator';

type Props = {
  quality: SearchQuality | null;
};

export function CoverageCard({ quality }: Props) {
  if (!quality) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No coverage data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-brand-400" />
          <CardTitle>Search Coverage & Estimation</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <MetricBar icon={TrendingUp} label="Coverage Score" value={quality.coverage_score} suffix="%" />
          <MetricBar icon={BarChart3} label="Filter Completeness" value={quality.filter_completeness} suffix="%" />
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Hash className="h-3.5 w-3.5 text-ink-500" />
            <span className="text-xs font-medium text-ink-500">Estimated Results</span>
          </div>
          <div className="rounded-lg border border-gold-500/12 bg-card-900 p-3">
            <p className="text-sm text-ink-500 font-medium">{quality.estimated_result_count}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-ink-500">Search Complexity:</span>
            <Badge tone={quality.search_complexity === 'low' ? 'success' : quality.search_complexity === 'medium' ? 'warning' : 'error'}>
              {quality.search_complexity.charAt(0).toUpperCase() + quality.search_complexity.slice(1)}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricBar({ icon: Icon, label, value, suffix }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  suffix?: string;
}) {
  const tone = value >= 85 ? 'bg-success-500' : value >= 70 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-ink-500" />
          <span className="text-xs text-ink-500">{label}</span>
        </div>
        <span className="text-xs font-semibold text-ink-500">{value}{suffix}</span>
      </div>
      <div className="h-2 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full transition-all duration-500', tone)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
