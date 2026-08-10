import { Badge } from '@/components/ui/Badge';
import type { ICPPainPoint, Severity, Urgency } from '@/types/icp-intelligence';

type Props = {
  painPoint: ICPPainPoint;
};

const severityTone: Record<Severity, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

const urgencyTone: Record<Urgency, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  immediate: 'error',
};

export function PainPointCard({ painPoint }: Props) {
  return (
    <div className="rounded-xl border border-gold-500/12 bg-maroon-900 p-4 transition-colors hover:border-gold-500/25">
      <div className="flex items-start justify-between mb-2">
        <h4 className="text-sm font-semibold text-ink-500">{painPoint.pain_point}</h4>
        <div className="flex gap-1.5 shrink-0">
          <Badge tone={severityTone[painPoint.severity]}>{painPoint.severity}</Badge>
          <Badge tone={urgencyTone[painPoint.urgency]}>{painPoint.urgency}</Badge>
        </div>
      </div>
      {painPoint.business_impact && (
        <div className="mb-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-ink-500">Business Impact</span>
          <p className="text-xs text-ink-500 leading-relaxed mt-0.5">{painPoint.business_impact}</p>
        </div>
      )}
      {painPoint.recommended_solution && (
        <div className="rounded-lg border border-brand-500/20 bg-gradient-to-r from-gold-400 to-gold-300/5 px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-brand-400">Recommended Solution</span>
          <p className="text-xs text-ink-500 leading-relaxed mt-0.5">{painPoint.recommended_solution}</p>
        </div>
      )}
    </div>
  );
}
