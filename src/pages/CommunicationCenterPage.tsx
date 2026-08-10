// ============================================================
// Communication Center — Provider Dashboard Page
// ============================================================

import { useState } from 'react';
import {
  Mail, Linkedin, MessageCircle, MessageSquare, Smartphone,
  Users, Plug, Sparkles, Plus, X, ChevronRight, CheckCircle2,
  AlertCircle, Clock, Activity, RefreshCw, Zap, Webhook,
  TrendingUp, ShieldCheck, Settings as SettingsIcon,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Spinner } from '@/components/ui/Spinner';
import {
  useProviders, useProviderConnections, useProviderHealth,
  useProviderAnalytics, useConnectProvider, useDisconnectProvider,
  useRefreshProvider, useSyncProvider, useTestConnection,
} from '@/hooks/useProviders';
import { cn, timeAgo, formatNumber } from '@/lib/utils';
import type { ProviderKey, CommunicationProviderRecord } from '@/types/communication-providers';

const PROVIDER_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  gmail: Mail, outlook: Mail, linkedin_messaging: Linkedin,
  whatsapp_business: MessageCircle, slack: MessageSquare,
  microsoft_teams: Users, twilio_sms: Smartphone,
  custom: Plug, future: Sparkles,
};

export function CommunicationCenterPage() {
  const { data: providers, isLoading: providersLoading } = useProviders();
  const { data: connections } = useProviderConnections();
  const { data: health } = useProviderHealth();
  const { data: analytics, isLoading: analyticsLoading } = useProviderAnalytics();
  const [selectedConnectionId, setSelectedConnectionId] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'connections' | 'health' | 'capabilities' | 'webhooks' | 'analytics'>('connections');

  return (
    <div>
      <PageHeader
        title="Communication Center"
        description="Manage communication providers, connections, and messaging channels."
        actions={
          <Button size="sm" onClick={() => setShowConnectModal(true)}>
            <Plus className="h-3.5 w-3.5" />
            Connect Provider
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <MetricCard icon={Plug} label="Providers" value={providers ? String(providers.length) : '—'} loading={providersLoading} />
        <MetricCard icon={CheckCircle2} label="Connected" value={connections ? String(connections.filter((c) => c.status === 'connected').length) : '—'} loading={!connections} tone="success" />
        <MetricCard icon={Activity} label="Healthy" value={health ? String(health.healthy) : '—'} loading={!health} tone="success" />
        <MetricCard icon={Zap} label="Messages Sent" value={analytics ? formatNumber(analytics.total_messages_sent) : '—'} loading={analyticsLoading} tone="brand" />
        <MetricCard icon={TrendingUp} label="Success Rate" value={analytics ? `${Math.round(analytics.success_rate * 100)}%` : '—'} loading={analyticsLoading} tone="brand" />
        <MetricCard icon={ShieldCheck} label="Avg Latency" value={analytics?.avg_latency_ms != null ? `${analytics.avg_latency_ms}ms` : '—'} loading={analyticsLoading} />
      </div>

      <div className="flex gap-1 mb-4 border-b border-gold-500/8">
        {(['connections', 'health', 'capabilities', 'webhooks', 'analytics'] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              activeTab === tab ? 'border-brand-500 text-brand-400' : 'border-transparent text-ink-500 hover:text-ink-500')}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'connections' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Plug className="h-4 w-4 text-brand-400" />
                  Provider Connections
                </CardTitle>
                <Badge tone="neutral">{connections?.length ?? 0}</Badge>
              </CardHeader>
              <CardContent className="p-0">
                {!connections || connections.length === 0 ? (
                  <EmptyState icon={<Plug className="h-6 w-6" />} title="No Connections" description="Connect a communication provider to get started." action={<Button size="sm" onClick={() => setShowConnectModal(true)}><Plus className="h-3.5 w-3.5" />Connect Provider</Button>} />
                ) : (
                  <div className="divide-y divide-border-subtle">
                    {connections.map((conn) => {
                      const Icon = PROVIDER_ICONS[conn.provider_key] ?? Plug;
                      return (
                        <div key={conn.id} className="flex items-center gap-4 px-5 py-3 hover:bg-card-800 transition-colors cursor-pointer" onClick={() => setSelectedConnectionId(conn.id)}>
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-card-900 border border-gold-500/12 shrink-0">
                            <Icon className="h-4 w-4 text-ink-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-ink-500">{conn.provider?.provider_name ?? conn.provider_key}</span>
                              {conn.connected_account && <span className="text-xs text-ink-500 truncate">{conn.connected_account}</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-ink-500">{timeAgo(conn.updated_at)}</span>
                              {conn.is_expired && <Badge tone="warning" dot>Expired</Badge>}
                            </div>
                          </div>
                          <Badge tone={conn.status === 'connected' ? 'success' : conn.status === 'error' ? 'error' : 'neutral'} dot>{conn.status}</Badge>
                          <ChevronRight className="h-4 w-4 text-ink-500" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-brand-400" />
                  Health Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {!health ? (
                  <div className="flex justify-center py-4"><Spinner className="h-5 w-5" /></div>
                ) : (
                  <>
                    <HealthRow label="Total" value={String(health.total)} />
                    <HealthRow label="Healthy" value={String(health.healthy)} tone="success" />
                    <HealthRow label="Degraded" value={String(health.degraded)} tone="warning" />
                    <HealthRow label="Expired" value={String(health.expired)} tone="warning" />
                    <HealthRow label="Error" value={String(health.error)} tone="error" />
                    <HealthRow label="Unknown" value={String(health.unknown)} />
                  </>
                )}
              </CardContent>
            </Card>

            {analytics && Object.keys(analytics.provider_distribution).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Plug className="h-4 w-4 text-ink-500" />
                    Provider Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {Object.entries(analytics.provider_distribution).map(([key, count]) => {
                    const Icon = PROVIDER_ICONS[key] ?? Plug;
                    return (
                      <div key={key} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 text-ink-500" />
                          <span className="text-xs text-ink-500 capitalize">{key.replace(/_/g, ' ')}</span>
                        </div>
                        <Badge tone="neutral">{count}</Badge>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === 'health' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-brand-400" />
              Provider Health
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!connections || connections.length === 0 ? (
              <EmptyState icon={<Activity className="h-6 w-6" />} title="No Health Data" description="Connect providers to see health monitoring data." />
            ) : (
              <div className="divide-y divide-border-subtle">
                {connections.map((conn) => {
                  const Icon = PROVIDER_ICONS[conn.provider_key] ?? Plug;
                  const h = conn.latest_health;
                  return (
                    <div key={conn.id} className="flex items-center gap-4 px-5 py-3">
                      <Icon className="h-4 w-4 text-ink-500 shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm text-ink-500">{conn.provider?.provider_name ?? conn.provider_key}</span>
                        {h && <span className="text-xs text-ink-500 ml-2">{h.latency_ms != null ? `${h.latency_ms}ms` : '—'}</span>}
                      </div>
                      {h ? (
                        <Badge tone={h.health_status === 'healthy' ? 'success' : h.health_status === 'degraded' ? 'warning' : h.health_status === 'error' ? 'error' : 'neutral'} dot>
                          {h.health_status}
                        </Badge>
                      ) : (
                        <Badge tone="neutral" dot>unknown</Badge>
                      )}
                      <span className="text-xs text-ink-500">{h ? timeAgo(h.last_checked_at) : 'Never'}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'capabilities' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SettingsIcon className="h-4 w-4 text-brand-400" />
              Capability Matrix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!providers || providers.length === 0 ? (
              <EmptyState icon={<SettingsIcon className="h-6 w-6" />} title="No Providers" description="Provider definitions will appear here." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gold-500/8">
                      <th className="text-left text-xs text-ink-500 font-medium px-5 py-2">Provider</th>
                      <th className="text-left text-xs text-ink-500 font-medium px-3 py-2">Type</th>
                      <th className="text-left text-xs text-ink-500 font-medium px-3 py-2">Auth</th>
                      <th className="text-left text-xs text-ink-500 font-medium px-3 py-2">Capabilities</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {providers.map((provider) => {
                      const Icon = PROVIDER_ICONS[provider.provider_key] ?? Plug;
                      return (
                        <tr key={provider.id} className="hover:bg-card-800 transition-colors">
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <Icon className="h-4 w-4 text-ink-500" />
                              <span className="text-sm text-ink-500">{provider.provider_name}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3"><Badge tone="neutral">{provider.provider_type}</Badge></td>
                          <td className="px-3 py-3"><Badge tone="brand">{provider.auth_type}</Badge></td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1">
                              {provider.capabilities.map((cap) => (
                                <span key={cap} className="text-[10px] text-ink-500 bg-card-900 border border-gold-500/12 rounded px-1.5 py-0.5">{cap.replace(/_/g, ' ')}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'webhooks' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-4 w-4 text-brand-400" />
              Recent Webhooks
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {analytics && analytics.recent_events.length > 0 ? (
              <div className="divide-y divide-border-subtle">
                {analytics.recent_events.filter((e) => e.event_type === 'webhook_received').map((event) => (
                  <div key={event.id} className="flex items-center gap-4 px-5 py-3">
                    <Webhook className="h-4 w-4 text-ink-500 shrink-0" />
                    <div className="flex-1">
                      <span className="text-sm text-ink-500">{event.message ?? 'Webhook event'}</span>
                      <div className="text-xs text-ink-500 mt-0.5">{timeAgo(event.created_at)}</div>
                    </div>
                    <Badge tone={event.event_status === 'success' ? 'success' : 'neutral'} dot>{event.event_status}</Badge>
                  </div>
                ))}
                {analytics.recent_events.filter((e) => e.event_type === 'webhook_received').length === 0 && (
                  <EmptyState icon={<Webhook className="h-6 w-6" />} title="No Webhooks" description="Webhook events will appear here when providers send them." />
                )}
              </div>
            ) : (
              <EmptyState icon={<Webhook className="h-6 w-6" />} title="No Webhooks" description="Webhook events will appear here when providers send them." />
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === 'analytics' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4 text-brand-400" />
                Performance Metrics
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <MetricRow label="Total Connections" value={analytics?.total_connections ?? 0} />
              <MetricRow label="Connected" value={analytics?.connected ?? 0} tone="brand" />
              <MetricRow label="Messages Sent" value={analytics?.total_messages_sent ?? 0} />
              <MetricRow label="Messages Failed" value={analytics?.total_messages_failed ?? 0} />
              <MetricRow label="Retries" value={analytics?.total_retries ?? 0} />
              <MetricRow label="Webhooks Received" value={analytics?.total_webhooks_received ?? 0} />
              <MetricRow label="Webhooks Processed" value={analytics?.total_webhooks_processed ?? 0} />
              <MetricRow label="Success Rate" value={`${Math.round((analytics?.success_rate ?? 0) * 100)}%`} tone="brand" />
              <MetricRow label="Avg Latency" value={analytics?.avg_latency_ms != null ? `${analytics.avg_latency_ms}ms` : '—'} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-ink-500" />
                Recent Events
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {analytics && analytics.recent_events.length > 0 ? (
                <div className="divide-y divide-border-subtle max-h-[400px] overflow-y-auto">
                  {analytics.recent_events.map((event) => (
                    <div key={event.id} className="flex items-center gap-3 px-5 py-2.5">
                      <Clock className="h-3.5 w-3.5 text-ink-500" />
                      <Badge tone="neutral">{event.event_type.replace(/_/g, ' ')}</Badge>
                      <span className="text-xs text-ink-500 truncate flex-1">{event.message}</span>
                      <span className="text-xs text-ink-500 shrink-0">{timeAgo(event.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState icon={<Activity className="h-6 w-6" />} title="No Events" description="Provider events will appear here." />
              )}
            </CardContent>
          </Card>

          {analytics && Object.keys(analytics.status_distribution).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-ink-500" />
                  Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(analytics.status_distribution).map(([status, count]) => (
                  <div key={status} className="flex items-center justify-between">
                    <span className="text-xs text-ink-500 capitalize">{status}</span>
                    <Badge tone={status === 'connected' ? 'success' : 'neutral'}>{count}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {selectedConnectionId && (
        <ConnectionDetailModal connectionId={selectedConnectionId} onClose={() => setSelectedConnectionId(null)} />
      )}

      {showConnectModal && providers && (
        <ConnectProviderModal providers={providers} onClose={() => setShowConnectModal(false)} />
      )}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, loading, tone = 'default' }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  loading?: boolean;
  tone?: 'default' | 'success' | 'warning' | 'error' | 'brand';
}) {
  const toneClasses = { default: 'text-ink-500', success: 'text-success-400', warning: 'text-warning-500', error: 'text-error-400', brand: 'text-brand-400' };
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-ink-500" />
        <span className="text-[10px] text-ink-500 uppercase tracking-wide">{label}</span>
      </div>
      {loading ? <Spinner className="h-4 w-4" /> : <span className={cn('text-lg font-semibold', toneClasses[tone])}>{value}</span>}
    </Card>
  );
}

function HealthRow({ label, value, tone }: { label: string; value: string; tone?: 'success' | 'warning' | 'error' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      {tone ? <Badge tone={tone} dot>{value}</Badge> : <span className="text-xs text-ink-500">{value}</span>}
    </div>
  );
}

function MetricRow({ label, value, tone }: { label: string; value: string | number; tone?: 'brand' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      <span className={cn('text-sm', tone === 'brand' ? 'text-brand-400' : 'text-ink-500')}>{value}</span>
    </div>
  );
}

function ConnectionDetailModal({ connectionId, onClose }: { connectionId: string; onClose: () => void }) {
  const { data: connection } = useProviderConnection(connectionId);
  const disconnectMutation = useDisconnectProvider();
  const refreshMutation = useRefreshProvider();
  const syncMutation = useSyncProvider();
  const testMutation = useTestConnection();

  if (!connection) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-maroon-950 border border-gold-500/12 rounded-xl p-8" onClick={(e) => e.stopPropagation()}>
          <Spinner className="h-6 w-6" />
        </div>
      </div>
    );
  }

  const Icon = PROVIDER_ICONS[connection.provider_key] ?? Plug;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-maroon-950 border border-gold-500/12 rounded-xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-card-900 border border-gold-500/12">
              <Icon className="h-5 w-5 text-ink-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-ink-500">{connection.provider?.provider_name ?? connection.provider_key}</h2>
              <div className="flex items-center gap-2 mt-1">
                <Badge tone={connection.status === 'connected' ? 'success' : 'neutral'} dot>{connection.status}</Badge>
                {connection.is_expired && <Badge tone="warning" dot>Expired</Badge>}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-500"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-3 mb-4">
          <DetailRow label="Connected Account" value={connection.connected_account ?? '—'} />
          <DetailRow label="Token Expires" value={connection.token_expires_at ? new Date(connection.token_expires_at).toLocaleString() : '—'} />
          <DetailRow label="Last Sync" value={connection.last_sync_at ? timeAgo(connection.last_sync_at) : 'Never'} />
          <DetailRow label="Last Health Check" value={connection.last_health_check_at ? timeAgo(connection.last_health_check_at) : 'Never'} />
          <DetailRow label="Health" value={connection.connection_health} />
        </div>

        {connection.capabilities.length > 0 && (
          <div className="mb-4">
            <span className="text-[10px] text-ink-500 uppercase tracking-wide">Capabilities</span>
            <div className="flex flex-wrap gap-1 mt-1.5">
              {connection.capabilities.map((cap) => (
                <span key={cap.capability_key} className={cn('text-[10px] rounded px-1.5 py-0.5 border', cap.is_enabled ? 'bg-gradient-to-r from-gold-400 to-gold-300/10 text-brand-400 border-brand-500/20' : 'bg-card-900 text-ink-500 border-gold-500/12')}>
                  {cap.capability_name}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => testMutation.mutate(connectionId)} loading={testMutation.isPending}>
            <CheckCircle2 className="h-3.5 w-3.5" />
            Test
          </Button>
          <Button size="sm" variant="outline" onClick={() => refreshMutation.mutate(connectionId)} loading={refreshMutation.isPending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
          <Button size="sm" variant="outline" onClick={() => syncMutation.mutate(connectionId)} loading={syncMutation.isPending}>
            <RefreshCw className="h-3.5 w-3.5" />
            Sync
          </Button>
          <Button size="sm" variant="danger" onClick={() => { disconnectMutation.mutate(connectionId); onClose(); }} loading={disconnectMutation.isPending}>
            Disconnect
          </Button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-ink-500">{label}</span>
      <span className="text-xs text-ink-500">{value}</span>
    </div>
  );
}

function ConnectProviderModal({ providers, onClose }: { providers: CommunicationProviderRecord[]; onClose: () => void }) {
  const connectMutation = useConnectProvider();
  const [selectedProvider, setSelectedProvider] = useState<ProviderKey | null>(null);

  const handleConnect = () => {
    if (!selectedProvider) return;
    connectMutation.mutate({ providerKey: selectedProvider });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-maroon-950/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-maroon-950 border border-gold-500/12 rounded-xl shadow-2xl max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-ink-500">Connect Provider</h2>
          <button onClick={onClose} className="text-ink-500 hover:text-ink-500"><X className="h-4 w-4" /></button>
        </div>

        <p className="text-xs text-ink-500 mb-4">Select a communication provider to connect. OAuth providers will redirect you to their authorization page.</p>

        <div className="space-y-2 max-h-[400px] overflow-y-auto mb-4">
          {providers.map((provider) => {
            const Icon = PROVIDER_ICONS[provider.provider_key] ?? Plug;
            const isSelected = selectedProvider === provider.provider_key;
            return (
              <button key={provider.id} onClick={() => setSelectedProvider(provider.provider_key as ProviderKey)}
                className={cn('w-full flex items-center gap-3 rounded-lg border p-3 transition-colors text-left',
                  isSelected ? 'border-brand-500 bg-gradient-to-r from-gold-400 to-gold-300/10' : 'border-gold-500/12 bg-card-900 hover:bg-card-800')}>
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-maroon-900 border border-gold-500/12 shrink-0">
                  <Icon className="h-4 w-4 text-ink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-ink-500">{provider.provider_name}</span>
                  <p className="text-xs text-ink-500 truncate">{provider.description}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge tone="neutral">{provider.provider_type}</Badge>
                  <Badge tone="brand">{provider.auth_type}</Badge>
                </div>
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button onClick={handleConnect} loading={connectMutation.isPending} disabled={!selectedProvider}>
            <Plug className="h-3.5 w-3.5" />
            Connect
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}
