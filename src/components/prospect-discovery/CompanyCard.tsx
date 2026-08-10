import { ExternalLink, Eye, Save, Ban, Microscope } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { ICPMatchBadge } from './ICPMatchBadge';
import { PriorityBadge } from './PriorityBadge';
import { cn } from '@/lib/utils';
import type { CompanyWithScores, CompanyStatus } from '@/types/prospect-discovery';

type Props = {
  company: CompanyWithScores;
  onView?: () => void;
  onSave?: () => void;
  onIgnore?: () => void;
  onResearch?: () => void;
};

const statusConfig: Record<CompanyStatus, { label: string; tone: 'default' | 'success' | 'warning' | 'error' | 'brand' | 'neutral' }> = {
  discovered: { label: 'Discovered', tone: 'default' },
  qualified: { label: 'Qualified', tone: 'success' },
  saved: { label: 'Saved', tone: 'brand' },
  ignored: { label: 'Ignored', tone: 'neutral' },
  researching: { label: 'Researching', tone: 'warning' },
};

export function CompanyCard({ company, onView, onSave, onIgnore, onResearch }: Props) {
  const { label: statusLabel, tone: statusTone } = statusConfig[company.status];

  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-4 transition-colors hover:border-gold-500/25">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-ink-500">{company.company_name}</h4>
          {company.website && (
            <a href={`https://${company.website}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-0.5">
              {company.website}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ICPMatchBadge score={company.icp_match_score} />
          <PriorityBadge priority={company.priority} />
        </div>
      </div>

      {/* Info */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <InfoItem label="Industry" value={company.industry} />
        <InfoItem label="Country" value={company.country} />
        <InfoItem label="Employees" value={company.employee_count} />
        <InfoItem label="Revenue" value={company.annual_revenue} />
      </div>

      {/* Scores */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <ScoreBar label="Opportunity" value={company.opportunity_score} />
        <ScoreBar label="Growth" value={company.growth_score} />
        <ScoreBar label="Overall" value={company.scores?.overall_score ?? 0} />
      </div>

      {/* Status + Actions */}
      <div className="flex items-center justify-between border-t border-gold-500/8 pt-3">
        <Badge tone={statusTone} dot>{statusLabel}</Badge>
        <div className="flex items-center gap-1">
          <ActionButton icon={Eye} label="View" onClick={onView} />
          <ActionButton icon={Save} label="Save" onClick={onSave} />
          <ActionButton icon={Microscope} label="Research" onClick={onResearch} />
          <ActionButton icon={Ban} label="Ignore" onClick={onIgnore} danger />
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">{label}</span>
      <p className="text-xs text-ink-500">{value ?? '—'}</p>
    </div>
  );
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const tone = value >= 80 ? 'bg-success-500' : value >= 50 ? 'bg-warning-500' : 'bg-error-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-ink-500">{label}</span>
        <span className="text-xs font-medium text-ink-500">{value}</span>
      </div>
      <div className="h-1.5 rounded-full bg-card-900 overflow-hidden">
        <div className={cn('h-full rounded-full', tone)} style={{ width: `${value}%` }} />
      </div>
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
