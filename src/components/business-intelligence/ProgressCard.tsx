import { cn } from '@/lib/utils';

type Props = {
  percentage: number;
  label?: string;
  className?: string;
};

export function ProgressCard({ percentage, label = 'Completion', className }: Props) {
  const tone = percentage >= 100 ? 'bg-success-500' : percentage > 0 ? 'bg-gradient-to-r from-gold-400 to-gold-300' : 'bg-gray-600';

  return (
    <div className={cn('rounded-xl border border-gold-500/12 bg-maroon-900 p-4', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-ink-500">{label}</span>
        <span className="text-sm font-semibold text-ink-500">{percentage}%</span>
      </div>
      <div className="h-2 rounded-full bg-card-900 overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', tone)}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
