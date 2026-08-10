import { useState } from 'react';
import { Plug, Link2, Search, CheckCircle2 } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'crm', label: 'CRM' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'communication', label: 'Communication' },
  { id: 'finance', label: 'Finance' },
  { id: 'storage', label: 'Storage' },
  { id: 'database', label: 'Databases' },
  { id: 'automation', label: 'Automation' },
  { id: 'ai_provider', label: 'AI Providers' },
] as const;

export function AvailableIntegrationsSection({ id, onConnect }: {
  id: IntegrationDashboard;
  onConnect: (providerKey: string) => void;
}) {
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');

  const connectedKeys = new Set(
    id.connections
      .filter((c) => (c as Record<string, unknown>).connection_status === 'connected')
      .map((c) => (c as Record<string, unknown>).provider_key as string)
  );

  const filtered = id.providers.filter((p) => {
    const provider = p as Record<string, unknown>;
    if (category !== 'all' && provider.provider_category !== category) return false;
    if (query) {
      const name = (provider.provider_name as string ?? '').toLowerCase();
      const key = (provider.provider_key as string ?? '').toLowerCase();
      return name.includes(query.toLowerCase()) || key.includes(query.toLowerCase());
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-lg border border-gold-500/12 bg-card-900 px-3 py-2 w-full sm:max-w-xs">
          <Search className="h-4 w-4 text-ink-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search integrations..."
            className="w-full bg-transparent text-sm text-ink-200 placeholder:text-ink-400 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                category === c.id
                  ? 'bg-gradient-to-r from-gold-400 to-gold-300 text-maroon-950'
                  : 'text-ink-500 hover:bg-card-800 hover:text-ink-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-sm text-ink-500">No integrations found.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p) => {
            const provider = p as Record<string, unknown>;
            const isConnected = connectedKeys.has(provider.provider_key as string);
            return (
              <Card key={provider.id as string} className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-300/10 border border-brand-300/20">
                      <Plug className="h-4 w-4 text-brand-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-ink-50">{provider.provider_name as string}</p>
                      <p className="text-xs text-ink-500 capitalize">{(provider.provider_category as string ?? '').replace('_', ' ')}</p>
                    </div>
                  </div>
                  {provider.is_popular && <Badge tone="brand">Popular</Badge>}
                </div>
                <p className="text-xs text-ink-500 leading-relaxed">
                  {(provider.auth_type as string ?? 'api_key') === 'oauth' ? 'OAuth authentication' : 'API key authentication'}
                </p>
                {isConnected ? (
                  <div className="flex items-center gap-2 text-xs font-medium text-success-500">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Connected
                  </div>
                ) : (
                  <button
                    onClick={() => onConnect(provider.provider_key as string)}
                    className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-3 py-1.5 text-xs font-medium text-maroon-950 hover:bg-brand-300/20 transition-colors"
                  >
                    <Link2 className="h-3 w-3" />Connect
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
