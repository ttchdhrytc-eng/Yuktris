import { ConfidenceBadge } from './ConfidenceBadge';
import { cn } from '@/lib/utils';
import type { ICPBuyingTrigger, Priority } from '@/types/icp-intelligence';

type Props = {
  trigger: ICPBuyingTrigger;
};

const priorityConfig: Record<Priority, { tone: string; label: string }> = {
  low: { tone: 'text-ink-500 bg-gray-500/10 border-gray-500/20', label: 'Low' },
  medium: { tone: 'text-success-400 bg-success-500/10 border-success-500/20', label: 'Medium' },
  high: { tone: 'text-warning-500 bg-warning-500/10 border-warning-500/20', label: 'High' },
  critical: { tone: 'text-error-400 bg-error-500/10 border-error-500/20', label: 'Critical' },
};

export function BuyingTriggerCard({ trigger }: Props) {
  const { tone, label } = priorityConfig[trigger.priority];

  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-4 transition-colors hover:border-gold-500/25">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-500">{trigger.trigger}</h4>
        <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium shrink-0', tone)}>
          {label}
        </span>
      </div>
      {trigger.description && (
        <p className="text-xs text-ink-500 leading-relaxed mb-3">{trigger.description}</p>
      )}
      <ConfidenceBadge score={trigger.confidence} label="confidence" />
    </div>
  );
}
