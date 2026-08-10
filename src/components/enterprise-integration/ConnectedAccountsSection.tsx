import { Plug, X, RefreshCw, Settings, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function ConnectedAccountsSection({ id, onDisconnect, onTestConnection }: {
  id: IntegrationDashboard;
  onDisconnect: (connId: string) => void;
  onTestConnection?: (connId: string) => void;
}) {
  if (id.connections.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-card-900 border border-gold-500/12">
          <Plug className="h-6 w-6 text-ink-400" />
        </div>
        <p className="text-sm font-medium text-ink-200">No connected accounts</p>
        <p className="text-xs text-ink-500">Connect an integration from the Available Integrations tab.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {id.connections.map((c) => {
        const conn = c as Record<string, unknown>;
        const status = conn.connection_status as string;
        const isConnected = status === 'connected';
        return (
          <Card key={conn.id as string} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-300/10 border border-brand-300/20">
                  <Plug className="h-5 w-5 text-brand-300" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-ink-50">{conn.connection_name as string}</p>
                  <div className="flex items-center gap-2">
                    {isConnected ? (
                      <span className="flex items-center gap-1 text-xs text-success-500">
                        <CheckCircle2 className="h-3 w-3" />Connected
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-warning-500">
                        <AlertTriangle className="h-3 w-3" />{status}
                      </span>
                    )}
                    {conn.last_sync_at && (
                      <span className="text-xs text-ink-500">
                        Last synced {new Date(conn.last_sync_at as string).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onTestConnection && (
                  <button
                    onClick={() => onTestConnection(conn.id as string)}
                    className="flex items-center gap-1.5 rounded-lg border border-gold-500/12 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-card-800 transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />Test
                  </button>
                )}
                <button
                  onClick={() => onDisconnect(conn.id as string)}
                  className="flex items-center gap-1.5 rounded-lg border border-gold-500/12 px-2.5 py-1.5 text-xs font-medium text-ink-200 hover:bg-card-800 transition-colors"
                >
                  <Settings className="h-3 w-3" />Manage
                </button>
                <button
                  onClick={() => onDisconnect(conn.id as string)}
                  className="flex items-center gap-1.5 rounded-lg bg-error-500/10 px-2.5 py-1.5 text-xs font-medium text-error-500 hover:bg-error-100 transition-colors"
                >
                  <X className="h-3 w-3" />Disconnect
                </button>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
