import { FileText } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function LogsSection({ id }: { id: IntegrationDashboard }) {
  if (id.logs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No logs.</div>;
  return (
    <div className="space-y-2">
      {id.logs.map((l, i) => {
        const log = l as Record<string, unknown>;
        return (
          <Card key={i} className="p-3">
            <div className="flex items-start gap-2"><FileText className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{log.event_name as string}</p><p className="text-xs text-ink-500">{log.event_description as string ?? ''} · {timeAgo(log.created_at as string)}</p></div></div>
          </Card>
        );
      })}
    </div>
  );
}
