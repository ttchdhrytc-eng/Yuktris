import { Webhook } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/hooks/useEnterpriseIntegration';

export function WebhooksSection({ id }: { id: IntegrationDashboard }) {
  if (id.webhooks.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No webhooks configured.</div>;
  return (
    <div className="space-y-2">
      {id.webhooks.map((w) => {
        const webhook = w as Record<string, unknown>;
        return (
          <Card key={webhook.id as string} className="p-3">
            <div className="flex items-start justify-between"><div className="flex items-center gap-2"><Webhook className="h-4 w-4 text-brand-400" /><div><p className="text-sm font-medium text-ink-500">{webhook.webhook_name as string ?? 'Webhook'}</p><p className="text-xs text-ink-500">{timeAgo(webhook.created_at as string)}</p></div></div><Badge tone={webhook.is_active ? 'success' : 'neutral'}>{webhook.is_active ? 'Active' : 'Inactive'}</Badge></div>
          </Card>
        );
      })}
    </div>
  );
}
