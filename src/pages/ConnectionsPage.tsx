import { Calendar, Linkedin, Mail } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { useConnectGoogle, useGoogleConnection } from '@/hooks/useGoogleAuth';
import { useConnectLinkedIn, useLinkedInAccounts } from '@/hooks/useLinkedInBrowser';
import { GOOGLE_SCOPES } from '@/types/google-auth';

type State = 'Connected' | 'Action required' | 'Not connected';

export function ConnectionsPage() {
  const linkedIn = useLinkedInAccounts();
  const google = useGoogleConnection();
  const connectLinkedIn = useConnectLinkedIn();
  const connectGoogle = useConnectGoogle();
  const liAccount = linkedIn.data?.find(a => a.connection_state === 'connected');
  const liNeedsAction = linkedIn.data?.some(a => a.connection_state === 'requires_action' || a.health_status === 'warning');
  const scopes = new Set(google.data?.token?.scope?.split(' ').filter(Boolean) ?? []);
  const googleReady = google.data?.account?.status === 'connected' && !google.data.needsReconnect;
  const gmail = googleReady && scopes.has(GOOGLE_SCOPES.GMAIL_SEND);
  const calendar = googleReady && (scopes.has(GOOGLE_SCOPES.CALENDAR) || scopes.has(GOOGLE_SCOPES.CALENDAR_EVENTS));

  const googleAction = () => connectGoogle.mutate();
  return <div className="space-y-6">
    <PageHeader title="Connections" description="Connect the accounts Yuktris uses for outreach and meeting booking." />
    <div className="grid gap-4 lg:grid-cols-3">
      <ConnectionCard icon={Linkedin} name="LinkedIn" detail={liAccount?.profile_name ?? liAccount?.account_name}
        state={liAccount ? 'Connected' : liNeedsAction ? 'Action required' : 'Not connected'}
        action={liAccount ? undefined : () => connectLinkedIn.mutate({ operationId: crypto.randomUUID() })}
        busy={linkedIn.isLoading || connectLinkedIn.isPending} />
      <ConnectionCard icon={Mail} name="Gmail" detail={google.data?.account?.email}
        state={gmail ? 'Connected' : googleReady ? 'Action required' : 'Not connected'} action={gmail ? undefined : googleAction} busy={google.isLoading || connectGoogle.isPending} />
      <ConnectionCard icon={Calendar} name="Google Calendar" detail={google.data?.account?.email}
        state={calendar ? 'Connected' : googleReady ? 'Action required' : 'Not connected'} action={calendar ? undefined : googleAction} busy={google.isLoading || connectGoogle.isPending} />
    </div>
    <p className="text-xs text-ink-500">Gmail and Google Calendar use one secure Google authorization. Their connection states are shown separately based on the access granted.</p>
  </div>;
}

function ConnectionCard({ icon: Icon, name, detail, state, action, busy }: { icon: typeof Linkedin; name: string; detail?: string | null; state: State; action?: () => void; busy: boolean }) {
  const color = state === 'Connected' ? 'text-success-500' : state === 'Action required' ? 'text-warning-500' : 'text-ink-500';
  return <Card className="p-6">
    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-500/10 text-gold-400"><Icon className="h-5 w-5" /></div>
    <h2 className="mt-5 text-lg font-semibold text-ink-50">{name}</h2>
    <p className={`mt-1 text-sm font-medium ${color}`}>{state}</p>
    <p className="mt-2 min-h-5 truncate text-xs text-ink-500">{detail ?? 'No account connected'}</p>
    {action && <Button className="mt-5 w-full" onClick={action} loading={busy}>{state === 'Action required' ? 'Reconnect' : 'Connect'}</Button>}
  </Card>;
}
