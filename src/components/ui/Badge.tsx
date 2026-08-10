import { type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'success' | 'warning' | 'error' | 'brand' | 'neutral' | 'violet' | 'neon';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  dot?: boolean;
  size?: 'sm' | 'md';
};

const tones: Record<Tone, string> = {
  default: 'bg-wine-800/40 text-ink-300 border-gold-500/10',
  success: 'bg-success-500/10 text-success-500 border-success-500/20',
  warning: 'bg-warning-500/10 text-warning-500 border-warning-500/20',
  error: 'bg-error-500/10 text-error-500 border-error-500/20',
  brand: 'bg-wine-800/50 text-gold-300 border-gold-500/20',
  neutral: 'bg-maroon-800/40 text-ink-500 border-gold-500/8',
  violet: 'bg-gold-500/10 text-gold-400 border-gold-500/20',
  neon: 'bg-neon-500/10 text-neon-400 border-neon-500/25',
};

const dotColors: Record<Tone, string> = {
  default: 'bg-ink-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
  brand: 'bg-gold-400',
  neutral: 'bg-ink-500',
  violet: 'bg-gold-400',
  neon: 'bg-neon-500',
};

export function Badge({ tone = 'default', dot, size = 'md', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border font-medium backdrop-blur-sm',
        'transition-all duration-200',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs',
        tones[tone],
        className
      )}
      {...props}
    >
      {dot && <span className={cn('h-1.5 w-1.5 rounded-full', dotColors[tone])} />}
      {children}
    </span>
  );
}
