import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  tone?: string;
  sub?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
};

export function StatCard({ label, value, icon, tone, sub, trend, className }: StatCardProps) {
  return (
    <div className={cn('kpi-card p-5 hover-lift', className)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-3xl font-bold text-ink-50 tracking-tight tabular-nums">{value}</p>
          <p className="text-sm text-ink-400 mt-1 font-medium">{label}</p>
        </div>
        {icon && (
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400 border border-gold-500/20">
            {icon}
          </span>
        )}
      </div>
      {sub && (
        <p className={cn(
          'text-sm mt-1.5 font-medium',
          trend === 'up' ? 'text-success-500' : trend === 'down' ? 'text-error-500' : 'text-ink-500'
        )}>
          {sub}
        </p>
      )}
    </div>
  );
}
