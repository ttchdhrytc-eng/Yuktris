import { cn } from '@/lib/utils';

type Props = {
  score: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
};

const sizes = {
  sm: 'h-16 w-16 text-lg',
  md: 'h-24 w-24 text-2xl',
  lg: 'h-32 w-32 text-3xl',
};

const strokeSizes = {
  sm: 4,
  md: 6,
  lg: 8,
};

export function OpportunityScore({ score, label = 'Opportunity', size = 'md' }: Props) {
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const tone = score >= 80 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('relative flex items-center justify-center', sizes[size])}>
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#27272a" strokeWidth={strokeSizes[size]} />
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth={strokeSizes[size]}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-700"
          />
        </svg>
        <span className="relative font-semibold text-ink-500">{score}</span>
      </div>
      <span className="text-xs text-ink-500">{label}</span>
    </div>
  );
}
