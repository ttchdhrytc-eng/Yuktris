import { Globe, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function MarketplaceSection({ id, onConnect }: { id: IntegrationDashboard; onConnect: (providerKey: string) => void }) {
  if (id.marketplace.length === 0) return <div className="text-center py-12 text-sm text-ink-500">No apps in marketplace.</div>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-ink-500 mb-3">Marketplace is for discovering third-party apps and plugins. To connect a standard provider like LinkedIn or Gmail, use the Available Integrations tab.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {id.marketplace.map((m) => {
        const app = m as Record<string, unknown>;
        return (
          <Card key={app.id as string} className="p-4 space-y-3">
            <div className="flex items-start justify-between"><div className="flex items-center gap-2.5"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-900 border border-gold-500/12"><Globe className="h-4 w-4 text-ink-500" /></div><p className="text-sm font-semibold text-ink-50">{app.app_name as string}</p></div>{app.is_featured && <Badge tone="brand">Featured</Badge>}</div>
            <p className="text-xs text-ink-500 leading-relaxed">{app.app_description as string}</p>
            <button onClick={() => onConnect(app.provider_id as string)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-1.5 text-xs font-medium text-maroon-950 hover:bg-brand-300/20 transition-colors"><Link2 className="h-3 w-3" />Connect</button>
          </Card>
        );
      })}
      </div>
    </div>
  );
}
