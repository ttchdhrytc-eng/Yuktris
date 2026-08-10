import { Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { cn } from '@/lib/utils';
import type { StakeholderSignal } from '@/types/buying-intent';

type Props = {
  signals: StakeholderSignal[];
};

export function StakeholderSignalCard({ signals }: Props) {
  if (!signals || signals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No stakeholder signals available.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-brand-400" />
          <CardTitle>Stakeholder Signals</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {signals.map((s, i) => {
            const metrics = [
              { label: 'Activity', value: s.activity_score },
              { label: 'Engagement', value: s.engagement_score },
              { label: 'Influence', value: s.influence_score },
              { label: 'Buying Readiness', value: s.buying_readiness },
            ];
            return (
              <div key={s.id ?? i} className="rounded-lg border border-gold-500/8 bg-card-900 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-ink-500">
                    Stakeholder {i + 1}
                    {s.contact_id && <span className="text-ink-500 ml-1.5">({s.contact_id})</span>}
                  </span>
                  <span className={cn('text-xs font-semibold', s.buying_readiness >= 80 ? 'text-success-400' : s.buying_readiness >= 60 ? 'text-warning-500' : 'text-ink-500')}>
                    Readiness: {s.buying_readiness}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  {metrics.map((m) => (
                    <div key={m.label}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-ink-500">{m.label}</span>
                        <span className={cn('text-xs font-semibold', m.value >= 80 ? 'text-success-400' : m.value >= 60 ? 'text-warning-500' : 'text-ink-500')}>
                          {m.value}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-maroon-950 overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all duration-700', m.value >= 80 ? 'bg-success-500' : m.value >= 60 ? 'bg-warning-500' : 'bg-gray-500')}
                          style={{ width: `${m.value}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
