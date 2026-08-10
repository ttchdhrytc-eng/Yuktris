import { cn } from '@/lib/utils';

type Props = {
  score: number;
  size?: 'sm' | 'md';
  className?: string;
};

export function ICPMatchBadge({ score, size = 'sm', className }: Props) {
  const tone = score >= 85 ? 'text-success-400 bg-success-500/10 border-success-500/20' : score >= 70 ? 'text-warning-500 bg-warning-500/10 border-warning-500/20' : 'text-error-400 bg-error-500/10 border-error-500/20';

  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-medium', tone, size === 'sm' && 'text-xs', className)}>
      <span className="font-semibold">{score}%</span>
    </div>
  );
}
