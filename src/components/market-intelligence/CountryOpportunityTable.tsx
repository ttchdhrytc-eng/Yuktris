import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { CountryAnalysis, CompetitionLevel } from '@/types/market-intelligence';

type Props = {
  countries: CountryAnalysis[];
};

const compTone: Record<CompetitionLevel, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'success',
  medium: 'warning',
  high: 'error',
  very_high: 'error',
};

export function CountryOpportunityTable({ countries }: Props) {
  if (countries.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No country analysis available.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-500/12 text-left">
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Country</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Market Size</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Language</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Buying Power</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Competition</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Opportunity</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Status</th>
          </tr>
        </thead>
        <tbody>
          {countries.map((c) => (
            <tr key={c.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
              <td className="px-4 py-3">
                <p className="text-sm text-ink-500 font-medium">{c.country}</p>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-ink-500">{c.market_size ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-ink-500">{c.language ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-card-900 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', c.buying_power >= 80 ? 'bg-success-500' : c.buying_power >= 50 ? 'bg-warning-500' : 'bg-error-500')}
                      style={{ width: `${c.buying_power}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-500 font-medium">{c.buying_power}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={compTone[c.competition]}>{c.competition.replace('_', ' ')}</Badge>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-card-900 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', c.opportunity_score >= 80 ? 'bg-success-500' : c.opportunity_score >= 50 ? 'bg-warning-500' : 'bg-error-500')}
                      style={{ width: `${c.opportunity_score}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-500 font-medium">{c.opportunity_score}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                {c.recommended ? (
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
