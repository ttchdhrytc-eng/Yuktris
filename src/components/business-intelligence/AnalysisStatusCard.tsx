import { CheckCircle2, Clock, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AnalysisStatus } from '@/types/business-intelligence';

type Props = {
  status: AnalysisStatus;
  className?: string;
};

const config: Record<AnalysisStatus, { icon: React.ComponentType<{ className?: string }>; label: string; tone: string }> = {
  queued: { icon: Clock, label: 'Queued', tone: 'text-ink-500 bg-gray-500/10 border-gray-500/20' },
  processing: { icon: Loader2, label: 'Processing', tone: 'text-brand-400 bg-gradient-to-r from-gold-400 to-gold-300/10 border-brand-500/20' },
  completed: { icon: CheckCircle2, label: 'Completed', tone: 'text-success-400 bg-success-500/10 border-success-500/20' },
  failed: { icon: AlertCircle, label: 'Failed', tone: 'text-error-400 bg-error-500/10 border-error-500/20' },
};

export function AnalysisStatusCard({ status, className }: Props) {
  const { icon: Icon, label, tone } = config[status];
  return (
    <div className={cn('inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium', tone, className)}>
      <Icon className={cn('h-3.5 w-3.5', status === 'processing' && 'animate-spin')} />
      {label}
    </div>
  );
}
