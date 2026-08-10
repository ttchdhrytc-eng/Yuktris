import { ListOrdered } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { PriorityQueueEntry } from '@/types/buying-intent';

type Props = {
  entries: PriorityQueueEntry[];
};

export function PriorityQueue({ entries }: Props) {
  if (!entries || entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No priority queue data available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-brand-400" />
          <CardTitle>Priority Queue</CardTitle>
          <Badge tone="brand">{entries.length} companies</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold-500/8">
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-3">#</th>
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-3">Company</th>
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-3">Primary Contact</th>
                <th className="text-right text-xs font-medium text-ink-500 pb-2 pr-3">Intent</th>
                <th className="text-right text-xs font-medium text-ink-500 pb-2 pr-3">Opp.</th>
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-3">Timing</th>
                <th className="text-left text-xs font-medium text-ink-500 pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {entries.slice(0, 20).map((e) => (
                <tr key={e.rank} className="border-b border-gold-500/8 last:border-0 hover:bg-card-900/50 transition-colors">
                  <td className="py-2.5 pr-3">
                    <div className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shrink-0',
                      e.rank <= 3 ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' : 'bg-card-900 text-ink-500',
                    )}>
                      {e.rank}
                    </div>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-sm text-ink-500 font-medium">{e.company}</span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-xs text-ink-500">{e.primary_contact}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <span className={cn('text-sm font-semibold', e.intent_score >= 85 ? 'text-success-400' : e.intent_score >= 70 ? 'text-warning-500' : 'text-ink-500')}>
                      {e.intent_score}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right">
                    <span className={cn('text-sm font-semibold', e.opportunity_score >= 85 ? 'text-success-400' : e.opportunity_score >= 70 ? 'text-warning-500' : 'text-ink-500')}>
                      {e.opportunity_score}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3">
                    <span className="text-xs text-ink-500">{e.recommended_timing}</span>
                  </td>
                  <td className="py-2.5">
                    <span className="text-xs text-ink-500">{e.recommended_action}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
