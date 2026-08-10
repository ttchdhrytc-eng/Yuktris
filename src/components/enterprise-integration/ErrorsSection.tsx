import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function ErrorsSection({ id }: { id: IntegrationDashboard }) {
  if (id.errors.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No errors.</div>;
  return (
    <div className="space-y-2">
      {id.errors.map((e) => {
        const err = e as Record<string, unknown>;
        return (
          <Card key={err.id as string} className="p-3">
            <div className="flex items-start gap-2"><AlertTriangle className="h-4 w-4 text-error-400 shrink-0 mt-0.5" /><div><p className="text-sm text-ink-500">{err.error_message as string}</p><p className="text-xs text-ink-500">{err.error_type as string} · {timeAgo(err.created_at as string)}</p></div></div>
          </Card>
        );
      })}
    </div>
  );
}
