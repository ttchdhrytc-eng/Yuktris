import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-20 text-center animate-fade-in-up', className)}>
      {icon && (
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl text-gold-400"
          style={{
            background: 'linear-gradient(145deg, rgba(212, 175, 55, 0.08), rgba(120, 20, 40, 0.08))',
            border: '1px solid rgba(212, 175, 55, 0.2)',
            boxShadow: '0 0 24px -4px rgba(212, 175, 55, 0.12), inset 0 1px 0 0 rgba(255, 255, 255, 0.04)',
          }}
        >
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-ink-50 tracking-tight">{title}</h3>
      {description && <p className="mt-2 text-sm text-ink-400 max-w-md leading-relaxed">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
