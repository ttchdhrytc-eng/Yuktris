import { Badge } from '@/components/ui/Badge';
import { cn } from '@/lib/utils';
import type { ICPDecisionMaker, Priority } from '@/types/icp-intelligence';

type Props = {
  decisionMakers: ICPDecisionMaker[];
};

const priorityTone: Record<Priority, 'success' | 'warning' | 'error' | 'neutral'> = {
  low: 'neutral',
  medium: 'success',
  high: 'warning',
  critical: 'error',
};

export function DecisionMakerTable({ decisionMakers }: Props) {
  if (decisionMakers.length === 0) {
    return <p className="text-xs text-ink-500 text-center py-8">No decision makers identified.</p>;
  }

  return (
    <div className="overflow-x-auto scrollbar-thin">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gold-500/12 text-left">
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Department</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Job Title</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Seniority</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Responsibilities</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Authority</th>
            <th className="px-4 py-3 text-xs font-medium text-ink-500">Priority</th>
          </tr>
        </thead>
        <tbody>
          {decisionMakers.map((dm) => (
            <tr key={dm.id} className="border-b border-gold-500/8 last:border-0 hover:bg-card-800 transition-colors">
              <td className="px-4 py-3">
                <span className="text-sm text-ink-500 font-medium">{dm.department ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-sm text-ink-500">{dm.job_title ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-ink-500">{dm.seniority ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <span className="text-xs text-ink-500 max-w-xs block line-clamp-2">{dm.responsibilities ?? '—'}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-16 rounded-full bg-card-900 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', dm.authority_score >= 80 ? 'bg-success-500' : dm.authority_score >= 50 ? 'bg-warning-500' : 'bg-error-500')}
                      style={{ width: `${dm.authority_score}%` }}
                    />
                  </div>
                  <span className="text-xs text-ink-500 font-medium">{dm.authority_score}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <Badge tone={priorityTone[dm.priority]}>{dm.priority}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
