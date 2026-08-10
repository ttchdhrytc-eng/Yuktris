import { Activity, Heart } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function MonitoringSection({ id }: { id: IntegrationDashboard }) {
  if (id.health.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No monitoring data.</div>;
  return (
    <div className="space-y-2">
      {id.health.map((h) => {
        const health = h as Record<string, unknown>;
        return (
          <Card key={health.id as string} className="p-3">
            <div className="flex items-start justify-between"><div className="flex items-center gap-2"><Heart className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">Score: {health.health_score as number}</p><p className="text-xs text-ink-500">{timeAgo(health.last_check_at as string)}</p></div></div><Badge tone={health.health_status as string === 'healthy' ? 'success' : health.health_status as string === 'degraded' ? 'warning' : 'error'} dot>{health.health_status as string}</Badge></div>
          </Card>
        );
      })}
    </div>
  );
}
