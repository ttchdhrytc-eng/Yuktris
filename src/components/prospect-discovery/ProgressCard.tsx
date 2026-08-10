import { cn } from '@/lib/utils';
import type { DiscoveryStageInfo } from '@/types/prospect-discovery';

type Props = {
  stages: DiscoveryStageInfo[];
  currentIndex: number;
  className?: string;
};

export function ProgressCard({ stages, currentIndex, className }: Props) {
  const progress = Math.round(((currentIndex + 1) / stages.length) * 100);

  return (
    <div className={cn('rounded-xl border border-gold-500/12 bg-maroon-900 p-5', className)}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-ink-500">Discovery Progress</h3>
        <span className="text-sm font-semibold text-brand-400">{progress}%</span>
      </div>
      <div className="h-2 rounded-full bg-card-900 overflow-hidden mb-4">
        <div className="h-full rounded-full bg-gradient-to-r from-gold-400 to-gold-300 transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>
      <div className="space-y-1.5">
        {stages.map((stage, i) => (
          <div key={stage.stage} className="flex items-center gap-2">
            <div className={cn(
              'h-2 w-2 rounded-full shrink-0 transition-colors',
              i < currentIndex && 'bg-success-500',
              i === currentIndex && 'bg-gradient-to-r from-gold-400 to-gold-300 animate-pulse',
              i > currentIndex && 'bg-gray-700'
            )} />
            <span className={cn('text-xs', i <= currentIndex ? 'text-ink-500' : 'text-ink-500')}>{stage.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
