import { Plug, Link2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function CategorySection({ id, category, onConnect }: { id: IntegrationDashboard; category: string; onConnect: (providerKey: string) => void }) {
  const filtered = id.providers.filter((p) => (p as Record<string, unknown>).provider_category === category);
  if (filtered.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No providers in this category.</div>;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filtered.map((p) => {
        const provider = p as Record<string, unknown>;
        return (
          <Card key={provider.id as string} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-300/10 border border-brand-300/20">
                  <Plug className="h-4 w-4 text-brand-300" />
                </div>
                <p className="text-sm font-semibold text-ink-50">{provider.provider_name as string}</p>
              </div>
              {provider.is_popular && <Badge tone="brand">Popular</Badge>}
            </div>
            <p className="text-xs text-ink-500">{(provider.auth_type as string ?? 'api_key') === 'oauth' ? 'OAuth authentication' : 'API key authentication'}</p>
            <button onClick={() => onConnect(provider.provider_key as string)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-1.5 text-xs font-medium text-maroon-950 hover:bg-brand-300/20 transition-colors"><Link2 className="h-3 w-3" />Connect</button>
          </Card>
        );
      })}
    </div>
  );
}
