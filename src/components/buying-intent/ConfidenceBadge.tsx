import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { IntentLevel } from '@/types/buying-intent';

type Props = {
  confidence: number;
  level?: IntentLevel;
  size?: 'sm' | 'md';
};

const levelTones: Record<IntentLevel, string> = {
  very_low: 'text-ink-500 border-gray-500/20 bg-gray-500/10',
  low: 'text-ink-500 border-gray-400/20 bg-gray-400/10',
  medium: 'text-warning-500 border-warning-500/20 bg-warning-500/10',
  high: 'text-success-400 border-success-500/20 bg-success-500/10',
  very_high: 'text-success-400 border-success-500/20 bg-success-500/10',
};

export function ConfidenceBadge({ confidence, level, size = 'sm' }: Props) {
  const tone = confidence >= 85 ? 'text-success-400' : confidence >= 70 ? 'text-warning-500' : 'text-ink-500';
  const label = level ? level.replace('_', ' ') : `${confidence}% confidence`;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium',
        level ? levelTones[level] : 'border-gold-500/12 bg-card-900 text-ink-500',
        size === 'sm' ? 'text-xs' : 'text-sm',
      )}
    >
      <ShieldCheck className={cn('h-3 w-3', tone)} />
      <span className={level ? '' : tone}>{label}</span>
    </span>
  );
}
