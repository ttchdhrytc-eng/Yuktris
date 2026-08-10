import {
  Plug, Zap, Activity, CheckCircle2, XCircle, AlertTriangle, RefreshCw,
  Globe, Shield, Code, Brain, TrendingUp, Clock, FileText, BarChart3,
  Sparkles, Heart, ExternalLink, Settings, Download, Key, Webhook,
} from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, timeAgo } from '@/lib/utils';
import type { IntegrationDashboard } from '@/types/enterprise-integration';

const CATEGORY_ICONS: Record<string, typeof Plug> = {
  crm: Plug, marketing: Zap, communication: Globe, finance: BarChart3,
  calendar: Clock, meetings: Globe, storage: Download, database: Code,
  automation: RefreshCw, ai_provider: Brain, documents: FileText, custom: Plug,
};

export function IntegrationKPICard({ icon: Icon, label, value, sublabel }: { icon: typeof Plug; label: string; value: string | number; sublabel?: string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-1"><Icon className="h-4 w-4 text-brand-400" /><span className="text-xs text-ink-500">{label}</span></div>
      <p className="text-2xl font-bold text-ink-500">{value}</p>
      {sublabel && <p className="text-xs text-ink-500 mt-0.5">{sublabel}</p>}
    </Card>
  );
}

export function OverviewSection({ id, onDiscover, isDiscovering, onMonitorHealth, isMonitoring }: { id: IntegrationDashboard; onDiscover: () => void; isDiscovering: boolean; onMonitorHealth: () => void; isMonitoring: boolean }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <IntegrationKPICard icon={Plug} label="Connections" value={id.totalConnections} sublabel={`${id.activeConnections} active`} />
        <IntegrationKPICard icon={Activity} label="Sync Jobs" value={id.totalSyncJobs} sublabel={`${id.pendingSyncJobs} pending`} />
        <IntegrationKPICard icon={AlertTriangle} label="Errors" value={id.totalErrors} sublabel={`${id.unresolvedErrors} unresolved`} />
        <IntegrationKPICard icon={Heart} label="Avg Health" value={`${id.avgHealthScore.toFixed(0)}`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <IntegrationKPICard icon={Webhook} label="Webhooks" value={id.totalWebhooks} />
        <IntegrationKPICard icon={Download} label="Installed Apps" value={id.totalInstalls} />
        <IntegrationKPICard icon={BarChart3} label="API Calls" value={id.totalApiCalls.toLocaleString()} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={onDiscover} disabled={isDiscovering} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50"><Zap className="h-3.5 w-3.5" />{isDiscovering ? 'Discovering...' : 'Discover Integrations'}</button>
        <button onClick={onMonitorHealth} disabled={isMonitoring} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-4 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20 disabled:opacity-50"><Heart className="h-3.5 w-3.5" />{isMonitoring ? 'Monitoring...' : 'Monitor Health'}</button>
      </div>
    </div>
  );
}

export function InstalledAppsSection({ id, onDisconnect }: { id: IntegrationDashboard; onDisconnect?: (connId: string) => void }) {
  if (id.connections.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No integrations installed. Browse the marketplace to connect.</div>;
  const statusTone = { connected: 'success', connecting: 'brand', disconnected: 'neutral', error: 'error', expired: 'warning', revoked: 'error', paused: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {id.connections.map((c) => {
        const conn = c as Record<string, unknown>;
        const provider = id.providers.find((p) => (p as Record<string, unknown>).id === conn.provider_id) as Record<string, unknown> | undefined;
        const health = id.health.find((h) => (h as Record<string, unknown>).connection_id === conn.id) as Record<string, unknown> | undefined;
        return (
          <Card key={conn.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10"><Plug className="h-4 w-4 text-brand-400" /></div>
                <div>
                  <p className="text-sm font-medium text-ink-500">{conn.connection_name as string}</p>
                  <p className="text-xs text-ink-500">{provider?.provider_name as string} · {conn.auth_type as string}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {health && <Badge tone="brand"><Heart className="h-3 w-3 mr-1" />{(health.health_score as number).toFixed(0)}</Badge>}
                <Badge tone={(statusTone[conn.connection_status as string] ?? 'neutral') as never} dot>{conn.connection_status as string}</Badge>
                {conn.connection_status === 'connected' && onDisconnect && <button onClick={() => onDisconnect(conn.id as string)} className="rounded-lg bg-error-500/10 px-2.5 py-1 text-xs text-error-400 hover:bg-error-500/20">Disconnect</button>}
              </div>
            </div>
            {conn.last_synced_at && <p className="text-xs text-ink-500 mt-1">Last synced {timeAgo(conn.last_synced_at as string)}</p>}
          </Card>
        );
      })}
    </div>
  );
}

export function MarketplaceSection({ id, onConnect }: { id: IntegrationDashboard; onConnect?: (providerKey: string) => void }) {
  const featured = id.marketplace.filter((m) => (m as Record<string, unknown>).is_featured);
  const rest = id.marketplace.filter((m) => !(m as Record<string, unknown>).is_featured);
  return (
    <div className="space-y-4">
      {featured.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Featured</span></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((m) => { const app = m as Record<string, unknown>; const Icon = CATEGORY_ICONS[app.app_category as string] ?? Plug; return <MarketplaceCard key={app.id as string} app={app} Icon={Icon} onConnect={onConnect} />; })}
          </div>
        </div>
      )}
      <div>
        <span className="text-sm font-medium text-ink-500 block mb-2">All Apps</span>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rest.map((m) => { const app = m as Record<string, unknown>; const Icon = CATEGORY_ICONS[app.app_category as string] ?? Plug; return <MarketplaceCard key={app.id as string} app={app} Icon={Icon} onConnect={onConnect} />; })}
        </div>
      </div>
    </div>
  );
}

function MarketplaceCard({ app, Icon, onConnect }: { app: Record<string, unknown>; Icon: typeof Plug; onConnect?: (key: string) => void }) {
  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/10"><Icon className="h-5 w-5 text-brand-400" /></div>
          <div>
            <p className="text-sm font-semibold text-ink-500">{app.app_name as string}</p>
            <p className="text-xs text-ink-500 capitalize">{app.app_category as string}</p>
          </div>
        </div>
        {app.is_verified && <Badge tone="success"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>}
      </div>
      {app.app_description && <p className="text-xs text-ink-500 leading-relaxed line-clamp-2">{app.app_description as string}</p>}
      <div className="flex items-center gap-2 text-xs">
        <Badge tone="brand">{app.pricing_type as string}</Badge>
        <span className="text-ink-500">{app.setup_difficulty as string} setup</span>
      </div>
      <button onClick={() => onConnect?.((app as Record<string, string>).provider_id)} className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20">
        <Plug className="h-3.5 w-3.5" />Connect
      </button>
    </Card>
  );
}

export function CategorySection({ id, category, onConnect }: { id: IntegrationDashboard; category: string; onConnect?: (key: string) => void }) {
  const providers = id.providers.filter((p) => (p as Record<string, unknown>).provider_category === category);
  if (providers.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No {category} integrations available.</div>;
  const Icon = CATEGORY_ICONS[category] ?? Plug;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {providers.map((p) => {
        const provider = p as Record<string, unknown>;
        const conn = id.connections.find((c) => (c as Record<string, unknown>).provider_id === provider.id);
        return (
          <Card key={provider.id as string} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-r from-gold-400 to-gold-300/10"><Icon className="h-5 w-5 text-brand-400" /></div>
                <div>
                  <p className="text-sm font-semibold text-ink-500">{provider.provider_name as string}</p>
                  <p className="text-xs text-ink-500">{provider.auth_type as string}</p>
                </div>
              </div>
              {conn ? <Badge tone="success" dot>Connected</Badge> : provider.is_popular ? <Badge tone="brand">Popular</Badge> : null}
            </div>
            {provider.provider_description && <p className="text-xs text-ink-500 line-clamp-2">{provider.provider_description as string}</p>}
            {!conn && <button onClick={() => onConnect?.(provider.provider_key as string)} className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-2 text-sm font-medium text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20"><Plug className="h-3.5 w-3.5" />Connect</button>}
          </Card>
        );
      })}
    </div>
  );
}

export function SyncJobsSection({ id, onRetry }: { id: IntegrationDashboard; onRetry?: (jobId: string) => void }) {
  if (id.syncJobs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No sync jobs yet.</div>;
  const statusTone = { pending: 'neutral', running: 'brand', completed: 'success', failed: 'error', cancelled: 'neutral', retrying: 'warning', dead_letter: 'error' } as const;
  return (
    <div className="space-y-2">
      {id.syncJobs.map((s) => {
        const job = s as Record<string, unknown>;
        return (
          <Card key={job.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <RefreshCw className={cn('h-4 w-4 text-brand-400', job.status === 'running' && 'animate-spin')} />
                <div>
                  <p className="text-sm font-medium text-ink-500">{job.entity_type as string} — {job.sync_type as string}</p>
                  <p className="text-xs text-ink-500">{job.processed_records as number}/{job.total_records as number} records · {timeAgo(job.created_at as string)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={(statusTone[job.status as string] ?? 'neutral') as never} dot>{job.status as string}</Badge>
                {job.status === 'failed' && onRetry && <button onClick={() => onRetry(job.id as string)} className="rounded-lg bg-warning-500/10 px-2.5 py-1 text-xs text-warning-400 hover:bg-warning-500/20">Retry</button>}
              </div>
            </div>
            {job.error_message && <p className="text-xs text-error-400 mt-1">{job.error_message as string}</p>}
          </Card>
        );
      })}
    </div>
  );
}

export function WebhooksSection({ id }: { id: IntegrationDashboard }) {
  if (id.webhooks.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No webhooks configured.</div>;
  return (
    <div className="space-y-2">
      {id.webhooks.map((w) => {
        const webhook = w as Record<string, unknown>;
        return (
          <Card key={webhook.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-brand-400" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{webhook.webhook_name as string}</p>
                  <p className="text-xs text-ink-500">{webhook.subscribed_events as string[]}</p>
                </div>
              </div>
              <Badge tone={webhook.is_active ? 'success' : 'neutral'} dot>{webhook.is_active ? 'Active' : 'Inactive'}</Badge>
            </div>
            <p className="text-xs text-ink-500 mt-1">{webhook.trigger_count as number} triggers · {webhook.failure_count as number} failures</p>
          </Card>
        );
      })}
    </div>
  );
}

export function LogsSection({ id }: { id: IntegrationDashboard }) {
  if (id.logs.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No logs available.</div>;
  const levelTone = { debug: 'neutral', info: 'brand', warn: 'warning', error: 'error', fatal: 'error' } as const;
  return (
    <div className="space-y-1">
      {id.logs.map((l, i) => {
        const log = l as Record<string, unknown>;
        return (
          <div key={i} className="flex items-start gap-2 rounded-lg bg-card-900 p-2">
            <Badge tone={(levelTone[log.log_level as string] ?? 'neutral') as never}>{log.log_level as string}</Badge>
            <span className="text-xs text-ink-500 flex-1">{log.log_message as string}</span>
            <span className="text-xs text-ink-500 shrink-0">{timeAgo(log.created_at as string)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function MonitoringSection({ id }: { id: IntegrationDashboard }) {
  if (id.health.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No monitoring data. Run health check.</div>;
  const statusTone = { healthy: 'success', degraded: 'warning', unhealthy: 'error', critical: 'error', unknown: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {id.health.map((h) => {
        const health = h as Record<string, unknown>;
        const conn = id.connections.find((c) => (c as Record<string, unknown>).id === health.connection_id) as Record<string, unknown> | undefined;
        const score = health.health_score as number;
        const scoreColor = score >= 80 ? 'text-success-400' : score >= 50 ? 'text-warning-400' : 'text-error-400';
        return (
          <Card key={health.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Heart className={cn('h-4 w-4', scoreColor)} />
                <div>
                  <p className="text-sm font-medium text-ink-500">{conn?.connection_name as string ?? 'Unknown'}</p>
                  <p className="text-xs text-ink-500">Latency: {health.latency_ms as number}ms · Error rate: {(health.error_rate as number).toFixed(1)}%</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={cn('text-sm font-bold', scoreColor)}>{score.toFixed(0)}</span>
                <Badge tone={(statusTone[health.health_status as string] ?? 'neutral') as never} dot>{health.health_status as string}</Badge>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

export function SecuritySection({ id, onRotate }: { id: IntegrationDashboard; onRotate?: (connId: string) => void }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2"><Shield className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Security Overview</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <IntegrationKPICard icon={Shield} label="Connections" value={id.totalConnections} />
          <IntegrationKPICard icon={Key} label="API Keys" value="—" />
          <IntegrationKPICard icon={AlertTriangle} label="Errors" value={id.totalErrors} />
          <IntegrationKPICard icon={Heart} label="Avg Health" value={`${id.avgHealthScore.toFixed(0)}`} />
        </div>
      </Card>
      {id.connections.length > 0 && (
        <div className="space-y-2">
          {id.connections.map((c) => {
            const conn = c as Record<string, unknown>;
            return (
              <Card key={conn.id as string} className="p-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-brand-400" /><span className="text-sm text-ink-500">{conn.connection_name as string}</span></div>
                {onRotate && <button onClick={() => onRotate(conn.id as string)} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-300/10 px-3 py-1.5 text-xs text-brand-400 hover:bg-gradient-to-r from-gold-400 to-gold-300/20">Rotate Secrets</button>}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function DeveloperPortalSection({ id, onGenerateKey }: { id: IntegrationDashboard; onGenerateKey?: (name: string) => void }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3"><Code className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">API Platform</span></div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div className="rounded-lg bg-card-900 p-3"><Key className="h-4 w-4 text-brand-400 mb-1" /><p className="text-xs text-ink-500">API Keys</p><p className="text-sm text-ink-500">Generate keys</p></div>
          <div className="rounded-lg bg-card-900 p-3"><Webhook className="h-4 w-4 text-brand-400 mb-1" /><p className="text-xs text-ink-500">Webhooks</p><p className="text-sm text-ink-500">{id.totalWebhooks} active</p></div>
          <div className="rounded-lg bg-card-900 p-3"><FileText className="h-4 w-4 text-brand-400 mb-1" /><p className="text-xs text-ink-500">Documentation</p><p className="text-sm text-ink-500">OpenAPI 3.0</p></div>
        </div>
        {onGenerateKey && <button onClick={() => onGenerateKey('Default API Key')} className="mt-3 flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-4 py-2 text-sm font-medium text-maroon-950 hover:bg-brand-300/15"><Key className="h-3.5 w-3.5" />Generate API Key</button>}
      </Card>
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-2"><Globe className="h-4 w-4 text-brand-400" /><span className="text-sm font-medium text-ink-500">Available Endpoints</span></div>
        <div className="space-y-1">
          {['GET /api/v1/integrations', 'POST /api/v1/integrations/connect', 'POST /api/v1/integrations/sync', 'GET /api/v1/integrations/health', 'POST /api/v1/webhooks/subscribe', 'GET /api/v1/metrics'].map((ep) => (
            <div key={ep} className="flex items-center gap-2 rounded-lg bg-card-900 p-2"><Code className="h-3.5 w-3.5 text-brand-400" /><span className="text-xs text-ink-500 font-mono">{ep}</span></div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export function ErrorsSection({ id }: { id: IntegrationDashboard }) {
  if (id.errors.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No unresolved errors.</div>;
  const typeTone = { auth: 'error', rate_limit: 'warning', network: 'warning', validation: 'brand', server: 'error', timeout: 'warning', permission: 'error', data: 'brand', conflict: 'warning', unknown: 'neutral' } as const;
  return (
    <div className="space-y-2">
      {id.errors.map((e) => {
        const err = e as Record<string, unknown>;
        return (
          <Card key={err.id as string} className="p-3">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-error-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-ink-500">{err.error_message as string}</p>
                  <p className="text-xs text-ink-500 mt-0.5">{err.error_type as string} · {timeAgo(err.created_at as string)}</p>
                </div>
              </div>
              <Badge tone={(typeTone[err.error_type as string] ?? 'neutral') as never}>{err.error_type as string}</Badge>
            </div>
            {err.is_dead_letter && <Badge tone="error">Dead Letter</Badge>}
          </Card>
        );
      })}
    </div>
  );
}

export function GenericListSection({ items, icon: Icon, titleKey, descKey }: { items: Array<Record<string, unknown>>; icon: typeof Plug; titleKey: string; descKey: string }) {
  if (items.length === 0) return <div className="text-center py-8 text-sm text-ink-500">No data available.</div>;
  return (
    <div className="space-y-2">
      {items.slice(0, 20).map((item, i) => (
        <Card key={i} className="p-3 flex items-start gap-2">
          <Icon className="h-4 w-4 text-brand-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-ink-500">{(item[titleKey] as string) ?? 'Item'}</p>
            <p className="text-xs text-ink-500 mt-0.5">{((item[descKey] as string) ?? '').slice(0, 120)}</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function IntegrationEmptyState({ onDiscover, isDiscovering }: { onDiscover: () => void; isDiscovering: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 space-y-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-r from-gold-400 to-gold-300/10 border border-brand-500/20"><Plug className="h-8 w-8 text-brand-400" /></div>
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold text-ink-500">Enterprise Integration Hub</h3>
        <p className="text-sm text-ink-500 max-w-md mx-auto leading-relaxed">Connect your CRM, marketing, communication, finance, storage, database, automation, and AI providers. Browse the marketplace, install apps, and sync data bi-directionally.</p>
      </div>
      <button onClick={onDiscover} disabled={isDiscovering} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-gold-400 to-gold-300 px-6 py-2.5 text-sm font-medium text-maroon-950 hover:bg-brand-300/15 disabled:opacity-50">
        <Zap className="h-4 w-4" />{isDiscovering ? 'Discovering...' : 'Discover Integrations'}
      </button>
    </div>
  );
}
