import { Crown, Star, Target, Swords, DollarSign, Eye, Copy, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { ConfidenceBadge } from './ConfidenceBadge';
import { cn } from '@/lib/utils';
import type { FullICP, ICPPriority } from '@/types/icp-intelligence';

type Props = {
  icp: FullICP;
  onView?: () => void;
  onDuplicate?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onSetPrimary?: () => void;
};

const priorityConfig: Record<ICPPriority, { label: string; tone: 'brand' | 'success' | 'neutral'; icon: React.ComponentType<{ className?: string }> }> = {
  primary: { label: 'Primary', tone: 'brand', icon: Crown },
  secondary: { label: 'Secondary', tone: 'success', icon: Star },
  tertiary: { label: 'Tertiary', tone: 'neutral', icon: Target },
};

export function ICPCard({ icp, onView, onDuplicate, onEdit, onDelete, onSetPrimary }: Props) {
  const { label, tone, icon: PriorityIcon } = priorityConfig[icp.priority];

  return (
    <Card className="p-5 transition-colors hover:border-gold-500/25">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg',
            icp.priority === 'primary' ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400' : 'bg-card-900 text-ink-500'
          )}>
            <PriorityIcon className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-ink-500">{icp.name}</h3>
            <Badge tone={tone} className="mt-0.5">{label}</Badge>
          </div>
        </div>
        <ConfidenceBadge score={icp.confidence} label="confidence" />
      </div>

      {/* Description */}
      {icp.description && (
        <p className="text-xs text-ink-500 leading-relaxed mb-4 line-clamp-3">{icp.description}</p>
      )}

      {/* Scores */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <ScoreItem icon={Target} label="Opportunity" value={icp.opportunity_score} />
        <ScoreItem icon={Swords} label="Competition" value={icp.competition_score} />
        <ScoreItem icon={DollarSign} label="Revenue" value={icp.revenue_score} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Deal Size</span>
          <p className="text-sm text-ink-500 font-medium mt-0.5">{icp.estimated_deal_size ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-gold-500/8 bg-card-900 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Close Rate</span>
          <p className="text-sm text-ink-500 font-medium mt-0.5">{icp.conversion_rate}%</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1.5 border-t border-gold-500/8 pt-3">
        <ActionButton icon={Eye} label="View" onClick={onView} />
        <ActionButton icon={Copy} label="Duplicate" onClick={onDuplicate} />
        <ActionButton icon={Pencil} label="Edit" onClick={onEdit} />
        <ActionButton icon={Trash2} label="Delete" onClick={onDelete} danger />
        {icp.priority !== 'primary' && (
          <button
            onClick={onSetPrimary}
            className="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/10 transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Set Primary
          </button>
        )}
      </div>
    </Card>
  );
}

function ScoreItem({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number }) {
  const tone = value >= 80 ? 'text-success-400' : value >= 50 ? 'text-warning-500' : 'text-error-400';
  return (
    <div className="rounded-lg border border-gold-500/8 bg-card-900 px-2 py-2 text-center">
      <Icon className={cn('h-3.5 w-3.5 mx-auto mb-1 text-ink-500')} />
      <p className={cn('text-sm font-semibold', tone)}>{value}</p>
      <p className="text-[10px] text-ink-500">{label}</p>
    </div>
  );
}

function ActionButton({ icon: Icon, label, onClick, danger }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg p-1.5 transition-colors',
        danger ? 'text-ink-500 hover:text-error-400 hover:bg-error-500/10' : 'text-ink-500 hover:text-ink-500 hover:bg-card-800'
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
