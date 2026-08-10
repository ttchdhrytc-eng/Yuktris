import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  score: number;
  label?: string;
};

export function ConfidenceBadge({ score, label = 'Confidence' }: Props) {
  const tone = score >= 85 ? 'text-success-400 bg-success-500/10 border-success-500/20' : score >= 70 ? 'text-warning-500 bg-warning-500/10 border-warning-500/20' : 'text-error-400 bg-error-500/10 border-error-500/20';
  const dotColor = score >= 85 ? 'bg-success-500' : score >= 70 ? 'bg-warning-500' : 'bg-error-500';

  return (
    <div className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-1.5', tone)}>
      <Shield className="h-3.5 w-3.5" />
      <span className="text-xs font-medium">{label}</span>
      <div className={cn('h-1.5 w-1.5 rounded-full', dotColor)} />
      <span className="text-xs font-semibold">{score}%</span>
    </div>
  );
}
