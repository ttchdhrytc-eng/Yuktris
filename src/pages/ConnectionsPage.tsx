import { useRef, useState } from 'react';
import { SecureLinkedInAuthModal } from '@/components/linkedin/SecureLinkedInAuthModal';
import { AlertTriangle, Linkedin } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { useAuthInteractions, useCancelExecution, useConnectLinkedIn, useLinkedInAccounts, useLinkedInConnectionAttempt, useLinkedInLoginAccess, useRecoverLinkedInAuthSurface } from '@/hooks/useLinkedInBrowser';


type State = 'Connected' | 'Action required' | 'Not connected';

export function ConnectionsPage() {
  const linkedIn = useLinkedInAccounts();
  const connectLinkedIn = useConnectLinkedIn();
  const [connection, setConnection] = useState<{ accountId: string; queueItemId: string } | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const starting = useRef(false);
  const attempt = useLinkedInConnectionAttempt(connection?.queueItemId ?? null);
  const interactions = useAuthInteractions(connection?.accountId ?? null);
  const recover = useRecoverLinkedInAuthSurface();
  const cancel = useCancelExecution();
  const events = (interactions.data ?? []).filter(event => event.queue_item_id === connection?.queueItemId);
  const progress = events.filter(event => event.interaction_type === 'progress');
  const challenge = events.some(event => event.interaction_type === 'challenge' && event.status === 'pending');
  const identityVerified = progress.some(event => event.step === 'identity_verified' && event.status === 'completed');
  const authRequired = challenge || progress.some(event => event.step === 'auth_required' && event.status === 'completed');
  const access = useLinkedInLoginAccess(connection?.accountId ?? null, connection?.queueItemId ?? null, authRequired);
  const terminal = !!attempt.data && ['completed', 'failed', 'cancelled'].includes(attempt.data.status);
  const error = startError || connectionError(attempt.error || interactions.error || access.error || recover.error || cancel.error)
    || (attempt.data?.status === 'failed' ? attempt.data.error || 'The connection attempt failed.' : null);

  async function startConnection() {
    if (starting.current) return;
    if (connection && !terminal) { setAuthOpen(true); return; }
    starting.current = true;
    setStartError(null);
    recover.reset();
    cancel.reset();
    setConnection(null);
    try {
      // Reuse a workspace-owned account; reconnect must not create a new sender on every click.
      const existing = linkedIn.data?.find(account => account.expected_profile_url) ?? linkedIn.data?.slice(-1)[0];
      const result = await connectLinkedIn.mutateAsync({ existingAccountId: existing?.id, operationId: crypto.randomUUID() });
      setConnection(result);
      setAuthOpen(true);
    } catch (cause) {
      setStartError(connectionError(cause) || 'Unable to start LinkedIn sign-in.');
    } finally { starting.current = false; }
  }
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
        action={liAccount ? undefined : () => void startConnection()}
        busy={linkedIn.isLoading || connectLinkedIn.isPending} />
    </div>}
    {connectLinkedIn.isPending && <Card role="status" className="p-4">Starting your secure LinkedIn connection...</Card>}
    {error && <Card role="alert" className="border-error-500/30 p-4"><p className="text-error-300">{error}</p><p className="mt-2 text-sm text-ink-400">No LinkedIn outreach was sent. Try again after the service recovers; if this continues, contact support with connection attempt {connection?.queueItemId ?? 'not created'}.</p></Card>}
    <SecureLinkedInAuthModal
      open={authOpen && !error && !terminal}
      loginUrl={access.data?.loginUrl ?? null}
      identityVerified={identityVerified}
      securityCheckRequired={challenge}
      repeatedSecurityChecks={progress.some(event => event.step === 'provider_rechallenge')}
      queueItemId={connection?.queueItemId}
      recovering={recover.isPending || progress.slice(-1)[0]?.step === 'recovering_auth_surface'}
      connectionFailed={progress.slice(-1)[0]?.step === 'connection_failed'}
      onRecover={() => { if (connection) recover.mutate(connection); }}
      onCancel={() => {
        if (connection) cancel.mutate(connection.queueItemId, { onSuccess: () => { setAuthOpen(false); setConnection(null); } });
      }}
    />
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

function connectionError(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === 'object' && 'message' in error && typeof error.message === 'string') return error.message;
  return 'Unable to load LinkedIn connection progress. Please refresh and try again.';
}
