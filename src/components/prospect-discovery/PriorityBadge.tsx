import { cn } from '@/lib/utils';
import type { Priority } from '@/types/prospect-discovery';

type Props = {
  priority: Priority;
  className?: string;
};

const config: Record<Priority, { tone: string; label: string }> = {
  low: { tone: 'text-ink-500 bg-gray-500/10 border-gray-500/20', label: 'Low' },
  medium: { tone: 'text-success-400 bg-success-500/10 border-success-500/20', label: 'Medium' },
  high: { tone: 'text-warning-500 bg-warning-500/10 border-warning-500/20', label: 'High' },
  critical: { tone: 'text-error-400 bg-error-500/10 border-error-500/20', label: 'Critical' },
};

export function PriorityBadge({ priority, className }: Props) {
  const { tone, label } = config[priority];
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', tone, className)}>
      {label}
    </span>
  );
}
