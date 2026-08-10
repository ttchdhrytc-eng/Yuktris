import { RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function SyncJobsSection({ id, onRetry }: { id: IntegrationDashboard; onRetry: (jobId: string) => void }) {
  if (id.syncJobs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No sync jobs.</div>;
  return (
    <div className="space-y-2">
      {id.syncJobs.map((j) => {
        const job = j as Record<string, unknown>;
        return (
          <Card key={job.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><RefreshCw className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{job.sync_type as string} · {job.entity_type as string}</p><p className="text-xs text-ink-500">{job.processed_records as number ?? 0} records · {timeAgo(job.created_at as string)}</p></div></div>
              <div className="flex items-center gap-2"><Badge tone={job.status as string === 'completed' ? 'success' : job.status as string === 'failed' ? 'error' : 'brand'} dot>{job.status as string}</Badge>{job.status === 'failed' && <button onClick={() => onRetry(job.id as string)} className="rounded-lg bg-warning-500/10 px-2.5 py-1 text-xs text-warning-400 hover:bg-warning-500/20">Retry</button>}</div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
