import { Shield, Key } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function SecuritySection({ id, onRotate }: { id: IntegrationDashboard; onRotate: (connId: string) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-sm font-medium text-ink-500 mb-2">API Keys</h4>
        {id.apiKeys.length === 0 ? <p className="text-sm text-ink-500">No API keys.</p> : (
          <div className="space-y-2">{id.apiKeys.map((k) => { const key = k as Record<string, unknown>; return (<Card key={key.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Key className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{key.key_name as string}</p><p className="text-xs text-ink-500">{key.key_prefix as string}... · {timeAgo(key.created_at as string)}</p></div></div><Badge tone="brand">Active</Badge></div></Card>); })}</div>
        )}
      </div>
      <div>
        <h4 className="text-sm font-medium text-ink-500 mb-2">Credentials</h4>
        {id.connections.length === 0 ? <p className="text-sm text-ink-500">No connections.</p> : (
          <div className="space-y-2">{id.connections.map((c) => { const conn = c as Record<string, unknown>; return (<Card key={conn.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Shield className="h-4 w-4 text-brand-400" /><p className="text-sm font-medium text-ink-500">{conn.connection_name as string}</p></div><button onClick={() => onRotate(conn.id as string)} className="rounded-lg bg-warning-500/10 px-2.5 py-1 text-xs text-warning-400 hover:bg-warning-500/20">Rotate</button></div></Card>); })}</div>
        )}
      </div>
    </div>
  );
}
