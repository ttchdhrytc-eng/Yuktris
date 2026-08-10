import { Key, Code } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function DeveloperPortalSection({ id, onGenerateKey }: { id: IntegrationDashboard; onGenerateKey: (name: string) => void }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-ink-500">API Keys</h4>
        <button onClick={() => onGenerateKey('New API Key')} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><Key className="h-3 w-3" />Generate Key</button>
      </div>
      {id.apiKeys.length === 0 ? <p className="text-sm text-ink-500">No API keys generated.</p> : (
        <div className="space-y-2">{id.apiKeys.map((k) => { const key = k as Record<string, unknown>; return (<Card key={key.id as string} className="p-3"><div className="flex items-start justify-between"><div className="flex items-center gap-2"><Code className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{key.key_name as string}</p><p className="text-xs text-ink-500">{key.key_prefix as string}... · {timeAgo(key.created_at as string)}</p></div></div><Badge tone="brand">Active</Badge></div></Card>); })}</div>
      )}
    </div>
  );
}
