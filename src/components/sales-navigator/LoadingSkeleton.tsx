import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  lines?: number;
};

export function LoadingSkeleton({ className, lines = 3 }: Props) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-card-900 animate-pulse" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-5">
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4">
            <div className="h-4 w-32 rounded bg-card-900 animate-pulse" />
            <div className="h-4 w-20 rounded bg-card-900 animate-pulse" />
            <div className="h-4 flex-1 rounded bg-card-900 animate-pulse" />
            <div className="h-6 w-16 rounded-full bg-card-900 animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  );
}
