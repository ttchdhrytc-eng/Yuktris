import { Plug, X } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function InstalledAppsSection({ id, onDisconnect }: { id: IntegrationDashboard; onDisconnect: (connId: string) => void }) {
  if (id.connections.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No connected accounts.</div>;
  return (
    <div className="space-y-2">
      {id.connections.map((c) => {
        const conn = c as Record<string, unknown>;
        return (
          <Card key={conn.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2"><Plug className="h-4 w-4 text-brand-300" /><div><p className="text-sm font-medium text-ink-50">{conn.connection_name as string}</p><p className="text-xs text-ink-500">{conn.connection_status as string}</p></div></div>
              <div className="flex items-center gap-2"><Badge tone={conn.connection_status as string === 'connected' ? 'success' : 'neutral'} dot>{conn.connection_status as string}</Badge><button onClick={() => onDisconnect(conn.id as string)} className="rounded-lg bg-error-500/10 px-2.5 py-1 text-xs text-error-500 hover:bg-error-100"><X className="h-3 w-3" /></button></div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
