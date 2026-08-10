import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { IndustryAnalysis, CompetitionLevel } from '@/types/market-intelligence';

type Props = {
  industries: IndustryAnalysis[];
};

const compTone: Record<CompetitionLevel, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  very_high: 'error',
};

const priorityTone: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

export function IndustryOpportunityTable({ industries }: Props) {
  if (industries.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No industry analysis available.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-500/12 text-left">
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Industry</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Market Size</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Growth Rate</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Competition</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Opportunity</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Priority</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {industries.map((ind) => (
            <tr key={ind.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm text-ink-500 font-medium">{ind.industry_name}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-ink-500">{ind.market_size ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-ink-500">{ind.growth_rate ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <Badge tone={compTone[ind.competition_level]}>{ind.competition_level.replace('_', ' ')}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-card-900 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', ind.opportunity_score >= 80 ? 'bg-success-500' : ind.opportunity_score >= 50 ? 'bg-warning-500' : 'bg-error-500')}
                      style={{ width: `${ind.opportunity_score}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-500 font-medium">{ind.opportunity_score}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={priorityTone[ind.priority]}>{ind.priority}</Badge>
              </td>
              <td className="px-4 py-3">
                {ind.recommended ? (
                  <Badge tone="brand" dot>Recommended</Badge>
                ) : (
                  <span className="text-xs text-ink-500">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
