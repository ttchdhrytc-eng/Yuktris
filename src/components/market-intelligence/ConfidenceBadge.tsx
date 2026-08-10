import { cn } from '@/lib/utils';

type Props = {
  score: number;
  label?: string;
  className?: string;
};

export function ConfidenceBadge({ score, label, className }: Props) {
  const tone = score >= 80 ? 'text-success-400 bg-success-500/10 border-success-500/20' : score >= 50 ? 'text-warning-500 bg-warning-500/10 border-warning-500/20' : 'text-error-400 bg-error-500/10 border-error-500/20';

  return (
    <div className={cn('inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium', tone, className)}>
      <span className="font-semibold">{score}%</span>
      {label && <span className="text-ink-500">{label}</span>}
    </div>
  );
}
