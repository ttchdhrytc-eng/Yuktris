import { useState } from 'react';
import {
  BarChart3, CheckCircle2, Plug, Heart, Activity, Code, Globe, Zap,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils';
import {
  useIntegrationDashboard, useDiscoverIntegrations, useConnectProvider,
  useDisconnectProvider, useSyncData, useRetrySync, useMonitorHealth,
  useGenerateAPIKey, useRotateSecrets, useResolveConflict,
} from '@/hooks/useEnterpriseIntegration';
import {
  OverviewSection, ConnectedAccountsSection, AvailableIntegrationsSection,
  MarketplaceSection, SyncJobsSection, WebhooksSection, LogsSection,
  MonitoringSection, SecuritySection, DeveloperPortalSection,
  ErrorsSection, IntegrationEmptyState,
} from '@/components/enterprise-integration';

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart3 },
  { id: 'connected', label: 'Connected Accounts', icon: CheckCircle2 },
  { id: 'available', label: 'Available Integrations', icon: Plug },
  { id: 'health', label: 'Health', icon: Heart },
  { id: 'usage', label: 'Usage', icon: Activity },
  { id: 'developer', label: 'Developer / API', icon: Code },
  { id: 'marketplace', label: 'Marketplace', icon: Globe },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function IntegrationsPage() {
  const { data: id, isLoading } = useIntegrationDashboard();
  const discover = useDiscoverIntegrations();
  const connect = useConnectProvider();
  const disconnect = useDisconnectProvider();
  const sync = useSyncData();
  const retry = useRetrySync();
  const monitor = useMonitorHealth();
  const generateKey = useGenerateAPIKey();
  const rotateSecrets = useRotateSecrets();
  const resolveConflict = useResolveConflict();
  const [tab, setTab] = useState<TabId>('overview');

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Integration Hub" description="Connect your entire tech stack — CRM, marketing, finance, communication, storage, databases, automation, and AI providers." />
        <div className="flex justify-center py-20"><Spinner className="h-8 w-8" /></div>
      </div>
    );
  }

  if (!id || id.providers.length === 0) {
    return (
      <div>
        <PageHeader title="Integration Hub" description="Connect your entire tech stack — CRM, marketing, finance, communication, storage, databases, automation, and AI providers." />
        <Card className="p-6">
          <IntegrationEmptyState onDiscover={() => discover.mutate()} isDiscovering={discover.isPending} />
        </Card>
      </div>
    );
  }

  const handleConnect = (providerKey: string) => {
    connect.mutate({ providerKey, authData: { api_key: 'placeholder', scopes: [] } });
  };

  return (
    <div>
      <PageHeader
        title="Integration Hub"
        description="Connect your entire tech stack — CRM, marketing, finance, communication, storage, databases, automation, and AI providers."
        actions={
          <div className="flex items-center gap-2">
            <button onClick={() => discover.mutate()} disabled={discover.isPending} className="flex items-center gap-2 rounded-lg bg-brand-300/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-300/10 disabled:opacity-50 transition-colors">
              <Zap className="h-3.5 w-3.5" />Discover
            </button>
            <button onClick={() => monitor.mutate()} disabled={monitor.isPending} className="flex items-center gap-2 rounded-lg bg-brand-300/10 px-3 py-2 text-sm font-medium text-brand-300 hover:bg-brand-300/10 disabled:opacity-50 transition-colors">
              <Heart className="h-3.5 w-3.5" />Health Check
            </button>
          </div>
        }
      />

      <Card>
        <div className="border-b border-gold-500/12 px-2">
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-thin">
            {TABS.map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)} className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                tab === t.id
                  ? 'border-brand-600 text-brand-300'
                  : 'border-transparent text-ink-500 hover:text-ink-200'
              )}>
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4">
          {tab === 'overview' && <OverviewSection id={id} onDiscover={() => discover.mutate()} isDiscovering={discover.isPending} onMonitorHealth={() => monitor.mutate()} isMonitoring={monitor.isPending} />}
          {tab === 'connected' && <ConnectedAccountsSection id={id} onDisconnect={(connId) => disconnect.mutate(connId)} />}
          {tab === 'available' && <AvailableIntegrationsSection id={id} onConnect={handleConnect} />}
          {tab === 'health' && <MonitoringSection id={id} />}
          {tab === 'usage' && <SyncJobsSection id={id} onRetry={(jobId) => retry.mutate(jobId)} />}
          {tab === 'developer' && <DeveloperPortalSection id={id} onGenerateKey={(name) => generateKey.mutate(name)} />}
          {tab === 'marketplace' && <MarketplaceSection id={id} onConnect={handleConnect} />}
        </div>
      </Card>
    </div>
  );
}
