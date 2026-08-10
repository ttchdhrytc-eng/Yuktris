import { cn } from '@/lib/utils';
import { ConfidenceBadge } from './ConfidenceBadge';
import type { TrendAnalysis, ImpactLevel } from '@/types/market-intelligence';

type Props = {
  trend: TrendAnalysis;
};

const impactConfig: Record<ImpactLevel, { tone: string; label: string }> = {
  low: { tone: 'text-ink-500 bg-gray-500/10 border-gray-500/20', label: 'Low Impact' },
  medium: { tone: 'text-success-400 bg-success-500/10 border-success-500/20', label: 'Medium Impact' },
  high: { tone: 'text-warning-500 bg-warning-500/10 border-warning-500/20', label: 'High Impact' },
  transformative: { tone: 'text-brand-400 bg-gradient-to-r from-gold-400 to-gold-300/10 border-brand-500/20', label: 'Transformative' },
};

export function TrendCard({ trend }: Props) {
  const { tone, label } = impactConfig[trend.impact];

  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-4 transition-colors hover:border-gold-500/25">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-500">{trend.trend}</h4>
        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium shrink-0', tone)}>
          {label}
        </span>
      </div>
      {trend.opportunity && (
        <p className="text-xs text-ink-500 leading-relaxed mb-3">{trend.opportunity}</p>
      )}
      <div className="flex items-center justify-between">
        <ConfidenceBadge score={trend.confidence} label="confidence" />
      </div>
    </div>
  );
}
