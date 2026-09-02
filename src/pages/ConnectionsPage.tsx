import { AlertTriangle, Linkedin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { useConnectLinkedIn, useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';

type State = 'Connected' | 'Action required' | 'Not connected';

export function ConnectionsPage() {
  const linkedIn = useLinkedInAccounts();
  const connectLinkedIn = useConnectLinkedIn();
  const liAccount = linkedIn.data?.find(a => a.connection_state === 'connected' && ['healthy', 'degraded'].includes(a.health_status));
  const liNeedsAction = linkedIn.data?.some(a => a.connection_state === 'requires_action' || a.health_status === 'warning');
  return <div className="space-y-6">
    <PageHeader title="Connections" description="Connect the LinkedIn account Yuktris uses for V1 outreach." />
    {linkedIn.isError ? (
      <Card className="border-error-500/30 p-6">
        <div className="flex items-start gap-3 text-error-300"><AlertTriangle className="mt-0.5 h-5 w-5" /><div><h2 className="font-semibold">LinkedIn status could not be loaded</h2><p className="mt-1 text-sm text-ink-400">Refresh this page. No connection state was changed.</p></div></div>
      </Card>
    ) : <div className="grid gap-4 lg:grid-cols-3">
      <ConnectionCard icon={Linkedin} name="LinkedIn" detail={liAccount?.profile_name ?? liAccount?.account_name}
        state={liAccount ? 'Connected' : liNeedsAction ? 'Action required' : 'Not connected'}
        health={liAccount?.health_status === 'healthy' ? 'Healthy' : liAccount?.health_status === 'degraded' ? 'Connected — degraded' : undefined}
        action={liAccount ? undefined : () => connectLinkedIn.mutate({ operationId: crypto.randomUUID() })}
        busy={linkedIn.isLoading || connectLinkedIn.isPending} />
    </div>}
  </div>;
}

function ConnectionCard({ icon: Icon, name, detail, state, health, action, busy }: { icon: typeof Linkedin; name: string; detail?: string | null; state: State; health?: string; action?: () => void; busy: boolean }) {
  const color = state === 'Connected' ? 'text-success-500' : state === 'Action required' ? 'text-warning-500' : 'text-ink-500';
  return <Card className="p-6">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400"><Icon className="h-5 w-5" /></div>
    <h2 className="mt-5 text-lg font-semibold text-ink-50">{name}</h2>
    <p className={`mt-1 text-sm font-medium ${color}`}>{state}</p>
    {health && <p className="mt-1 text-xs font-medium text-success-400">{health}</p>}
    <p className="mt-2 min-h-5 truncate text-xs text-ink-500">{detail ?? 'No account connected'}</p>
    {action && <Button className="mt-5 w-full" onClick={action} loading={busy}>{state === 'Action required' ? 'Reconnect' : 'Connect'}</Button>}
  </Card>;
}
