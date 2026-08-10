import { cn } from '@/lib/utils';

export function Spinner({ className }: { className?: string }) {
  return (
    <div className={cn('relative inline-flex', className)} style={{ width: '1em', height: '1em' }}>
      <svg className="absolute inset-0 animate-spin" viewBox="0 0 24 24" fill="none" style={{ width: '100%', height: '100%' }}>
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="rgb(212 175 55)" strokeWidth="3" />
        <path fill="none" stroke="rgb(242 201 76)" strokeWidth="3" strokeLinecap="round" d="M12 2a10 10 0 0 1 10 10" />
      </svg>
    </div>
  );
}

export function GoldSpinner({ className }: { className?: string }) {
  return <Spinner className={className} />;
}

export function AILoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 animate-fade-in">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-2 border-gold-500/15" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-gold-400 animate-spin" />
        <div className="absolute inset-3 rounded-full bg-neon-500/10 animate-ai-pulse" />
        <div className="h-2 w-2 rounded-full bg-neon-500 glow-neon" />
      </div>
      {label && <p className="text-xs text-ink-400 shimmer-text">{label}</p>}
    </div>
  );
}

export function PageLoader({ label }: { label?: string }) {
  return <AILoader label={label} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}
