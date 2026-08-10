import { Signal } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { IntentSignal, SignalPriority } from '@/types/buying-intent';

type Props = {
  signals: IntentSignal[];
};

const priorityTones: Record<SignalPriority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

const typeIcons: Record<string, string> = {
  hiring: 'Hiring',
  funding: 'Funding',
  expansion: 'Expansion',
  technology: 'Technology',
  website: 'Website',
  leadership: 'Leadership',
  product: 'Product',
  partnership: 'Partnership',
  acquisition: 'Acquisition',
  revenue: 'Revenue',
  employee_growth: 'Employee Growth',
  market: 'Market',
  digital: 'Digital',
  competitive: 'Competitive',
  security: 'Security',
  infrastructure: 'Infrastructure',
};

export function SignalTable({ signals }: Props) {
  if (!signals || signals.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-xs text-ink-500">No signals detected.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Signal className="h-4 w-4 text-brand-400" />
          <CardTitle>Intent Signals</CardTitle>
          <Badge tone="brand">{signals.length}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gold-500/8">
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-4">Signal</th>
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-4">Type</th>
                <th className="text-left text-xs font-medium text-ink-500 pb-2 pr-4">Value</th>
                <th className="text-right text-xs font-medium text-ink-500 pb-2 pr-4">Weight</th>
                <th className="text-right text-xs font-medium text-ink-500 pb-2 pr-4">Confidence</th>
                <th className="text-right text-xs font-medium text-ink-500 pb-2">Priority</th>
              </tr>
            </thead>
            <tbody>
              {signals.map((s) => (
                <tr key={s.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-900/50 transition-colors">
                  <td className="py-2.5 pr-4">
                    <span className="text-sm text-ink-500 font-medium">{s.signal_name}</span>
                  </td>
                  <td className="py-2.5 pr-4">
                    <Badge tone="neutral">{typeIcons[s.signal_type] ?? s.signal_type}</Badge>
                  </td>
                  <td className="py-2.5 pr-4 max-w-xs">
                    <span className="text-xs text-ink-500 truncate block">{s.signal_value ?? 'N/A'}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className={cn('text-sm font-semibold', s.signal_weight >= 80 ? 'text-success-400' : s.signal_weight >= 60 ? 'text-warning-500' : 'text-ink-500')}>
                      {s.signal_weight}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-right">
                    <span className={cn('text-sm font-semibold', s.confidence >= 85 ? 'text-success-400' : s.confidence >= 70 ? 'text-warning-500' : 'text-ink-500')}>
                      {s.confidence}%
                    </span>
                  </td>
                  <td className="py-2.5 text-right">
                    <Badge tone={priorityTones[s.priority]} dot>{s.priority}</Badge>
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
